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
  try {
    var data = parseIncomingRequest(e);
    var result = processSubmission(data);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", id: result ? result.id : "N/A" }))
                          .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                          .setMimeType(ContentService.MimeType.JSON);
  }
}

function onFormSubmit(e) {
  try {
    var data = {};
    if (e && e.namedValues) {
      data = e.namedValues;
    } else if (e && e.response) {
      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        data[itemResponses[i].getItem().getTitle()] = itemResponses[i].getResponse();
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    return processSubmission(data);
  } catch (err) {
    Logger.log("onFormSubmit Error: " + err.toString());
  }
}

function processSubmission(rawData) {
  if (!rawData) {
    Logger.log("⚠️ processSubmission called without rawData payload.");
    rawData = {};
  }

  var extractedMap = normalizeInputKeys(rawData);
  var evaluation = evaluateSubmission(rawData, extractedMap);
  
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
    return defaultValue;
  }

  var nameVal = getValue(['entry.1576532276', 'entry_1576532276', 'name', 'fullName', 'full_name', 'your_name'], "N/A");
  var emailVal = getValue(['entry.817428911', 'entry_817428911', 'email', 'emailAddress', 'email_address'], "N/A");
  var phoneVal = getValue(['entry.1285532466', 'entry_1285532466', 'phone', 'phoneNumber', 'contact_number', 'mobile'], "N/A");
  var addressVal = getValue(['entry.1293794731', 'entry_1293794731', 'address', 'location'], "N/A");
  var categoryVal = getValue(['entry.343301224', 'entry_343301224', 'userType', 'category'], evaluation.category || "General Inquiry");
  var situationVal = getValue(['entry.650060968', 'entry_650060968', 'situation', 'subject'], "New Website Lead");
  
  // entry.483026621 = Goal / Desired Outcome / Service details
  var messageVal = getValue([
    'entry.483026621', 'entry_483026621', 
    'entry.1883892334', 'entry_1883892334', 
    'what_are_you_trying_to_achieve', 'What Are You Trying To Achieve?', 
    'achievement', 'message', 'goal', 'details', 'desired_outcome'
  ], "");
  
  // entry.1883892334 = Timeframe / Urgency
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

  logToSheet(submission);
  sendEmails(submission, evaluation);

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

  // Dual mapping: checks both parameter arrangements
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

  // 2. Keyword Moderation & Stemming
  var reviewKeywords = getFlaggedKeywords();
  var goalLower = goalText.toLowerCase();
  var goalMatches = [];

  if (goalLower.length > 0) {
    for (var g = 0; g < reviewKeywords.length; g++) {
      var rawKw = reviewKeywords[g].toLowerCase().trim();
      if (!rawKw) continue;

      // Stemming logic: removes suffixes (e.g. "tune", "tuning", "tuned")
      var stemKw = rawKw.replace(/(ing|ers?|ed|es?)$/i, "");

      if (goalLower.indexOf(rawKw) !== -1 || (stemKw.length >= 3 && goalLower.indexOf(stemKw) !== -1)) {
        goalMatches.push(rawKw);
      }
    }
    if (goalMatches.length > 0) {
      isReviewRequired = true;
      spamScore += goalMatches.length;
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

  // 5. Phone Validation (Flags 16 zeros like 0000000000000000)
  var phoneStr = String(map['entry_1285532466'] || map['phone'] || map['mobile'] || '').replace(/[^0-9]/g, '');
  if (phoneStr.length > 0) {
    if (/^0+$/.test(phoneStr) || /^(\d)\1+$/.test(phoneStr) || phoneStr === '123456789' || phoneStr === '0123456789' || phoneStr.length < 7) {
      spamScore += 2;
      isSpam = true;
      flagReasons.push("Suspicious phone format");
    }
  }

  // 6. Threshold Check
  var threshold = (typeof CONFIG !== 'undefined' && CONFIG.SPAM_THRESHOLD) ? CONFIG.SPAM_THRESHOLD : 3;
  if (spamScore >= threshold) {
    isSpam = true;
  } else if (spamScore > 0 || linkCount > 0) {
    isReviewRequired = true;
  }

  var statusLabel = "NEW INQUIRY";
  if (isSpam) statusLabel = "SPAM DETECTED";
  else if (isReviewRequired) statusLabel = "REVIEW REQUIRED";

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
    : ["crypto", "seo", "invest", "loans", "casino", "viagra", "guest post", "backlinks", "tv tune", "tv tuning", "tv tuned"];

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
    if (!ss) return;

    var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Form Responses";
    var sheet = ss.getSheetByName(sheetName);

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
  } catch (err) {
    Logger.log("logToSheet Error: " + err.toString());
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
  if (submission.isSpam || (evalResult && evalResult.isSpam))                     flags.push("SPAM DETECTED");
  if (submission.isUrgent || (evalResult && evalResult.isUrgent))                 flags.push("URGENT INQUIRY");

  var subjectPrefix = flags.length > 0 ? "⚠️ [" + flags.join(", ") + "] " : "🚀 [NEW LEAD - " + upperCategory + "] ";
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

    MailApp.sendEmail({
      to: adminEmail,
      subject: adminSubject,
      htmlBody: htmlBody,
      name: senderName,
      replyTo: (submission.email && submission.email !== 'N/A' && submission.email.indexOf("@") !== -1) ? submission.email : undefined
    });

    Logger.log("✅ Admin Email sent successfully to: " + adminEmail);
  } catch (adminErr) {
    Logger.log("Admin Email Error: " + adminErr.toString());
  }
}

function sendClientConfirmation(submission) {
  submission = submission || {};

  var senderName = (typeof CONFIG !== 'undefined' && CONFIG.SENDER_NAME) ? CONFIG.SENDER_NAME : "RD3 Tech";
  var companyName = (typeof CONFIG !== 'undefined' && CONFIG.COMPANY_NAME) ? CONFIG.COMPANY_NAME : senderName;

  var categoryText = String(submission.category || submission.userType || "General Inquiry");

  if (!submission.isSpam && submission.email && submission.email !== 'N/A' && submission.email.indexOf("@") !== -1) {
    try {
      var clientSubject = "We received your request - " + companyName;

      var template = HtmlService.createTemplateFromFile("ClientTemplate");

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

      var htmlBody = template.evaluate().getContent();

      MailApp.sendEmail({
        to: submission.email,
        subject: clientSubject,
        htmlBody: htmlBody,
        name: senderName
      });

      Logger.log("✅ Client Confirmation Email sent successfully to: " + submission.email);
    } catch (clientErr) {
      Logger.log("Client Email Error: " + clientErr.toString());
    }
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