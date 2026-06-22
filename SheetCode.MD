function allsync()
{
syncChecklist();
syncDelegation();
syncUsers();

}

// Configuration
const SUPABASE_URL = 'https://zpkikvgmmbtekbcuqahf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwa2lrdmdtbWJ0ZWtiY3VxYWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDAyOTgsImV4cCI6MjA4NTY3NjI5OH0.DNoapjLC7cSoaBZVH_cnee4VjQSI-oovvZrCSa5HlV4';
// Use service role for better access - UNCOMMENT THIS LINE AND USE IT INSTEAD OF ANON KEY
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwa2lrdmdtbWJ0ZWtiY3VxYWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEwMDI5OCwiZXhwIjoyMDg1Njc2Mjk4fQ.hxKMwnSQtJCkqB_ICECJKfj1K7_k2PLznW52uUY9w6A';

// Choose which key to use - SERVICE_KEY bypasses RLS
const API_KEY = SUPABASE_SERVICE_KEY; // Change this to SUPABASE_ANON_KEY if you want to use anon key

const SHEET_ID = '18lgxCfDKsnLIGpV9t1-ZK2lhaewTcl8n82R0hsUxspY'; // Replace with your actual Google Sheet ID
const CHECKLIST_SHEET = 'Checklist'; // Replace with your sheet tab name
const DELEGATION_SHEET = 'Delegation'; // New delegation sheet
const USERS_SHEET = "users"

function syncChecklist() {

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CHECKLIST_SHEET);
  sheet.clearContents();

  const headers = [
    "Task ID","Department","Given By","Name","Task Description",
    "Enable Reminder","Require Attachment","Frequency","Remark",
    "Status","Image","Admin Done","Delay",
    "Planned Date","Created At","Task Start Date","Submission Date"
  ];

  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  // Force Task ID column as TEXT
  sheet.getRange("A:A").setNumberFormat("@");

  // Get today's 23:59:59
  const now = new Date();
  const todayEnd = Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

  let allData = [];
  let offset = 0;
  const limit = 1000;

  while (true) {

    const url =
      `${SUPABASE_URL}/rest/v1/checklist` +
      `?select=*` +
      `&task_start_date=lte.${encodeURIComponent(todayEnd)}` +
      `&order=task_id.asc` +
      `&limit=${limit}` +
      `&offset=${offset}`;

    const options = {
      method: "GET",
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();

    if (status !== 200) {
      Logger.log("Error: " + response.getContentText());
      break;
    }

    const data = JSON.parse(response.getContentText());

    if (data.length === 0) break;

    allData = allData.concat(data);

    Logger.log("Fetched rows: " + allData.length);

    if (data.length < limit) break;

    offset += limit;
  }

  if (allData.length === 0) {
    Logger.log("No data found.");
    return;
  }

  const rows = allData.map(item => [
    String(item.task_id),
    item.department || "",
    item.given_by || "",
    item.name || "",
    item.task_description || "",
    item.enable_reminder || "",
    item.require_attachment || "",
    item.frequency || "",
    item.remark || "",
    item.status || "",
    item.image || "",
    item.admin_done || "",
    item.delay || "",
    item.planned_date || "",
    item.created_at || "",
    item.task_start_date || "",
    item.submission_date || ""
  ]);

  sheet.getRange(2,1,rows.length,headers.length).setValues(rows);

  Logger.log("✅ Checklist synced successfully. Total rows: " + rows.length);
}







function syncDelegation() {

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Delegation");
  sheet.clearContents();

  const headers = [
    "Task ID","Created At","Department","Name","Task Description",
    "Frequency","Remarks","Task Start Date","Given By","Image",
    "Enable Reminder","Require Attachment","Status",
    "Updated At","Planned Date","Submission Date",
    "Color Code For","Delay","Admin Done"
  ];

  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  // Force Task ID column as TEXT
  sheet.getRange("A:A").setNumberFormat("@");

  // Get today's end time (23:59:59)
  const now = new Date();
  const todayEnd = Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

  let allData = [];
  let offset = 0;
  const limit = 1000;

  while (true) {

    const url =
      `${SUPABASE_URL}/rest/v1/delegation` +
      `?select=*` +
      `&task_start_date=lte.${encodeURIComponent(todayEnd)}` +
      `&order=task_id.asc` +
      `&limit=${limit}` +
      `&offset=${offset}`;

    const options = {
      method: "GET",
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();

    if (status !== 200) {
      Logger.log("Error: " + response.getContentText());
      break;
    }

    const data = JSON.parse(response.getContentText());

    if (data.length === 0) break;

    allData = allData.concat(data);

    Logger.log("Fetched delegation rows: " + allData.length);

    if (data.length < limit) break;

    offset += limit;
  }

  if (allData.length === 0) {
    Logger.log("No delegation data found.");
    return;
  }

  const rows = allData.map(item => [
    String(item.task_id),
    item.created_at || "",
    item.department || "",
    item.name || "",
    item.task_description || "",
    item.frequency || "",
    item.remarks || "",
    item.task_start_date || "",
    item.given_by || "",
    item.image || "",
    item.enable_reminder || "",
    item.require_attachment || "",
    item.status || "",
    item.updated_at || "",
    item.planned_date || "",
    item.submission_date || "",
    item.color_code_for || "",
    item.delay || "",
    item.admin_done || ""
  ]);

  sheet.getRange(2,1,rows.length,headers.length).setValues(rows);

  Logger.log("✅ Delegation synced successfully. Total rows: " + rows.length);
}






function syncUsers() {

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET);
  sheet.clearContents();

  const headers = [
    "ID","Created At","User Name","Password","Email",
    "Number","Department","Given By","Role","Status",
    "User Access","Leave Date","Remark","Leave End Date",
    "Employee ID","Last Punch Time","Last Punch Device",
    "Page Access","System Access"
  ];

  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  // Force ID column as TEXT
  sheet.getRange("A:A").setNumberFormat("@");

  let allData = [];
  let offset = 0;
  const limit = 1000;

  while (true) {

    const url =
      `${SUPABASE_URL}/rest/v1/users` +
      `?select=*` +
      `&order=id.asc` +
      `&limit=${limit}` +
      `&offset=${offset}`;

    const options = {
      method: "GET",
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();

    if (status !== 200) {
      Logger.log("Error: " + response.getContentText());
      break;
    }

    const data = JSON.parse(response.getContentText());

    if (data.length === 0) break;

    allData = allData.concat(data);

    Logger.log("Fetched users: " + allData.length);

    if (data.length < limit) break;

    offset += limit;
  }

  if (allData.length === 0) {
    Logger.log("No users found.");
    return;
  }

  const rows = allData.map(item => [
    String(item.id),
    item.created_at || "",
    item.user_name || "",
    item.password || "",
    item.email_id || "",
    item.number || "",
    item.department || "",
    item.given_by || "",
    item.role || "",
    item.status || "",
    item.user_access || "",
    item.leave_date || "",
    item.remark || "",
    item.leave_end_date || "",
    item.employee_id || "",
    item.last_punch_time || "",
    item.last_punch_device || "",
    item.page_access || "",
    item.system_access || ""
  ]);

  sheet.getRange(2,1,rows.length,headers.length).setValues(rows);

  Logger.log("✅ Users synced successfully. Total rows: " + rows.length);
};

function clearMultipleSheets() 
{
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 👉 Add sheet names here
  var sheets = ["Checklist", "users", "Delegation"];

  sheets.forEach(function(name) 
  {
    var sheet = ss.getSheetByName(name);
    
    if (sheet) 
    {
      sheet.clear(); // Clears everything (data + format)
    }
  });
}