/**
 * RD3 Tech Lead Engine - Global Configuration & Settings
 */
const CONFIG = {
  ADMIN_EMAIL: "tom@rd3tech.com",
  COMPANY_NAME: "RD3 Tech",
  SENDER_NAME: "RD3 Tech",
  SPREADSHEET_ID: "1FNzJIm_njbU9d9Rv_dfJe9ChzG8f6ICJOF6bIAxrLUY",
  SHEET_NAME: "Submissions",
  SPAM_THRESHOLD: 3,
  TIMEZONE: "Pacific/Auckland",
  HONEYPOT_FIELD: "website",

  DEFAULT_TAXONOMY: {
    spamKeywords: [
      "casino",
      "viagra",
      "loans",
      "invest",
      "crypto loans",
      "cheap credits"
    ],
    reviewKeywords: [
      "TV",
      "Tuned",
      "Tv Tuned",
      "crypto",
      "seo",
      "guest post",
      "backlinks",
      "rankings",
      "partnership",
      "TV screen",
      "TV panel",
      "Display fault",
      "TV power failure",
      "Internal TV component",
      "Antenna",
      "TV reception",
      "Mobile phone screen",
      "Mobile phone battery",
      "Charging port",
      "Water damage",
      "Tablet screen",
      "Soldering",
      "Component-level electronics",
      "Console hardware",
      "PlayStation",
      "Xbox",
      "Nintendo",
      "Appliance",
      "Whiteware",
      "Electrical wiring",
      "General electronics",
      "Manufacturer warranty service"
    ],
    urgentKeywords: [
      "As soon as possible"
    ]
  }
};

/**
 * Retrieves the spreadsheet database instance safely across Form-bound, Sheet-bound, or Webhook contexts
 */
function getTargetSpreadsheet() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID) {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    }
  } catch (e) {
    Logger.log("Could not open spreadsheet by ID, falling back to active spreadsheet: " + e.toString());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Retrieves or initializes stored JSON Keyword Taxonomy
 */
function getStoredTaxonomy() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("KEYWORD_TAXONOMY");
  if (!raw) {
    const jsonString = JSON.stringify(CONFIG.DEFAULT_TAXONOMY);
    props.setProperty("KEYWORD_TAXONOMY", jsonString);
    return CONFIG.DEFAULT_TAXONOMY;
  }
  return JSON.parse(raw);
}

/**
 * Updates stored JSON Keyword Taxonomy
 */
function updateStoredTaxonomy(jsonObj) {
  const jsonString = JSON.stringify(jsonObj);
  PropertiesService.getScriptProperties().setProperty("KEYWORD_TAXONOMY", jsonString);
}