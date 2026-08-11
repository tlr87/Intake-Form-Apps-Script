/**
 * RD3 Tech Lead Engine - Parsing, Formatting & Sanitization
 */
const Helpers = {
  
  parseIncomingRequest: function(e) {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        // Fallback for form-encoded POST
        payload = e.parameter || {};
      }
    }
    return {
      name: Helpers.sanitizeText(payload.name),
      email: Helpers.sanitizeText(payload.email),
      phone: Helpers.sanitizeText(payload.phone),
      message: Helpers.sanitizeText(payload.message),
      honeypot: payload.website || payload.honeypot || ""
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