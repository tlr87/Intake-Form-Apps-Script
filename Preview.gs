// Target Spreadsheet ID & Tab
var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
var HTML_TAB_NAME = "HTML";

// Your Working Web App Test Deployment URL
var DEV_BASE_URL = "https://script.google.com/a/macros/rd3tech.com/s/AKfycbzpO2HZEaD2K_UtIx0fAhBgC2o2cdvzVV4Us1OWe5AC/dev";

// List of HTML template files in your Apps Script project
var HTML_FILES = [
  { name: "AdminUI", description: "Keyword Taxonomy JSON Editor" },
  { name: "ClientTemplate", description: "Customer Confirmation Email Template" },
  { name: "AdminTemplate", description: "Internal Admin Notification Email Template (Default / Green)" },
  { name: "AdminTemplate&mode=urgent", description: "Internal Admin Notification Email Template (Urgent / Orange Badge)" },
  { name: "AdminTemplate&mode=review", description: "Internal Admin Notification Email Template (Review Required / Gold Badge)" },
  { name: "AdminTemplate&mode=spam", description: "Internal Admin Notification Email Template (Spam / Red Badge)" }
];

/**
 * Serves HTML templates in the browser via Web App /dev URL.
 * Accepts query parameters: 
 *   - ?page=AdminUI | AdminTemplate | ClientTemplate
 *   - ?mode=urgent | spam | review
 */
function doGet(e) {
  var templateName = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'AdminUI';
  var mode = (e && e.parameter && e.parameter.mode) ? e.parameter.mode.toLowerCase() : '';

  try {
    var template = HtmlService.createTemplateFromFile(templateName);

    // Mock data for AdminTemplate & ClientTemplate previewing
    template.name = "John Doe";
    template.email = "john@example.com";
    template.phone = "(555) 019-2834";
    template.address = "123 Tech Street, Sydney NSW";
    template.userType = "Business Client";
    template.situation = "Looking to upgrade our network infrastructure and cloud backups.";
    template.achievement = "Improved security and faster system performance.";
    template.timeframe = "Within 1 month";
    template.submitTime = new Date().toLocaleString();

    template.isSpam = (mode === 'spam');
    template.isUrgent = (mode === 'urgent');
    template.requiresReview = (mode === 'review');

    return template.evaluate()
      .setTitle("RD3 Tech - " + templateName)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      "<div style='font-family: sans-serif; padding: 20px; color: #dc2626;'>" +
      "<h2>❌ Error Loading Page: '" + templateName + "'</h2>" +
      "<p>" + err.toString() + "</p>" +
      "<p>Check that the file exists in your Apps Script project sidebar.</p>" +
      "</div>"
    );
  }
}

/**
 * Writes Dev links to the "HTML" tab in Google Sheets
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

    var sheet = ss.getSheetByName(HTML_TAB_NAME) || ss.insertSheet(HTML_TAB_NAME);
    sheet.clear();

    var headers = ["Page / Mode", "Description", "Dev Link"];
    sheet.appendRow(headers);

    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    HTML_FILES.forEach(function(file) {
      var fullDevUrl = DEV_BASE_URL + "?page=" + file.name;
      var hyperlinkFormula = '=HYPERLINK("' + fullDevUrl + '", "🔗 Open ' + file.name + '")';

      sheet.appendRow([
        file.name,
        file.description,
        hyperlinkFormula
      ]);
    });

    sheet.setColumnWidth(1, 240);
    sheet.setColumnWidth(2, 450);
    sheet.setColumnWidth(3, 280);

    Logger.log("✅ Successfully updated preview links.");
    return true;

  } catch (err) {
    Logger.log("❌ ERROR updating links: " + err.toString());
    return false;
  }
}