/**
 * RD3 TECH — CONTACT FORM BACKEND & AUTO-RESPONDER SYSTEM
 * Location: Code.gs
 */

// Global Configuration
var ADMIN_EMAIL = "tom@rd3tech.com";
var SPREADSHEET_ID = "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY";

/**
 * 1a. HTTP POST Endpoint (Receives WordPress Web App & Form POST submissions)
 */
function doPost(e) {
  try {
    var data = {};

    // Parse incoming payload (URL Search Params or JSON)
    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      data = e.parameter;
    } else if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        var params = new URLSearchParams(e.postData.contents);
        for (var pair of params.entries()) {
          data[pair[0]] = pair[1];
        }
      }
    }

    Logger.log("Received Form Keys: " + JSON.stringify(Object.keys(data)));

    // Anti-Spam Honeypot Verification
    var honeypotValue = data.hp_website || data.website_hp || data.website_url || "";
    var isSpam = (honeypotValue.toString().trim() !== "");

    // Field Extraction (Supports standard web keys AND Google Form entry IDs)
    var name = (data.name || data.fullName || data["entry.1576532276"] || "").trim();
    var userEmail = (data.email || data.userEmail || data.contactEmail || data["entry.817428911"] || "").trim();
    var phone = (data.phone || data.userPhone || data["entry.1285532466"] || "").trim();
    var userType = (data.userType || data.clientType || data["entry.343301224"] || "").trim();
    var situation = (data.situation || data.issue || data["entry.650060968"] || "").trim();
    var achievement = (data.achievement || data.goal || data["entry.483026621"] || "").trim();
    var timeframe = (data.timeframe || data.urgency || data["entry.1883892334"] || "").trim();

    Logger.log("Extracted Client Email: '" + userEmail + "'");

    // Execute submission processing pipeline
    processSubmission(name, userEmail, phone, userType, situation, achievement, timeframe, isSpam);

    return ContentService.createTextOutput(JSON.stringify({ result: "success", isSpam: isSpam }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Critical Error in doPost: " + error.toString());
    
    try {
      MailApp.sendEmail(ADMIN_EMAIL, "⚠️ Web App doPost Error Alert", error.toString() + "\n\nStack:\n" + error.stack);
    } catch (mailErr) {
      Logger.log("Failed to send error alert: " + mailErr.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 1b. Native Google Form Submit Trigger
 * Runs automatically when someone fills out the Google Form directly.
 */
function onFormSubmit(e) {
  try {
    if (!e || !e.response) {
      Logger.log("onFormSubmit triggered manually without event object.");
      return;
    }

    var itemResponses = e.response.getItemResponses();
    
    var name = "";
    var userEmail = e.response.getRespondentEmail() || "";
    var phone = "";
    var userType = "";
    var situation = "";
    var achievement = "";
    var timeframe = "";

    for (var i = 0; i < itemResponses.length; i++) {
      var itemResponse = itemResponses[i];
      var title = itemResponse.getItem().getTitle().toLowerCase();
      var response = itemResponse.getResponse();

      if (title.indexOf("name") !== -1) name = response;
      else if (title.indexOf("email") !== -1 && !userEmail) userEmail = response;
      else if (title.indexOf("phone") !== -1) phone = response;
      else if (title.indexOf("category") !== -1 || title.indexOf("user") !== -1) userType = response;
      else if (title.indexOf("situation") !== -1 || title.indexOf("problem") !== -1) situation = response;
      else if (title.indexOf("goal") !== -1 || title.indexOf("outcome") !== -1) achievement = response;
      else if (title.indexOf("timeframe") !== -1 || title.indexOf("soon") !== -1) timeframe = response;
    }

    Logger.log("Google Form Trigger Received for: " + name + " (" + userEmail + ")");
    processSubmission(name, userEmail, phone, userType, situation, achievement, timeframe, false);

  } catch (err) {
    Logger.log("Error in onFormSubmit trigger: " + err.toString());
  }
}

/**
 * 2. Core Business Logic & Processing Pipeline
 */
function processSubmission(name, userEmail, phone, userType, situation, achievement, timeframe, isSpam) {
  isSpam = Boolean(isSpam);

  var combinedText = (name + " " + userEmail + " " + situation + " " + achievement + " " + userType).toLowerCase();

  var flaggedTerms = getFlaggedTermsFromSheet();
  var requiresReview = false;
  var matchedTerms = [];

  if (flaggedTerms.length > 0) {
    for (var j = 0; j < flaggedTerms.length; j++) {
      var safeTerm = escapeRegex(flaggedTerms[j]);
      var regex = new RegExp("\\b" + safeTerm + "\\b", "i");
      if (regex.test(combinedText)) {
        requiresReview = true;
        matchedTerms.push(flaggedTerms[j]);
      }
    }
  }

  var templates = getEmailTemplatesFromSheet();

  var flagPrefix = "";
  var textFlagAlert = "";

  if (isSpam) {
    flagPrefix = "[SPAM DETECTED] ";
    textFlagAlert = "🚫 SPAM NOTICE: Honeypot field was filled out on this submission.\n\n";
  } else if (requiresReview) {
    flagPrefix = "[PLEASE REVIEW] ";
    textFlagAlert = "⚠️ PLEASE REVIEW: Submission contains flagged keyword(s): " + matchedTerms.join(", ") + "\n\n";
  }

  var submitTime = new Date().toLocaleString();

  // Save entry to spreadsheet "Records" tab via Sheets.gs
  var submissionPayload = {
    submitTime: submitTime,
    name: name,
    email: userEmail,
    phone: phone,
    userType: userType,
    situation: situation,
    achievement: achievement,
    timeframe: timeframe,
    isSpam: isSpam,
    requiresReview: requiresReview,
    matchedTerms: matchedTerms
  };

  if (typeof saveSubmissionToSheet === "function") {
    saveSubmissionToSheet(submissionPayload);
  } else {
    Logger.log("Warning: saveSubmissionToSheet function not found in project.");
  }

  // Admin Email Dispatch
  var adminHtmlBody = "";
  if (templates.AdminBody && templates.AdminBody.trim().length > 0) {
    var htmlFlagBanner = "";
    if (isSpam) {
      htmlFlagBanner = '<div style="background-color: #f8d7da; color: #721c24; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-weight: bold; font-family: sans-serif;">🚫 SPAM NOTICE: Honeypot field was filled out.</div>';
    } else if (requiresReview) {
      htmlFlagBanner = '<div style="background-color: #fff3cd; color: #856404; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-weight: bold; font-family: sans-serif;">⚠️ PLEASE REVIEW: Contains flagged keyword(s): ' + matchedTerms.join(", ") + '</div>';
    }

    adminHtmlBody = templates.AdminBody
      .replace(/{FLAG_BANNER}/g, htmlFlagBanner)
      .replace(/{NAME}/g, escapeHtml(name || "Not provided"))
      .replace(/{EMAIL}/g, escapeHtml(userEmail || "Not provided"))
      .replace(/{PHONE}/g, escapeHtml(phone || "Not provided"))
      .replace(/{USER_TYPE}/g, escapeHtml(userType || "Not specified"))
      .replace(/{SITUATION}/g, escapeHtml(situation || "Not specified"))
      .replace(/{ACHIEVEMENT}/g, escapeHtml(achievement || "Not specified"))
      .replace(/{TIMEFRAME}/g, escapeHtml(timeframe || "Not specified"))
      .replace(/{SUBMIT_TIME}/g, submitTime);

  } else {
    var adminTemplate = HtmlService.createTemplateFromFile('AdminTemplate');
    adminTemplate.isSpam = isSpam;
    adminTemplate.requiresReview = requiresReview;
    adminTemplate.matchedTerms = matchedTerms;
    adminTemplate.name = name;
    adminTemplate.email = userEmail;
    adminTemplate.phone = phone;
    adminTemplate.userType = userType;
    adminTemplate.situation = situation;
    adminTemplate.achievement = achievement;
    adminTemplate.timeframe = timeframe;
    adminTemplate.submitTime = submitTime;

    adminHtmlBody = adminTemplate.evaluate().getContent();
  }

  var adminSubject = (templates.AdminSubject || "{FLAG_PREFIX}New Inquiry: {NAME}")
    .replace(/{FLAG_PREFIX}/g, flagPrefix)
    .replace(/{NAME}/g, name || "Client");

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: adminSubject,
    body: textFlagAlert + "New Submission received from " + (name || "Client") + " (" + (userEmail || "No Email") + ").",
    htmlBody: adminHtmlBody
  });

  // Client Confirmation Email Dispatch (Skipped if SPAM)
  if (!isSpam && userEmail && userEmail.trim().length > 0) {
    try {
      var userHtmlBody = "";
      if (templates.ClientBody && templates.ClientBody.trim().length > 0) {
        userHtmlBody = templates.ClientBody
          .replace(/{NAME}/g, escapeHtml(name || "there"))
          .replace(/{SITUATION}/g, escapeHtml(situation || achievement || "your technology needs"));
      } else {
        var clientTemplate = HtmlService.createTemplateFromFile('ClientTemplate');
        clientTemplate.name = name || "there";
        clientTemplate.situation = situation || achievement || "your technology needs";

        userHtmlBody = clientTemplate.evaluate().getContent();
      }

      var userSubject = (templates.ClientSubject || "We received your request — RD3 Tech")
        .replace(/{NAME}/g, name || "there");

      MailApp.sendEmail({
        to: userEmail,
        subject: userSubject,
        body: "Hi " + (name || "there") + ",\n\nThank you for reaching out to RD3 Tech! We received your inquiry regarding: \"" + (situation || "your technology needs") + "\". Our team will be in touch shortly.",
        htmlBody: userHtmlBody
      });
      Logger.log("✅ Client HTML confirmation sent to: " + userEmail);

    } catch (clientEmailErr) {
      Logger.log("❌ ERROR sending Client Confirmation Email: " + clientEmailErr.toString());
    }
  }
}

/**
 * 3. Sheet Integration Helpers
 */
function getFlaggedTermsFromSheet() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Settings");
    if (!sheet) return [];

    var data = sheet.getRange("A2:A" + sheet.getLastRow()).getValues();
    var terms = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() !== "") {
        terms.push(data[i][0].toString().trim());
      }
    }
    return terms;
  } catch (e) {
    return [];
  }
}

function getEmailTemplatesFromSheet() {
  var templates = {};
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("EmailTemplates");
    if (!sheet) return templates;

    var data = sheet.getRange("A2:B" + sheet.getLastRow()).getValues();
    for (var i = 0; i < data.length; i++) {
      var key = data[i][0];
      var value = data[i][1];
      if (key) {
        templates[key.toString().trim()] = value ? value.toString().trim() : "";
      }
    }
  } catch (e) {
    Logger.log("Notice: EmailTemplates tab optional.");
  }
  return templates;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}