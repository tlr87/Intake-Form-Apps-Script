/**
 * RD3 Tech Lead Engine - Evaluation, Anti-Spam & Keyword Detection
 */
const Evaluation = {
  
  evaluateLead: function(payload) {
    const text = (payload.message || "") + " " + (payload.name || "");
    const lowerText = text.toLowerCase();
    
    let flags = [];
    let spamScore = 0;
    
    // Anti-Spam Check 1: Honeypot field filled
    if (payload.honeypot && payload.honeypot.trim() !== "") {
      flags.push("Honeypot Triggered");
      spamScore += 5;
    }
    
    // Anti-Spam Check 2: Hyperlinks in message
    if (/(http|https):\/\/[^\s]+/gi.test(payload.message)) {
      flags.push("Contains External Links");
      spamScore += 2;
    }
    
    // Anti-Spam Check 3: Known spam phrases
    const spamKeywords = ["seo ranking", "crypto", "casino", "viagra", "backlinks", "wire transfer"];
    spamKeywords.forEach(word => {
      if (lowerText.includes(word)) {
        flags.push("Spam Keyword: " + word);
        spamScore += 3;
      }
    });

    // Keyword Taxonomy Detection
    const taxonomy = getStoredTaxonomy();
    let detectedCategories = [];
    
    if (taxonomy.categories && Array.isArray(taxonomy.categories)) {
      taxonomy.categories.forEach(cat => {
        const matches = cat.keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
        if (matches.length > 0) {
          detectedCategories.push(cat.name);
        }
      });
    }

    // Urgency Check
    const urgentTerms = ["urgent", "asap", "today", "emergency", "broken now", "water damage"];
    const isUrgent = urgentTerms.some(term => lowerText.includes(term));
    if (isUrgent) {
      flags.push("High Priority / Urgent");
    }

    const category = detectedCategories.length > 0 ? detectedCategories.join(", ") : "General Inquiry";
    const isSpam = spamScore >= CONFIG.SPAM_THRESHOLD;

    return {
      category: category,
      isSpam: isSpam,
      spamScore: spamScore,
      isUrgent: isUrgent,
      flags: flags
    };
  }
};