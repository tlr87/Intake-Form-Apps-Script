

/**
 * Fallback function to read the last row directly from the sheet if trigger 'e' object is stripped
 */
function processLatestSheetRow() {
  var ss = getTargetSpreadsheetInstance();
  if (!ss) return;
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Form Responses 1";
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  
  if (lastRow < 2) return;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  var payload = {};
  for (var i = 0; i < headers.length; i++) {
    payload[headers[i].toString().trim()] = values[i];
  }
  
  return processSubmission(payload);
}

/**
 * Clears all existing project triggers and installs a fresh 'onFormSubmit' trigger.
 * Run this directly from the Apps Script editor toolbar.
 */
function setupFreshTrigger() {
  // 1. Delete all existing triggers to clear ghost/broken triggers
  var allTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < allTriggers.length; i++) {
    ScriptApp.deleteTrigger(allTriggers[i]);
  }
  Logger.log("🗑️ Deleted " + allTriggers.length + " existing trigger(s).");

  // 2. Identify the active container and install the trigger
  var ss = getTargetSpreadsheet();
  if (ss) {
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
    Logger.log("✅ Installed fresh 'onFormSubmit' trigger bound to Spreadsheet: " + ss.getName());
  } else {
    Logger.log("❌ Could not locate Spreadsheet to bind trigger.");
  }
}