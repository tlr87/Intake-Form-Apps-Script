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
    Logger.log("doPost Error: " + err.stack);
    return Helpers.buildJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

function doGet(e) {
  // Route to Keyword Visual Editor Admin UI
  if (e && e.parameter && e.parameter.page === 'admin') {
    return HtmlService.createTemplateFromFile('AdminUI')
      .evaluate()
      .setTitle('RD3 Tech - Taxonomy Editor')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return ContentService.createTextOutput("RD3 Tech Engine Endpoint Active");
}

/**
 * Web App Remote Procedures (RPC) for AdminUI.html
 */
function apiGetTaxonomy() {
  return JSON.stringify(getStoredTaxonomy());
}

function apiSaveTaxonomy(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    updateStoredTaxonomy(parsed);
    return { success: true, message: "Taxonomy saved successfully." };
  } catch (err) {
    return { success: false, message: "Invalid JSON: " + err.message };
  }
}