/**
 * Lead Evaluation & Risk Analysis Module
 * Analyzes incoming payloads for spam, honeypot traps, urgency, and review keywords
 * utilizing TaxonomyService configuration.
 */
var Evaluation = (function() {

  function toStr(val) {
    if (!val) return '';
    if (Array.isArray(val)) return String(val[0] || '').trim();
    return String(val).trim();
  }

  function evaluateLead(payload) {
    var spamScore = 0;
    var flags = [];
    var isUrgent = false;

    payload = payload || {};

    // 1. Fetch Taxonomy dynamically from TaxonomyService (or fallback options)
    var taxonomy = {};
    if (typeof TaxonomyService !== 'undefined' && typeof TaxonomyService.getTaxonomy === 'function') {
      taxonomy = TaxonomyService.getTaxonomy();
    } else if (typeof DEFAULT_TAXONOMY !== 'undefined') {
      taxonomy = DEFAULT_TAXONOMY;
    }

    var spamKeywords = taxonomy.spamKeywords || [
      "casino", "viagra", "loans", "invest", "crypto loans", "cheap credits"
    ];
    var reviewKeywords = taxonomy.reviewKeywords || [
      "crypto", "seo", "guest post", "backlinks", "rankings", "partnership", "TV screen"
    ];

    // Safely extract string values from payload
    var situation   = toStr(payload.situation || payload['Situation']);
    var achievement = toStr(payload.achievement || payload.goal || payload['Goal / Desired Outcome']);
    var userType    = toStr(payload.userType || payload.category || payload['Category']);
    var timeframe   = toStr(payload.timeframe || payload['Timeframe']);
    var phone       = toStr(payload.phone || payload['Phone']);
    var honeypot    = toStr(payload.honeypot || payload['Honeypot']);

    var fullText = (situation + ' ' + achievement + ' ' + userType + ' ' + timeframe).toLowerCase();

    // 2. Check Honeypot Trap
    if (honeypot !== '') {
      spamScore += 100;
      flags.push("Honeypot Triggered ('" + honeypot + "')");
    }

    // 3. Check Suspicious Phone Numbers
    if (phone !== '') {
      var cleanPhone = phone.replace(/\D/g, '');
      if (/^0+$/.test(cleanPhone) || /^1+$/.test(cleanPhone) || (cleanPhone.length > 0 && cleanPhone.length < 7)) {
        spamScore += 30;
        flags.push("Suspicious Phone Number ('" + phone + "')");
      }
    }

    // 4. Check Spam Keywords from Taxonomy
    spamKeywords.forEach(function(term) {
      if (term && fullText.indexOf(term.toLowerCase()) !== -1) {
        spamScore += 30;
        flags.push("Spam Keyword Matched: '" + term + "'");
      }
    });

    // 5. Check Review Keywords from Taxonomy
    var matchesReview = false;
    reviewKeywords.forEach(function(term) {
      if (term && fullText.indexOf(term.toLowerCase()) !== -1) {
        matchesReview = true;
        flags.push("Flagged Review Keyword: '" + term + "'");
      }
    });

    // 6. Urgency Evaluation based on "How Soon Do You Need Help?" / Timeframe
    var tfLower = timeframe.toLowerCase();
    if (tfLower === 'as soon as possible' || tfLower === 'asap') {
      isUrgent = true;
      flags.push("Urgent Request: 'As soon as possible'");
    } else if (tfLower === 'within the next few weeks' || tfLower === 'planning ahead') {
      isUrgent = false;
    }

    var isSpam = spamScore >= 50;
    var requiresReview = matchesReview || (spamScore > 0 && !isSpam);

    return {
      spamScore: spamScore,
      isSpam: isSpam,
      requiresReview: requiresReview,
      isUrgent: isUrgent,
      flags: flags,
      reasons: flags,
      flagReasons: flags
    };
  }

  return {
    evaluateLead: evaluateLead
  };

})();