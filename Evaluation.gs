/**
 * Lead Evaluation & Risk Analysis Module
 *
 * Single source of truth for:
 * - Spam detection
 * - Honeypot detection
 * - Review keywords
 * - Urgency detection
 * - Suspicious phone numbers
 *
 * Taxonomy source:
 *   TaxonomyService.getTaxonomy()
 *
 * Fallback:
 *   CONFIG.DEFAULT_TAXONOMY
 */

var Evaluation = (function () {

  function toStr(val) {
    if (!val) return '';

    if (Array.isArray(val)) {
      return val.join(', ').trim();
    }

    return String(val).trim();
  }


  /**
   * Evaluates an incoming submission.
   *
   * Returns the canonical evaluation object used by
   * EmailService.processSubmission().
   */
  function evaluateLead(payload) {

    payload = payload || {};

    var spamScore = 0;
    var flags = [];
    var isUrgent = false;
    var matchesReview = false;


    /* ==========================================================================
     * TAXONOMY
     * ======================================================================== */

    var taxonomy = {};

    if (
      typeof TaxonomyService !== 'undefined' &&
      typeof TaxonomyService.getTaxonomy === 'function'
    ) {
      taxonomy =
        TaxonomyService.getTaxonomy() || {};
    }

    var defaultTaxonomy =
      (
        typeof CONFIG !== 'undefined' &&
        CONFIG.DEFAULT_TAXONOMY
      )
        ? CONFIG.DEFAULT_TAXONOMY
        : {};


    var spamKeywords =
      (
        taxonomy.spamKeywords &&
        taxonomy.spamKeywords.length
      )
        ? taxonomy.spamKeywords
        : (
            defaultTaxonomy.spamKeywords || []
          );


    var reviewKeywords =
      (
        taxonomy.reviewKeywords &&
        taxonomy.reviewKeywords.length
      )
        ? taxonomy.reviewKeywords
        : (
            defaultTaxonomy.reviewKeywords || []
          );


    var urgentKeywords =
      (
        taxonomy.urgentKeywords &&
        taxonomy.urgentKeywords.length
      )
        ? taxonomy.urgentKeywords
        : (
            defaultTaxonomy.urgentKeywords || []
          );


    /* ==========================================================================
     * STANDARD FIELD EXTRACTION
     * ======================================================================== */

    var situation =
      toStr(
        payload.situation ||
        payload.Situation ||
        payload['entry.650060968'] ||
        payload['entry_650060968']
      );


    var achievement =
      toStr(
        payload.achievement ||
        payload.goal ||
        payload.desired_outcome ||
        payload['Goal / Desired Outcome'] ||
        payload['What Are You Trying To Achieve?'] ||
        payload['entry.483026621'] ||
        payload['entry_483026621']
      );


    var userType =
      toStr(
        payload.userType ||
        payload.category ||
        payload.Category ||
        payload['User Type'] ||
        payload['entry.343301224'] ||
        payload['entry_343301224']
      );


    var timeframe =
      toStr(
        payload.timeframe ||
        payload.Timeframe ||
        payload.urgency ||
        payload.timeline ||
        payload['How Soon Do You Need Help?'] ||
        payload['entry.1883892334'] ||
        payload['entry_1883892334']
      );


    var phone =
      toStr(
        payload.phone ||
        payload.Phone ||
        payload.phoneNumber ||
        payload.phone_number ||
        payload.mobile ||
        payload['Contact Number'] ||
        payload['entry.1285532466'] ||
        payload['entry_1285532466']
      );


    var honeypot =
      toStr(
        payload.honeypot ||
        payload.Honeypot ||
        payload.website ||
        payload.website_hp ||
        payload.website_url_hp ||
        payload[CONFIG && CONFIG.HONEYPOT_FIELD]
      );


    /* ==========================================================================
     * FULL PAYLOAD TEXT
     * ======================================================================== */

    var allPayloadTokens = [];

    for (var key in payload) {

      if (
        !payload.hasOwnProperty(key)
      ) {
        continue;
      }

      allPayloadTokens.push(key);
      allPayloadTokens.push(
        toStr(payload[key])
      );
    }


    var rawCombined =
      allPayloadTokens.join(' ') +
      ' ' +
      situation +
      ' ' +
      achievement +
      ' ' +
      timeframe;


    var fullText =
      ' ' +
      rawCombined
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim() +
      ' ';


    /* ==========================================================================
     * HONEYPOT
     * ======================================================================== */

    if (honeypot !== '') {

      spamScore += 100;

      flags.push(
        "Honeypot Triggered ('" +
        honeypot +
        "')"
      );

    }


    /* ==========================================================================
     * PHONE VALIDATION
     * ======================================================================== */

    if (phone !== '') {

      var cleanPhone =
        phone.replace(/\D/g, '');


      if (
        /^0+$/.test(cleanPhone) ||
        /^1+$/.test(cleanPhone) ||
        (
          cleanPhone.length > 0 &&
          cleanPhone.length < 7
        )
      ) {

        spamScore += 30;

        flags.push(
          "Suspicious Phone Number ('" +
          phone +
          "')"
        );

      }

    }


    /* ==========================================================================
     * SPAM KEYWORDS
     * ======================================================================== */

    var spamMatches = [];

    spamKeywords.forEach(
      function (term) {

        if (!term) {
          return;
        }

        var cleanTerm =
          term
            .toString()
            .toLowerCase()
            .trim();


        if (
          cleanTerm !== '' &&
          fullText.indexOf(cleanTerm) !== -1
        ) {

          if (
            spamMatches.indexOf(cleanTerm) === -1
          ) {

            spamMatches.push(
              cleanTerm
            );

            spamScore += 30;

            flags.push(
              "Spam Keyword Matched: '" +
              term +
              "'"
            );

          }

        }

      }
    );


    /* ==========================================================================
     * REVIEW KEYWORDS
     * ======================================================================== */

    var reviewMatches = [];
    var seenReviewMatches = {};


    reviewKeywords.forEach(
      function (term) {

        if (!term) {
          return;
        }

        var cleanTerm =
          term
            .toString()
            .toLowerCase()
            .trim();


        if (
          cleanTerm === '' ||
          seenReviewMatches[cleanTerm]
        ) {
          return;
        }


        var isMatch = false;


        /*
         * Short terms such as "TV" use whole-word matching.
         */
        if (
          cleanTerm.length <= 3
        ) {

          var rx =
            new RegExp(
              '(^|[^a-z0-9])' +
              escapeRegExp(cleanTerm) +
              '($|[^a-z0-9])',
              'i'
            );


          if (
            rx.test(fullText)
          ) {

            isMatch = true;

          }

        } else {

          /*
           * Longer terms use substring matching.
           */
          if (
            fullText.indexOf(cleanTerm) !== -1
          ) {

            isMatch = true;

          }

        }


        if (isMatch) {

          matchesReview = true;

          seenReviewMatches[cleanTerm] = true;

          reviewMatches.push(
            cleanTerm
          );

          flags.push(
            "Flagged Review Keyword: '" +
            term +
            "'"
          );

        }

      }
    );


    /* ==========================================================================
     * URGENCY
     * ======================================================================== */

    var timeframeLower =
      timeframe.toLowerCase();


    var urgentMatches = [];


    urgentKeywords.forEach(
      function (term) {

        if (!term) {
          return;
        }

        var cleanTerm =
          term
            .toString()
            .toLowerCase()
            .trim();


        if (!cleanTerm) {
          return;
        }


        if (
          timeframeLower.indexOf(cleanTerm) !== -1 ||
          fullText.indexOf(cleanTerm) !== -1
        ) {

          if (
            urgentMatches.indexOf(cleanTerm) === -1
          ) {

            urgentMatches.push(
              cleanTerm
            );

          }

        }

      }
    );


    /*
     * Standard urgent phrases.
     */
    if (
      timeframeLower.indexOf('asap') !== -1
    ) {

      if (
        urgentMatches.indexOf('asap') === -1
      ) {

        urgentMatches.push('asap');

      }

    }


    if (
      timeframeLower.indexOf('as soon as possible') !== -1
    ) {

      if (
        urgentMatches.indexOf(
          'as soon as possible'
        ) === -1
      ) {

        urgentMatches.push(
          'as soon as possible'
        );

      }

    }


    if (
      urgentMatches.length > 0
    ) {

      isUrgent = true;

      flags.push(
        "Urgent Request: '" +
        urgentMatches.join(', ') +
        "'"
      );

    }


    /* ==========================================================================
     * SPAM THRESHOLD
     * ======================================================================== */

    /*
     * Use CONFIG.SPAM_THRESHOLD when configured.
     *
     * Default is 50 because:
     * - Honeypot = 100
     * - Spam keyword = 30
     * - Suspicious phone = 30
     *
     * This avoids accidentally making every small warning an automatic spam
     * classification.
     */
    var spamThreshold =
      (
        typeof CONFIG !== 'undefined' &&
        Number(CONFIG.SPAM_THRESHOLD) > 0
      )
        ? Number(CONFIG.SPAM_THRESHOLD)
        : 50;


    var isSpam =
      spamScore >= spamThreshold;


    /* ==========================================================================
     * REVIEW STATUS
     * ======================================================================== */

    /*
     * Non-spam suspicious activity can still require review.
     */
    var requiresReview =
      matchesReview ||
      (
        spamScore > 0 &&
        !isSpam
      );


    /* ==========================================================================
     * STATUS
     * ======================================================================== */

    var statusParts = [];


    if (requiresReview) {

      statusParts.push(
        'REVIEW REQUIRED'
      );

    }


    if (isSpam) {

      statusParts.push(
        'SPAM DETECTED'
      );

    }


    if (isUrgent) {

      statusParts.push(
        'URGENT'
      );

    }


    var statusLabel =
      statusParts.length > 0
        ? statusParts.join(' | ')
        : 'NEW INQUIRY';


    /* ==========================================================================
     * RESULT
     * ======================================================================== */

    return {

      spamScore:
        spamScore,

      isSpam:
        isSpam,

      isReviewRequired:
        requiresReview,

      requiresReview:
        requiresReview,

      isUrgent:
        isUrgent,

      flags:
        flags,

      reasons:
        flags,

      flagReasons:
        flags,

      statusLabel:
        statusLabel,

      category:
        userType,

      reviewMatches:
        reviewMatches,

      spamMatches:
        spamMatches,

      urgentMatches:
        urgentMatches

    };

  }


  /* ============================================================================
   * REGEX HELPER
   * ========================================================================== */

  function escapeRegExp(value) {

    return String(value || '')
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

  }


  /* ============================================================================
   * PUBLIC API
   * ========================================================================== */

  return {

    evaluateLead:
      evaluateLead

  };

})();