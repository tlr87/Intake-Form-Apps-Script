/**
 * RD3 Tech Lead Engine - Database & Google Sheet Operations
 */
const SheetLogger = {
  
  logLeadToSheet: function(payload, evalResult) {
    const ss = getTargetSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      sheet.appendRow(["Timestamp", "Name", "Email", "Phone", "Message", "Category", "Status / Flags", "Spam Score"]);
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e0e0e0");
    }

    const timestamp = new Date();
    const statusText = evalResult.flags.length > 0 ? evalResult.flags.join(" | ") : "Clean";

    sheet.appendRow([
      timestamp,
      payload.name || "",
      payload.email || "",
      payload.phone || "",
      payload.message || "",
      evalResult.category,
      statusText,
      evalResult.spamScore
    ]);

    return sheet.getLastRow();
  }
};