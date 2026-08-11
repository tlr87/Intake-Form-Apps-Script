/**
 * RD3 Tech Lead Engine - Main Entry Point & Orchestrator
 */

function doPost(e) {
  try {
    const payload = Helpers.parseIncomingRequest(e);
    
    // 1. Evaluate incoming lead (Anti-spam, Keywords, Urgency)
    const evalResult = Evaluation.evaluateLead(payload);
    
    // 2. Log lead to Google Sheet
    const rowId = SheetLogger.logLeadToSheet(payload, evalResult);
    
    // 3. Process email notifications
    if (!evalResult.isSpam) {
      EmailService.sendClientAutoResponse(payload);
    }
    EmailService.sendAdminNotification(payload, evalResult, rowId);

    return Helpers.buildJsonResponse({ status: "success", leadId: rowId, flags: evalResult.flags });
  } catch (err) {
    Logger.log("doPost Error: " + (err.stack || err.toString()));
    return Helpers.buildJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

function doGet(e) {
  // Route to Admin Dashboard & Moderation Console
  if (e && e.parameter && e.parameter.page === 'admin') {
    var template = HtmlService.createTemplateFromFile('AdminTemplate');
    
    // Attach lead history fetched dynamically from the Google Sheet
    template.leads = fetchLeadsForAdmin();

    return template.evaluate()
      .setTitle('RD3 Tech — Lead Management & Admin Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return ContentService.createTextOutput("RD3 Tech Engine Endpoint Active");
}

/* ============================================================================
 * ADMIN DATA FETCHING & MAPPING
 * ============================================================================ */

/**
 * Dynamic, header-aware lead reader for Admin Portal (AdminTemplate.html)
 */
function fetchLeadsForAdmin() {
  try {
    var ss = typeof getTargetSpreadsheetInstance === 'function' 
      ? getTargetSpreadsheetInstance() 
      : (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet());
    
    if (!ss) return [];
    
    // Priority 1: "Form Responses" (where live Google Form rows land)
    // Priority 2: Configured SHEET_NAME
    // Priority 3: First sheet in workbook
    var sheet = ss.getSheetByName("Form Responses");
    if (!sheet && typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) {
      sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    }
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }
    
    if (!sheet || sheet.getLastRow() < 2) return [];

    var allValues = sheet.getDataRange().getValues();
    var rawHeaders = allValues[0];
    
    // Normalize header titles for alias matching
    var headerMap = {};
    for (var h = 0; h < rawHeaders.length; h++) {
      var cleanHeader = rawHeaders[h].toString().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      headerMap[cleanHeader] = h;
    }

    // Helper to extract column value by testing multiple alias keys
    function getCell(row, aliases, fallback) {
      for (var k = 0; k < aliases.length; k++) {
        var idx = headerMap[aliases[k]];
        if (idx !== undefined && row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
          return String(row[idx]).trim();
        }
      }
      return fallback;
    }

    var leads = [];

    // Parse data rows (skipping header row 0)
    for (var i = 1; i < allValues.length; i++) {
      var row = allValues[i];

      var idVal = getCell(row, ['lead_id', 'id', 'submission_id', 'leadid'], "LEAD-" + (i + 1));
      var timeVal = getCell(row, ['timestamp', 'date', 'time', 'date_submitted'], "N/A");
      var nameVal = getCell(row, ['name', 'full_name', 'your_name', 'client_name', 'contact_name'], "N/A");
      var emailVal = getCell(row, ['email', 'email_address', 'your_email', 'client_email', 'contact_email'], "N/A");
      var phoneVal = getCell(row, ['phone', 'phone_number', 'contact_number', 'your_phone', 'mobile'], "N/A");
      var addressVal = getCell(row, ['address', 'location', 'street_address', 'your_address'], "N/A");
      
      var categoryVal = getCell(row, ['category', 'i_am_contacting_rd3_tech_as', 'user_type', 'usertype', 'contact_as', 'type'], "General Inquiry");
      var situationVal = getCell(row, ['situation', 'what_sounds_like_your_situation', 'subject_situation', 'subject', 'problem', 'issue'], "New Website Lead");
      var achievementVal = getCell(row, ['achievement', 'what_are_you_trying_to_achieve', 'message_goal', 'message', 'goal', 'details'], "");
      var timeframeVal = getCell(row, ['timeframe', 'how_soon_do_you_need_help', 'urgency', 'timeframe_urgency', 'how_soon'], "N/A");
      
      var statusVal = getCell(row, ['status', 'lead_status', 'review_status'], "NEW INQUIRY");
      var isSpamVal = getCell(row, ['is_spam', 'spam'], "NO").toUpperCase() === "YES";
      var isReviewVal = getCell(row, ['review_required', 'is_review_required', 'needs_review'], "NO").toUpperCase() === "YES";
      var scoreVal = getCell(row, ['spam_score', 'score'], 0);
      var flagsVal = getCell(row, ['flag_reasons', 'flags', 'reason', 'reasons'], "");

      leads.push({
        id: idVal,
        timestamp: timeVal,
        status: statusVal,
        name: nameVal,
        email: emailVal,
        phone: phoneVal,
        address: addressVal,
        category: categoryVal,
        situation: situationVal,
        achievement: achievementVal,
        timeframe: timeframeVal,
        isSpam: isSpamVal,
        isReviewRequired: isReviewVal,
        spamScore: scoreVal,
        flagReasons: flagsVal
      });
    }

    // Return newest submissions first
    return leads.reverse();
  } catch (err) {
    Logger.log("Error in fetchLeadsForAdmin: " + err.toString());
    return [];
  }
}
/* ============================================================================
 * WEB APP REMOTE PROCEDURES (RPC) FOR ADMIN UI & TAXONOMY
 * ============================================================================ */

function apiGetTaxonomy() {
  if (typeof getStoredTaxonomy === 'function') {
    return JSON.stringify(getStoredTaxonomy());
  }
  return JSON.stringify(typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_TAXONOMY : {});
}

function apiSaveTaxonomy(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof updateStoredTaxonomy === 'function') {
      updateStoredTaxonomy(parsed);
    }
    return { success: true, message: "Taxonomy saved successfully." };
  } catch (err) {
    return { success: false, message: "Invalid JSON: " + err.message };
  }
}