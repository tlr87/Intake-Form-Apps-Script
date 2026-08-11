/**
 * EmailService.gs
 * Handles form submission evaluation, admin notifications, and client confirmation emails.
 */

// Global Configuration
const CONFIG = {
  ADMIN_EMAIL: "tom@rd3tech.com", // Replace with your admin email recipient
  TIMEZONE: "Pacific/Auckland",      // Replace with your timezone
  HONEYPOT_FIELD: "website",         // Honeypot field name (should be hidden on front-end form)
  FLAGGED_KEYWORDS: [                // Keywords that flag submission for admin review
    "crypto", "seo", "invest", "loans", "casino", "viagra", "guest post", "backlinks"
  ]
};

/**
 * Primary entry point function to process incoming form payloads.
 * @param {Object} payload Object containing form submission values.
 */
function processFormSubmission(payload) {
  if (!payload) {
    Logger.log("Error: processFormSubmission received a null or empty payload.");
    return;
  }

  // 1. Evaluate payload for spam indicators or review flags
  const evalResult = evaluateSubmission(payload);

  // 2. Send notification to Admin
  sendAdminEmail(payload, evalResult);

  // 3. Send auto-reply confirmation to Client (skipped if marked as spam or no email given)
  if (payload.email && !evalResult.isSpam) {
    sendClientConfirmation(payload);
  }
}

/**
 * Evaluates the payload against honeypot spam detection and flagged keyword checks.
 * @param {Object} payload 
 * @returns {Object} Evaluation status and flags
 */
function evaluateSubmission(payload) {
  const evalResult = {
    isSpam: false,
    flags: [],
    category: payload.userType || payload.clientCategory || "General Inquiry"
  };

  // Honeypot check: If honeypot input is filled, treat as spam
  if (payload[CONFIG.HONEYPOT_FIELD] && String(payload[CONFIG.HONEYPOT_FIELD]).trim() !== "") {
    evalResult.isSpam = true;
  }

  // Keyword check across primary content fields
  const textToScan = [
    payload.name,
    payload.email,
    payload.situation,
    payload.message,
    payload.achievement
  ].filter(Boolean).join(" ").toLowerCase();

  CONFIG.FLAGGED_KEYWORDS.forEach(function(keyword) {
    if (textToScan.indexOf(keyword.toLowerCase()) !== -1) {
      evalResult.flags.push(keyword);
    }
  });

  return evalResult;
}

/**
 * Builds and sends the administrative email notification using AdminTemplate.html.
 * @param {Object} payload Form inputs
 * @param {Object} evalResult Evaluation results from evaluateSubmission()
 */
function sendAdminEmail(payload, evalResult) {
  try {
    const template = HtmlService.createTemplateFromFile("AdminTemplate");

    // Bind dynamic properties required by AdminTemplate.html
    template.isSpam = evalResult.isSpam;
    template.requiresReview = evalResult.flags.length > 0;
    template.matchedTerms = evalResult.flags;
    template.name = payload.name || "";
    template.email = payload.email || "";
    template.phone = payload.phone || "";
    template.userType = evalResult.category;
    template.situation = payload.situation || payload.message || "";
    template.achievement = payload.achievement || payload.goal || "";
    template.timeframe = payload.timeframe || "";
    template.submitTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    const htmlBody = template.evaluate().getContent();

    // Subject status prefixing
    let subjectPrefix = "";
    if (evalResult.isSpam) {
      subjectPrefix = "🚫 [SPAM] ";
    } else if (evalResult.flags.length > 0) {
      subjectPrefix = "⚠️ [REVIEW NEEDED] ";
    }

    const emailSubject = subjectPrefix + "New Contact Submission - " + (payload.name || "Anonymous");

    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: emailSubject,
      htmlBody: htmlBody
    });

  } catch (error) {
    Logger.log("Error sending Admin Email: " + error.toString());
  }
}

/**
 * Builds and sends the client confirmation email using ClientTemplate.html.
 * @param {Object} payload Form inputs
 */
function sendClientConfirmation(payload) {
  try {
    const template = HtmlService.createTemplateFromFile("ClientTemplate");

    // Bind dynamic properties required by ClientTemplate.html
    template.name = payload.name || "";
    template.situation = payload.situation || payload.message || "";

    const htmlBody = template.evaluate().getContent();

    MailApp.sendEmail({
      to: payload.email,
      subject: "We Received Your Request - RD3 Tech",
      htmlBody: htmlBody
    });

  } catch (error) {
    Logger.log("Error sending Client Confirmation Email: " + error.toString());
  }
}

/**
 * Optional function to test the execution directly inside the Google Apps Script IDE.
 */
function testSubmission() {
  const sampleData = {
    name: "Alex Morgan",
    email: "alex@example.com",
    phone: "+1 (555) 019-2831",
    userType: "Business Client",
    situation: "Looking to automate contract processing using Google Apps Script.",
    achievement: "Reduce manual processing time by 80%",
    timeframe: "Within 2 weeks",
    website: "" // Honeypot left empty
  };

  processFormSubmission(sampleData);
}