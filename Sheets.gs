// Target Spreadsheet ID
var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
var TARGET_TAB_NAME = "Records";

/**
 * Saves a form submission into the "Records" tab of the specified Google Sheet.
 * 
 * @param {Object} data - Submission details passed from processSubmission
 */
function saveSubmissionToSheet(data) {
  try {
    var ss;
    
    // Attempt to open the specific spreadsheet by ID; fallback to active spreadsheet if bound
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) {
      throw new Error("Could not access the spreadsheet. Check the SPREADSHEET_ID and script permissions.");
    }

    var sheet = ss.getSheetByName(TARGET_TAB_NAME);

    // 1. Create the "Records" tab if it doesn't exist yet
    if (!sheet) {
      sheet = ss.insertSheet(TARGET_TAB_NAME);
    }

    // 2. Add and format headers if the tab is brand new/empty
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Timestamp",
        "Name",
        "Email",
        "Phone",
        "Client Category",
        "Situation",
        "Goal / Outcome",
        "Timeframe",
        "Spam Status",
        "Requires Review",
        "Matched Keywords"
      ];
      sheet.appendRow(headers);
      
      // Style header row (Navy background with white bold text)
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    // 3. Prepare row data
    var timestamp = data.submitTime || new Date();
    var rowData = [
      timestamp,
      data.name || "Not provided",
      data.email || "Not provided",
      data.phone || "Not provided",
      data.userType || "Not specified",
      data.situation || "Not specified",
      data.achievement || "Not specified",
      data.timeframe || "Not specified",
      data.isSpam ? "SPAM (Honeypot Triggered)" : "Clean",
      data.requiresReview ? "YES" : "No",
      (data.matchedTerms && data.matchedTerms.length > 0) ? data.matchedTerms.join(", ") : "None"
    ];

    // 4. Append submission to the "Records" tab
    sheet.appendRow(rowData);

    // 5. Apply highlight formatting for Spam or Flagged entries
    var lastRow = sheet.getLastRow();
    var rowRange = sheet.getRange(lastRow, 1, 1, rowData.length);
    
    if (data.isSpam) {
      rowRange.setBackground("#fee2e2"); // Light red background for spam
    } else if (data.requiresReview) {
      rowRange.setBackground("#fef3c7"); // Light yellow background for flagged keywords
    }

    Logger.log("✅ Successfully saved submission to tab '" + TARGET_TAB_NAME + "' in spreadsheet ID: " + SPREADSHEET_ID);
    return true;

  } catch (err) {
    Logger.log("❌ ERROR saving to Spreadsheet: " + err.toString());
    return false;
  }
}

/**
 * TEST FUNCTION: Run this in Apps Script to test saving directly to the Records tab.
 */
function testSaveToRecordsTab() {
  var sampleData = {
    submitTime: new Date(),
    name: "Test User",
    email: "testuser@example.com",
    phone: "555-0199",
    userType: "Business Client",
    situation: "Testing connection to the Records tab.",
    achievement: "Direct entry verification.",
    timeframe: "Immediate",
    isSpam: false,
    requiresReview: false,
    matchedTerms: []
  };

  var result = saveSubmissionToSheet(sampleData);
  Logger.log("Test execution finished. Result: " + result);
}