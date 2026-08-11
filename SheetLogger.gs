/**
 * Sheet Logger Module
 * Handles recording incoming form submissions and evaluation metrics to Google Sheets.
 */
var SheetLogger = (function () {

  /**
   * Logs submission payload and evaluation flags into the designated Google Sheet.
   * @param {Object} leadData - Parsed submission data
   * @param {Object} evalResult - Calculated metrics from Evaluation module
   */
  function logSubmission(leadData, evalResult) {
    try {
      leadData = leadData || {};
      evalResult = evalResult || {};

      // 1. Direct call to global getTargetSpreadsheet() defined in Config.gs
      var ss = (typeof getTargetSpreadsheet === 'function') 
        ? getTargetSpreadsheet() 
        : SpreadsheetApp.getActiveSpreadsheet();

      // Guard clause: Exit gracefully if no spreadsheet is available
      if (!ss) {
        Logger.log('SheetLogger Notice: No Google Sheet available. (Add SPREADSHEET_ID to CONFIG in Config.gs if using a standalone script).');
        return;
      }

      var targetSheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) 
        ? CONFIG.SHEET_NAME 
        : 'Form Responses 1';

      var sheet = ss.getSheetByName(targetSheetName);

      // Initialize sheet with bold headers if it doesn't exist
      if (!sheet) {
        sheet = ss.insertSheet(targetSheetName);
        sheet.appendRow([
          'Timestamp', 
          'Status', 
          'Name', 
          'Email', 
          'Phone', 
          'Address', 
          'Category', 
          'Situation', 
          'Desired Outcome', 
          'Timeframe', 
          'Spam Score', 
          'Flags / Reasons'
        ]);
        sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
      }

      // Determine status label
      var statusLabel = 'Clean';
      if (evalResult.isSpam) {
        statusLabel = 'Spam';
      } else if (evalResult.requiresReview || evalResult.isReviewRequired) {
        statusLabel = 'Review Required';
      } else if (evalResult.isUrgent) {
        statusLabel = 'Urgent';
      }

      // Format flags/reasons into a readable string
      var flagDetails = '';
      if (evalResult.flags && evalResult.flags.length > 0) {
        flagDetails = evalResult.flags.join('; ');
      } else if (evalResult.flagReasons) {
        flagDetails = Array.isArray(evalResult.flagReasons) ? evalResult.flagReasons.join('; ') : evalResult.flagReasons;
      } else if (evalResult.flagReason) {
        flagDetails = evalResult.flagReason;
      }

      var rowData = [
        new Date(),
        statusLabel,
        leadData.name || 'Not provided',
        leadData.email || 'Not provided',
        leadData.phone || 'Not provided',
        leadData.address || 'Not provided',
        leadData.userType || leadData.category || evalResult.category || 'General Inquiry',
        leadData.situation || leadData.subject || '',
        leadData.achievement || leadData.message || '',
        leadData.timeframe || '',
        evalResult.spamScore || 0,
        flagDetails
      ];

      sheet.appendRow(rowData);
      Logger.log('Successfully logged lead to sheet "' + targetSheetName + '".');

    } catch (err) {
      Logger.log('Error logging submission to Sheet: ' + err.toString());
    }
  }

  return {
    logSubmission: logSubmission
  };

})();