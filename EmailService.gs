
/**
 * EmailService.gs - Lead Ingestion & Processing Engine for RD3 Tech
 */


/**
 * ============================================================================
 * LEGACY / RETIRED TAXONOMY FUNCTIONS
 * ============================================================================
 *
 * The functions below belong to the previous keyword/category system.
 *
 * They are NOT part of the current live taxonomy workflow.
 *
 * Current active taxonomy:
 *
 * Config.gs
 *     ↓
 * CONFIG.DEFAULT_TAXONOMY
 *     ↓
 * TaxonomyService
 *     ↓
 * KEYWORD_TAXONOMY_JSON
 *     ↓
 * evaluateSubmission()
 *
 * The current taxonomy manages:
 *   - spamKeywords
 *   - reviewKeywords
 *   - urgentKeywords
 *
 * The older KEYWORD_TAXONOMY category system and Flagged sheet logic
 * are retained temporarily for legacy compatibility only.
 *
 * DO NOT add new keyword filtering logic here.
 *
 * These functions may be removed once the project has been checked to
 * confirm that no other legacy code still depends on them.
 * ============================================================================
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
 * ============================================================================
 * PUBLIC SUBMISSION DUPLICATE / RATE LIMIT
 * ============================================================================
 *
 * Prevents the same public request from being repeatedly submitted within
 * a short period.
 *
 * This is intentionally lightweight and uses Script Cache rather than a
 * spreadsheet or database, so it does not add significant processing overhead.
 *
 * Apps Script web-app requests do not provide the client's IP address in the
 * event object, so this protection uses submitted contact details to create
 * a temporary duplicate fingerprint.
 *
 * This protection is applied only to public entry points:
 *   - doPost()
 *   - onFormSubmit()
 *
 * The Test sheet calls processSubmission() directly and is therefore not
 * affected by this rate-limit check.
 *
 * Cache window: 60 seconds
 *
 * NOTE:
 * This is duplicate/replay protection, not a full anti-bot system.
 * ============================================================================
 */
function checkSubmissionRateLimit(rawData) {

  var data = rawData || {};

  var email = String(
    data['entry.817428911'] ||
    data['entry_817428911'] ||
    data.email ||
    data.Email ||
    ''
  ).toLowerCase().trim();

  var name = String(
    data['entry.1576532276'] ||
    data['entry_1576532276'] ||
    data.name ||
    data.Name ||
    ''
  ).toLowerCase().trim();

  var phone = String(
    data['entry.1285532466'] ||
    data['entry_1285532466'] ||
    data.phone ||
    data.Phone ||
    ''
  ).replace(/\D/g, '');

  /*
   * If there is not enough identifying information, allow the request
   * through to the normal spam/honeypot evaluation.
   */
  if (!email && !name && !phone) {
    return true;
  }

  var fingerprintSource =
    email + '|' +
    name + '|' +
    phone;

  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    fingerprintSource,
    Utilities.Charset.UTF_8
  );

  var fingerprint = Utilities.base64Encode(digest)
    .replace(/[^a-zA-Z0-9]/g, '');

  var cache = CacheService.getScriptCache();
  var cacheKey = 'submission_rate_' + fingerprint;

  /*
   * Duplicate request detected within the active window.
   */
  if (cache.get(cacheKey)) {

    Logger.log(
      '⚠️ Duplicate public submission blocked within rate-limit window.'
    );

    return false;
  }

/**
 * Cache window:
 *
 *     CONFIG.SUBMISSION_RATE_LIMIT_SECONDS
 *
 * Default:
 *     60 seconds
  * */
var rateLimitSeconds =
  (
    typeof CONFIG !== 'undefined' &&
    Number(CONFIG.SUBMISSION_RATE_LIMIT_SECONDS) > 0
  )
    ? Number(CONFIG.SUBMISSION_RATE_LIMIT_SECONDS)
    : 60;

cache.put(
  cacheKey,
  '1',
  rateLimitSeconds
);

return true;
}


/**
 * ============================================================================
 * EMAIL ADDRESS VALIDATION
 * ============================================================================
 *
 * Validates customer-provided email addresses before they are used for:
 *
 *   - Admin Reply-To
 *   - Client confirmation delivery
 *
 * This is intentionally a simple practical validation. The purpose is to
 * reject clearly invalid values rather than attempt full RFC email parsing.
 * ============================================================================
 */
function isValidEmailAddress(email) {

  var value = String(email || '').trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}


/**
 * ============================================================================
 * PUBLIC WEBHOOK
 * ============================================================================
 */
function doPost(e) {

  Logger.log("=== 🌐 WEBHOOK DOPOST TRIGGERED ===");

  try {

    var data = parseIncomingRequest(e);

    Logger.log(
      "📥 Parsed Webhook Data: " +
      JSON.stringify(data)
    );

    /*
     * Apply duplicate/rate-limit protection before any processing,
     * spreadsheet writes, or emails.
     */
    if (!checkSubmissionRateLimit(data)) {

      Logger.log(
        "⚠️ Public submission blocked by duplicate/rate-limit protection."
      );

      return ContentService
        .createTextOutput(
          JSON.stringify({
            status: "blocked",
            message: "Duplicate submission detected. Please wait before submitting again."
          })
        )
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result = processSubmission(data);

    return ContentService
      .createTextOutput(
        JSON.stringify({
          status: "success",
          id: result ? result.id : "N/A"
        })
      )
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {

    Logger.log(
      "❌ CRITICAL ERROR in doPost: " +
      err.toString()
    );

    return ContentService
      .createTextOutput(
        JSON.stringify({
          status: "error",
          message: err.toString()
        })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * ============================================================================
 * GOOGLE FORM SUBMISSION TRIGGER
 * ============================================================================
 */
function onFormSubmit(e) {

  Logger.log("=== 🚀 FORM SUBMISSION TRIGGERED ===");

  try {

    var data = {};

    if (
      e &&
      e.namedValues &&
      Object.keys(e.namedValues).length > 0
    ) {

      Logger.log(
        "📥 Form Data Source: e.namedValues"
      );

      data = e.namedValues;

    } else if (e && e.response) {

      Logger.log(
        "📥 Form Data Source: e.response"
      );

      var itemResponses =
        e.response.getItemResponses();

      for (var i = 0; i < itemResponses.length; i++) {

        data[
          itemResponses[i]
            .getItem()
            .getTitle()
        ] = itemResponses[i].getResponse();
      }

    } else if (
      e &&
      e.values &&
      e.range
    ) {

      Logger.log(
        "📥 Form Data Source: e.values (Spreadsheet row)"
      );

      var sheet = e.range.getSheet();

      var headers = sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getValues()[0];

      for (var h = 0; h < headers.length; h++) {

        if (headers[h]) {

          data[
            headers[h]
              .toString()
              .trim()
          ] = e.values[h];
        }
      }

    } else if (e && e.parameter) {

      Logger.log(
        "📥 Form Data Source: e.parameter"
      );

      data = e.parameter;

    } else {

      Logger.log(
        "⚠️ Trigger event object missing or empty. " +
        "Fetching latest row from Sheet as safety fallback..."
      );

      return processLatestSheetRow();
    }

    Logger.log(
      "📦 Parsed Raw Payload: " +
      JSON.stringify(data)
    );

    /*
     * Apply the same duplicate/rate-limit protection to actual
     * Google Form submissions.
     */
    if (!checkSubmissionRateLimit(data)) {

      Logger.log(
        "⚠️ Form submission blocked by duplicate/rate-limit protection."
      );

      return;
    }

    return processSubmission(data);

  } catch (err) {

    Logger.log(
      "❌ CRITICAL ERROR in onFormSubmit: " +
      err.toString()
    );
  }
}


/**
 * ============================================================================
 * FORM RESPONSES SHEET FALLBACK
 * ============================================================================
 */
function processLatestSheetRow() {

  var ss =
    getTargetSpreadsheetInstance();

  if (!ss) {

    Logger.log(
      "❌ Fallback Failed: Spreadsheet target unreachable."
    );

    return;
  }

  var sheetName =
    CONFIG.SHEET_NAME_GOOGLE;

  var sheet =
    ss.getSheetByName(sheetName) ||
    ss.getSheets()[0];

  var lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    Logger.log(
      "⚠️ Fallback Skipped: Sheet has no submission data rows."
    );

    return;
  }

  var headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  var values =
    sheet
      .getRange(
        lastRow,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  var payload = {};

  for (var i = 0; i < headers.length; i++) {

    payload[
      headers[i]
        .toString()
        .trim()
    ] = values[i];
  }

  Logger.log(
    "📄 Extracted Fallback Payload from Row " +
    lastRow +
    ": " +
    JSON.stringify(payload)
  );

  return processSubmission(payload);
}


/**
 * ============================================================================
 * MAIN SUBMISSION PROCESSOR
 * ============================================================================
 */
function processSubmission(rawData) {

  Logger.log(
    "=== ⚙️ PROCESSING SUBMISSION ==="
  );

  if (!rawData) {

    Logger.log(
      "⚠️ processSubmission called without rawData payload."
    );

    rawData = {};
  }

  var extractedMap =
    normalizeInputKeys(rawData);

  var evaluation =
    evaluateSubmission(
      rawData,
      extractedMap
    );

  Logger.log(
    "🔍 Evaluation Result: " +
    JSON.stringify(evaluation)
  );

  var tz =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.TIMEZONE
    )
      ? CONFIG.TIMEZONE
      : "Pacific/Auckland";

  var timestamp =
    Utilities.formatDate(
      new Date(),
      tz,
      "yyyy-MM-dd HH:mm:ss"
    );


  function getValue(keys, defaultValue) {

    for (var i = 0; i < keys.length; i++) {

      var k = keys[i];

      if (
        rawData &&
        rawData[k] !== undefined &&
        rawData[k] !== null &&
        String(rawData[k]).trim() !== ''
      ) {

        var v = rawData[k];

        return Array.isArray(v)
          ? v.join(", ").trim()
          : String(v).trim();
      }
    }

    for (var j = 0; j < keys.length; j++) {

      var cleanK =
        keys[j]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "");

      if (
        extractedMap &&
        extractedMap[cleanK] !== undefined &&
        extractedMap[cleanK] !== null &&
        String(extractedMap[cleanK]).trim() !== ''
      ) {

        return String(
          extractedMap[cleanK]
        ).trim();
      }
    }

    /*
     * Search by partial fuzzy match.
     */
    for (var rawKey in rawData) {

      if (!rawData.hasOwnProperty(rawKey)) {
        continue;
      }

      var lowerKey =
        rawKey.toLowerCase();

      for (
        var p = 0;
        p < keys.length;
        p++
      ) {

        var targetKey =
          keys[p].toLowerCase();

        if (
          targetKey.length > 2 &&
          lowerKey.indexOf(targetKey) !== -1
        ) {

          var val =
            rawData[rawKey];

          if (
            val !== undefined &&
            val !== null &&
            String(val).trim() !== ''
          ) {

            return Array.isArray(val)
              ? val.join(", ").trim()
              : String(val).trim();
          }
        }
      }
    }

    return defaultValue;
  }


  var nameVal =
    getValue(
      [
        'entry.1576532276',
        'entry_1576532276',
        'name',
        'fullName',
        'full_name',
        'your_name',
        'Name'
      ],
      "N/A"
    );


  /*
   * Extract email address with fallback to scanning all input fields
   * for an '@' symbol.
   */
  var emailVal =
    getValue(
      [
        'entry.817428911',
        'entry_817428911',
        'email',
        'emailAddress',
        'email_address',
        'Email',
        'Your Email',
        'contact_email'
      ],
      "N/A"
    );


  if (
    emailVal === "N/A" &&
    rawData
  ) {

    for (var rawK in rawData) {

      if (
        !rawData.hasOwnProperty(rawK)
      ) {
        continue;
      }

      var rawV =
        String(
          rawData[rawK]
        ).trim();

      if (
        rawV.indexOf("@") !== -1 &&
        rawV.indexOf(".") !== -1 &&
        rawV.indexOf(" ") === -1
      ) {

        emailVal = rawV;
        break;
      }
    }
  }


  var phoneVal =
    getValue(
      [
        'entry.1285532466',
        'entry_1285532466',
        'phone',
        'phoneNumber',
        'contact_number',
        'mobile',
        'Phone'
      ],
      "N/A"
    );


  var addressVal =
    getValue(
      [
        'entry.1293794731',
        'entry_1293794731',
        'address',
        'location',
        'Address'
      ],
      "N/A"
    );


  var categoryVal =
    getValue(
      [
        'entry.343301224',
        'entry_343301224',
        'userType',
        'category',
        'usertype'
      ],
      evaluation.category ||
      "General Inquiry"
    );


  var situationVal =
    getValue(
      [
        'entry.650060968',
        'entry_650060968',
        'situation',
        'subject',
        'Situation'
      ],
      "New Website Lead"
    );


  var messageVal =
    getValue(
      [
        'entry.483026621',
        'entry_483026621',
        'entry.1883892334',
        'entry_1883892334',
        'what_are_you_trying_to_achieve',
        'What Are You Trying To Achieve?',
        'achievement',
        'message',
        'goal',
        'details',
        'desired_outcome'
      ],
      ""
    );


  var timeframeVal =
    getValue(
      [
        'entry.1883892334',
        'entry_1883892334',
        'entry.483026621',
        'entry_483026621',
        'how_soon_do_you_need_help',
        'How Soon Do You Need Help?',
        'timeframe',
        'urgency',
        'timeline'
      ],
      "N/A"
    );


  var submission = {

    id:
      "LEAD-" +
      Date.now(),

    timestamp:
      timestamp,

    name:
      nameVal,

    email:
      emailVal,

    phone:
      phoneVal,

    address:
      addressVal,

    subject:
      situationVal,

    message:
      messageVal,

    situation:
      situationVal,

    achievement:
      messageVal,

    timeframe:
      timeframeVal,

    category:
      categoryVal,

    userType:
      categoryVal,

    isSpam:
      evaluation.isSpam || false,

    isReviewRequired:
      evaluation.isReviewRequired || false,

    isUrgent:
      evaluation.isUrgent || false,

    spamScore:
      evaluation.spamScore || 0,

    flagReasons:
      (
        evaluation.flagReasons &&
        evaluation.flagReasons.length
      )
        ? evaluation.flagReasons.join(" | ")
        : "",

    reasons:
      evaluation.flagReasons || [],

    flags:
      evaluation.flagReasons || [],

    status:
      evaluation.statusLabel ||
      "NEW INQUIRY",

    rawData:
      JSON.stringify(rawData)
  };


  Logger.log(
    "👤 Extracted Lead Profile:"
  );

  Logger.log(
    "   - Name: " +
    submission.name
  );

  Logger.log(
    "   - Email: " +
    submission.email
  );

  Logger.log(
    "   - Phone: " +
    submission.phone
  );

  Logger.log(
    "   - Category: " +
    submission.category
  );

  Logger.log(
    "   - Status: " +
    submission.status
  );


  logToSheet(
    submission
  );

  sendEmails(
    submission,
    evaluation
  );


  Logger.log(
    "=== ✅ SUBMISSION PROCESSING COMPLETE ==="
  );

  return submission;
}


/**
 * ============================================================================
 * INPUT NORMALISATION
 * ============================================================================
 */
function normalizeInputKeys(rawData) {

  var map = {};

  if (!rawData) {
    return map;
  }

  for (var key in rawData) {

    if (!rawData.hasOwnProperty(key)) {
      continue;
    }

    var cleanKey =
      key
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    var val =
      rawData[key];

    if (Array.isArray(val)) {
      val = val.join(", ");
    }

    map[cleanKey] =
      String(val || '').trim();
  }

  return map;
}


/**
 * ============================================================================
 * SUBMISSION EVALUATION
 * ============================================================================
 */
function evaluateSubmission(rawData, map) {

  var flagReasons = [];
  var spamScore = 0;
  var isSpam = false;
  var isReviewRequired = false;
  var isUrgent = false;


  /**
   * ============================================================================
   * TAXONOMY LOADING
   * ============================================================================
   *
   * Live taxonomy:
   *
   *   Script Properties → KEYWORD_TAXONOMY_JSON
   *
   * The live taxonomy is retrieved through:
   *
   *   TaxonomyService.getTaxonomy()
   *
   * If a live taxonomy category is unavailable or empty, that category
   * falls back to the corresponding category in:
   *
   *   CONFIG.DEFAULT_TAXONOMY
   *
   * This keeps Config.gs as the single source of default taxonomy values
   * while allowing the Taxonomy Editor to control the live taxonomy.
   * ============================================================================
   */


  var taxonomy = {};


  if (
    typeof TaxonomyService !== 'undefined' &&
    typeof TaxonomyService.getTaxonomy === 'function'
  ) {

    taxonomy =
      TaxonomyService.getTaxonomy() || {};
  }


  var spamKeywords =
    (
      taxonomy.spamKeywords &&
      taxonomy.spamKeywords.length
    )
      ? taxonomy.spamKeywords
      : CONFIG.DEFAULT_TAXONOMY.spamKeywords;


  var reviewKeywords =
    (
      taxonomy.reviewKeywords &&
      taxonomy.reviewKeywords.length
    )
      ? taxonomy.reviewKeywords
      : CONFIG.DEFAULT_TAXONOMY.reviewKeywords;


  var urgentKeywords =
    (
      taxonomy.urgentKeywords &&
      taxonomy.urgentKeywords.length
    )
      ? taxonomy.urgentKeywords
      : CONFIG.DEFAULT_TAXONOMY.urgentKeywords;


  /**
   * ============================================================================
   * INPUT EXTRACTION
   * ============================================================================
   */

  function extractValue(keys) {

    for (var i = 0; i < keys.length; i++) {

      var k =
        keys[i];

      if (
        rawData &&
        rawData[k] !== undefined &&
        rawData[k] !== null &&
        String(rawData[k]).trim() !== ''
      ) {

        var v =
          rawData[k];

        return Array.isArray(v)
          ? v.join(" ").trim()
          : String(v).trim();
      }
    }


    for (var j = 0; j < keys.length; j++) {

      var cleanK =
        keys[j]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "");

      if (
        map &&
        map[cleanK] !== undefined &&
        map[cleanK] !== null &&
        String(map[cleanK]).trim() !== ''
      ) {

        return String(
          map[cleanK]
        ).trim();
      }
    }

    return "";
  }


  var goalText =
    extractValue(
      [
        'entry.483026621',
        'entry_483026621',
        'what_are_you_trying_to_achieve',
        'What Are You Trying To Achieve?',
        'What are you trying to achieve?',
        'achievement',
        'message',
        'goal',
        'details',
        'desired_outcome'
      ]
    );


  var timeframeText =
    extractValue(
      [
        'entry.1883892334',
        'entry_1883892334',
        'how_soon_do_you_need_help',
        'How Soon Do You Need Help?',
        'How soon do you need help?',
        'timeframe',
        'urgency',
        'timeline'
      ]
    );


  /**
   * ============================================================================
   * 1. HONEYPOT CHECK
   * ============================================================================
   */


  var hpField =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.HONEYPOT_FIELD
    )
      ? CONFIG.HONEYPOT_FIELD.toLowerCase()
      : "website";


  if (
    (map[hpField] &&
      map[hpField] !== "") ||
    map['honeypot'] ||
    map['website_url_hp']
  ) {

    isSpam = true;
    spamScore += 5;

    flagReasons.push(
      "Honeypot field filled ('" +
      hpField +
      "')"
    );
  }


  /**
   * ============================================================================
   * 2. REVIEW KEYWORD EVALUATION
   * ============================================================================
   *
   * Short keywords (3 characters or fewer):
   *
   *   Whole-word matching.
   *
   * Longer keywords:
   *
   *   Phrase/substring matching with simple word-stem support.
   *
   * All matches are retained.
   * ============================================================================
   */


  var goalLower =
    goalText.toLowerCase();

  var goalMatches = [];


  if (goalLower.length > 0) {

    for (
      var g = 0;
      g < reviewKeywords.length;
      g++
    ) {

      var rawKw =
        reviewKeywords[g]
          .toString()
          .toLowerCase()
          .trim();

      if (!rawKw) {
        continue;
      }

      var isMatched = false;


      if (rawKw.length <= 3) {

        var rx =
          new RegExp(
            '(^|[^a-z0-9])' +
            rawKw +
            '($|[^a-z0-9])',
            'i'
          );

        if (rx.test(goalLower)) {
          isMatched = true;
        }

      } else {

        var stemKw =
          rawKw.replace(
            /(ing|ers?|ed|es?)$/i,
            ""
          );

        if (
          goalLower.indexOf(rawKw) !== -1 ||
          (
            stemKw.length >= 3 &&
            goalLower.indexOf(stemKw) !== -1
          )
        ) {

          isMatched = true;
        }
      }


      if (
        isMatched &&
        goalMatches.indexOf(rawKw) === -1
      ) {

        goalMatches.push(
          rawKw
        );
      }
    }
  }


  if (goalMatches.length > 0) {

    isReviewRequired = true;

    flagReasons.push(
      "Goal / Desired Outcome matched review keyword(s): " +
      goalMatches.join(", ")
    );
  }


  /**
   * ============================================================================
   * 3. SPAM KEYWORD EVALUATION
   * ============================================================================
   *
   * Spam keywords come from the live taxonomy first, with
   * CONFIG.DEFAULT_TAXONOMY.spamKeywords as the fallback.
   * ============================================================================
   */


  var combinedKeywordText = (
    goalText +
    " " +
    timeframeText +
    " " +
    Object.keys(map || {})
      .map(function (key) {
        return map[key];
      })
      .join(" ")
  ).toLowerCase();


  var spamMatches = [];


  for (
    var s = 0;
    s < spamKeywords.length;
    s++
  ) {

    var spamTerm =
      spamKeywords[s]
        .toString()
        .toLowerCase()
        .trim();

    if (!spamTerm) {
      continue;
    }

    if (
      combinedKeywordText.indexOf(spamTerm) !== -1 &&
      spamMatches.indexOf(spamTerm) === -1
    ) {

      spamMatches.push(
        spamTerm
      );
    }
  }


  if (spamMatches.length > 0) {

    spamScore +=
      spamMatches.length * 30;

    flagReasons.push(
      "Spam keyword(s) matched: " +
      spamMatches.join(", ")
    );
  }


  /**
   * ============================================================================
   * 4. TIMEFRAME / URGENCY EVALUATION
   * ============================================================================
   *
   * Urgent keywords come from the live taxonomy first, with
   * CONFIG.DEFAULT_TAXONOMY.urgentKeywords as the fallback.
   * ============================================================================
   */


  var timeframeLower =
    timeframeText.toLowerCase();

  var matchedUrgent = [];


  for (
    var u = 0;
    u < urgentKeywords.length;
    u++
  ) {

    var urgentTerm =
      urgentKeywords[u]
        .toString()
        .toLowerCase()
        .trim();

    if (!urgentTerm) {
      continue;
    }

    if (
      timeframeLower.indexOf(urgentTerm) !== -1 &&
      matchedUrgent.indexOf(urgentTerm) === -1
    ) {

      matchedUrgent.push(
        urgentTerm
      );
    }
  }


  if (matchedUrgent.length > 0) {

    isUrgent = true;

    flagReasons.push(
      "Urgent timeframe detected: '" +
      matchedUrgent.join(", ") +
      "'"
    );
  }


  /**
   * ============================================================================
   * 5. MULTIPLE URL CHECK
   * ============================================================================
   */


  var textParts = [
    goalText,
    timeframeText
  ];


  for (var k in map) {

    if (
      map.hasOwnProperty(k) &&
      map[k] &&
      typeof map[k] === 'string'
    ) {

      textParts.push(
        map[k]
      );
    }
  }


  var combinedText =
    textParts
      .join(" ")
      .toLowerCase();


  var urlMatch =
    combinedText.match(
      /https?:\/\/[^\s]+|www\.[^\s]+/g
    );


  var linkCount =
    urlMatch
      ? urlMatch.length
      : 0;


  if (linkCount > 1) {

    spamScore += 2;
    isSpam = true;

    flagReasons.push(
      "Contains multiple URLs (" +
      linkCount +
      ")"
    );
  }


  /**
   * ============================================================================
   * 6. PHONE VALIDATION
   * ============================================================================
   */


  var phoneStr =
    String(
      map['entry_1285532466'] ||
      map['phone'] ||
      map['mobile'] ||
      map['entry.1285532466'] ||
      ''
    ).replace(
      /[^0-9]/g,
      ''
    );


  if (phoneStr.length > 0) {

    if (
      /^0+$/.test(phoneStr) ||
      /^1+$/.test(phoneStr)
    ) {

      spamScore += 1;

      flagReasons.push(
        "Suspicious phone format"
      );
    }
  }


  /**
   * ============================================================================
   * 7. THRESHOLD & STATUS LABEL
   * ============================================================================
   */


  var threshold =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.SPAM_THRESHOLD
    )
      ? CONFIG.SPAM_THRESHOLD
      : 3;


  if (spamScore >= threshold) {
    isSpam = true;
  }


  var statusParts = [];


  if (isReviewRequired) {
    statusParts.push(
      "REVIEW REQUIRED"
    );
  }


  if (isSpam) {
    statusParts.push(
      "SPAM DETECTED"
    );
  }


  if (isUrgent) {
    statusParts.push(
      "URGENT"
    );
  }


  var statusLabel =
    statusParts.length > 0
      ? statusParts.join(" | ")
      : "NEW INQUIRY";


  var category =
    categorizeLead(
      combinedText
    );


  return {

    isSpam:
      isSpam,

    isReviewRequired:
      isReviewRequired,

    isUrgent:
      isUrgent,

    spamScore:
      spamScore,

    flagReasons:
      flagReasons,

    reasons:
      flagReasons,

    flags:
      flagReasons,

    statusLabel:
      statusLabel,

    category:
      category,

    reviewMatches:
      goalMatches,

    spamMatches:
      spamMatches,

    urgentMatches:
      matchedUrgent
  };
}


/**
 * LEGACY: Previous category classifier.
 *
 * This is not part of the current live Spam / Review / Urgent
 * taxonomy workflow.
 *
 * Retained temporarily for legacy compatibility only.
 */
function categorizeLead(text) {

  if (
    typeof CONFIG === 'undefined' ||
    !CONFIG.DEFAULT_TAXONOMY ||
    !CONFIG.DEFAULT_TAXONOMY.categories
  ) {

    return "General Inquiry";
  }

  var categories =
    CONFIG.DEFAULT_TAXONOMY.categories;

  for (
    var i = 0;
    i < categories.length;
    i++
  ) {

    var cat =
      categories[i];

    if (
      cat.keywords &&
      Array.isArray(cat.keywords)
    ) {

      for (
        var k = 0;
        k < cat.keywords.length;
        k++
      ) {

        if (
          text.indexOf(
            cat.keywords[k]
              .toLowerCase()
          ) !== -1
        ) {

          return cat.name;
        }
      }
    }
  }

  return "General Inquiry";
}


/**
 * LEGACY: Previous Flagged-sheet / CONFIG.FLAGGED_KEYWORDS source.
 *
 * Current live evaluation uses:
 *
 *   TaxonomyService.getTaxonomy()
 *       ↓
 *   KEYWORD_TAXONOMY_JSON
 *
 * Do not add new live keyword filtering logic here.
 */
function getFlaggedKeywords() {

  var keywords =
    (
      typeof CONFIG !== 'undefined' &&
      Array.isArray(
        CONFIG.FLAGGED_KEYWORDS
      )
    )
      ? CONFIG.FLAGGED_KEYWORDS.slice()
      : [
          "crypto",
          "seo",
          "invest",
          "loans",
          "casino",
          "viagra",
          "guest post",
          "backlinks",
          "tv tune",
          "tv tuning",
          "tv tuned",
          "tv"
        ];


  try {

    var ss =
      getTargetSpreadsheetInstance();

    if (ss) {

      var flaggedSheet =
        ss.getSheetByName(
          "Flagged"
        );

      if (flaggedSheet) {

        var data =
          flaggedSheet
            .getDataRange()
            .getValues();

        for (
          var i = 1;
          i < data.length;
          i++
        ) {

          var word =
            String(
              data[i][0]
            )
              .toLowerCase()
              .trim();

          if (
            word &&
            keywords.indexOf(word) === -1
          ) {

            keywords.push(
              word
            );
          }
        }
      }
    }

  } catch (e) {

    Logger.log(
      "Notice reading Flagged tab: " +
      e.toString()
    );
  }

  return keywords;
}


/**
 * ============================================================================
 * LEGACY / CURRENT SUBMISSIONS LOGGER
 * ============================================================================
 */
function logToSheet(submission) {

  submission =
    submission || {};

  var lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(10000);

    var ss =
      getTargetSpreadsheetInstance();

    if (!ss) {

      Logger.log(
        "❌ logToSheet Failed: Target spreadsheet instance not resolved."
      );

      return;
    }

    var sheetName =
      (
        typeof CONFIG !== 'undefined' &&
        CONFIG.SHEET_NAME
      )
        ? CONFIG.SHEET_NAME
        : "Submissions";

    var sheet =
      ss.getSheetByName(sheetName) ||
      ss.getSheets()[0];

    if (!sheet) {

      sheet =
        ss.insertSheet(
          sheetName
        );

      sheet.appendRow([
        "Lead ID",
        "Timestamp",
        "Status",
        "Name",
        "Email",
        "Phone",
        "Category",
        "Subject / Situation",
        "Message / Goal",
        "Timeframe",
        "Is Spam",
        "Review Required",
        "Spam Score",
        "Flag Reasons"
      ]);
    }

    sheet.appendRow([

      submission.id ||
        "LEAD-" +
        Date.now(),

      submission.timestamp ||
        new Date().toISOString(),

      submission.status ||
        "NEW INQUIRY",

      submission.name ||
        "N/A",

      submission.email ||
        "N/A",

      submission.phone ||
        "N/A",

      submission.category ||
        submission.userType ||
        "General Inquiry",

      submission.subject ||
        submission.situation ||
        "N/A",

      submission.message ||
        submission.achievement ||
        "",

      submission.timeframe ||
        "N/A",

      submission.isSpam
        ? "YES"
        : "NO",

      submission.isReviewRequired
        ? "YES"
        : "NO",

      submission.spamScore ||
        0,

      submission.flagReasons ||
        ""
    ]);

    SpreadsheetApp.flush();

    lock.releaseLock();

    Logger.log(
      "📊 Successfully logged submission " +
      submission.id +
      " to tab '" +
      sheet.getName() +
      "'."
    );

  } catch (err) {

    Logger.log(
      "❌ logToSheet Error: " +
      err.toString()
    );
  }
}


/**
 * ============================================================================
 * EMAIL DISPATCH
 * ============================================================================
 */
function sendEmails(
  submission,
  evalResult
) {

  sendAdminNotification(
    submission,
    evalResult
  );

  sendClientConfirmation(
    submission
  );
}


/**
 * ============================================================================
 * ADMIN EMAIL
 * ============================================================================
 */
function sendAdminNotification(
  submission,
  evalResult
) {

  submission =
    submission || {};

  var adminEmail =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.ADMIN_EMAIL
    )
      ? CONFIG.ADMIN_EMAIL
      : "tom@rd3tech.com";

  var senderName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.SENDER_NAME
    )
      ? CONFIG.SENDER_NAME
      : "RD3 Tech";

  var companyName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.COMPANY_NAME
    )
      ? CONFIG.COMPANY_NAME
      : senderName;

  var categoryText =
    String(
      submission.category ||
      submission.userType ||
      "General Inquiry"
    );

  var upperCategory =
    categoryText.toUpperCase();

  var flags = [];

  if (
    submission.isReviewRequired ||
    (
      evalResult &&
      evalResult.isReviewRequired
    )
  ) {

    flags.push(
      "REVIEW REQUIRED"
    );
  }

  if (
    submission.isUrgent ||
    (
      evalResult &&
      evalResult.isUrgent
    )
  ) {

    flags.push(
      "URGENT INQUIRY"
    );
  }

  if (
    submission.isSpam ||
    (
      evalResult &&
      evalResult.isSpam
    )
  ) {

    flags.push(
      "SPAM DETECTED"
    );
  }

  var subjectPrefix =
    flags.length > 0
      ? "⚠️ [" +
        flags.join(" | ") +
        "] "
      : "🚀 [NEW LEAD - " +
        upperCategory +
        "] ";

  /*
   * Customer-controlled values are used in the email subject.
   *
   * Remove CR/LF characters so they cannot introduce additional
   * email headers.
   */
  var safeSubject =
    String(
      submission.subject ||
      submission.situation ||
      categoryText ||
      "New Inquiry"
    )
      .replace(/[\r\n]+/g, " ")
      .trim();

  var safeLeadName =
    String(
      submission.name ||
      "N/A"
    )
      .replace(/[\r\n]+/g, " ")
      .trim();

  var adminSubject =
    subjectPrefix +
    safeSubject +
    " - " +
    safeLeadName;

  try {

    var template =
      HtmlService
        .createTemplateFromFile(
          "AdminTemplate"
        );

    template.submission =
      submission;

    template.companyName =
      companyName;

    template.senderName =
      senderName;

    template.category =
      categoryText;

    template.userType =
      categoryText;

    template.name =
      submission.name ||
      "N/A";

    template.email =
      submission.email ||
      "N/A";

    template.phone =
      submission.phone ||
      "N/A";

    template.address =
      submission.address ||
      "N/A";

    template.subject =
      submission.subject ||
      submission.situation ||
      "N/A";

    template.situation =
      submission.situation ||
      submission.subject ||
      "N/A";

    template.message =
      submission.message ||
      submission.achievement ||
      "N/A";

    template.achievement =
      submission.achievement ||
      submission.message ||
      "N/A";

    template.timeframe =
      submission.timeframe ||
      "N/A";

    template.evalResult =
      evalResult || {

        isSpam:
          submission.isSpam ||
          false,

        isReviewRequired:
          submission.isReviewRequired ||
          false,

        isUrgent:
          submission.isUrgent ||
          false,

        spamScore:
          submission.spamScore ||
          0,

        flagReasons:
          submission.flagReasons ||
          "",

        reasons:
          submission.reasons ||
          [],

        flags:
          submission.flags ||
          []
      };

    var htmlBody =
      template
        .evaluate()
        .getContent();

    var emailOptions = {

      htmlBody:
        htmlBody,

      name:
        senderName
    };

    /*
     * Only use a customer email as Reply-To when it passes validation.
     */
    if (
      isValidEmailAddress(
        submission.email
      )
    ) {

      emailOptions.replyTo =
        String(
          submission.email
        ).trim();
    }

    GmailApp.sendEmail(
      adminEmail,
      adminSubject,
      "Please enable HTML in your email client to view this message.",
      emailOptions
    );

    Logger.log(
      "✅ Admin Notification sent successfully to: " +
      adminEmail
    );

  } catch (adminErr) {

    Logger.log(
      "❌ Admin Email Error: " +
      adminErr.toString()
    );
  }
}


/**
 * ============================================================================
 * CLIENT CONFIRMATION EMAIL
 * ============================================================================
 */
function sendClientConfirmation(
  submission
) {

  submission =
    submission || {};

  var clientEmail =
    submission.email
      ? String(
          submission.email
        ).trim()
      : "";

  var senderName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.SENDER_NAME
    )
      ? CONFIG.SENDER_NAME
      : "RD3 Tech";

  var companyName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.COMPANY_NAME
    )
      ? CONFIG.COMPANY_NAME
      : senderName;


  /*
   * Validate the client address before attempting delivery.
   */
  if (
    !isValidEmailAddress(
      clientEmail
    )
  ) {

    Logger.log(
      "❌ Skipped Client Email: Invalid email address ('" +
      clientEmail +
      "')."
    );

    return;
  }

  try {

    var clientSubject =
      "We received your request - " +
      companyName;

    var template =
      HtmlService
        .createTemplateFromFile(
          "ClientTemplate"
        );

    template.submission =
      submission;

    template.companyName =
      companyName;

    template.senderName =
      senderName;

    template.name =
      submission.name ||
      "N/A";

    template.email =
      clientEmail;

    template.phone =
      submission.phone ||
      "N/A";

    template.subject =
      submission.subject ||
      "N/A";

    template.message =
      submission.message ||
      "N/A";

    var htmlBody =
      template
        .evaluate()
        .getContent();

    GmailApp.sendEmail(
      clientEmail,
      clientSubject,
      "Please enable HTML to view this email.",
      {
        htmlBody: htmlBody,
        name: senderName
      }
    );

    Logger.log(
      "✅ Client Confirmation Email successfully sent to: " +
      clientEmail
    );

  } catch (err) {

    Logger.log(
      "❌ Client Email Error: " +
      err.toString()
    );
  }
}


/**
 * ============================================================================
 * SPREADSHEET RESOLUTION
 * ============================================================================
 */
function getTargetSpreadsheetInstance() {

  if (
    typeof getTargetSpreadsheet ===
    'function'
  ) {

    return getTargetSpreadsheet();
  }

  if (
    typeof CONFIG !== 'undefined' &&
    CONFIG.SPREADSHEET_ID
  ) {

    try {

      return SpreadsheetApp.openById(
        CONFIG.SPREADSHEET_ID
      );

    } catch (e) {

      Logger.log(
        "Failed opening spreadsheet by ID: " +
        e.toString()
      );
    }
  }

  return SpreadsheetApp
    .getActiveSpreadsheet();
}


/**
 * ============================================================================
 * INCOMING REQUEST PARSER
 * ============================================================================
 */
function parseIncomingRequest(e) {

  if (!e) {
    return {};
  }

  if (
    e.postData &&
    e.postData.contents
  ) {

    try {

      return JSON.parse(
        e.postData.contents
      );

    } catch (err) {
      // Fall through to request parameters.
    }
  }

  return e.parameter || {};
}


/**
 * ============================================================================
 * DIRECT EMAIL TEST
 * ============================================================================
 *
 * Run this function directly in Google Apps Script Editor to test
 * client and admin dispatches.
 *
 * This intentionally bypasses the public rate-limit check because it is
 * a developer test function.
 * ============================================================================
 */
function testClientEmailDirectly() {

  var testPayload = {

    "Name":
      "John Test",

    "Email":
      "tom@rd3tech.com",

    "Phone":
      "0211234567",

    "Situation":
      "Need help with TV setup",

    "Message":
      "Need TV SEO done as soon as possible"
  };

  Logger.log(
    "--- STARTING DIRECT TEST ---"
  );

  var result =
    processSubmission(
      testPayload
    );

  Logger.log(
    "--- TEST RESULT COMPLETE ---"
  );
}

