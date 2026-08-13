/**
 * ============================================================================
 * Main.gs - RD3 Tech Main Entry Point & Admin RPC
 * ============================================================================
 *
 * Responsibilities:
 *
 * - Public Web App POST entry point
 * - Admin portal data fetching
 * - Taxonomy RPC methods
 *
 * Submission processing itself lives in EmailService.gs.
 *
 * IMPORTANT:
 * There must be ONLY ONE doPost() function in the entire Apps Script project.
 * ========================================================================== */


/* ============================================================================
 * PUBLIC WEB APP ENTRY POINT
 * ========================================================================== */

/**
 * Main HTTP POST endpoint.
 *
 * WordPress / external webhook
 *        ↓
 * doPost()
 *        ↓
 * EmailService.processPublicSubmission()
 *        ↓
 * Evaluation
 *        ↓
 * Sheet logging
 *        ↓
 * Admin notification
 *        ↓
 * Client confirmation when legitimate
 */
function doPost(e) {

  Logger.log(
    '=== RD3 TECH WEB APP DOPOST ==='
  );

  try {

    /*
     * Parse incoming request.
     *
     * parseIncomingRequest() is defined in EmailService.gs.
     */
    var data =
      parseIncomingRequest(e);

    Logger.log(
      'Incoming POST payload: ' +
      JSON.stringify(data)
    );


    /*
     * Duplicate / rate-limit protection.
     *
     * checkSubmissionRateLimit() is defined in EmailService.gs.
     */
    if (
      !checkSubmissionRateLimit(data)
    ) {

      Logger.log(
        'Public submission blocked by duplicate/rate-limit protection.'
      );

      return ContentService
        .createTextOutput(
          JSON.stringify({

            status:
              'blocked',

            message:
              'Duplicate submission detected. Please wait before submitting again.'

          })
        )
        .setMimeType(
          ContentService.MimeType.JSON
        );

    }


    /*
     * Process the submission.
     *
     * processSubmission() is defined in EmailService.gs.
     */
    var result =
      processSubmission(data);


    /*
     * Return clean JSON response to WordPress.
     */
    return ContentService
      .createTextOutput(
        JSON.stringify({

          status:
            'success',

          id:
            result
              ? result.id
              : 'N/A',

          flags:
            result
              ? result.flags || []
              : []

        })
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );


  } catch (err) {

    Logger.log(
      'doPost ERROR: ' +
      (
        err.stack ||
        err.toString()
      )
    );


    return ContentService
      .createTextOutput(
        JSON.stringify({

          status:
            'error',

          message:
            err.toString()

        })
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );

  }

}


/* ============================================================================
 * ADMIN DATA FETCHING & MAPPING
 * ========================================================================== */

/**
 * Dynamic, header-aware lead reader for Admin Portal.
 *
 * Reads the configured submission sheet and maps different possible
 * header names into the standard Admin Portal lead object.
 */
function fetchLeadsForAdmin() {

  try {

    var ss =
      typeof getTargetSpreadsheetInstance === 'function'

        ? getTargetSpreadsheetInstance()

        : (
            typeof CONFIG !== 'undefined' &&
            CONFIG.SPREADSHEET_ID

              ? SpreadsheetApp.openById(
                  CONFIG.SPREADSHEET_ID
                )

              : SpreadsheetApp.getActiveSpreadsheet()
          );


    if (!ss) {

      return [];

    }


    /*
     * Sheet priority:
     *
     * 1. Form Responses
     * 2. CONFIG.SHEET_NAME
     * 3. First sheet
     */
    var sheet =
      ss.getSheetByName(
        'Form Responses'
      );


    if (
      !sheet &&
      typeof CONFIG !== 'undefined' &&
      CONFIG.SHEET_NAME
    ) {

      sheet =
        ss.getSheetByName(
          CONFIG.SHEET_NAME
        );

    }


    if (!sheet) {

      sheet =
        ss.getSheets()[0];

    }


    if (
      !sheet ||
      sheet.getLastRow() < 2
    ) {

      return [];

    }


    var allValues =
      sheet
        .getDataRange()
        .getValues();


    var rawHeaders =
      allValues[0];


    /*
     * Normalise header names.
     */
    var headerMap =
      {};


    for (
      var h = 0;
      h < rawHeaders.length;
      h++
    ) {

      var cleanHeader =
        rawHeaders[h]
          .toString()
          .toLowerCase()
          .replace(
            /[^a-z0-9_]/g,
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


      headerMap[cleanHeader] =
        h;

    }


    /*
     * Header-aware value extractor.
     */
    function getCell(
      row,
      aliases,
      fallback
    ) {

      for (
        var k = 0;
        k < aliases.length;
        k++
      ) {

        var idx =
          headerMap[
            aliases[k]
          ];


        if (
          idx !== undefined &&
          row[idx] !== undefined &&
          row[idx] !== null &&
          String(
            row[idx]
          ).trim() !== ''
        ) {

          return String(
            row[idx]
          ).trim();

        }

      }


      return fallback;

    }


    var leads =
      [];


    /*
     * Parse submission rows.
     */
    for (
      var i = 1;
      i < allValues.length;
      i++
    ) {

      var row =
        allValues[i];


      var idVal =
        getCell(
          row,
          [
            'lead_id',
            'id',
            'submission_id',
            'leadid'
          ],
          'LEAD-' + (i + 1)
        );


      var timeVal =
        getCell(
          row,
          [
            'timestamp',
            'date',
            'time',
            'date_submitted'
          ],
          'N/A'
        );


      var nameVal =
        getCell(
          row,
          [
            'name',
            'full_name',
            'your_name',
            'client_name',
            'contact_name'
          ],
          'N/A'
        );


      var emailVal =
        getCell(
          row,
          [
            'email',
            'email_address',
            'your_email',
            'client_email',
            'contact_email'
          ],
          'N/A'
        );


      var phoneVal =
        getCell(
          row,
          [
            'phone',
            'phone_number',
            'contact_number',
            'your_phone',
            'mobile'
          ],
          'N/A'
        );


      var addressVal =
        getCell(
          row,
          [
            'address',
            'location',
            'street_address',
            'your_address'
          ],
          'N/A'
        );


      var categoryVal =
        getCell(
          row,
          [
            'category',
            'i_am_contacting_rd3_tech_as',
            'user_type',
            'usertype',
            'contact_as',
            'type'
          ],
          'General Inquiry'
        );


      var situationVal =
        getCell(
          row,
          [
            'situation',
            'what_sounds_like_your_situation',
            'subject_situation',
            'subject',
            'problem',
            'issue'
          ],
          'New Website Lead'
        );


      var achievementVal =
        getCell(
          row,
          [
            'achievement',
            'what_are_you_trying_to_achieve',
            'message_goal',
            'message',
            'goal',
            'details'
          ],
          ''
        );


      var timeframeVal =
        getCell(
          row,
          [
            'timeframe',
            'how_soon_do_you_need_help',
            'urgency',
            'timeframe_urgency',
            'how_soon'
          ],
          'N/A'
        );


      var statusVal =
        getCell(
          row,
          [
            'status',
            'lead_status',
            'review_status'
          ],
          'NEW INQUIRY'
        );


      var isSpamVal =
        getCell(
          row,
          [
            'is_spam',
            'spam'
          ],
          'NO'
        )
          .toUpperCase() === 'YES';


      var isReviewVal =
        getCell(
          row,
          [
            'review_required',
            'is_review_required',
            'needs_review'
          ],
          'NO'
        )
          .toUpperCase() === 'YES';


      var scoreVal =
        getCell(
          row,
          [
            'spam_score',
            'score'
          ],
          0
        );


      var flagsVal =
        getCell(
          row,
          [
            'flag_reasons',
            'flags',
            'reason',
            'reasons'
          ],
          ''
        );


      leads.push({

        id:
          idVal,

        timestamp:
          timeVal,

        status:
          statusVal,

        name:
          nameVal,

        email:
          emailVal,

        phone:
          phoneVal,

        address:
          addressVal,

        category:
          categoryVal,

        situation:
          situationVal,

        achievement:
          achievementVal,

        timeframe:
          timeframeVal,

        isSpam:
          isSpamVal,

        isReviewRequired:
          isReviewVal,

        spamScore:
          scoreVal,

        flagReasons:
          flagsVal

      });

    }


    /*
     * Newest submissions first.
     */
    return leads.reverse();


  } catch (err) {

    Logger.log(
      'Error in fetchLeadsForAdmin: ' +
      err.toString()
    );

    return [];

  }

}


/* ============================================================================
 * ADMIN TAXONOMY RPC
 * ========================================================================== */

/**
 * Returns the currently stored taxonomy.
 */
function apiGetTaxonomy() {

  if (
    typeof getStoredTaxonomy === 'function'
  ) {

    return JSON.stringify(
      getStoredTaxonomy()
    );

  }


  return JSON.stringify(
    typeof CONFIG !== 'undefined'
      ? CONFIG.DEFAULT_TAXONOMY
      : {}
  );

}


/**
 * Saves taxonomy JSON.
 */
function apiSaveTaxonomy(
  jsonString
) {

  try {

    var parsed =
      JSON.parse(
        jsonString
      );


    if (
      typeof updateStoredTaxonomy === 'function'
    ) {

      updateStoredTaxonomy(
        parsed
      );

    }


    return {

      success:
        true,

      message:
        'Taxonomy saved successfully.'

    };


  } catch (err) {

    return {

      success:
        false,

      message:
        'Invalid JSON: ' +
        err.message

    };

  }

}