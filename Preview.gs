// Target Spreadsheet ID & Tab
var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
var HTML_TAB_NAME = "HTML";

// Your exact Web App Test Deployment URL
var DEV_BASE_URL = "https://script.google.com/macros/s/AKfycbyWw6UBuMEgeYobQn-hTf0KwPbUO0X8hnsGN3C4NM4/dev";

// List of HTML template files in your Apps Script project
var HTML_FILES = [
  { name: "ClientTemplate", description: "Customer Confirmation Email Template" },
  { name: "AdminTemplate", description: "Internal Admin Notification Email Template" },
  { name: "HOW_TO_MODIFY", description: "Documentation & System Maintenance Guide" }
];

/**
 * Serves HTML templates in the browser via Web App /dev URL.
 * Accepts query parameters: ?page=ClientTemplate or ?page=AdminTemplate or ?page=HOW_TO_MODIFY
 */
function doGet(e) {
  var templateName = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'ClientTemplate';

  try {
    var template = HtmlService.createTemplateFromFile(templateName);

    // Mock data for live rendering/previewing
    template.name = "John Doe";
    template.email = "john@example.com";
    template.phone = "(555) 019-2834";
    template.userType = "Business Client";
    template.situation = "Looking to upgrade our network infrastructure and cloud backups.";
    template.achievement = "Improved security and faster system performance.";
    template.timeframe = "Within 1 month";
    template.isSpam = false;
    template.requiresReview = false;
    template.matchedTerms = [];
    template.submitTime = new Date().toLocaleString();

    return template.evaluate()
      .setTitle("HTML Preview: " + templateName)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      "<div style='font-family: sans-serif; padding: 20px; color: #dc2626;'>" +
      "<h2>❌ Error Loading Template: '" + templateName + "'</h2>" +
      "<p>" + err.toString() + "</p>" +
      "<p>Check that the file exists in your Apps Script project sidebar.</p>" +
      "</div>"
    );
  }
}

/**
 * Builds Dev links for all HTML files and writes them as clickable hyperlinks 
 * into the "HTML" tab of your Google Sheet.
 */
function updateHtmlTabLinks() {
  try {
    var ss;
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) {
      throw new Error("Could not access spreadsheet ID: " + SPREADSHEET_ID);
    }

    var sheet = ss.getSheetByName(HTML_TAB_NAME);

    // Create the tab if missing
    if (!sheet) {
      sheet = ss.insertSheet(HTML_TAB_NAME);
    }

    // Clear previous contents
    sheet.clear();

    // 1. Set up Headers
    var headers = ["HTML File Name", "Description", "Dev Preview Link"];
    sheet.appendRow(headers);

    // Format Header Row (Dark Navy background, Bold White Text)
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    // 2. Populate rows with clickable =HYPERLINK() formulas
    HTML_FILES.forEach(function(file) {
      var fullDevUrl = DEV_BASE_URL + "?page=" + file.name;
      var hyperlinkFormula = '=HYPERLINK("' + fullDevUrl + '", "🔗 Open ' + file.name + ' Preview")';

      sheet.appendRow([
        file.name,
        file.description,
        hyperlinkFormula
      ]);
    });

    // 3. Adjust Column Widths
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 350);
    sheet.setColumnWidth(3, 300);

    Logger.log("✅ Successfully updated the '" + HTML_TAB_NAME + "' tab with working Dev Preview links.");
    return true;

  } catch (err) {
    Logger.log("❌ ERROR updating HTML tab: " + err.toString());
    return false;
  }
}