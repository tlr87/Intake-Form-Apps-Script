/**
 * Handles Google Form response triggers (Spreadsheet & Form triggers)
 */
function onFormSubmit(e) {
  try {
    var data = {};

    if (e && e.namedValues && Object.keys(e.namedValues).length > 0) {
      // 1. Standard Spreadsheet Trigger
      data = e.namedValues;
    } else if (e && e.response) {
      // 2. Direct Form Trigger
      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        data[itemResponses[i].getItem().getTitle()] = itemResponses[i].getResponse();
      }
    } else if (e && e.values && e.range) {
      // 3. Spreadsheet Trigger missing namedValues
      var sheet = e.range.getSheet();
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      for (var h = 0; h < headers.length; h++) {
        if (headers[h]) data[headers[h].toString().trim()] = e.values[h];
      }
    } else {
      // 4. Live Trigger fired with missing payload - Read last row from Sheet as fallback
      Logger.log("⚠️ Live trigger fired without event object. Fetching latest sheet row...");
      return processLatestSheetRow();
    }

    return processSubmission(data);
  } catch (err) {
    Logger.log("onFormSubmit Error: " + err.toString());
  }
}

/**
 * Main ingestion & pipeline processing function
 */
function processSubmission(rawData) {
  if (!rawData) {
    Logger.log("⚠️ processSubmission called without rawData payload.");
    rawData = {};
  }

  var extractedMap = normalizeInputKeys(rawData);
  var evaluation = evaluateSubmission(rawData, extractedMap);
  
  var tz = (typeof CONFIG !== 'undefined' && CONFIG.TIMEZONE) ? CONFIG.TIMEZONE : "Pacific/Auckland";
  var timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

  /**
   * Smart Fuzzy Value Extractor
   * Scans exact keys first, then performs partial substring matching across all payload keys
   */
  function getValue(exactKeys, partialKeywords, defaultValue) {
    // 1. Check exact key matches in rawData and normalized map
    for (var i = 0; i < exactKeys.length; i++) {
      var k = exactKeys[i];
      if (rawData && rawData[k] !== undefined && rawData[k] !== null) {
        var v = rawData[k];
        if (Array.isArray(v)) v = v.join(", ");
        if (String(v).trim() !== '') return String(v).trim();
      }
      
      var cleanK = k.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      if (extractedMap && extractedMap[cleanK] !== undefined && extractedMap[cleanK] !== null && String(extractedMap[cleanK]).trim() !== '') {
        return String(extractedMap[cleanK]).trim();
      }
    }

    // 2. Fuzzy match: Search for partial keywords in key titles (e.g. "email" matches "Email Address")
    for (var rawKey in rawData) {
      if (!rawData.hasOwnProperty(rawKey)) continue;
      var lowerKey = rawKey.toLowerCase();
      for (var p = 0; p < partialKeywords.length; p++) {
        if (lowerKey.indexOf(partialKeywords[p].toLowerCase()) !== -1) {
          var val = rawData[rawKey];
          if (Array.isArray(val)) val = val.join(", ");
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      }
    }

    return defaultValue;
  }

  var nameVal = getValue(
    ['name', 'fullName', 'full_name', 'your_name', 'first_name', 'Name'], 
    ['name'], 
    "N/A"
  );
  
  var emailVal = getValue(
    ['email', 'emailAddress', 'email_address', 'your_email', 'Email'], 
    ['email', 'e-mail'], 
    "N/A"
  );
  
  var phoneVal = getValue(
    ['phone', 'phoneNumber', 'contact_number', 'mobile', 'telephone', 'Phone'], 
    ['phone', 'mobile', 'contact', 'cell', 'tel'], 
    "N/A"
  );
  
  var addressVal = getValue(
    ['address', 'location', 'Address'], 
    ['address', 'location', 'street'], 
    "N/A"
  );
  
  var categoryVal = getValue(
    ['userType', 'category', 'user_type', 'usertype', 'i_am_contacting_rd3_tech_as', 'I am contacting RD3 Tech as:'], 
    ['contacting', 'usertype', 'category', 'user type', 'as:'], 
    evaluation.category || "General Inquiry"
  );
  
  var situationVal = getValue(
    ['situation', 'subject', 'what_sounds_like_your_situation', 'What sounds like your situation?', 'problem', 'service'], 
    ['situation', 'sounds', 'problem', 'issue', 'service', 'subject'], 
    "New Website Lead"
  );
  
  var messageVal = getValue(
    ['achievement', 'message', 'goal', 'details', 'what_are_you_trying_to_achieve', 'What Are You Trying To Achieve?', 'comments', 'desired_outcome'], 
    ['achieve', 'goal', 'message', 'details', 'comments', 'outcome'], 
    ""
  );
  
  var timeframeVal = getValue(
    ['timeframe', 'urgency', 'how_soon_do_you_need_help', 'How Soon Do You Need Help?', 'timeline'], 
    ['soon', 'timeframe', 'urgency', 'timeline', 'help?'], 
    "N/A"
  );

  var submission = {
    id: "LEAD-" + Date.now(),
    timestamp: timestamp,
    name: nameVal,
    email: emailVal,
    phone: phoneVal,
    address: addressVal,
    subject: situationVal,
    message: messageVal,
    situation: situationVal,
    achievement: messageVal,
    timeframe: timeframeVal,
    category: categoryVal,
    userType: categoryVal,
    isSpam: evaluation.isSpam || false,
    isReviewRequired: evaluation.isReviewRequired || false,
    isUrgent: evaluation.isUrgent || false,
    spamScore: evaluation.spamScore || 0,
    flagReasons: (evaluation.flagReasons && evaluation.flagReasons.length) ? evaluation.flagReasons.join(", ") : "",
    reasons: evaluation.flagReasons || [],
    flags: evaluation.flagReasons || [],
    status: evaluation.statusLabel || "NEW INQUIRY",
    rawData: JSON.stringify(rawData)
  };

  logToSheet(submission);
  sendEmails(submission, evaluation);

  return submission;
}

/**
 * Fallback function to read the last row directly from the sheet if trigger 'e' object is stripped
 */
function processLatestSheetRow() {
  var ss = getTargetSpreadsheetInstance();
  if (!ss) return;
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Form Responses 1";
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  
  if (lastRow < 2) return;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  var payload = {};
  for (var i = 0; i < headers.length; i++) {
    payload[headers[i].toString().trim()] = values[i];
  }
  
  return processSubmission(payload);
}


