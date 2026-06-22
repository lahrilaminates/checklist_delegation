# Supabase → Google Sheets Sync (via Webhooks + Apps Script)

This document describes how to sync data from Supabase tables to a Google Sheet in real time, using Supabase **Database Webhooks** and a **Google Apps Script Web App**. Only the changed row is written (PATCH-style) — the rest of the sheet is left untouched.

## Architecture

```
Supabase table change (INSERT / UPDATE / DELETE)
        │
        ▼
Supabase Database Webhook (HTTP POST)
        │
        ▼
Google Apps Script Web App (doPost)
        │
        ▼
Google Sheet — only the affected row is written
```

Apps Script runs as the Sheet's owner, so there's no service account, no OAuth flow, and no sharing permissions to manage — just a deployed Web App URL.

This document also includes a **manual "Sync" function** (Step 7) for backfilling rows that already existed in Supabase *before* the webhook was set up. It reuses the exact same upsert logic as the webhook, so re-running it never creates duplicate rows.

## Prerequisites

- A Supabase project with the tables: `checklist`, `delegation`, `maintenance_tasks`, `users`.
- A Google Sheet with one tab per table (tab names matching the table names).
- Owner/edit access to that Google Sheet.

---

## Step 1 — Prepare the Google Sheet

1. Create four tabs, named exactly:
   - `checklist`
   - `delegation`
   - `maintenance_tasks`
   - `users`
2. In **row 1** of each tab, paste the headers below exactly as shown (tab-separated — paste directly into cell A1 and Google Sheets will split it into columns automatically).
3. **Column A holds the primary key** for that table — this is used to find and patch the correct row. Note the primary key column name differs per table:
   - `checklist` → `task_id`
   - `delegation` → `task_id`
   - `maintenance_tasks` → `id`
   - `users` → `id`

**`checklist` tab — row 1:**
```
task_id	department	given_by	name	task_description	enable_reminder	require_attachment	frequency	remark	status	image	admin_done	delay	planned_date	created_at	task_start_date	submission_date	duration	audio_url	admin_approval_date	admin_approved_by	instruction_attachment_url	instruction_attachment_type	enable_sunday
```

**`delegation` tab — row 1:**
```
task_id	created_at	department	name	task_description	frequency	remarks	task_start_date	given_by	image	enable_reminder	require_attachment	status	updated_at	planned_date	submission_date	color_code_for	delay	admin_done	duration	audio_url	admin_approval_date	admin_approved_by	instruction_attachment_url	instruction_attachment_type	enable_sunday
```

**`maintenance_tasks` tab — row 1:**
```
id	created_at	department	given_by	name	task_description	task_start_date	freq	enable_reminders	require_attachment	submission_date	delay	status	remarks	uploaded_image_url	admin_done	buddy	machine_name	part_name	part_area	duration	planned_date	audio_url	admin_approval_date	admin_approved_by
```

**`users` tab — row 1:**
```
id	created_at	user_name	password	email_id	number	user_access	given_by	role	status	department	leave_date	remark	leave_end_date	employee_id	system_access	page_access	profile_image	Designation	reported_by	can_self_assign
```

> ⚠️ Note `Designation` has a capital **D** — this matches the Postgres column name exactly and must be pasted as-is.

---

## Step 2 — Add the Apps Script

1. Open the Google Sheet → **Extensions → Apps Script**.
2. Delete the default boilerplate in `Code.gs`.
3. Paste in the script below.

```javascript
/**
 * Code.gs
 *
 * Receives Supabase Database Webhook POST requests and syncs ONLY the
 * changed row into the matching sheet tab (PATCH-style update, not a
 * full sheet rewrite).
 *
 * SETUP:
 * 1. Paste this into Extensions > Apps Script in your target Spreadsheet.
 * 2. Update TABLE_TO_SHEET below if your tab names differ from table names.
 * 3. Project Settings > Script Properties: add a property WEBHOOK_SECRET
 *    with a long random value (used to verify requests really come from
 *    your Supabase webhook).
 * 4. Deploy > New deployment > type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Copy the Web App URL — you'll put this in Supabase's webhook config.
 * 5. Every sheet tab's row 1 must be headers matching the Supabase
 *    column names exactly, with the primary key in column A
 *    (task_id for checklist/delegation, id for maintenance_tasks/users).
 */

// Map Supabase table name -> Sheet tab name
const TABLE_TO_SHEET = {
  checklist: "checklist",
  delegation: "delegation",
  maintenance_tasks: "maintenance_tasks",
  users: "users",
};

// Primary key column differs per table (checklist/delegation use "task_id",
// maintenance_tasks and users use "id"). Column A of each sheet tab must hold this value.
const TABLE_TO_PK = {
  checklist: "task_id",
  delegation: "task_id",
  maintenance_tasks: "id",
  users: "id",
};

// How many rows to fetch per page from Supabase during a manual Sync.
// Supabase's PostgREST caps a single request at 1000 rows by default,
// so this also doubles as a safe page size.
const SYNC_PAGE_SIZE = 1000;

// Adds a custom "Sync" menu to the Sheet's UI on open.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Sync")
    .addItem("Sync Now (all tables)", "syncAllTables")
    .addItem("Sync checklist only", "syncChecklistOnly")
    .addItem("Sync delegation only", "syncDelegationOnly")
    .addItem("Sync maintenance_tasks only", "syncMaintenanceTasksOnly")
    .addItem("Sync users only", "syncUsersOnly")
    .addToUi();
}

function doPost(e) {
  try {
    const secretProp = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");

    // Secret is passed as a query param (?secret=...) because Apps Script
    // doPost doesn't reliably expose custom HTTP headers.
    if (!secretProp || e.parameter.secret !== secretProp) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const payload = JSON.parse(e.postData.contents);
    const { type, table, record, old_record } = payload;

    const sheetName = TABLE_TO_SHEET[table];
    if (!sheetName) {
      return jsonResponse({ ok: true, skipped: true, reason: "table not configured: " + table });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return jsonResponse({ ok: false, error: "Sheet tab not found: " + sheetName }, 500);
    }

    const headers = getHeaderRow(sheet);
    if (headers.length === 0) {
      return jsonResponse({ ok: false, error: "No header row in tab: " + sheetName }, 500);
    }

    if (type === "INSERT" || type === "UPDATE") {
      upsertRow(sheet, headers, record, table);
    } else if (type === "DELETE") {
      deleteRow(sheet, old_record, table);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

// Optional: allow GET for a quick health check when you open the Web App URL
function doGet(e) {
  return jsonResponse({ ok: true, message: "Webhook endpoint is live" });
}

// ---------- helpers ----------

function getHeaderRow(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

// Finds the row number (1-based, includes header) for a given primary key
// value by scanning column A. Returns -1 if not found.
function findRowByPk(sheet, pkValue) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // column A, skip header
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(pkValue)) {
      return i + 2; // +2: 1-based + header row offset
    }
  }
  return -1;
}

function recordToRowArray(record, headers) {
  return headers.map((h) => {
    const v = record[h];
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v); // jsonb columns
    return v;
  });
}

// INSERT/UPDATE: patch the existing row in place, or append if new.
function upsertRow(sheet, headers, record, table) {
  if (!record) throw new Error("Missing record in payload");
  const pk = TABLE_TO_PK[table];
  const pkValue = record[pk];
  const rowArray = recordToRowArray(record, headers);

  const existingRow = findRowByPk(sheet, pkValue);
  if (existingRow !== -1) {
    // PATCH: only this row's range gets written
    sheet.getRange(existingRow, 1, 1, rowArray.length).setValues([rowArray]);
  } else {
    // New record -> append as a new row at the bottom
    sheet.appendRow(rowArray);
  }
}

// DELETE: clear the row's contents (keeps row positions stable).
// Swap to sheet.deleteRow(existingRow) if you'd rather physically remove it.
function deleteRow(sheet, oldRecord, table) {
  if (!oldRecord) throw new Error("Missing old_record in payload");
  const pk = TABLE_TO_PK[table];
  const pkValue = oldRecord[pk];
  const existingRow = findRowByPk(sheet, pkValue);
  if (existingRow !== -1) {
    sheet.getRange(existingRow, 1, 1, sheet.getLastColumn()).clearContent();
  }
}

function jsonResponse(obj, statusCode) {
  // Apps Script's ContentService doesn't let you set a true HTTP status
  // code on web apps (Anyone access always returns 200 at the transport
  // level), so we encode the real status inside the JSON body too.
  obj._status = statusCode || 200;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- manual sync / backfill (Sync menu) ----------
//
// Pulls existing rows straight from Supabase's REST API (PostgREST) and
// upserts each one using the SAME upsertRow() logic the webhook uses —
// so running this multiple times never creates duplicate rows. Rows
// already present (matched by primary key in column A) are patched in
// place; rows not yet in the sheet are appended.
//
// Requires two Script Properties (Project Settings > Script Properties):
//   SUPABASE_URL      e.g. https://xxxxxxxx.supabase.co
//   SUPABASE_API_KEY  the "anon" or "service_role" key from
//                      Supabase Dashboard > Project Settings > API
// Using the service_role key is recommended here since it bypasses Row
// Level Security — appropriate since this runs only from your own script,
// never exposed to end users. Keep it only in Script Properties, never in code.

function syncAllTables() {
  const tables = Object.keys(TABLE_TO_SHEET);
  let summary = [];
  for (const table of tables) {
    const count = syncTable(table);
    summary.push(table + ": " + count + " row(s) synced");
  }
  SpreadsheetApp.getUi().alert("Sync complete\n\n" + summary.join("\n"));
}

function syncChecklistOnly() {
  const count = syncTable("checklist");
  SpreadsheetApp.getUi().alert("checklist: " + count + " row(s) synced");
}

function syncDelegationOnly() {
  const count = syncTable("delegation");
  SpreadsheetApp.getUi().alert("delegation: " + count + " row(s) synced");
}

function syncMaintenanceTasksOnly() {
  const count = syncTable("maintenance_tasks");
  SpreadsheetApp.getUi().alert("maintenance_tasks: " + count + " row(s) synced");
}

function syncUsersOnly() {
  const count = syncTable("users");
  SpreadsheetApp.getUi().alert("users: " + count + " row(s) synced");
}

// Fetches every row of `table` from Supabase (paginated) and upserts each
// into its matching sheet tab. Returns the number of rows processed.
function syncTable(table) {
  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = props.getProperty("SUPABASE_URL");
  const supabaseKey = props.getProperty("SUPABASE_API_KEY");
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_API_KEY in Script Properties");
  }

  const sheetName = TABLE_TO_SHEET[table];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet tab not found: " + sheetName);

  const headers = getHeaderRow(sheet);
  if (headers.length === 0) throw new Error("No header row in tab: " + sheetName);

  const pk = TABLE_TO_PK[table];
  let offset = 0;
  let totalSynced = 0;

  while (true) {
    const records = fetchSupabasePage(supabaseUrl, supabaseKey, table, pk, offset, SYNC_PAGE_SIZE);
    if (records.length === 0) break;

    for (const record of records) {
      upsertRow(sheet, headers, record, table);
      totalSynced++;
    }

    if (records.length < SYNC_PAGE_SIZE) break; // last page
    offset += SYNC_PAGE_SIZE;
  }

  return totalSynced;
}

// Fetches one page of rows from Supabase's auto-generated REST API.
// Ordered by primary key so pagination is stable across pages.
function fetchSupabasePage(supabaseUrl, supabaseKey, table, pk, offset, limit) {
  const url = supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/" + table +
    "?select=*&order=" + encodeURIComponent(pk) + ".asc" +
    "&offset=" + offset + "&limit=" + limit;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      apikey: supabaseKey,
      Authorization: "Bearer " + supabaseKey,
    },
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  if (statusCode !== 200) {
    throw new Error("Supabase REST error (" + table + "): " + statusCode + " " + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}
```

---

## Step 3 — Add Supabase REST credentials (needed for the Sync button)

The webhook only covers *future* changes. To backfill rows that already exist in Supabase, the Sync button reads them via Supabase's REST API, which needs your project URL and an API key.

1. Supabase Dashboard → **Project Settings → API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxx.supabase.co`).
3. Copy the **`service_role` key** (under "Project API keys"). This key bypasses Row Level Security, which is fine here since it's only ever used inside your own script, never exposed publicly. Treat it like a password.
4. In the Apps Script editor: **Project Settings → Script Properties → Add script property**, and add two entries:
   - Key: `SUPABASE_URL` → Value: your Project URL
   - Key: `SUPABASE_API_KEY` → Value: your `service_role` key

---

## Step 4 — Set the webhook secret

1. In the Apps Script editor: **Project Settings** (gear icon) → **Script Properties** → **Add script property**.
2. Key: `WEBHOOK_SECRET`
3. Value: a long random string. Generate one locally, e.g.:
   ```bash
   openssl rand -hex 32
   ```
4. Save.

This prevents random internet traffic from writing into your sheet — Supabase passes the same value back on every request.

---

## Step 5 — Deploy as a Web App

1. **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Click **Deploy**, then authorize the requested permissions (it needs edit access to the spreadsheet).
6. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> ⚠️ **Important:** every time you edit `Code.gs`, you must go to **Deploy → Manage deployments → Edit (pencil icon) → New version → Deploy**. Saving the script alone does **not** update the live Web App URL.

---

## Step 6 — Create the Supabase Database Webhooks

Supabase webhooks are configured **per table**, so repeat this for `checklist`, `delegation`, `maintenance_tasks`, and `users`.

1. Supabase Dashboard → **Database → Webhooks → Create a new webhook**.
2. **Name:** e.g. `sync-checklist-to-sheets`.
3. **Table:** `checklist`.
4. **Events:** check **Insert**, **Update**, **Delete**.
5. **Type:** HTTP Request.
6. **Method:** POST.
7. **URL:**
   ```
   https://script.google.com/macros/s/AKfycb.../exec?secret=YOUR_WEBHOOK_SECRET
   ```
   Replace with your actual deployed URL and the same secret value from Step 4.
8. **Headers:** leave default (`Content-Type: application/json` is set automatically).
9. Save.

Repeat steps 2–9 for `delegation`, `maintenance_tasks`, and `users`.

---

## Step 7 — Backfill existing data with the Sync menu

This is the one-time (or repeatable) step that brings rows you already had in Supabase *before* the webhook existed into the Sheet — without creating duplicates.

1. **Reload the Google Sheet** (refresh the browser tab). A new **Sync** menu should appear in the menu bar, next to Help.
   - If it doesn't appear, open **Extensions → Apps Script**, run the `onOpen` function once manually (▶ button), then reload the sheet.
2. Click **Sync → Sync Now (all tables)** to backfill all four tables, or use the per-table options if you only need one.
3. The first time you run it, Google will ask you to **authorize** the script's permissions again (since it now calls an external URL) — click through and allow it.
4. A summary popup shows how many rows were synced per table.

**Why this never creates duplicates:** `Sync` calls the exact same `upsertRow()` function the webhook uses. For each record fetched from Supabase, it checks column A for a matching primary key — if found, it **patches that row in place**; if not found, it **appends** a new row. Running Sync repeatedly (e.g. daily, or after a bulk import) is always safe.

**Notes:**
- Large tables are fetched in pages of 1000 rows at a time (`SYNC_PAGE_SIZE`), so this works even for tables with tens of thousands of rows — it'll just take longer. Apps Script has a 6-minute execution limit per run; if a table is large enough to exceed that, let me know and I'll add resumable/batched sync via a time-driven trigger.
- Sync is **read-from-Supabase, write-to-Sheet only** — it never deletes sheet rows for records that no longer exist in Supabase. It also doesn't push Sheet edits back to Supabase (this whole setup is one-directional: Supabase → Sheets).

---

## Step 8 — Test it

1. In Supabase Table Editor, insert a test row into `checklist`.
2. Check the Google Sheet's `checklist` tab — the row should appear within a couple of seconds.
3. Update that same row in Supabase → confirm the **same** sheet row updates in place (no duplicate row).
4. Delete it in Supabase → confirm the sheet row's contents clear.

---

## Step 9 — Debugging

| Where to look | What it shows |
|---|---|
| Apps Script → **Executions** (clock icon, left sidebar) | Every `doPost` call, manual Sync run, logs, and any thrown errors |
| Supabase → **Database → Webhooks → [webhook] → Logs** | The HTTP response Apps Script sent back (status + body) |

**Common issues:**
- Forgetting to create a **new deployment version** after editing the script (see warning in Step 5).
- Header row in the sheet tab not matching Supabase column names exactly (case-sensitive).
- `WEBHOOK_SECRET` mismatch between Script Properties and the webhook URL's `?secret=` param.
- Sync menu missing `SUPABASE_URL` / `SUPABASE_API_KEY` → throws "Missing SUPABASE_URL or SUPABASE_API_KEY" (check Step 3).
- Sync fails with a 401/403 from Supabase → API key wrong, or Row Level Security is blocking the `anon` key (use the `service_role` key instead, as noted in Step 3).

---

## Design notes

- **Why this is PATCH-style, not a full rewrite:** the script reads column A to find the row with a matching `id`, then writes only that row's range via `setValues()`. It never touches unrelated rows.
- **Why the secret is a query param, not a header:** Apps Script Web Apps don't reliably expose custom HTTP headers inside `doPost(e)`, so the query string is the standard, reliable workaround.
- **DELETE behavior:** clears the row's contents but keeps its position, so rows below are not shifted. To physically remove the row instead, replace `clearContent()` with `sheet.deleteRow(existingRow)` in the `deleteRow()` function — note this will shift all rows below up by one.
- **jsonb / object columns:** automatically stringified with `JSON.stringify()` before being written to the cell.
- **Extending to more tables:** add an entry to `TABLE_TO_SHEET` *and* `TABLE_TO_PK`, create the matching sheet tab with headers (PK column in column A), and add a new Supabase webhook for that table.
- **Why two tables use `task_id` and two use `id`:** this mirrors your actual Postgres schema — `checklist` and `delegation` define `task_id` as their primary key, while `maintenance_tasks` and `users` use `id`. The script looks up the correct key name per table via `TABLE_TO_PK` rather than assuming one name everywhere.
- **Why Sync can't create duplicates:** both the webhook (`doPost`) and the manual Sync menu funnel through the same `upsertRow()` function, which always checks column A for an existing primary key before deciding to patch vs. append. There's only one code path for "write a row," so the two entry points can't drift out of sync with each other.