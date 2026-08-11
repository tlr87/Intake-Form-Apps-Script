/**
 * RAW DATA DIAGNOSTIC TEST
 * Dispatches an email containing the exact raw objects received by Apps Script.
 */
function sendRawDiagnosticEmail(e) {
  var ADMIN_EMAIL = "tom@rd3tech.com";
  var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";

  var report = [];
  report.push("=== RAW DIAGNOSTIC DATA REPORT ===");
  report.push("Timestamp: " + new Date().toString());
  report.push("");

  // 1. INSPECT EVENT OBJECT (e)
  if (!e) {
    report.push("⚠️ WARNING: Event object 'e' is UNDEFINED.");
    report.push("(This happens when you press 'Run' inside the editor instead of submitting a live form.)");
    report.push("");
  } else {
    report.push("--- 1. EVENT OBJECT KEYS ---");
    report.push(JSON.stringify(Object.keys(e)));
    report.push("");

    if (e.namedValues) {
      report.push("--- 2. e.namedValues (Question Title -> Value) ---");
      report.push(JSON.stringify(e.namedValues, null, 2));
      report.push("");
    } else {
      report.push("--- 2. e.namedValues: Not Present ---");
      report.push("");
    }

    if (e.values) {
      report.push("--- 3. e.values (Ordered Array) ---");
      report.push(JSON.stringify(e.values, null, 2));
      report.push("");
    }

    if (e.response) {
      report.push("--- 4. e.response (Native Google Form Items) ---");
      try {
        var items = e.response.getItemResponses();
        var itemDump = [];
        for (var i = 0; i < items.length; i++) {
          itemDump.push({
            title: items[i].getItem().getTitle(),
            response: items[i].getResponse()
          });
        }
        report.push(JSON.stringify(itemDump, null, 2));
        report.push("");
      } catch (formErr) {
        report.push("Error parsing e.response: " + formErr.toString());
        report.push("");
      }
    }
  }

  // 2. DIRECT READ OF THE GOOGLE SHEET
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Form Responses 1") || ss.getSheets()[0];
    var lastRow = sheet.getLastRow();

    report.push("--- 5. DIRECT SHEET READ ---");
    report.push("Target Tab Name: " + sheet.getName());
    report.push("Last Row Index: " + lastRow);
    report.push("");

    if (lastRow >= 1) {
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      report.push("Row 1 (Headers):");
      report.push(JSON.stringify(headers, null, 2));
      report.push("");
    }

    if (lastRow >= 2) {
      var lastRowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
      report.push("Row " + lastRow + " (Latest Submission Data):");
      report.push(JSON.stringify(lastRowValues, null, 2));
      report.push("");
    }
  } catch (sheetErr) {
    report.push("Error reading Sheet directly: " + sheetErr.toString());
    report.push("");
  }

  // 3. SEND EMAIL
  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: "🔍 RAW DIAGNOSTIC DATA TEST — " + new Date().toLocaleTimeString(),
    body: report.join("\n")
  });

  Logger.log("Diagnostic email sent to " + ADMIN_EMAIL);
}

/**
 * TEST FUNCTION A: Run this directly from the Editor to test Sheet-reading
 */
function testManualRawSheetRead() {
  sendRawDiagnosticEmail(null);
}





/**
 * RE-ALIGNMENT UTILITY: Normalizes Row 1 headers on 'Form Responses 1'
 * Run this ONCE to fix the column shift.
 */
function fixAndAlignSheetHeaders() {
  var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
  
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Form Responses 1") || ss.getSheets()[0];
    
    // Standardized 11-column header structure matching existing row offsets
    var correctHeaders = [
      "Timestamp",
      "Status / Review",
      "Flagged Reasons",
      "Name",
      "Email",
      "Phone",
      "Address",
      "I am contacting RD3 Tech as:",
      "What sounds like your situation?",
      "What Are You Trying To Achieve?",
      "How Soon Do You Need Help?"
    ];

    // Update Row 1 across Columns A to K
    sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);

    // Format Row 1 Header for visibility
    var headerRange = sheet.getRange(1, 1, 1, correctHeaders.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4a86e8");
    headerRange.setFontColor("#ffffff");
    
    // Auto-fit column widths
    sheet.autoResizeColumns(1, correctHeaders.length);

    Logger.log("✅ SUCCESS: Row 1 headers updated successfully on tab: " + sheet.getName());
  } catch (err) {
    Logger.log("❌ ERROR updating headers: " + err.toString());
  }
}



/**
 * DIAGNOSTIC TOOL: INSPECT SPREADSHEET STRUCTURE
 * Logs all tabs, row counts, and column header structures.
 */
function inspectSheetStructure() {
  var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();

  Logger.log("==================================================");
  Logger.log("📊 SPREADSHEET DIAGNOSTIC REPORT");
  Logger.log("Spreadsheet Name: " + ss.getName());
  Logger.log("Total Tabs: " + sheets.length);
  Logger.log("==================================================");

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var tabName = sheet.getName();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    Logger.log("\n--- TAB [" + (i + 1) + "]: '" + tabName + "' ---");
    Logger.log("Total Rows: " + lastRow + " | Total Columns: " + lastCol);

    if (lastRow > 0 && lastCol > 0) {
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      Logger.log("Headers (Row 1):");
      for (var h = 0; h < headers.length; h++) {
        var colLetter = String.fromCharCode(65 + h); // A, B, C...
        Logger.log("  Column " + colLetter + " (" + (h + 1) + "): \"" + headers[h] + "\"");
      }

      // Preview latest data row if available
      if (lastRow > 1) {
        var latestRow = sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];
        Logger.log("\n  Latest Data Preview (Row " + lastRow + "):");
        for (var d = 0; d < latestRow.length; d++) {
          var label = headers[d] || ("Col " + (d + 1));
          Logger.log("    " + label + " -> " + JSON.stringify(latestRow[d]));
        }
      } else {
        Logger.log("  (No data rows present yet)");
      }
    } else {
      Logger.log("  ⚠️ Tab is completely empty.");
    }
  }

  Logger.log("\n==================================================");
  Logger.log("✅ DIAGNOSTIC REPORT COMPLETE");
  Logger.log("==================================================");
}




/**
 * TEST FUNCTION: Verify fetchLeadsForAdmin mapping against Row 29
 */
function testFetchLeadsForAdmin() {
  Logger.log("=== TESTING fetchLeadsForAdmin() ===");
  
  var leads = fetchLeadsForAdmin();
  
  if (!leads || leads.length === 0) {
    Logger.log("❌ No leads retrieved or sheet empty.");
    return;
  }

  Logger.log("Total leads retrieved: " + leads.length);
  Logger.log("--- LATEST LEAD (Row 29 / Item 0) ---");
  Logger.log(JSON.stringify(leads[0], null, 2));
}


