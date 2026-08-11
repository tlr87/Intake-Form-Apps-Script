/**
 * EmailService.gs - Lead Ingestion & Processing Engine for RD3 Tech
 * Reads CONFIG directly from Config.gs (Do not declare var CONFIG in this file)
 */

/**
 * Global EmailService Namespace
 * Exposes methods expected by Triggers.gs and external webhooks
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

/**
 * Handles Webhook / HTTP POST submissions
 */
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

/**
 * Handles Google Form response triggers
 */
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
  
  // Format timestamp using timezone from Config
  var tz = (typeof CONFIG !== 'undefined' && CONFIG.TIMEZONE) ? CONFIG.TIMEZONE : "Pacific/Auckland";
  var timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

  // Helper to search rawData & extractedMap for any matching key variant
  function getValue(keys, defaultValue) {
    // 1. Direct rawData lookup
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (rawData && rawData[k] !== undefined && rawData[k] !== null && String(rawData[k]).trim() !== '') {
        return String(rawData[k]).trim();
      }
    }
    // 2. Normalized map lookup
    for (var j = 0; j < keys.length; j++) {
      var cleanK = keys[j].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      if (extractedMap && extractedMap[cleanK] !== undefined && extractedMap[cleanK] !== null && String(extractedMap[cleanK]).trim() !== '') {
        return String(extractedMap[cleanK]).trim();
      }
    }
    return defaultValue;
  }

  var nameVal = getValue(['name', 'fullName', 'full_name', 'your_name', 'first_name'], "N/A");
  var emailVal = getValue(['email', 'emailAddress', 'email_address', 'your_email'], "N/A");
  var phoneVal = getValue(['phone', 'phoneNumber', 'contact_number', 'mobile', 'telephone'], "N/A");
  var addressVal = getValue(['address', 'location'], "N/A");
  
  var categoryVal = getValue(
    ['userType', 'category', 'user_type', 'usertype', 'i_am_contacting_rd3_tech_as', 'I am contacting RD3 Tech as:'], 
    evaluation.category || "General Inquiry"
  );
  
  var situationVal = getValue(
    ['situation', 'subject', 'what_sounds_like_your_situation', 'What sounds like your situation?', 'problem', 'service'], 
    "New Website Lead"
  );
  
  var messageVal = getValue(
    ['achievement', 'message', 'goal', 'details', 'what_are_you_trying_to_achieve', 'What Are You Trying To Achieve?', 'comments', 'desired_outcome'], 
    ""
  );
  
  var timeframeVal = getValue(
    ['timeframe', 'urgency', 'how_soon_do_you_need_help', 'How Soon Do You Need Help?', 'timeline'], 
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
 * Normalizes parameter keys (lowercase, strips special chars)
 */
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

/**
 * Evaluates spam rules, honeypot, keywords, and taxonomy categories
 */
function evaluateSubmission(rawData, map) {
  var flagReasons = [];
  var spamScore = 0;
  var isSpam = false;
  var isReviewRequired = false;
  var isUrgent = false;

  // 1. Honeypot Field Check from Config
  var hpField = (typeof CONFIG !== 'undefined' && CONFIG.HONEYPOT_FIELD) ? CONFIG.HONEYPOT_FIELD.toLowerCase() : "website";
  if ((map[hpField] && map[hpField] !== "") || map['honeypot'] || map['website_url_hp']) {
    isSpam = true;
    spamScore += 5;
    flagReasons.push("Honeypot field filled ('" + hpField + "')");
  }

  // Combine submission text for term scanning
  var textParts = [];
  for (var k in map) {
    if (map[k] && typeof map[k] === 'string') textParts.push(map[k]);
  }
  var combinedText = textParts.join(" ").toLowerCase();

  // 2. Keyword Moderation
  var keywords = getFlaggedKeywords();
  var matchedKeywords = [];
  for (var i = 0; i < keywords.length; i++) {
    var kw = keywords[i].toLowerCase().trim();
    if (kw.length > 0 && combinedText.indexOf(kw) !== -1) {
      matchedKeywords.push(kw);
      spamScore += 1;
    }
  }
  if (matchedKeywords.length > 0) {
    isReviewRequired = true;
    flagReasons.push("Matched keywords: " + matchedKeywords.join(", "));
  }

  // 3. Link Count Check (>1 link raises suspicion)
  var urlMatch = combinedText.match(/https?:\/\/[^\s]+|www\.[^\s]+/g);
  var linkCount = urlMatch ? urlMatch.length : 0;
  if (linkCount > 1) {
    spamScore += 2;
    isSpam = true;
    flagReasons.push("Contains multiple URLs (" + linkCount + ")");
  }

  // 4. Phone Pattern Validation
  var phoneStr = String(map['phone'] || map['mobile'] || map['contact_number'] || '').replace(/[^0-9]/g, '');
  if (phoneStr.length > 0) {
    if (/^0+$/.test(phoneStr) || /^(\d)\1+$/.test(phoneStr) || phoneStr === '123456789' || phoneStr === '0123456789' || phoneStr.length < 7) {
      spamScore += 2;
      isSpam = true;
      flagReasons.push("Suspicious phone format");
    }
  }

  // 5. Urgency Check
  if (combinedText.indexOf('asap') !== -1 || combinedText.indexOf('urgent') !== -1 || combinedText.indexOf('immediately') !== -1) {
    isUrgent = true;
  }

  // 6. Spam Threshold Check against Config
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

/**
 * Matches submission text against CONFIG.DEFAULT_TAXONOMY categories
 */
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

/**
 * Merges CONFIG.FLAGGED_KEYWORDS with keywords from the 'Flagged' sheet tab
 */
function getFlaggedKeywords() {
  var keywords = (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.FLAGGED_KEYWORDS)) 
    ? CONFIG.FLAGGED_KEYWORDS.slice() 
    : ["crypto", "seo", "invest", "loans", "casino", "viagra", "guest post", "backlinks"];

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

/**
 * Logs data safely with LockService to avoid concurrent row conflicts
 */
function logToSheet(submission) {
  submission = submission || {};
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var ss = getTargetSpreadsheetInstance();
    if (!ss) {
      Logger.log("Could not open spreadsheet in logToSheet.");
      return;
    }

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
  } catch (err) {
    Logger.log("logToSheet Error: " + err.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Dispatches both Admin and Client HTML emails via templates
 */
function sendEmails(submission, evalResult) {
  sendAdminNotification(submission, evalResult);
  sendClientConfirmation(submission);
}

/**
 * Sends Admin Alert Email rendering AdminTemplate.html
 */
function sendAdminNotification(submission, evalResult) {
  submission = submission || {};

  var adminEmail = (typeof CONFIG !== 'undefined' && CONFIG.ADMIN_EMAIL) ? CONFIG.ADMIN_EMAIL : "tom@rd3tech.com";
  var senderName = (typeof CONFIG !== 'undefined' && CONFIG.SENDER_NAME) ? CONFIG.SENDER_NAME : "RD3 Tech";
  var companyName = (typeof CONFIG !== 'undefined' && CONFIG.COMPANY_NAME) ? CONFIG.COMPANY_NAME : senderName;

  var categoryText = String(submission.category || submission.userType || "General Inquiry");
  var upperCategory = categoryText.toUpperCase();

  var flags = [];
  if (submission.isReviewRequired || (evalResult && evalResult.requiresReview)) flags.push("REVIEW REQUIRED");
  if (submission.isSpam || (evalResult && evalResult.isSpam))                   flags.push("SPAM DETECTED");
  if (submission.isUrgent || (evalResult && evalResult.isUrgent))               flags.push("URGENT INQUIRY");

  var subjectPrefix = flags.length > 0 ? "⚠️ [" + flags.join(", ") + "] " : "🚀 [NEW LEAD - " + upperCategory + "] ";
  var leadName = submission.name || "N/A";
  var adminSubject = subjectPrefix + (submission.subject || submission.situation || categoryText) + " - " + leadName;

  try {
    var template = HtmlService.createTemplateFromFile("AdminTemplate");

    // Standard container object
    template.submission = submission;
    template.companyName = companyName;
    template.senderName = senderName;

    // Top-level property bindings to prevent ReferenceErrors in template evaluation
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

/**
 * Sends Client Confirmation Email rendering ClientTemplate.html
 */
function sendClientConfirmation(submission) {
  submission = submission || {};

  var senderName = (typeof CONFIG !== 'undefined' && CONFIG.SENDER_NAME) ? CONFIG.SENDER_NAME : "RD3 Tech";
  var companyName = (typeof CONFIG !== 'undefined' && CONFIG.COMPANY_NAME) ? CONFIG.COMPANY_NAME : senderName;

  var categoryText = String(submission.category || submission.userType || "General Inquiry");

  if (!submission.isSpam && submission.email && submission.email !== 'N/A' && submission.email.indexOf("@") !== -1) {
    try {
      var clientSubject = "We received your request - " + companyName;

      var template = HtmlService.createTemplateFromFile("ClientTemplate");

      // Standard container object
      template.submission = submission;
      template.companyName = companyName;
      template.senderName = senderName;

      // Top-level property bindings to prevent ReferenceErrors in template evaluation
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

/**
 * Helper to safely get Spreadsheet instance using Config fallback
 */
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

/**
 * Parses JSON post data or form parameters
 */
function parseIncomingRequest(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {}
  }
  return e.parameter || {};
}