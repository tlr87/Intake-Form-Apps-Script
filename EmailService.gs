/**
 * EmailService.gs - Lead Ingestion & Processing Engine for RD3 Tech
 */

var EmailService = {
  doPost: doPost,
  onFormSubmit: onFormSubmit,
  processSubmission: processSubmission,
  processLeadSubmission: processSubmission,
  logToSheet: logToSheet,
  sendEmails: sendEmails,
  sendAdminNotification: sendAdminNotification,
  sendClientConfirmation: sendClientConfirmation,
  evaluateSubmission: evaluateSubmission
};

function doPost(e) {
  Logger.log("=== 🌐 WEBHOOK DOPOST TRIGGERED ===");
  try {
    var data = parseIncomingRequest(e);
    Logger.log("📥 Parsed Webhook Data: " + JSON.stringify(data));
    var result = processSubmission(data);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", id: result ? result.id : "N/A" }))
                          .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("❌ CRITICAL ERROR in doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                          .setMimeType(ContentService.MimeType.JSON);
  }
}

function onFormSubmit(e) {
  Logger.log("=== 🚀 FORM SUBMISSION TRIGGERED ===");
  try {
    var data = {};
    if (e && e.namedValues && Object.keys(e.namedValues).length > 0) {
      Logger.log("📥 Form Data Source: e.namedValues");
      data = e.namedValues;
    } else if (e && e.response) {
      Logger.log("📥 Form Data Source: e.response");
      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        data[itemResponses[i].getItem().getTitle()] = itemResponses[i].getResponse();
      }
    } else if (e && e.values && e.range) {
      Logger.log("📥 Form Data Source: e.values (Spreadsheet row)");
      var sheet = e.range.getSheet();
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      for (var h = 0; h < headers.length; h++) {
        if (headers[h]) data[headers[h].toString().trim()] = e.values[h];
      }
    } else if (e && e.parameter) {
      Logger.log("📥 Form Data Source: e.parameter");
      data = e.parameter;
    } else {
      Logger.log("⚠️ Trigger event object missing or empty. Fetching latest row from Sheet as safety fallback...");
      return processLatestSheetRow();
    }

    Logger.log("📦 Parsed Raw Payload: " + JSON.stringify(data));
    return processSubmission(data);
  } catch (err) {
    Logger.log("❌ CRITICAL ERROR in onFormSubmit: " + err.toString());
  }
}

function processLatestSheetRow() {
  var ss = getTargetSpreadsheetInstance();
  if (!ss) {
    Logger.log("❌ Fallback Failed: Spreadsheet target unreachable.");
    return;
  }
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Form Responses 1";
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    Logger.log("⚠️ Fallback Skipped: Sheet has no submission data rows.");
    return;
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  var payload = {};
  for (var i = 0; i < headers.length; i++) {
    payload[headers[i].toString().trim()] = values[i];
  }
  
  Logger.log("📄 Extracted Fallback Payload from Row " + lastRow + ": " + JSON.stringify(payload));
  return processSubmission(payload);
}

function processSubmission(rawData) {
  Logger.log("=== ⚙️ PROCESSING SUBMISSION ===");
  if (!rawData) {
    Logger.log("⚠️ processSubmission called without rawData payload.");
    rawData = {};
  }

  var extractedMap = normalizeInputKeys(rawData);
  var evaluation = evaluateSubmission(rawData, extractedMap);
  Logger.log("🔍 Evaluation Result: " + JSON.stringify(evaluation));

  var tz = (typeof CONFIG !== 'undefined' && CONFIG.TIMEZONE) ? CONFIG.TIMEZONE : "Pacific/Auckland";
  var timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

  function getValue(keys, defaultValue) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (rawData && rawData[k] !== undefined && rawData[k] !== null && String(rawData[k]).trim() !== '') {
        var v = rawData[k];
        return Array.isArray(v) ? v.join(", ").trim() : String(v).trim();
      }
    }
    for (var j = 0; j < keys.length; j++) {
      var cleanK = keys[j].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      if (extractedMap && extractedMap[cleanK] !== undefined && extractedMap[cleanK] !== null && String(extractedMap[cleanK]).trim() !== '') {
        return String(extractedMap[cleanK]).trim();
      }
    }
    // Search by partial fuzzy match
    for (var rawKey in rawData) {
      if (!rawData.hasOwnProperty(rawKey)) continue;
      var lowerKey = rawKey.toLowerCase();
      for (var p = 0; p < keys.length; p++) {
        var targetKey = keys[p].toLowerCase();
        if (targetKey.length > 2 && lowerKey.indexOf(targetKey) !== -1) {
          var val = rawData[rawKey];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return Array.isArray(val) ? val.join(", ").trim() : String(val).trim();
          }
        }
      }
    }
    return defaultValue;
  }

  var nameVal = getValue(['entry.1576532276', 'entry_1576532276', 'name', 'fullName', 'full_name', 'your_name', 'Name'], "N/A");
  
  // Extract email address with fallback to scan all input fields for an '@' symbol
  var emailVal = getValue(['entry.817428911', 'entry_817428911', 'email', 'emailAddress', 'email_address', 'Email', 'Your Email', 'contact_email'], "N/A");
  if (emailVal === "N/A" && rawData) {
    for (var rawK in rawData) {
      if (!rawData.hasOwnProperty(rawK)) continue;
      var rawV = String(rawData[rawK]).trim();
      if (rawV.indexOf("@") !== -1 && rawV.indexOf(".") !== -1 && rawV.indexOf(" ") === -1) {
        emailVal = rawV;
        break;
      }
    }
  }

  var phoneVal = getValue(['entry.1285532466', 'entry_1285532466', 'phone', 'phoneNumber', 'contact_number', 'mobile', 'Phone'], "N/A");
  var addressVal = getValue(['entry.1293794731', 'entry_1293794731', 'address', 'location', 'Address'], "N/A");
  var categoryVal = getValue(['entry.343301224', 'entry_343301224', 'userType', 'category', 'usertype'], evaluation.category || "General Inquiry");
  var situationVal = getValue(['entry.650060968', 'entry_650060968', 'situation', 'subject', 'Situation'], "New Website Lead");
  
  var messageVal = getValue([
    'entry.483026621', 'entry_483026621', 
    'entry.1883892334', 'entry_1883892334', 
    'what_are_you_trying_to_achieve', 'What Are You Trying To Achieve?', 
    'achievement', 'message', 'goal', 'details', 'desired_outcome'
  ], "");
  
  var timeframeVal = getValue([
    'entry.1883892334', 'entry_1883892334', 
    'entry.483026621', 'entry_483026621', 
    'how_soon_do_you_need_help', 'How Soon Do You Need Help?', 
    'timeframe', 'urgency', 'timeline'
  ], "N/A");

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
    flagReasons: (evaluation.flagReasons && evaluation.flagReasons.length) ? evaluation.flagReasons.join(" | ") : "",
    reasons: evaluation.flagReasons || [],
    flags: evaluation.flagReasons || [],
    status: evaluation.statusLabel || "NEW INQUIRY",
    rawData: JSON.stringify(rawData)
  };

  Logger.log("👤 Extracted Lead Profile:");
  Logger.log("   - Name: " + submission.name);
  Logger.log("   - Email: " + submission.email);
  Logger.log("   - Phone: " + submission.phone);
  Logger.log("   - Category: " + submission.category);
  Logger.log("   - Status: " + submission.status);

  logToSheet(submission);
  sendEmails(submission, evaluation);

  Logger.log("=== ✅ SUBMISSION PROCESSING COMPLETE ===");
  return submission;
}

function normalizeInputKeys(rawData) {
  var map = {};
  if (!rawData) return map;

  for (var key in rawData) {
    if (!rawData.hasOwnProperty(key)) continue;
    var cleanKey = key.toString().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    var val = rawData[key];
    if (Array.isArray(val)) val = val.join(", ");
    map[cleanKey] = String(val || '').trim();
  }
  return map;
}

function evaluateSubmission(rawData, map) {
  var flagReasons = [];
  var spamScore = 0;
  var isSpam = false;
  var isReviewRequired = false;
  var isUrgent = false;

  function extractValue(keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (rawData && rawData[k] !== undefined && rawData[k] !== null && String(rawData[k]).trim() !== '') {
        var v = rawData[k];
        return Array.isArray(v) ? v.join(" ").trim() : String(v).trim();
      }
    }
    for (var j = 0; j < keys.length; j++) {
      var cleanK = keys[j].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      if (map && map[cleanK] !== undefined && map[cleanK] !== null && String(map[cleanK]).trim() !== '') {
        return String(map[cleanK]).trim();
      }
    }
    return "";
  }

  var goalText = extractValue([
    'entry.483026621', 'entry_483026621',
    'entry.1883892334', 'entry_1883892334', 
    'what_are_you_trying_to_achieve', 'What Are You Trying To Achieve?', 
    'achievement', 'message', 'goal', 'details', 'desired_outcome'
  ]);

  var timeframeText = extractValue([
    'entry.1883892334', 'entry_1883892334',
    'entry.483026621', 'entry_483026621', 
    'how_soon_do_you_need_help', 'How Soon Do You Need Help?', 
    'timeframe', 'urgency', 'timeline'
  ]);

  // 1. Honeypot Check
  var hpField = (typeof CONFIG !== 'undefined' && CONFIG.HONEYPOT_FIELD) ? CONFIG.HONEYPOT_FIELD.toLowerCase() : "website";
  if ((map[hpField] && map[hpField] !== "") || map['honeypot'] || map['website_url_hp']) {
    isSpam = true;
    spamScore += 5;
    flagReasons.push("Honeypot field filled ('" + hpField + "')");
  }

  // 2. Review Keywords Evaluation (Fixed for short terms like "TV")
  var reviewKeywords = getFlaggedKeywords();
  
  // Always enforce "tv" in the keyword check list
  if (reviewKeywords.indexOf("tv") === -1 && reviewKeywords.indexOf("TV") === -1) {
    reviewKeywords.unshift("tv");
  }

  var goalLower = goalText.toLowerCase();
  var goalMatches = [];

  if (goalLower.length > 0) {
    for (var g = 0; g < reviewKeywords.length; g++) {
      var rawKw = reviewKeywords[g].toString().toLowerCase().trim();
      if (!rawKw) continue;

      var isMatched = false;

      // Handle short terms (e.g. "tv", "seo") with regex word boundaries
      if (rawKw.length <= 3) {
        var rx = new RegExp('(^|[^a-z0-9])' + rawKw + '($|[^a-z0-9])', 'i');
        if (rx.test(goalLower)) {
          isMatched = true;
        }
      } else {
        var stemKw = rawKw.replace(/(ing|ers?|ed|es?)$/i, "");
        if (goalLower.indexOf(rawKw) !== -1 || (stemKw.length >= 3 && goalLower.indexOf(stemKw) !== -1)) {
          isMatched = true;
        }
      }

      if (isMatched && goalMatches.indexOf(rawKw) === -1) {
        goalMatches.push(rawKw);
      }
    }

    if (goalMatches.length > 0) {
      isReviewRequired = true;
      flagReasons.push("Goal / Desired Outcome matched review keyword(s): " + goalMatches.join(", "));
    }
  }

  // 3. Timeframe Urgency Check
  var urgentKeywords = ['asap', 'as soon as possible', 'urgent', 'urgently', 'immediately', 'critical', 'emergency', 'right away', 'today', '24 hours', 'soon'];
  var timeframeLower = timeframeText.toLowerCase();
  var matchedUrgent = [];

  for (var u = 0; u < urgentKeywords.length; u++) {
    var uk = urgentKeywords[u];
    if (timeframeLower.indexOf(uk) !== -1) {
      matchedUrgent.push(uk);
    }
  }

  if (matchedUrgent.length > 0) {
    isUrgent = true;
    flagReasons.push("Urgent timeframe detected: '" + matchedUrgent.join(", ") + "'");
  }

  // 4. Multiple URLs Check
  var textParts = [goalText, timeframeText];
  for (var k in map) {
    if (map[k] && typeof map[k] === 'string') textParts.push(map[k]);
  }
  var combinedText = textParts.join(" ").toLowerCase();

  var urlMatch = combinedText.match(/https?:\/\/[^\s]+|www\.[^\s]+/g);
  var linkCount = urlMatch ? urlMatch.length : 0;
  if (linkCount > 1) {
    spamScore += 2;
    isSpam = true;
    flagReasons.push("Contains multiple URLs (" + linkCount + ")");
  }

  // 5. Phone Validation (Restricted to repeated single-digits)
  var phoneStr = String(map['entry_1285532466'] || map['phone'] || map['mobile'] || map['entry.1285532466'] || '').replace(/[^0-9]/g, '');
  if (phoneStr.length > 0) {
    if (/^0+$/.test(phoneStr) || /^1+$/.test(phoneStr)) {
      spamScore += 1;
      flagReasons.push("Suspicious phone format");
    }
  }

  // 6. Threshold & Status Label Assembly
  var threshold = (typeof CONFIG !== 'undefined' && CONFIG.SPAM_THRESHOLD) ? CONFIG.SPAM_THRESHOLD : 3;
  if (spamScore >= threshold) {
    isSpam = true;
  }

  var statusParts = [];
  if (isReviewRequired) statusParts.push("REVIEW REQUIRED");
  if (isSpam) statusParts.push("SPAM DETECTED");
  if (isUrgent) statusParts.push("URGENT");

  var statusLabel = statusParts.length > 0 ? statusParts.join(" | ") : "NEW INQUIRY";
  var category = categorizeLead(combinedText);

  return {
    isSpam: isSpam,
    isReviewRequired: isReviewRequired,
    isUrgent: isUrgent,
    spamScore: spamScore,
    flagReasons: flagReasons,
    reasons: flagReasons,
    flags: flagReasons,
    statusLabel: statusLabel,
    category: category
  };
}

function categorizeLead(text) {
  if (typeof CONFIG === 'undefined' || !CONFIG.DEFAULT_TAXONOMY || !CONFIG.DEFAULT_TAXONOMY.categories) {
    return "General Inquiry";
  }

  var categories = CONFIG.DEFAULT_TAXONOMY.categories;
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    if (cat.keywords && Array.isArray(cat.keywords)) {
      for (var k = 0; k < cat.keywords.length; k++) {
        if (text.indexOf(cat.keywords[k].toLowerCase()) !== -1) {
          return cat.name;
        }
      }
    }
  }
  return "General Inquiry";
}

function getFlaggedKeywords() {
  var keywords = (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.FLAGGED_KEYWORDS))
    ? CONFIG.FLAGGED_KEYWORDS.slice()
    : ["crypto", "seo", "invest", "loans", "casino", "viagra", "guest post", "backlinks", "tv tune", "tv tuning", "tv tuned", "tv"];

  try {
    var ss = getTargetSpreadsheetInstance();
    if (ss) {
      var flaggedSheet = ss.getSheetByName("Flagged");
      if (flaggedSheet) {
        var data = flaggedSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          var word = String(data[i][0]).toLowerCase().trim();
          if (word && keywords.indexOf(word) === -1) {
            keywords.push(word);
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Notice reading Flagged tab: " + e.toString());
  }
  return keywords;
}

function logToSheet(submission) {
  submission = submission || {};
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var ss = getTargetSpreadsheetInstance();
    if (!ss) {
      Logger.log("❌ logToSheet Failed: Target spreadsheet instance not resolved.");
      return;
    }

    var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Form Responses 1";
    var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "Lead ID", "Timestamp", "Status", "Name", "Email", "Phone",
        "Category", "Subject / Situation", "Message / Goal", "Timeframe",
        "Is Spam", "Review Required", "Spam Score", "Flag Reasons"
      ]);
    }

    sheet.appendRow([
      submission.id || "LEAD-" + Date.now(),
      submission.timestamp || new Date().toISOString(),
      submission.status || "NEW INQUIRY",
      submission.name || "N/A",
      submission.email || "N/A",
      submission.phone || "N/A",
      submission.category || submission.userType || "General Inquiry",
      submission.subject || submission.situation || "N/A",
      submission.message || submission.achievement || "",
      submission.timeframe || "N/A",
      submission.isSpam ? "YES" : "NO",
      submission.isReviewRequired ? "YES" : "NO",
      submission.spamScore || 0,
      submission.flagReasons || ""
    ]);

    SpreadsheetApp.flush();
    lock.releaseLock();
    Logger.log("📊 Successfully logged submission " + submission.id + " to tab '" + sheet.getName() + "'.");
  } catch (err) {
    Logger.log("❌ logToSheet Error: " + err.toString());
  }
}

function sendEmails(submission, evalResult) {
  sendAdminNotification(submission, evalResult);
  sendClientConfirmation(submission);
}

function sendAdminNotification(submission, evalResult) {
  submission = submission || {};

  var adminEmail = (typeof CONFIG !== 'undefined' && CONFIG.ADMIN_EMAIL) ? CONFIG.ADMIN_EMAIL : "tom@rd3tech.com";
  var senderName = (typeof CONFIG !== 'undefined' && CONFIG.SENDER_NAME) ? CONFIG.SENDER_NAME : "RD3 Tech";
  var companyName = (typeof CONFIG !== 'undefined' && CONFIG.COMPANY_NAME) ? CONFIG.COMPANY_NAME : senderName;

  var categoryText = String(submission.category || submission.userType || "General Inquiry");
  var upperCategory = categoryText.toUpperCase();

  var flags = [];
  if (submission.isReviewRequired || (evalResult && evalResult.isReviewRequired)) flags.push("REVIEW REQUIRED");
  if (submission.isUrgent || (evalResult && evalResult.isUrgent))                 flags.push("URGENT INQUIRY");
  if (submission.isSpam || (evalResult && evalResult.isSpam))                     flags.push("SPAM DETECTED");

  var subjectPrefix = flags.length > 0 ? "⚠️ [" + flags.join(" | ") + "] " : "🚀 [NEW LEAD - " + upperCategory + "] ";
  var leadName = submission.name || "N/A";
  var adminSubject = subjectPrefix + (submission.subject || submission.situation || categoryText) + " - " + leadName;

  try {
    var template = HtmlService.createTemplateFromFile("AdminTemplate");

    template.submission = submission;
    template.companyName = companyName;
    template.senderName = senderName;

    template.category = categoryText;
    template.userType = categoryText;
    template.name = submission.name || "N/A";
    template.email = submission.email || "N/A";
    template.phone = submission.phone || "N/A";
    template.address = submission.address || "N/A";
    template.subject = submission.subject || submission.situation || "N/A";
    template.situation = submission.situation || submission.subject || "N/A";
    template.message = submission.message || submission.achievement || "N/A";
    template.achievement = submission.achievement || submission.message || "N/A";
    template.timeframe = submission.timeframe || "N/A";
    template.evalResult = evalResult || {
      isSpam: submission.isSpam || false,
      isReviewRequired: submission.isReviewRequired || false,
      isUrgent: submission.isUrgent || false,
      spamScore: submission.spamScore || 0,
      flagReasons: submission.flagReasons || "",
      reasons: submission.reasons || [],
      flags: submission.flags || []
    };

    var htmlBody = template.evaluate().getContent();

    var emailOptions = {
      htmlBody: htmlBody,
      name: senderName
    };

    if (submission.email && submission.email !== 'N/A' && submission.email.indexOf("@") !== -1) {
      emailOptions.replyTo = submission.email;
    }

    GmailApp.sendEmail(adminEmail, adminSubject, "Please enable HTML in your email client to view this message.", emailOptions);

    Logger.log("✅ Admin Notification sent successfully to: " + adminEmail);
  } catch (adminErr) {
    Logger.log("❌ Admin Email Error: " + adminErr.toString());
  }
}

function sendClientConfirmation(submission) {
  submission = submission || {};
  var clientEmail = submission.email ? String(submission.email).trim() : "";
  var senderName = (typeof CONFIG !== 'undefined' && CONFIG.SENDER_NAME) ? CONFIG.SENDER_NAME : "RD3 Tech";
  var companyName = (typeof CONFIG !== 'undefined' && CONFIG.COMPANY_NAME) ? CONFIG.COMPANY_NAME : senderName;

  if (submission.isSpam) {
    Logger.log("⚠️ Skipped Client Email: Marked as SPAM.");
    return;
  }

  if (!clientEmail || clientEmail === "N/A" || clientEmail.indexOf("@") === -1) {
    Logger.log("❌ Skipped Client Email: Invalid email address ('" + clientEmail + "').");
    return;
  }

  try {
    var clientSubject = "We received your request - " + companyName;
    var template = HtmlService.createTemplateFromFile("ClientTemplate");

    template.submission = submission;
    template.companyName = companyName;
    template.senderName = senderName;

    template.name = submission.name || "N/A";
    template.email = clientEmail;
    template.phone = submission.phone || "N/A";
    template.subject = submission.subject || "N/A";
    template.message = submission.message || "N/A";

    var htmlBody = template.evaluate().getContent();

    GmailApp.sendEmail(clientEmail, clientSubject, "Please enable HTML to view this email.", {
      htmlBody: htmlBody,
      name: senderName
    });

    Logger.log("✅ Client Confirmation Email successfully sent to: " + clientEmail);
  } catch (err) {
    Logger.log("❌ Client Email Error: " + err.toString());
  }
}

function getTargetSpreadsheetInstance() {
  if (typeof getTargetSpreadsheet === 'function') {
    return getTargetSpreadsheet();
  }

  if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } catch (e) {
      Logger.log("Failed opening spreadsheet by ID: " + e.toString());
    }
  }

  return SpreadsheetApp.getActiveSpreadsheet();
} 

function parseIncomingRequest(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {}
  }
  return e.parameter || {};
}

/**
 * Run this function directly in Google Apps Script Editor to test client & admin dispatches
 */
function testClientEmailDirectly() {
  var testPayload = {
    "Name": "John Test",
    "Email": "tom@rd3tech.com",
    "Phone": "0211234567",
    "Situation": "Need help with TV setup",
    "Message": "Need TV SEO done as soon as possible"
  };
  
  Logger.log("--- STARTING DIRECT TEST ---");
  var result = processSubmission(testPayload);
  Logger.log("--- TEST RESULT COMPLETE ---");
}