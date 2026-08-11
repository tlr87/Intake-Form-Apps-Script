// ============================================================
// RD3 TECH - MANAGEMENT & PREVIEW HUB
// Code.gs
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

// Target Spreadsheet ID and tab name
var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";
var HTML_TAB_NAME = "HTML";

// Web App deployment URLs
var DEV_BASE_URL = "https://script.google.com/a/macros/rd3tech.com/s/AKfycbzpO2HZEaD2K_UtIx0fAhBgC2o2cdvzVV4Us1OWe5AC/dev";
var EXEC_BASE_URL = "https://script.google.com/a/macros/rd3tech.com/s/AKfycbzpO2HZEaD2K_UtIx0fAhBgC2o2cdvzVV4Us1OWe5AC/exec";


// ============================================================
// HTML FILE DEFINITIONS
// ============================================================
//
// "name" is the actual HTML file name.
// "mode" is an optional URL parameter.
//
// Example:
// ?page=AdminTemplate&mode=urgent
//
// loads:
// AdminTemplate.html
//
// with mode set to "urgent".
// ============================================================

var HTML_FILES = [
  {
    name: "Index",
    description: "Default Management & Preview Hub Landing Page"
  },
  {
    name: "SnippetsReference",
    description: "RD3 Snippets Technical Code & Shortcode Reference Library"
  },
  {
    name: "AdminUI",
    description: "Keyword Taxonomy JSON Editor"
  },
  {
    name: "ClientTemplate",
    description: "Customer Confirmation Email Template"
  },
  {
    name: "AdminTemplate",
    description: "Internal Admin Notification Email Template (Default / Green)"
  },
  {
    name: "AdminTemplate",
    mode: "urgent",
    description: "Internal Admin Notification Email Template (Urgent / Orange Badge)"
  },
  {
    name: "AdminTemplate",
    mode: "review",
    description: "Internal Admin Notification Email Template (Review Required / Gold Badge)"
  },
  {
    name: "AdminTemplate",
    mode: "spam",
    description: "Internal Admin Notification Email Template (Spam / Red Badge)"
  }
];


// ============================================================
// WEB APP ENTRY POINT
// ============================================================
//
// Supported URLs:
//
// /exec
// /exec?page=Index
// /exec?page=SnippetsReference
// /exec?page=AdminUI
// /exec?page=ClientTemplate
// /exec?page=AdminTemplate
// /exec?page=AdminTemplate&mode=urgent
// /exec?page=AdminTemplate&mode=review
// /exec?page=AdminTemplate&mode=spam
// ============================================================

function doGet(e) {

  // Default page
  var templateName = "Index";

  // Read page parameter
  if (e && e.parameter && e.parameter.page) {
    templateName = e.parameter.page;
  }

  // Default mode
  var mode = "";

  // Read mode parameter
  if (e && e.parameter && e.parameter.mode) {
    mode = String(e.parameter.mode).toLowerCase();
  }

  // Check that the requested page exists
  var validPage = false;

  for (var i = 0; i < HTML_FILES.length; i++) {
    if (HTML_FILES[i].name === templateName) {
      validPage = true;
      break;
    }
  }

  // Stop if the requested page does not exist
  if (!validPage) {
    return HtmlService
      .createHtmlOutput(
        "<div style=\"font-family:Arial,sans-serif;padding:30px;color:#dc2626;\">" +
        "<h2>Page Not Found</h2>" +
        "<p>The requested page does not exist.</p>" +
        "<p><strong>Requested page:</strong> " +
        escapeHtml(templateName) +
        "</p>" +
        "</div>"
      )
      .setTitle("RD3 Tech - Page Not Found");
  }

  try {

    // Load the requested HTML template
    var template = HtmlService.createTemplateFromFile(templateName);

    // Mock data used by email preview templates
    template.name = "John Doe";
    template.email = "john@example.com";
    template.phone = "(555) 019-2834";
    template.address = "123 Tech Street, Sydney NSW";
    template.userType = "Business Client";
    template.situation = "Looking to upgrade our network infrastructure and cloud backups.";
    template.achievement = "Improved security and faster system performance.";
    template.timeframe = "Within 1 month";
    template.submitTime = new Date().toLocaleString();

    // Set template mode flags
    template.isSpam = (mode === "spam");
    template.isUrgent = (mode === "urgent");
    template.requiresReview = (mode === "review");

    // Get the current deployed web app URL.
    // Index.html uses this to construct its navigation links.
    template.baseUrl = ScriptApp.getService().getUrl();

    // Pass current request information to the template.
    // Useful for diagnostics and page-specific logic.
    template.currentPage = templateName;
    template.currentMode = mode;

    // Render and return the page
    return template
      .evaluate()
      .setTitle("RD3 Tech - " + templateName)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {

    // Display a useful error page if the HTML template cannot be loaded
    return HtmlService
      .createHtmlOutput(
        "<div style=\"font-family:Arial,sans-serif;padding:30px;color:#dc2626;\">" +
        "<h2>Error Loading Page</h2>" +
        "<p><strong>Page:</strong> " +
        escapeHtml(templateName) +
        "</p>" +
        "<p><strong>Mode:</strong> " +
        escapeHtml(mode) +
        "</p>" +
        "<p><strong>Error:</strong><br>" +
        escapeHtml(err.toString()) +
        "</p>" +
        "<p>Check that the required HTML file exists in the Apps Script project.</p>" +
        "</div>"
      )
      .setTitle("RD3 Tech - Error");
  }
}


// ============================================================
// HTML ESCAPING HELPER
// ============================================================

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ============================================================
// BUILD PAGE URL
// ============================================================
//
// Creates a URL for a page and optional mode.
//
// Example:
// AdminTemplate + urgent
//
// becomes:
// /exec?page=AdminTemplate&mode=urgent
// ============================================================

function buildPageUrl(baseUrl, file) {

  var url = baseUrl;

  // Index is the default page and does not need ?page=Index
  if (file.name !== "Index") {

    url += "?page=" + encodeURIComponent(file.name);

    // Add optional mode
    if (file.mode) {
      url += "&mode=" + encodeURIComponent(file.mode);
    }
  }

  return url;
}


// ============================================================
// UPDATE HTML TAB LINKS
// ============================================================
//
// Writes Dev and Exec links into the "HTML" spreadsheet tab.
// ============================================================

function updateHtmlTabLinks() {

  try {

    // Try to open the configured spreadsheet
    var ss;

    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    // Make sure the spreadsheet is available
    if (!ss) {
      throw new Error(
        "Could not access spreadsheet ID: " + SPREADSHEET_ID
      );
    }

    // Get existing HTML tab or create it
    var sheet = ss.getSheetByName(HTML_TAB_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(HTML_TAB_NAME);
    }

    // Clear existing content
    sheet.clear();

    // Spreadsheet headers
    var headers = [
      "Page / Mode",
      "Description",
      "Dev Link",
      "Exec Link",
      "Exec Raw URL",
      "Dev Raw URL"
    ];

    sheet.appendRow(headers);

    // Format header
    var headerRange = sheet.getRange(
      1,
      1,
      1,
      headers.length
    );

    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#ffffff");

    sheet.setFrozenRows(1);

    // Add each HTML page
    HTML_FILES.forEach(function(file) {

      var devUrl = buildPageUrl(
        DEV_BASE_URL,
        file
      );

      var execUrl = buildPageUrl(
        EXEC_BASE_URL,
        file
      );

      // Display label
      var label = file.name;

      if (file.mode) {
        label += " (" + file.mode + ")";
      }

      // Google Sheets hyperlink formulas
      var devFormula =
        '=HYPERLINK("' +
        devUrl +
        '","Dev ' +
        label +
        '")';

      var execFormula =
        '=HYPERLINK("' +
        execUrl +
        '","Exec ' +
        label +
        '")';

      // Add row
      sheet.appendRow([
        label,
        file.description,
        devFormula,
        execFormula,
        execUrl,
        devUrl
      ]);
    });

    // Set column widths
    sheet.setColumnWidth(1, 240);
    sheet.setColumnWidth(2, 380);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 500);
    sheet.setColumnWidth(6, 500);

    Logger.log(
      "Successfully updated preview links."
    );

    return true;

  } catch (err) {

    Logger.log(
      "ERROR updating links: " +
      err.toString()
    );

    return false;
  }
}
