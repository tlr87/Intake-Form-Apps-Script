/**
 * Lead Evaluation & Risk Analysis Module
 * Analyzes incoming payloads for spam, honeypot traps, urgency, and review keywords
 * utilizing TaxonomyService configuration with DEFAULT_TAXONOMY fallbacks.
 */
var Evaluation = (function() {

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

    // 1. Fetch Taxonomy - Merge DEFAULT_TAXONOMY & TaxonomyService dynamically
    var defaultSpam = [
      "casino", "viagra", "loans", "invest", "crypto loans", "cheap credits"
    ];
    
    var defaultReview = [
      "TV", "Tuned", "Tv Tuned", "crypto", "seo", "guest post", "backlinks", "rankings", 
      "partnership", "TV screen", "TV panel", "Display fault", "TV power failure", 
      "Internal TV component", "Antenna", "TV reception", "Mobile phone screen", 
      "Mobile phone battery", "Charging port", "Water damage", "Tablet screen", 
      "Soldering", "Component-level electronics", "Console hardware", "PlayStation", 
      "Xbox", "Nintendo", "Appliance", "Whiteware", "Electrical wiring", 
      "General electronics", "Manufacturer warranty service"
    ];

    var defaultUrgent = ["as soon as possible", "asap"];

    var taxonomy = {};
    if (typeof DEFAULT_TAXONOMY !== 'undefined') {
      taxonomy = DEFAULT_TAXONOMY;
    }
    if (typeof TaxonomyService !== 'undefined' && typeof TaxonomyService.getTaxonomy === 'function') {
      var dynamicTax = TaxonomyService.getTaxonomy();
      if (dynamicTax) {
        if (dynamicTax.spamKeywords && dynamicTax.spamKeywords.length) taxonomy.spamKeywords = dynamicTax.spamKeywords;
        if (dynamicTax.reviewKeywords && dynamicTax.reviewKeywords.length) taxonomy.reviewKeywords = dynamicTax.reviewKeywords;
        if (dynamicTax.urgentKeywords && dynamicTax.urgentKeywords.length) taxonomy.urgentKeywords = dynamicTax.urgentKeywords;
      }
    }

    var spamKeywords = taxonomy.spamKeywords || defaultSpam;
    var reviewKeywords = taxonomy.reviewKeywords || defaultReview;
    var urgentKeywords = taxonomy.urgentKeywords || defaultUrgent;

    // Safety: Guarantee short terms like "TV" are in the review list even if missing from dynamic taxonomy
    if (reviewKeywords.indexOf("TV") === -1 && reviewKeywords.indexOf("tv") === -1) {
      reviewKeywords.unshift("TV");
    }

    // 2. Extract standard properties
    var situation   = toStr(payload.situation || payload['Situation'] || payload['entry.650060968']);
    var achievement = toStr(payload.achievement || payload.goal || payload['Goal / Desired Outcome'] || payload['entry.483026621']);
    var userType    = toStr(payload.userType || payload.category || payload['Category'] || payload['entry.343301224']);
    var timeframe   = toStr(payload.timeframe || payload['Timeframe'] || payload['entry.1883892334']);
    var phone       = toStr(payload.phone || payload['Phone'] || payload['entry.1285532466']);
    var honeypot    = toStr(payload.honeypot || payload['Honeypot'] || payload['website_hp']);

    // Catch-all: Push both KEY and VALUE with explicit spaces so text never mashes together
    var allPayloadTokens = [];
    for (var key in payload) {
      if (payload.hasOwnProperty(key)) {
        allPayloadTokens.push(key);
        allPayloadTokens.push(toStr(payload[key]));
      }
    }

    var rawCombined = allPayloadTokens.join(" ") + " " + situation + " " + achievement + " " + timeframe;
    // Normalize fullText wrapped with leading/trailing spaces
    var fullText = " " + rawCombined.toLowerCase().replace(/\s+/g, " ") + " ";

    // 3. Check Honeypot Trap
    if (honeypot !== '') {
      spamScore += 100;
      flags.push("Honeypot Triggered ('" + honeypot + "')");
    }

    // 4. Check Suspicious Phone Numbers
    if (phone !== '') {
      var cleanPhone = phone.replace(/\D/g, '');
      if (/^0+$/.test(cleanPhone) || /^1+$/.test(cleanPhone) || (cleanPhone.length > 0 && cleanPhone.length < 7)) {
        spamScore += 30;
        flags.push("Suspicious Phone Number ('" + phone + "')");
      }
    }

    // 5. Check Spam Keywords
    spamKeywords.forEach(function(term) {
      if (!term) return;
      var cleanTerm = term.toString().toLowerCase().trim();
      if (cleanTerm !== '' && fullText.indexOf(cleanTerm) !== -1) {
        spamScore += 30;
        flags.push("Spam Keyword Matched: '" + term + "'");
      }
    });

    // 6. Check Review Keywords (Supports 2-letter keywords like 'TV')
    var matchesReview = false;
    var seenMatches = {};

    reviewKeywords.forEach(function(term) {
      if (!term) return;
      var cleanTerm = term.toString().toLowerCase().trim();
      if (cleanTerm === '' || seenMatches[cleanTerm]) return;

      var isMatch = false;
      if (cleanTerm.length <= 3) {
        var rx = new RegExp('(^|[^a-z0-9])' + cleanTerm + '($|[^a-z0-9])', 'i');
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
        flags.push("Flagged Review Keyword: '" + term + "'");
      }
    });

    // 7. Urgency Evaluation
    var tfLower = timeframe.toLowerCase();
    urgentKeywords.forEach(function(uTerm) {
      var cleanUTerm = uTerm.toString().toLowerCase().trim();
      if (cleanUTerm !== '' && (tfLower.indexOf(cleanUTerm) !== -1 || fullText.indexOf(cleanUTerm) !== -1)) {
        isUrgent = true;
      }
    });
    if (tfLower.indexOf('asap') !== -1 || tfLower.indexOf('as soon as possible') !== -1) {
      isUrgent = true;
    }
    if (isUrgent && flags.join(' ').indexOf('Urgent Request') === -1) {
      flags.push("Urgent Request: 'As soon as possible'");
    }

    var isSpam = spamScore >= 50;
    var requiresReview = matchesReview || (spamScore > 0 && !isSpam);

    return {
      spamScore: spamScore,
      isSpam: isSpam,
      requiresReview: requiresReview,
      isReviewRequired: requiresReview,
      isUrgent: isUrgent,
      flags: flags,
      reasons: flags,
      flagReasons: flags,
      statusLabel: isSpam ? "SPAM" : (requiresReview ? "NEEDS REVIEW" : "NEW INQUIRY")
    };
  }

  return {
    evaluateLead: evaluateLead
  };

})();