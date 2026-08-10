/**
 * Programmatic Trigger Setup & Management
 * Location: Triggers.gs
 */

// Target Spreadsheet ID
var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";

/**
 * Creates the Google Sheet form submission trigger programmatically.
 * Run this function ONCE from the toolbar above.
 */
function setupFormSubmitTrigger() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // First, clear existing duplicate triggers for onFormSubmit to avoid double-processing
    removeExistingTriggers('onFormSubmit');

    // Create the new form submit trigger attached to your spreadsheet
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();

    Logger.log("✅ SUCCESS: 'onFormSubmit' trigger created for Spreadsheet ID: " + SPREADSHEET_ID);
  } catch (err) {
    Logger.log("❌ ERROR creating trigger: " + err.toString());
  }
}

/**
 * Helper function: Removes duplicate triggers for a given function name.
 */
function removeExistingTriggers(functionName) {
  var allTriggers = ScriptApp.getProjectTriggers();
  var count = 0;
  
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(allTriggers[i]);
      count++;
    }
  }
  
  if (count > 0) {
    Logger.log("🧹 Removed " + count + " existing trigger(s) for function '" + functionName + "'.");
  }
}

/**
 * Utility: Check and log all active triggers attached to this project.
 */
function listActiveTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log("Found " + triggers.length + " active trigger(s):");
  
  for (var i = 0; i < triggers.length; i++) {
    Logger.log("- Function: " + triggers[i].getHandlerFunction() + 
               " | Event Type: " + triggers[i].getEventType() + 
               " | Source: " + triggers[i].getTriggerSource());
  }
}