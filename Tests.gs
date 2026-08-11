/**
 * ============================================================================
 * RD3 TECH — MASTER TEST SUITE (Tests.gs)
 * 
 * Instructions:
 * - Run `runAllTests()` to execute the full evaluation & lead routing pipeline.
 * - Run `testRunAllBypassTests()` to bypass HTML templates & test raw email delivery.
 * - Run `testTipAllFourBadges()` to verify all status badges and subject formatting.
 * - Run individual functions directly from the Apps Script dropdown.
 * ============================================================================
 */

// Helper to resolve admin email safely across test environments
function getTestAdminEmail() {
  return (typeof ADMIN_EMAIL !== 'undefined' && ADMIN_EMAIL) ? ADMIN_EMAIL : 'tom@rd3tech.com';
}

// Helper to construct comma-separated subject badge tags
function buildSubjectTag(isSpam, isUrgent, requiresReview) {
  var tags = [];
  if (requiresReview) tags.push("REVIEW REQUIRED");
  if (isSpam) tags.push("SPAM DETECTED");
  if (isUrgent) tags.push("URGENT INQUIRY");

  return tags.length > 0 ? "⚠️ [" + tags.join(", ") + "] " : "🚀 [NEW INQUIRY] ";
}

/* ============================================================================
 * SECTION 1: MASTER TEST SUITE (Evaluation & Email Pipeline)
 * ============================================================================ */

function runAllTests() {
  Logger.log('==================================================');
  Logger.log('STARTING FULL TEST SUITE FOR LEAD EVALUATION & EMAIL');
  Logger.log('==================================================\n');

  testStandardInquiry();
  testUrgentInquiry();
  testFlaggedKeywordInquiry();
  testElectronicsReviewKeywordsInquiry();
  testSpamInquiry();
  testGoogleFormSubmission();
  testEmptyPayloadInquiry();
  testTipAllFourBadges();

  Logger.log('==================================================');
  Logger.log('ALL EVALUATION TESTS COMPLETED SUCCESSFULLY');
  Logger.log('==================================================');
}

function testStandardInquiry() {
  Logger.log('--- TEST 1: Standard Inquiry ---');
  
  var payload = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '0411223344',
    address: '123 Tech Street, Melbourne VIC',
    userType: 'Individual',
    situation: 'I need assistance setting up a remote home office station.',
    achievement: 'Ensure stable VPN connection and dual monitor support.',
    timeframe: 'Within the next 2 weeks',
    honeypot: ''
  };

  var evalResult = Evaluation.evaluateLead(payload);
  Logger.log('Spam Score: ' + evalResult.spamScore + ' | Is Spam: ' + evalResult.isSpam + ' | Requires Review: ' + evalResult.requiresReview);
  
  EmailService.sendAdminNotification(payload, evalResult);
  Logger.log('Standard Inquiry Test Completed.\n');
}

function testUrgentInquiry() {
  Logger.log('--- TEST 2: Urgent Inquiry ---');

  var payload = {
    name: 'Marcus Vance',
    email: 'marcus.vance@example.com',
    phone: '0488990011',
    address: '78 Enterprise Rd, Sydney NSW',
    userType: 'Business Owner',
    situation: 'Our primary server went offline and critical data is inaccessible.',
    achievement: 'Restore network connectivity immediately.',
    timeframe: 'ASAP / Urgent',
    honeypot: ''
  };

  var evalResult = Evaluation.evaluateLead(payload);
  Logger.log('Spam Score: ' + evalResult.spamScore + ' | Is Urgent: ' + evalResult.isUrgent);

  EmailService.sendAdminNotification(payload, evalResult);
  Logger.log('Urgent Inquiry Test Completed.\n');
}

function testFlaggedKeywordInquiry() {
  Logger.log('--- TEST 3: Flagged Keyword Review Required ---');

  var payload = {
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    phone: '0412345678',
    address: '456 Business Way, Brisbane QLD',
    userType: 'Business Owner',
    situation: 'We are looking for guest post options and partnership opportunities.',
    achievement: 'Improve organic rankings and acquire quality backlinks.',
    timeframe: 'Next 30 days',
    honeypot: ''
  };

  var evalResult = Evaluation.evaluateLead(payload);
  Logger.log('Spam Score: ' + evalResult.spamScore + ' | Requires Review: ' + evalResult.requiresReview);

  EmailService.sendAdminNotification(payload, evalResult);
  Logger.log('Flagged Keyword Test Completed.\n');
}

function testElectronicsReviewKeywordsInquiry() {
  Logger.log('--- TEST 4: Electronics & Hardware Review Keywords ---');

  var payload = {
    name: 'David Miller',
    email: 'david.miller@example.com',
    phone: '0412987654',
    address: '88 George St, Sydney NSW',
    userType: 'Individual',
    situation: 'My PlayStation console hardware has a TV power failure and display fault.',
    achievement: 'Need soldering or component-level electronics repair.',
    timeframe: 'Next 3 days',
    honeypot: ''
  };

  var evalResult = Evaluation.evaluateLead(payload);
  Logger.log('Spam Score: ' + evalResult.spamScore + ' | Requires Review: ' + evalResult.requiresReview);

  EmailService.sendAdminNotification(payload, evalResult);
  Logger.log('Electronics Review Keywords Test Completed.\n');
}

function testSpamInquiry() {
  Logger.log('--- TEST 5: Spam Detected ---');

  var payload = {
    name: 'Spam Bot',
    email: 'spammer@botnet-domain.xyz',
    phone: '123456789',
    address: 'Unknown',
    userType: 'Marketer',
    situation: 'Buy cheap casino credits and crypto loans at https://example-spam1.com',
    achievement: 'Guaranteed cheap credits',
    timeframe: 'Immediate',
    honeypot: 'gotcha_bot'
  };

  var evalResult = Evaluation.evaluateLead(payload);
  Logger.log('Spam Score: ' + evalResult.spamScore + ' | Is Spam: ' + evalResult.isSpam);

  EmailService.sendAdminNotification(payload, evalResult);
  Logger.log('Spam Inquiry Test Completed.\n');
}

function testGoogleFormSubmission() {
  Logger.log('--- TEST 6: Google Form Pre-filled Link Submission ---');

  var mockFormEvent = {
    namedValues: {
      'Timestamp': ['11/08/2026 15:09:40'],
      'Name': ['Tom Revill'],
      'Email': ['tom.revill@gmail.com'],
      'Phone': ['0210000000'],
      'Address': ['123 Messines Road Karori'],
      'I am contacting RD3 Tech as:': ['Residential / Home User'],
      'What sounds like your situation?': ['Something Broken? — Fix a problem'],
      'What Are You Trying To Achieve?': ['Tv Tuned'],
      'How Soon Do You Need Help?': ['As soon as possible']
    }
  };

  if (typeof onFormSubmit === 'function') {
    onFormSubmit(mockFormEvent);
  } else if (typeof handleFormSubmit === 'function') {
    handleFormSubmit(mockFormEvent);
  } else if (typeof EmailService !== 'undefined' && typeof EmailService.onFormSubmit === 'function') {
    EmailService.onFormSubmit(mockFormEvent);
  } else {
    Logger.log('⚠️ No form handler (onFormSubmit / handleFormSubmit) found in global scope or EmailService.');
  }
  
  Logger.log('Google Form Submission Test Completed.\n');
}

function testEmptyPayloadInquiry() {
  Logger.log('--- TEST 7: Empty / Unprovided Payload ---');

  var emptyPayload = {
    name: '',
    email: '',
    phone: '',
    address: '',
    userType: '',
    situation: '',
    achievement: '',
    timeframe: '',
    honeypot: ''
  };

  var evalResult = Evaluation.evaluateLead(emptyPayload);
  EmailService.sendAdminNotification(emptyPayload, evalResult);

  Logger.log('Empty Payload Test Completed.\n');
}

/**
 * Test runner function to test all badges and the yellow flag reasons box.
 */
function testTipAllFourBadges() {
  var testPayload = {
    name: "Test User - Multi-Flag Lead",
    email: "test@example.com",
    phone: "0000000",
    address: "123 Test St, Auckland",
    userType: "General Enquiry",
    situation: "Need urgent TV screen repair and crypto consultation ASAP.",
    achievement: "Get hardware fixed immediately",
    timeframe: "As soon as possible"
  };

  var testEvalResult = {
    spamScore: 80,
    isSpam: true,
    requiresReview: true,
    isUrgent: true,
    flags: [
      "Suspicious Phone Number ('0000000')",
      "Flagged Review Keyword: 'tv screen'",
      "Spam Keyword Matched: 'crypto'",
      "Urgent Request: 'As soon as possible'"
    ],
    reasons: [
      "Suspicious Phone Number ('0000000')",
      "Flagged Review Keyword: 'tv screen'",
      "Spam Keyword Matched: 'crypto'",
      "Urgent Request: 'As soon as possible'"
    ]
  };

  // Send the notification
  EmailService.sendAdminNotification(testPayload, testEvalResult);
  Logger.log("✅ Test email with all badges and flag reasons box sent!");
}

/* ============================================================================
 * SECTION 2: TEMPLATE BYPASS TESTS (Direct Plain Text Delivery)
 * Use these to confirm Gmail/MailApp connectivity independently of HTML files.
 * ============================================================================ */

function testRunAllBypassTests() {
  Logger.log('==================================================');
  Logger.log('   RUNNING DIRECT TEMPLATE BYPASS EMAIL TESTS     ');
  Logger.log('==================================================\n');
  
  testDirectAdminEmailBypass();
  testDirectClientEmailBypass();
  
  Logger.log('==================================================');
  Logger.log('   ALL DIRECT BYPASS TESTS COMPLETED              ');
  Logger.log('==================================================');
}

function testDirectAdminEmailBypass() {
  Logger.log('--- TEST: Direct Admin Email Bypass ---');
  var targetEmail = getTestAdminEmail();

  var testPayload = {
    name: "Test Admin User",
    email: "test.admin@example.com",
    phone: "021 123 4567",
    address: "456 Bypass Road, Auckland",
    userType: "Commercial / Business",
    situation: "Network outage - urgent fix required",
    achievement: "Restore internet connection",
    timeframe: "As soon as possible"
  };

  var subject = "🧪 [DIRECT TEST - ADMIN BYPASS] New Lead: " + testPayload.name;

  var plainBody = 
    "=== DIRECT ADMIN TEST SUBMISSION (BYPASSED HTML TEMPLATE) ===\n\n" +
    "Name: " + testPayload.name + "\n" +
    "Email: " + testPayload.email + "\n" +
    "Phone: " + testPayload.phone + "\n" +
    "Address: " + testPayload.address + "\n" +
    "Category: " + testPayload.userType + "\n" +
    "Situation: " + testPayload.situation + "\n" +
    "Goal: " + testPayload.achievement + "\n" +
    "Timeframe: " + testPayload.timeframe + "\n\n" +
    "Sent at: " + new Date().toString();

  MailApp.sendEmail({
    to: targetEmail,
    subject: subject,
    body: plainBody
  });

  Logger.log('✅ Direct Admin bypass email sent to: ' + targetEmail + '\n');
}

function testDirectClientEmailBypass() {
  Logger.log('--- TEST: Direct Client Email Bypass ---');
  var targetEmail = getTestAdminEmail(); // Sends to admin address for testing receipt

  var testPayload = {
    name: "Tom Revill",
    email: targetEmail,
    phone: "021 987 6543",
    address: "123 Test Street, Wellington",
    userType: "Home user",
    situation: "Wi-Fi setup requested",
    achievement: "Configure Mesh Network",
    timeframe: "Within a few days"
  };

  var subject = "🧪 [DIRECT TEST - CLIENT BYPASS] RD3 Tech Enquiry Received";

  var plainBody = 
    "Hi " + testPayload.name + ",\n\n" +
    "Thanks for reaching out! This is a direct test confirmation bypassing HTML templates.\n\n" +
    "--- YOUR SUBMISSION SUMMARY ---\n" +
    "Name: " + testPayload.name + "\n" +
    "Email: " + testPayload.email + "\n" +
    "Phone: " + testPayload.phone + "\n" +
    "Address: " + testPayload.address + "\n" +
    "Category: " + testPayload.userType + "\n" +
    "Situation: " + testPayload.situation + "\n" +
    "Goal: " + testPayload.achievement + "\n" +
    "Timeframe: " + testPayload.timeframe + "\n\n" +
    "We will be in touch shortly.\n\n" +
    "Kind regards,\n" +
    "RD3 Tech Team";

  MailApp.sendEmail({
    to: testPayload.email,
    subject: subject,
    body: plainBody
  });

  Logger.log('✅ Direct Client bypass email sent to: ' + testPayload.email + '\n');
}

/* ============================================================================
 * SECTION 3: FULL HTML TEMPLATE EXECUTION TEST
 * Tests rendering through AdminTemplate.html & ClientTemplate.html
 * ============================================================================ */

function testFullFormSubmissionWithTemplates() {
  Logger.log('--- TEST: Full Form Submission Rendering AdminTemplate & ClientTemplate ---');

  var mockEvent = {
    values: [
      new Date(),
      "Tom Revill",
      getTestAdminEmail(),
      "021 555 1234",
      "123 Messines Road Karori",
      "Home user",
      "Something Broken? — Fix a problem",
      "Tv Tuned",
      "As soon as possible"
    ]
  };

  if (typeof handleFormSubmit === 'function') {
    handleFormSubmit(mockEvent);
  } else if (typeof onFormSubmit === 'function') {
    onFormSubmit(mockEvent);
  } else if (typeof EmailService !== 'undefined' && typeof EmailService.onFormSubmit === 'function') {
    EmailService.onFormSubmit(mockEvent);
  } else {
    Logger.log('⚠️ No trigger function (handleFormSubmit / onFormSubmit) found in scope.');
  }

  Logger.log('✅ Simulated template form submission completed.\n');
}

/**
 * TEST FUNCTION: Run this directly in the Apps Script Editor
 * Reads the latest row from your Google Sheet and runs processSubmission()
 */
function testLatestSheetRow() {
  // 1. Fetch spreadsheet (handles standalone & bound scripts)
  var ss = null;
  
  if (typeof getTargetSpreadsheetInstance === 'function') {
    ss = getTargetSpreadsheetInstance();
  } else if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    Logger.log("❌ Error: Could not locate Spreadsheet. Ensure CONFIG.SPREADSHEET_ID is set in Config.gs.");
    return;
  }

  var sheet = ss.getSheetByName("Form Responses");
  if (!sheet) {
    Logger.log("❌ Error: Sheet 'Form Responses' not found in spreadsheet: " + ss.getName());
    return;
  }
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("⚠️ No submission data found in 'Form Responses' sheet.");
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

  var mockPayload = {};
  for (var i = 0; i < headers.length; i++) {
    mockPayload[headers[i].toString().trim()] = rowValues[i];
  }

  Logger.log("--- MOCK TESTING ROW " + lastRow + " ---");
  Logger.log("Payload constructed: " + JSON.stringify(mockPayload));

  // 2. Run the pipeline
  if (typeof EmailService !== 'undefined' && typeof EmailService.processSubmission === 'function') {
    var result = EmailService.processSubmission(mockPayload);
    Logger.log("--- RESULT ---");
    Logger.log(JSON.stringify(result, null, 2));
  } else {
    Logger.log("❌ Error: EmailService.processSubmission is not defined.");
  }
}