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

## Prerequisites

- A Supabase project with the tables: `checklist`, `delegation`, `maintenance_tasks`.
- A Google Sheet with one tab per table (tab names matching the table names).
- Owner/edit access to that Google Sheet.

---

## Step 1 — Prepare the Google Sheet

1. Create three tabs, named exactly:
   - `checklist`
   - `delegation`
   - `maintenance_tasks`
2. In **row 1** of each tab, paste the headers below exactly as shown (tab-separated — paste directly into cell A1 and Google Sheets will split it into columns automatically).
3. **Column A holds the primary key** for that table — this is used to find and patch the correct row. Note the primary key column name differs per table:
   - `checklist` → `task_id`
   - `delegation` → `task_id`
   - `maintenance_tasks` → `id`

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
 *    (task_id for checklist/delegation, id for maintenance_tasks).
 */

// Map Supabase table name -> Sheet tab name
const TABLE_TO_SHEET = {
  checklist: "checklist",
  delegation: "delegation",
  maintenance_tasks: "maintenance_tasks",
};

// Primary key column differs per table (checklist/delegation use "task_id",
// maintenance_tasks uses "id"). Column A of each sheet tab must hold this value.
const TABLE_TO_PK = {
  checklist: "task_id",
  delegation: "task_id",
  maintenance_tasks: "id",
};

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
```

---

## Step 3 — Set the webhook secret

1. In the Apps Script editor: **Project Settings** (gear icon) → **Script Properties** → **Add script property**.
2. Key: `WEBHOOK_SECRET`
3. Value: a long random string. Generate one locally, e.g.:
   ```bash
   openssl rand -hex 32
   ```
4. Save.

This prevents random internet traffic from writing into your sheet — Supabase passes the same value back on every request.

---

## Step 4 — Deploy as a Web App

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

## Step 5 — Create the Supabase Database Webhooks

Supabase webhooks are configured **per table**, so repeat this for `checklist`, `delegation`, and `maintenance_tasks`.

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
   Replace with your actual deployed URL and the same secret value from Step 3.
8. **Headers:** leave default (`Content-Type: application/json` is set automatically).
9. Save.

Repeat steps 2–9 for `delegation` and `maintenance_tasks`.

---

## Step 6 — Test it

1. In Supabase Table Editor, insert a test row into `checklist`.
2. Check the Google Sheet's `checklist` tab — the row should appear within a couple of seconds.
3. Update that same row in Supabase → confirm the **same** sheet row updates in place (no duplicate row).
4. Delete it in Supabase → confirm the sheet row's contents clear.

---

## Step 7 — Debugging

| Where to look | What it shows |
|---|---|
| Apps Script → **Executions** (clock icon, left sidebar) | Every `doPost` call, logs, and any thrown errors |
| Supabase → **Database → Webhooks → [webhook] → Logs** | The HTTP response Apps Script sent back (status + body) |

**Common issues:**
- Forgetting to create a **new deployment version** after editing the script (see warning in Step 4).
- Header row in the sheet tab not matching Supabase column names exactly (case-sensitive).
- `WEBHOOK_SECRET` mismatch between Script Properties and the webhook URL's `?secret=` param.

---

## Design notes

- **Why this is PATCH-style, not a full rewrite:** the script reads column A to find the row with a matching `id`, then writes only that row's range via `setValues()`. It never touches unrelated rows.
- **Why the secret is a query param, not a header:** Apps Script Web Apps don't reliably expose custom HTTP headers inside `doPost(e)`, so the query string is the standard, reliable workaround.
- **DELETE behavior:** clears the row's contents but keeps its position, so rows below are not shifted. To physically remove the row instead, replace `clearContent()` with `sheet.deleteRow(existingRow)` in the `deleteRow()` function — note this will shift all rows below up by one.
- **jsonb / object columns:** automatically stringified with `JSON.stringify()` before being written to the cell.
- **Extending to more tables:** add an entry to `TABLE_TO_SHEET` *and* `TABLE_TO_PK`, create the matching sheet tab with headers (PK column in column A), and add a new Supabase webhook for that table.
- **Why two tables use `task_id` and one uses `id`:** this mirrors your actual Postgres schema — `checklist` and `delegation` both define `task_id` as their primary key, while `maintenance_tasks` uses `id`. The script looks up the correct key name per table via `TABLE_TO_PK` rather than assuming `id` everywhere.