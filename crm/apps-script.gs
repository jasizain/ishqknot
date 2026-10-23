// ISHQ KNOT enquiry CRM — Google Apps Script bound to a Google Sheet.
// Setup steps are in crm/README.md.

const HEADERS = ["Received", "Name", "Phone", "Wedding date", "Venue", "Package", "Message", "Status", "Follow-up", "Notes"];
const STATUSES = ["New", "Contacted", "Quoted", "Booked", "Shot", "Delivered", "Lost"];

// Run once from the editor: adds headers, a Status dropdown and frozen header row.
function setup() {
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
  sheet.getRange(2, HEADERS.indexOf("Status") + 1, sheet.getMaxRows() - 1).setDataValidation(rule);
}

// Called by the website's contact form.
function doPost(e) {
  const p = e.parameter;
  if (p.website) return ContentService.createTextOutput("ok"); // honeypot: bots fill hidden field

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActiveSheet().appendRow([
      new Date(),
      clean(p.name), clean(p.phone), clean(p.date), clean(p.venue),
      clean(p.package) || "Not sure yet", clean(p.message),
      "New", "", "",
    ]);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput("ok");
}

// Trim, cap length, and stop values being treated as spreadsheet formulas.
function clean(v) {
  v = String(v || "").trim().slice(0, 1000);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
