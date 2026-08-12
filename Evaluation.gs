
/**
 * Lead Evaluation & Risk Analysis Module
 * Analyzes incoming payloads for spam, honeypot traps, urgency, and review keywords
 * utilizing TaxonomyService configuration with CONFIG.DEFAULT_TAXONOMY fallbacks.
 */
var Evaluation = (function () {

  function toStr(val) {
    if (!val) return '';
    if (Array.isArray(val)) return val.join(', ').trim();
    return String(val).trim();
  }

  function evaluateLead(payload) {
    var spamScore = 0;
    var flags = [];
    var isUrgent = false;

    payload = payload || {};

    /**
     * ============================================================================
     * TAXONOMY LOADING
     * ============================================================================
     *
     * The live taxonomy is stored in Script Properties as:
     *     KEYWORD_TAXONOMY_JSON
     *
     * TaxonomyService.getTaxonomy() retrieves the active taxonomy.
     *
     * Evaluation uses the live taxonomy first.
     * If an individual category is missing or empty, it falls back to the
     * corresponding category in CONFIG.DEFAULT_TAXONOMY.
     *
     * Config.gs remains the single source of default taxonomy values.
     * ============================================================================
     */

    var taxonomy = {};

    if (
      typeof TaxonomyService !== 'undefined' &&
      typeof TaxonomyService.getTaxonomy === 'function'
    ) {
      taxonomy = TaxonomyService.getTaxonomy() || {};
    }

    /**
     * Spam keyword list.
     *
     * Priority:
     * 1. Live taxonomy from KEYWORD_TAXONOMY_JSON
     * 2. CONFIG.DEFAULT_TAXONOMY.spamKeywords
     */
    var spamKeywords =
      (taxonomy.spamKeywords && taxonomy.spamKeywords.length)
        ? taxonomy.spamKeywords
        : CONFIG.DEFAULT_TAXONOMY.spamKeywords;

    /**
     * Review keyword list.
     *
     * Priority:
     * 1. Live taxonomy from KEYWORD_TAXONOMY_JSON
     * 2. CONFIG.DEFAULT_TAXONOMY.reviewKeywords
     */
    var reviewKeywords =
      (taxonomy.reviewKeywords && taxonomy.reviewKeywords.length)
        ? taxonomy.reviewKeywords
        : CONFIG.DEFAULT_TAXONOMY.reviewKeywords;

    /**
     * Urgent keyword list.
     *
     * Priority:
     * 1. Live taxonomy from KEYWORD_TAXONOMY_JSON
     * 2. CONFIG.DEFAULT_TAXONOMY.urgentKeywords
     */
    var urgentKeywords =
      (taxonomy.urgentKeywords && taxonomy.urgentKeywords.length)
        ? taxonomy.urgentKeywords
        : CONFIG.DEFAULT_TAXONOMY.urgentKeywords;

    // 2. Extract standard properties
    var situation =
      toStr(
        payload.situation ||
        payload['Situation'] ||
        payload['entry.650060968']
      );

    var achievement =
      toStr(
        payload.achievement ||
        payload.goal ||
        payload['Goal / Desired Outcome'] ||
        payload['entry.483026621']
      );

    var userType =
      toStr(
        payload.userType ||
        payload.category ||
        payload['Category'] ||
        payload['entry.343301224']
      );

    var timeframe =
      toStr(
        payload.timeframe ||
        payload['Timeframe'] ||
        payload['entry.1883892334']
      );

    var phone =
      toStr(
        payload.phone ||
        payload['Phone'] ||
        payload['entry.1285532466']
      );

    var honeypot =
      toStr(
        payload.honeypot ||
        payload['Honeypot'] ||
        payload['website_hp']
      );

    // Catch-all: Push both KEY and VALUE with explicit spaces so text never mashes together
    var allPayloadTokens = [];

    for (var key in payload) {
      if (payload.hasOwnProperty(key)) {
        allPayloadTokens.push(key);
        allPayloadTokens.push(toStr(payload[key]));
      }
    }

    var rawCombined =
      allPayloadTokens.join(" ") +
      " " +
      situation +
      " " +
      achievement +
      " " +
      timeframe;

    // Normalize fullText wrapped with leading/trailing spaces
    var fullText =
      " " +
      rawCombined
        .toLowerCase()
        .replace(/\s+/g, " ") +
      " ";

    // 3. Check Honeypot Trap
    if (honeypot !== '') {
      spamScore += 100;
      flags.push("Honeypot Triggered ('" + honeypot + "')");
    }

    // 4. Check Suspicious Phone Numbers
    if (phone !== '') {
      var cleanPhone = phone.replace(/\D/g, '');

      if (
        /^0+$/.test(cleanPhone) ||
        /^1+$/.test(cleanPhone) ||
        (
          cleanPhone.length > 0 &&
          cleanPhone.length < 7
        )
      ) {
        spamScore += 30;
        flags.push("Suspicious Phone Number ('" + phone + "')");
      }
    }

    // 5. Check Spam Keywords
    spamKeywords.forEach(function (term) {
      if (!term) return;

      var cleanTerm = term
        .toString()
        .toLowerCase()
        .trim();

      if (
        cleanTerm !== '' &&
        fullText.indexOf(cleanTerm) !== -1
      ) {
        spamScore += 30;
        flags.push(
          "Spam Keyword Matched: '" + term + "'"
        );
      }
    });

    // 6. Check Review Keywords
    // Supports strict whole-word matching for short terms such as "TV"
    // and substring matching for longer phrases such as "TV aerial".
    var matchesReview = false;
    var seenMatches = {};

    reviewKeywords.forEach(function (term) {
      if (!term) return;

      var cleanTerm = term
        .toString()
        .toLowerCase()
        .trim();

      if (
        cleanTerm === '' ||
        seenMatches[cleanTerm]
      ) {
        return;
      }

      var isMatch = false;

      if (cleanTerm.length <= 3) {

        var rx = new RegExp(
          '(^|[^a-z0-9])' +
          cleanTerm +
          '($|[^a-z0-9])',
          'i'
        );

        if (rx.test(fullText)) {
          isMatch = true;
        }

      } else {

        if (fullText.indexOf(cleanTerm) !== -1) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matchesReview = true;
        seenMatches[cleanTerm] = true;

        flags.push(
          "Flagged Review Keyword: '" +
          term +
          "'"
        );
      }
    });

    // 7. Urgency Evaluation
    var tfLower = timeframe.toLowerCase();

    urgentKeywords.forEach(function (uTerm) {
      var cleanUTerm = uTerm
        .toString()
        .toLowerCase()
        .trim();

      if (
        cleanUTerm !== '' &&
        (
          tfLower.indexOf(cleanUTerm) !== -1 ||
          fullText.indexOf(cleanUTerm) !== -1
        )
      ) {
        isUrgent = true;
      }
    });

    // Additional protection for the standard urgent phrases
    if (
      tfLower.indexOf('asap') !== -1 ||
      tfLower.indexOf('as soon as possible') !== -1
    ) {
      isUrgent = true;
    }

    if (
      isUrgent &&
      flags.join(' ').indexOf('Urgent Request') === -1
    ) {
      flags.push(
        "Urgent Request: 'As soon as possible'"
      );
    }

    var isSpam = spamScore >= 50;

    var requiresReview =
      matchesReview ||
      (spamScore > 0 && !isSpam);

    return {
      spamScore: spamScore,
      isSpam: isSpam,
      requiresReview: requiresReview,
      isReviewRequired: requiresReview,
      isUrgent: isUrgent,
      flags: flags,
      reasons: flags,
      flagReasons: flags,
      statusLabel:
        isSpam
          ? "SPAM"
          : (
              requiresReview
                ? "NEEDS REVIEW"
                : "NEW INQUIRY"
            )
    };
  }

  return {
    evaluateLead: evaluateLead
  };

})();

