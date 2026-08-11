/**
 * MASTER FULL PURGE AND REBUILD (2-TAB ARCHITECTURE)
 * Purges the spreadsheet down to only 'Form Responses 1' and 'HTML'.
 * Deletes all legacy tabs and formats headers from scratch.
 */
function masterPurgeAndResetAll() {
  var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  Logger.log("--- STARTING MASTER SPREADSHEET PURGE ---");

  // 1. Target Tab Schemas (Form Responses 1 and HTML only)
  var tabSchemas = {
    "Form Responses 1": [
      "Timestamp",
      "Name",
      "Email",
      "Phone",
      "Address",
      "I am contacting RD3 Tech as:",
      "What sounds like your situation?",
      "What Are You Trying To Achieve?",
      "How Soon Do You Need Help?"
    ],
    "HTML": [
      "Template Name",
      "Subject",
      "HTML Body Content"
    ]
  };

  // 2. Delete all legacy/unwanted tabs
  var existingSheets = ss.getSheets();
  for (var s = 0; s < existingSheets.length; s++) {
    var sheetName = existingSheets[s].getName();
    if (!tabSchemas.hasOwnProperty(sheetName)) {
      // Don't delete if it's the last remaining tab during iteration
      if (ss.getSheets().length > 1) {
        ss.deleteSheet(existingSheets[s]);
        Logger.log("🗑️ Deleted legacy tab: " + sheetName);
      }
    }
  }

  // 3. Rebuild and Format the 2 Target Tabs
  for (var tabName in tabSchemas) {
    var targetSheet = ss.getSheetByName(tabName);
    if (!targetSheet) {
      targetSheet = ss.insertSheet(tabName);
      Logger.log("Created missing tab: " + tabName);
    }

    // Wipe all contents, formats, and notes
    targetSheet.clearContents();
    targetSheet.clearFormats();
    targetSheet.clearNotes();

    // Write fresh headers
    var headers = tabSchemas[tabName];
    targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header row
    var headerRange = targetSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1f2937"); // Dark Slate
    headerRange.setFontColor("#ffffff");   // White text
    targetSheet.setRowHeight(1, 35);
    targetSheet.autoResizeColumns(1, headers.length);

    Logger.log("✅ Tab '" + tabName + "' completely purged and re-indexed.");
  }

  Logger.log("--- MASTER PURGE COMPLETE: Spreadsheet contains only 'Form Responses 1' and 'HTML' ---");
}