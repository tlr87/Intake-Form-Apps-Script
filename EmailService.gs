/**
 * ============================================================================
 * EmailService.gs - RD3 Tech Lead Ingestion & Processing Engine
 * ============================================================================
 *
 * Responsibilities:
 *
 * - Receive Google Form submissions
 * - Parse / normalise incoming field names
 * - Prevent duplicate public submissions
 * - Evaluate spam / review / urgency
 * - Build standard submission object
 * - Log submissions to the Submissions sheet
 * - Send admin notification
 * - Send client confirmation for legitimate submissions
 *
 * Taxonomy source:
 *
 * TaxonomyService.getTaxonomy()
 *        ↓
 * KEYWORD_TAXONOMY_JSON
 *        ↓
 * evaluateSubmission()
 *
 * Fallback:
 *
 * CONFIG.DEFAULT_TAXONOMY
 *
 * IMPORTANT:
 *
 * doPost() lives in Main.gs.
 * There must be ONLY ONE doPost() in the project.
 * ========================================================================== */


/* ============================================================================
 * PUBLIC SERVICE API
 * ========================================================================== */

var EmailService = {

  onFormSubmit:
    onFormSubmit,

  processSubmission:
    processSubmission,

  processLeadSubmission:
    processSubmission,

  logToSheet:
    logToSheet,

  sendEmails:
    sendEmails,

  sendAdminNotification:
    sendAdminNotification,

  sendClientConfirmation:
    sendClientConfirmation

};


/* ============================================================================
 * PUBLIC SUBMISSION DUPLICATE / RATE LIMIT
 * ========================================================================== */

/**
 * Prevents the same public request from being repeatedly submitted
 * within a short period.
 *
 * Uses Script Cache rather than a spreadsheet/database.
 *
 * This protection is applied by Main.gs doPost() and onFormSubmit().
 */
function checkSubmissionRateLimit(
  rawData
) {

  var data =
    rawData || {};


  var email =
    String(
      data['entry.817428911'] ||
      data['entry_817428911'] ||
      data.email ||
      data.Email ||
      ''
    )
      .toLowerCase()
      .trim();


  var name =
    String(
      data['entry.1576532276'] ||
      data['entry_1576532276'] ||
      data.name ||
      data.Name ||
      ''
    )
      .toLowerCase()
      .trim();


  var phone =
    String(
      data['entry.1285532466'] ||
      data['entry_1285532466'] ||
      data.phone ||
      data.Phone ||
      ''
    )
      .replace(
        /\D/g,
        ''
      );


  /*
   * If there is no identifying information,
   * do not block the request.
   */
  if (
    !email &&
    !name &&
    !phone
  ) {

    return true;

  }


  var fingerprintSource =
    email +
    '|' +
    name +
    '|' +
    phone;


  var digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      fingerprintSource,
      Utilities.Charset.UTF_8
    );


  var fingerprint =
    Utilities
      .base64Encode(
        digest
      )
      .replace(
        /[^a-zA-Z0-9]/g,
        ''
      );


  var cache =
    CacheService.getScriptCache();


  var cacheKey =
    'submission_rate_' +
    fingerprint;


  if (
    cache.get(cacheKey)
  ) {

    Logger.log(
      'Duplicate public submission blocked within rate-limit window.'
    );

    return false;

  }


  var rateLimitSeconds =
    (
      typeof CONFIG !== 'undefined' &&
      Number(
        CONFIG.SUBMISSION_RATE_LIMIT_SECONDS
      ) > 0
    )

      ? Number(
          CONFIG.SUBMISSION_RATE_LIMIT_SECONDS
        )

      : 60;


  cache.put(
    cacheKey,
    '1',
    rateLimitSeconds
  );


  return true;

}


/* ============================================================================
 * EMAIL VALIDATION
 * ========================================================================== */

/**
 * Practical email validation.
 */
function isValidEmailAddress(
  email
) {

  var value =
    String(
      email || ''
    ).trim();


  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );

}


/* ============================================================================
 * EMAIL NORMALISATION
 * ========================================================================== */

/**
 * Converts common email formats into a plain email address.
 */
function normalizeEmailAddress(
  value
) {

  var email =
    String(
      value || ''
    ).trim();


  if (!email) {

    return '';

  }


  /*
   * Markdown mailto link.
   */
  var markdownMatch =
    email.match(
      /^\[([^\]]+)\]\(\s*mailto:([^)]+)\)$/i
    );


  if (
    markdownMatch
  ) {

    email =
      markdownMatch[2]
        .trim();

  }


  /*
   * Plain mailto.
   */
  if (
    /^mailto:/i.test(
      email
    )
  ) {

    email =
      email
        .replace(
          /^mailto:/i,
          ''
        )
        .trim();

  }


  /*
   * Accidental angle brackets.
   */
  email =
    email
      .replace(
        /^<|>$/g,
        ''
      )
      .trim();


  return email;

}


/* ============================================================================
 * GOOGLE FORM SUBMISSION TRIGGER
 * ========================================================================== */

/**
 * Handles Google Form submissions.
 *
 * Supports:
 *
 * - e.namedValues
 * - e.response
 * - e.values + e.range
 * - e.parameter
 * - latest spreadsheet row fallback
 */
function onFormSubmit(
  e
) {

  Logger.log(
    '=== FORM SUBMISSION TRIGGERED ==='
  );


  try {

    var data =
      {};


    /*
     * Google Forms trigger.
     */
    if (
      e &&
      e.namedValues &&
      Object.keys(
        e.namedValues
      ).length > 0
    ) {

      Logger.log(
        'Form Data Source: e.namedValues'
      );


      data =
        e.namedValues;


    /*
     * Form response object.
     */
    } else if (
      e &&
      e.response
    ) {

      Logger.log(
        'Form Data Source: e.response'
      );


      var itemResponses =
        e.response
          .getItemResponses();


      for (
        var i = 0;
        i < itemResponses.length;
        i++
      ) {

        var item =
          itemResponses[i]
            .getItem();


        var title =
          item.getTitle();


        data[title] =
          itemResponses[i]
            .getResponse();

      }


    /*
     * Spreadsheet form trigger.
     */
    } else if (
      e &&
      e.values &&
      e.range
    ) {

      Logger.log(
        'Form Data Source: e.values'
      );


      var sheet =
        e.range.getSheet();


      var headers =
        sheet
          .getRange(
            1,
            1,
            1,
            sheet.getLastColumn()
          )
          .getValues()[0];


      for (
        var h = 0;
        h < headers.length;
        h++
      ) {

        if (
          headers[h]
        ) {

          data[
            headers[h]
              .toString()
              .trim()
          ] =
            e.values[h];

        }

      }


    /*
     * Web request fallback.
     */
    } else if (
      e &&
      e.parameter
    ) {

      Logger.log(
        'Form Data Source: e.parameter'
      );


      data =
        e.parameter;


    /*
     * Last-resort spreadsheet fallback.
     */
    } else {

      Logger.log(
        'Trigger event object missing or empty. ' +
        'Fetching latest row from Sheet...'
      );


      return processLatestSheetRow();

    }


    Logger.log(
      'Parsed Raw Payload: ' +
      JSON.stringify(data)
    );


    /*
     * Duplicate protection.
     */
    if (
      !checkSubmissionRateLimit(
        data
      )
    ) {

      Logger.log(
        'Form submission blocked by duplicate/rate-limit protection.'
      );

      return;

    }


    return processSubmission(
      data
    );


  } catch (err) {

    Logger.log(
      'CRITICAL ERROR in onFormSubmit: ' +
      err.toString()
    );


    throw err;

  }

}


/* ============================================================================
 * FORM RESPONSES SHEET FALLBACK
 * ========================================================================== */

/**
 * Processes the latest row from the Google Form response sheet.
 */
function processLatestSheetRow() {

  var ss =
    getTargetSpreadsheetInstance();


  if (!ss) {

    Logger.log(
      'Fallback Failed: Spreadsheet target unreachable.'
    );

    return;

  }


  var sheetName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.SHEET_NAME_GOOGLE
    )

      ? CONFIG.SHEET_NAME_GOOGLE

      : 'Form Responses 1';


  var sheet =
    ss.getSheetByName(
      sheetName
    ) ||
    ss.getSheets()[0];


  var lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    Logger.log(
      'Fallback Skipped: Sheet has no submission data rows.'
    );

    return;

  }


  var lastColumn =
    sheet.getLastColumn();


  var headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0];


  var values =
    sheet
      .getRange(
        lastRow,
        1,
        1,
        lastColumn
      )
      .getValues()[0];


  var payload =
    {};


  for (
    var i = 0;
    i < headers.length;
    i++
  ) {

    if (
      headers[i]
    ) {

      payload[
        headers[i]
          .toString()
          .trim()
      ] =
        values[i];

    }

  }


  Logger.log(
    'Extracted fallback payload from row ' +
    lastRow
  );


  return processSubmission(
    payload
  );

}


/* ============================================================================
 * MAIN SUBMISSION PROCESSOR
 * ========================================================================== */

/**
 * Converts any supported incoming payload into the standard submission object.
 */
function processSubmission(
  rawData
) {

  Logger.log(
    '=== PROCESSING SUBMISSION ==='
  );


  if (!rawData) {

    rawData =
      {};

  }


  var extractedMap =
    normalizeInputKeys(
      rawData
    );


 var evaluation = {
  spamScore: 0,
  isSpam: false,
  requiresReview: false,
  isReviewRequired: false,
  isUrgent: false,
  flags: [],
  reasons: [],
  flagReasons: [],
  statusLabel: 'NEW INQUIRY'
};

if (
  typeof Evaluation !== 'undefined' &&
  typeof Evaluation.evaluateLead === 'function'
) {
  evaluation =
    Evaluation.evaluateLead(
      rawData
    ) || evaluation;
} else {
  Logger.log(
    'WARNING: Evaluation.evaluateLead() is unavailable. ' +
    'Using safe default evaluation.'
  );
}


  Logger.log(
    'Evaluation Result: ' +
    JSON.stringify(
      evaluation
    )
  );


  var tz =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.TIMEZONE
    )

      ? CONFIG.TIMEZONE

      : 'Pacific/Auckland';


  var timestamp =
    Utilities.formatDate(
      new Date(),
      tz,
      'yyyy-MM-dd HH:mm:ss'
    );


  /* --------------------------------------------------------------------------
   * UNIVERSAL VALUE EXTRACTOR
   * ------------------------------------------------------------------------ */

  function getValue(
    keys,
    defaultValue
  ) {

    /*
     * Exact raw-key match.
     */
    for (
      var i = 0;
      i < keys.length;
      i++
    ) {

      var key =
        keys[i];


      if (
        rawData &&
        rawData[key] !== undefined &&
        rawData[key] !== null &&
        String(
          rawData[key]
        ).trim() !== ''
      ) {

        var value =
          rawData[key];


        return Array.isArray(value)

          ? value.join(', ').trim()

          : String(
              value
            ).trim();

      }

    }


    /*
     * Normalised-key match.
     */
    for (
      var j = 0;
      j < keys.length;
      j++
    ) {

      var cleanKey =
        normalizeKey(
          keys[j]
        );


      if (
        extractedMap &&
        extractedMap[cleanKey] !== undefined &&
        extractedMap[cleanKey] !== null &&
        String(
          extractedMap[cleanKey]
        ).trim() !== ''
      ) {

        return String(
          extractedMap[cleanKey]
        ).trim();

      }

    }


    /*
     * Fuzzy key match.
     */
    for (
      var pRawKey in rawData
    ) {

      if (
        !rawData.hasOwnProperty(
          pRawKey
        )
      ) {

        continue;

      }


      var lowerRawKey =
        normalizeKey(
          pRawKey
        );


      for (
        var p = 0;
        p < keys.length;
        p++
      ) {

        var targetKey =
          normalizeKey(
            keys[p]
          );


        if (
          targetKey.length > 2 &&
          (
            lowerRawKey.indexOf(
              targetKey
            ) !== -1 ||
            targetKey.indexOf(
              lowerRawKey
            ) !== -1
          )
        ) {

          var fuzzyValue =
            rawData[pRawKey];


          if (
            fuzzyValue !== undefined &&
            fuzzyValue !== null &&
            String(
              fuzzyValue
            ).trim() !== ''
          ) {

            return Array.isArray(
              fuzzyValue
            )

              ? fuzzyValue
                  .join(', ')
                  .trim()

              : String(
                  fuzzyValue
                ).trim();

          }

        }

      }

    }


    return defaultValue;

  }


  /* --------------------------------------------------------------------------
   * STANDARD FIELD EXTRACTION
   * ------------------------------------------------------------------------ */

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
      'N/A'
    );


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
      ''
    );


  emailVal =
    normalizeEmailAddress(
      emailVal
    );


  /*
   * Fallback: scan all submitted values for an email.
   */
  if (
    !isValidEmailAddress(
      emailVal
    ) &&
    rawData
  ) {

    for (
      var rawK in rawData
    ) {

      if (
        !rawData.hasOwnProperty(
          rawK
        )
      ) {

        continue;

      }


      var rawV =
        String(
          rawData[rawK]
        ).trim();


      var possibleEmail =
        normalizeEmailAddress(
          rawV
        );


      if (
        isValidEmailAddress(
          possibleEmail
        )
      ) {

        emailVal =
          possibleEmail;


        break;

      }

    }

  }


  if (!emailVal) {

    emailVal =
      'N/A';

  }


  var phoneVal =
    getValue(
      [
        'entry.1285532466',
        'entry_1285532466',
        'phone',
        'phoneNumber',
        'phone_number',
        'contact_number',
        'mobile',
        'Phone',
        'Contact Number'
      ],
      'N/A'
    );


  var addressVal =
    getValue(
      [
        'entry.1293794731',
        'entry_1293794731',
        'address',
        'address_location',
        'location',
        'Address',
        'Address / Location'
      ],
      'N/A'
    );


  var preferredContactVal =
    getValue(
      [
        'entry.1615186237',
        'entry_1615186237',
        'preferredContact',
        'preferred_contact',
        'Preferred Contact',
        'preferred contact',
        'contact_preference',
        'contact preference'
      ],
      ''
    );


  var usedBeforeVal =
    getValue(
      [
        'entry.1388942246',
        'entry_1388942246',
        'usedBefore',
        'used_before',
        'Have you used RD3 Tech before?',
        'have you used rd3 tech before?',
        'previousCustomer'
      ],
      ''
    );


  var situationVal =
    getValue(
      [
        'entry.650060968',
        'entry_650060968',
        'situation',
        'subject',
        'Situation',
        'Subject'
      ],
      'New Website Lead'
    );


  var messageVal =
    getValue(
      [
        'entry.483026621',
        'entry_483026621',
        'message',
        'achievement',
        'goal',
        'desired_outcome',
        'desired outcome',
        'Goal / Desired Outcome',
        'What Are You Trying To Achieve?',
        'What are you trying to achieve?',
        'Message / Goal'
      ],
      ''
    );


  var achievementVal =
    messageVal;


  var categoryVal =
    getValue(
      [
        'entry.343301224',
        'entry_343301224',
        'category',
        'userType',
        'user_type',
        'Category',
        'User Type',
        'user type'
      ],
      'General Inquiry'
    );


  var timeframeVal =
    getValue(
      [
        'entry.1883892334',
        'entry_1883892334',
        'how_soon_do_you_need_help',
        'How Soon Do You Need Help?',
        'How soon do you need help?',
        'Timeframe',
        'timeframe',
        'urgency',
        'timeline'
      ],
      'N/A'
    );


  /* --------------------------------------------------------------------------
   * STANDARD SUBMISSION OBJECT
   * ------------------------------------------------------------------------ */

  var submission = {

    id:
      'LEAD-' +
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

    preferredContact:
      preferredContactVal,

    usedBefore:
      usedBeforeVal,

    relationship:
      usedBeforeVal,

    category:
      categoryVal,

    userType:
      categoryVal,

    subject:
      situationVal,

    situation:
      situationVal,

    message:
      messageVal,

    achievement:
      achievementVal,

    timeframe:
      timeframeVal,

    isSpam:
      evaluation.isSpam ||
      false,

    isReviewRequired:
      evaluation.isReviewRequired ||
      false,

    isUrgent:
      evaluation.isUrgent ||
      false,

    spamScore:
      evaluation.spamScore ||
      0,

    flagReasons:
      (
        evaluation.flagReasons &&
        evaluation.flagReasons.length
      )

        ? evaluation.flagReasons.join(
            ' | '
          )

        : '',

    reasons:
      evaluation.flagReasons ||
      [],

    flags:
      evaluation.flagReasons ||
      [],

    status:
      evaluation.statusLabel ||
      'NEW INQUIRY',

    rawData:
      JSON.stringify(
        rawData
      )

  };


  /*
   * Log basic information.
   */
  Logger.log(
    'Extracted Lead Profile: ' +
    submission.name +
    ' / ' +
    submission.email
  );


  /*
   * Write submission.
   */
  logToSheet(
    submission
  );


  /*
   * Send notifications.
   *
   * Spam does NOT receive a client confirmation.
   * Admin always receives notification.
   */
  sendEmails(
    submission,
    evaluation
  );


  Logger.log(
    '=== SUBMISSION PROCESSING COMPLETE ==='
  );


  return submission;

}


/* ============================================================================
 * INPUT NORMALISATION
 * ========================================================================== */

/**
 * Converts incoming keys into predictable lowercase underscore keys.
 */
function normalizeKey(
  key
) {

  return String(
    key || ''
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9_]+/g,
      '_'
    )
    .replace(
      /_+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    );

}


/**
 * Builds a normalised map of incoming data.
 */
function normalizeInputKeys(
  rawData
) {

  var map =
    {};


  if (!rawData) {

    return map;

  }


  for (
    var key in rawData
  ) {

    if (
      !rawData.hasOwnProperty(
        key
      )
    ) {

      continue;

    }


    var cleanKey =
      normalizeKey(
        key
      );


    var value =
      rawData[key];


    if (
      Array.isArray(value)
    ) {

      value =
        value.join(', ');

    }


    map[cleanKey] =
      String(
        value || ''
      ).trim();

  }


  return map;

}



/* ============================================================================
 * REGEX HELPER
 * ========================================================================== */

function escapeRegExp(
  value
) {

  return String(
    value || ''
  )
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

}


/* ============================================================================
 * SUBMISSIONS SHEET LOGGER
 * ========================================================================== */

/**
 * Logs the standard submission object to the Submissions sheet.
 */
function logToSheet(
  submission
) {

  submission =
    submission || {};


  var lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    var ss =
      getTargetSpreadsheetInstance();


    if (!ss) {

      throw new Error(
        'Target spreadsheet instance could not be resolved.'
      );

    }


    var sheetName =
      (
        typeof CONFIG !== 'undefined' &&
        CONFIG.SHEET_NAME
      )

        ? CONFIG.SHEET_NAME

        : 'Submissions';


    var sheet =
      ss.getSheetByName(
        sheetName
      );


    /*
     * Canonical headers.
     */
    var headers =
      [

        'Lead ID',
        'Timestamp',
        'Status',
        'Name',
        'Email',
        'Phone',
        'Address',
        'Preferred Contact',
        'Have You Used RD3 Tech Before?',
        'Category',
        'Subject / Situation',
        'Message / Goal',
        'Timeframe',
        'Is Spam',
        'Review Required',
        'Spam Score',
        'Flag Reasons'

      ];


    /*
     * Create sheet if necessary.
     */
    if (!sheet) {

      Logger.log(
        "Creating submission sheet '" +
        sheetName +
        "'."
      );


      sheet =
        ss.insertSheet(
          sheetName
        );

    }


    /*
     * Ensure enough columns.
     */
    if (
      sheet.getMaxColumns() <
      headers.length
    ) {

      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        headers.length -
        sheet.getMaxColumns()
      );

    }


    /*
     * Set canonical headers.
     */
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues(
        [
          headers
        ]
      );


    /*
     * Remove stale extra header/data columns.
     */
    var maxColumns =
      sheet.getMaxColumns();


    if (
      maxColumns >
      headers.length
    ) {

      sheet
        .getRange(
          1,
          headers.length + 1,
          sheet.getMaxRows(),
          maxColumns -
          headers.length
        )
        .clearContent();

    }


    /*
     * Build canonical row.
     */
    var row =
      [

        submission.id ||
          'LEAD-' +
          Date.now(),

        submission.timestamp ||
          new Date().toISOString(),

        submission.status ||
          'NEW INQUIRY',

        submission.name ||
          'N/A',

        submission.email ||
          'N/A',

        submission.phone ||
          'N/A',

        submission.address ||
          'N/A',

        submission.preferredContact ||
          '',

        submission.usedBefore ||
          '',

        submission.category ||
          submission.userType ||
          'General Inquiry',

        submission.subject ||
          submission.situation ||
          'N/A',

        submission.message ||
          submission.achievement ||
          '',

        submission.timeframe ||
          'N/A',

        submission.isSpam
          ? 'YES'
          : 'NO',

        submission.isReviewRequired
          ? 'YES'
          : 'NO',

        submission.spamScore ||
          0,

        submission.flagReasons ||
          ''

      ];


    if (
      row.length !==
      headers.length
    ) {

      throw new Error(
        'Submission column mismatch. Headers = ' +
        headers.length +
        ', Row = ' +
        row.length
      );

    }


    var nextRow =
      Math.max(
        sheet.getLastRow() + 1,
        2
      );


    sheet
      .getRange(
        nextRow,
        1,
        1,
        row.length
      )
      .setValues(
        [
          row
        ]
      );


    SpreadsheetApp.flush();


    Logger.log(
      'Successfully logged submission ' +
      row[0] +
      " to tab '" +
      sheet.getName() +
      "'."
    );


  } catch (err) {

    Logger.log(
      'logToSheet ERROR: ' +
      err.toString()
    );


    throw err;


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {

      /*
       * Lock was not held.
       */

    }

  }

}


/* ============================================================================
 * EMAIL DISPATCH
 * ========================================================================== */

/**
 * Sends emails for a processed submission.
 *
 * IMPORTANT:
 *
 * - Legitimate submissions receive client confirmation.
 * - Spam submissions do NOT receive client confirmation.
 * - Admin receives notification for all submissions.
 */
function sendEmails(
  submission,
  evalResult
) {

  submission =
    submission || {};


  evalResult =
    evalResult || {};


  /*
   * Never send customer confirmation for spam.
   */
  if (
    !submission.isSpam &&
    !evalResult.isSpam
  ) {

    sendClientConfirmation(
      submission
    );

  } else {

    Logger.log(
      'Client confirmation skipped because submission was marked as spam.'
    );

  }


  /*
   * Admin always receives notification.
   */
  sendAdminNotification(
    submission,
    evalResult
  );

}


/* ============================================================================
 * ADMIN EMAIL
 * ========================================================================== */

/**
 * Sends the RD3 Tech admin notification.
 */
function sendAdminNotification(
  submission,
  evalResult
) {

  submission =
    submission || {};


  evalResult =
    evalResult || {};


  var adminEmail =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.ADMIN_EMAIL
    )

      ? String(
          CONFIG.ADMIN_EMAIL
        ).trim()

      : 'tom@rd3tech.com';


  var senderName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.SENDER_NAME
    )

      ? CONFIG.SENDER_NAME

      : 'RD3 Tech';


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
      'General Inquiry'
    );


  var upperCategory =
    categoryText.toUpperCase();


  var flags =
    [];


  if (
    submission.isReviewRequired ||
    evalResult.isReviewRequired
  ) {

    flags.push(
      'REVIEW REQUIRED'
    );

  }


  if (
    submission.isUrgent ||
    evalResult.isUrgent
  ) {

    flags.push(
      'URGENT INQUIRY'
    );

  }


  if (
    submission.isSpam ||
    evalResult.isSpam
  ) {

    flags.push(
      'SPAM DETECTED'
    );

  }


  var subjectPrefix =
    flags.length > 0

      ? '[' +
        flags.join(
          ' | '
        ) +
        '] '

      : '[NEW LEAD - ' +
        upperCategory +
        '] ';


  /*
   * Protect email headers from customer-controlled CR/LF.
   */
  var safeSubject =
    String(
      submission.subject ||
      submission.situation ||
      categoryText ||
      'New Inquiry'
    )
      .replace(
        /[\r\n]+/g,
        ' '
      )
      .trim();


  var safeLeadName =
    String(
      submission.name ||
      'N/A'
    )
      .replace(
        /[\r\n]+/g,
        ' '
      )
      .trim();


  var adminSubject =
    subjectPrefix +
    safeSubject +
    ' - ' +
    safeLeadName;


  try {

    var template =
      HtmlService
        .createTemplateFromFile(
          'AdminTemplate'
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
      'N/A';


    template.email =
      submission.email ||
      'N/A';


    template.phone =
      submission.phone ||
      'N/A';


    template.address =
      submission.address ||
      'N/A';


    template.preferredContact =
      submission.preferredContact ||
      '';


    template.usedBefore =
      submission.usedBefore ||
      '';


    template.vUsedBefore =
      submission.usedBefore ||
      '';


    template.subject =
      submission.subject ||
      submission.situation ||
      'N/A';


    template.situation =
      submission.situation ||
      submission.subject ||
      'N/A';


    template.message =
      submission.message ||
      submission.achievement ||
      'N/A';


    template.achievement =
      submission.achievement ||
      submission.message ||
      'N/A';


    template.timeframe =
      submission.timeframe ||
      'N/A';


    template.evalResult =
      evalResult;


    var htmlBody =
      template
        .evaluate()
        .getContent();


    var emailOptions =
      {

        htmlBody:
          htmlBody,

        name:
          senderName

      };


    /*
     * Only use customer email as Reply-To when valid.
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
      'Please enable HTML in your email client to view this message.',
      emailOptions
    );


    Logger.log(
      'Admin notification sent successfully to: ' +
      adminEmail
    );


  } catch (adminErr) {

    Logger.log(
      'ADMIN EMAIL FAILED'
    );


    Logger.log(
      'Recipient: ' +
      adminEmail
    );


    Logger.log(
      'Subject: ' +
      adminSubject
    );


    Logger.log(
      'Error: ' +
      adminErr.toString()
    );


    throw adminErr;

  }

}


/* ============================================================================
 * CLIENT CONFIRMATION EMAIL
 * ========================================================================== */

/**
 * Sends confirmation to the customer.
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

      : '';


  clientEmail =
    normalizeEmailAddress(
      clientEmail
    );


  var adminEmail =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.ADMIN_EMAIL
    )

      ? String(
          CONFIG.ADMIN_EMAIL
        ).trim()

      : 'tom@rd3tech.com';


  var senderName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.SENDER_NAME
    )

      ? CONFIG.SENDER_NAME

      : 'RD3 Tech';


  var companyName =
    (
      typeof CONFIG !== 'undefined' &&
      CONFIG.COMPANY_NAME
    )

      ? CONFIG.COMPANY_NAME

      : senderName;


  /*
   * Validate email.
   */
  if (
    !isValidEmailAddress(
      clientEmail
    )
  ) {

    Logger.log(
      "Skipped Client Email: Invalid email address ('" +
      clientEmail +
      "')."
    );


    return;

  }


  try {

    var clientSubject =
      'We received your request - ' +
      companyName;


    var template =
      HtmlService
        .createTemplateFromFile(
          'ClientTemplate'
        );


    template.submission =
      submission;


    template.companyName =
      companyName;


    template.senderName =
      senderName;


    template.name =
      submission.name ||
      'N/A';


    template.email =
      clientEmail;


    template.phone =
      submission.phone ||
      'N/A';


    template.address =
      submission.address ||
      'N/A';


    template.preferredContact =
      submission.preferredContact ||
      '';


    template.usedBefore =
      submission.usedBefore ||
      '';


    template.vUsedBefore =
      submission.usedBefore ||
      '';


    template.category =
      submission.category ||
      submission.userType ||
      'General Inquiry';


    template.subject =
      submission.subject ||
      'N/A';


    template.situation =
      submission.situation ||
      submission.subject ||
      'N/A';


    template.message =
      submission.message ||
      'N/A';


    template.achievement =
      submission.achievement ||
      submission.message ||
      'N/A';


    template.timeframe =
      submission.timeframe ||
      'N/A';


    var htmlBody =
      template
        .evaluate()
        .getContent();


    GmailApp.sendEmail(
      clientEmail,
      clientSubject,
      'Please enable HTML to view this email.',
      {

        htmlBody:
          htmlBody,

        name:
          senderName,

        replyTo:
          adminEmail

      }
    );


    Logger.log(
      'Client confirmation successfully sent to: ' +
      clientEmail
    );


  } catch (err) {

    /*
     * Do not cause the entire lead processing operation
     * to fail merely because the customer email failed.
     */
    Logger.log(
      'Client Email Error: ' +
      err.toString()
    );

  }

}


/* ============================================================================
 * SPREADSHEET RESOLUTION
 * ========================================================================== */

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
        'Failed opening spreadsheet by ID: ' +
        e.toString()
      );

    }

  }


  return SpreadsheetApp
    .getActiveSpreadsheet();

}


/* ============================================================================
 * INCOMING REQUEST PARSER
 * ========================================================================== */

/**
 * Parses incoming webhook data.
 *
 * Supports:
 *
 * - JSON POST bodies
 * - Standard form parameters
 */
function parseIncomingRequest(
  e
) {

  if (!e) {

    return {};

  }


  if (
    e.postData &&
    e.postData.contents
  ) {

    try {

      var content =
        e.postData.contents;


      /*
       * JSON first.
       */
      return JSON.parse(
        content
      );


    } catch (err) {

      Logger.log(
        'POST body was not JSON; falling back to request parameters.'
      );

    }

  }


  return e.parameter ||
    {};

}