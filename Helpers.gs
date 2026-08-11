/**
 * RD3 Tech Lead Engine - Parsing, Formatting & Sanitization
 */
const Helpers = {

  /**
   * Universal Request Parser
   * Supports Google Form Triggers (e.namedValues), Query Params (entry.XXXX), 
   * Webhook JSON (e.postData), and Direct Objects.
   */
  parseIncomingRequest: function(e) {
    let raw = {};

    if (e) {
      // 1. Google Form Submit Event Trigger (e.namedValues)
      if (e.namedValues) {
        for (let key in e.namedValues) {
          if (e.namedValues.hasOwnProperty(key)) {
            let val = e.namedValues[key];
            raw[key] = Array.isArray(val) ? val[0] : val;
          }
        }
      } 
      // 2. Query Parameters / Form Prefills (e.parameter)
      else if (e.parameter && Object.keys(e.parameter).length > 0) {
        raw = e.parameter;
      } 
      // 3. Webhook / JSON POST Body (e.postData)
      else if (e.postData && e.postData.contents) {
        try {
          raw = JSON.parse(e.postData.contents);
        } catch (err) {
          raw = e.parameter || {};
        }
      } 
      // 4. Direct Object Pass-through
      else if (typeof e === 'object') {
        raw = e;
      }
    }

    // Helper to extract value testing multiple header/entry key aliases
    const getVal = (aliases, fallback = "") => {
      for (let i = 0; i < aliases.length; i++) {
        let k = aliases[i];
        
        // Exact match
        if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
          return Helpers.sanitizeText(raw[k]);
        }
        
        // Case-insensitive / trimmed match
        for (let rawKey in raw) {
          if (rawKey.toLowerCase().trim() === k.toLowerCase().trim()) {
            if (raw[rawKey] !== undefined && raw[rawKey] !== null && String(raw[rawKey]).trim() !== '') {
              return Helpers.sanitizeText(raw[rawKey]);
            }
          }
        }
      }
      return fallback;
    };

    const situationVal = getVal(['What sounds like your situation?', 'entry.650060968', 'situation', 'subject', 'subject_situation'], 'New Website Lead');
    const achievementVal = getVal(['What Are You Trying To Achieve?', 'entry.483026621', 'achievement', 'message', 'message_goal'], 'None');

    return {
      name: getVal(['Name', 'entry.1576532276', 'your_name', 'full_name', 'client_name'], 'N/A'),
      email: getVal(['Email', 'entry.817428911', 'email_address', 'your_email', 'client_email'], 'N/A'),
      phone: getVal(['Phone', 'entry.1285532466', 'phone_number', 'contact_number'], 'N/A'),
      address: getVal(['Address', 'entry.1293794731', 'street_address', 'location'], 'N/A'),
      
      category: getVal(['I am contacting RD3 Tech as:', 'entry.343301224', 'category', 'user_type'], 'General Inquiry'),
      situation: situationVal,
      achievement: achievementVal,
      timeframe: getVal(['How Soon Do You Need Help?', 'entry.1883892334', 'timeframe', 'urgency'], 'N/A'),
      
      // Alias mappings for email template backward compatibility
      subject: situationVal,
      message: achievementVal,
      
      honeypot: raw.website || raw.honeypot || ""
    };
  },

  sanitizeText: function(str) {
    if (!str) return "";
    return String(str).trim().replace(/<[^>]*>?/gm, ''); // Strips HTML tags
  },

  buildJsonResponse: function(data, statusCode) {
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
};