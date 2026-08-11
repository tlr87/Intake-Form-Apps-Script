/**
 * RD3 Tech Lead Engine - Global Configuration & Settings
 */
const CONFIG = {
  ADMIN_EMAIL: "tom@rd3tech.com",
  COMPANY_NAME: "RD3 Tech",
  SHEET_NAME: "Leads",
  SPAM_THRESHOLD: 3, // Flag lead if spam score >= 3
  DEFAULT_TAXONOMY: {
    "categories": [
      {
        "name": "TV & Display Repair",
        "keywords": ["tv", "tv screen", "tv panel", "television", "antenna", "tv reception"]
      },
      {
        "name": "Mobile & Tablet Repair",
        "keywords": ["phone screen replacement", "mobile screen replacement", "battery replacement", "charging port", "water damage", "tablet screen"]
      },
      {
        "name": "Consoles & Electronics",
        "keywords": ["soldering", "electronics repair", "console repair", "playstation", "xbox", "nintendo"]
      },
      {
        "name": "Appliances & Electrical",
        "keywords": ["appliance repair", "whiteware", "electrical wiring"]
      },
      {
        "name": "Warranty Service",
        "keywords": ["warranty repair", "manufacturer warranty"]
      }
    ]
  }
};

/**
 * Retrieves the spreadsheet database instance
 */
function getTargetSpreadsheet() {
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