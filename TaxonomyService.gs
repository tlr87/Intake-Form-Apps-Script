/**
 * Taxonomy Service
 * Stores and manages Spam vs. Review keyword categories.
 */
var TaxonomyService = (function () {

  var PROPERTY_KEY = 'KEYWORD_TAXONOMY_JSON';

  var DEFAULT_TAXONOMY = {
    spamKeywords: [
      "casino",
      "viagra",
      "loans",
      "invest",
      "crypto loans",
      "cheap credits"
    ],
    reviewKeywords: [
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
    ]
  };

  /**
   * Retrieves the stored taxonomy JSON object.
   * Initializes default configuration if none exists.
   */
  function getTaxonomy() {
    var stored = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEY);
    if (!stored) {
      saveTaxonomy(DEFAULT_TAXONOMY);
      return DEFAULT_TAXONOMY;
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      Logger.log('Error parsing taxonomy JSON: ' + e.toString());
      return DEFAULT_TAXONOMY;
    }
  }

  /**
   * Saves new taxonomy JSON to ScriptProperties.
   * @param {Object|String} taxonomyObj
   */
  function saveTaxonomy(taxonomyObj) {
    var jsonString = (typeof taxonomyObj === 'string') 
      ? taxonomyObj 
      : JSON.stringify(taxonomyObj);
    
    // Validate string formatting before saving
    JSON.parse(jsonString);
    PropertiesService.getScriptProperties().setProperty(PROPERTY_KEY, jsonString);
  }

  return {
    getTaxonomy: getTaxonomy,
    saveTaxonomy: saveTaxonomy,
    DEFAULT_TAXONOMY: DEFAULT_TAXONOMY
  };

})();

/**
 * Server-side API endpoints for Google Script Run (AdminUI.html)
 */
function apiGetTaxonomy() {
  var taxonomy = TaxonomyService.getTaxonomy();
  return JSON.stringify(taxonomy, null, 2);
}

function apiSaveTaxonomy(jsonStr) {
  try {
    TaxonomyService.saveTaxonomy(jsonStr);
    return { success: true, message: 'Taxonomy saved successfully!' };
  } catch (err) {
    return { success: false, message: 'Failed to save taxonomy: ' + err.toString() };
  }
}

/**
 * Overwrites stored PropertiesService taxonomy with the DEFAULT_TAXONOMY defined in code.
 */
function resetTaxonomyToDefault() {
  TaxonomyService.saveTaxonomy(TaxonomyService.DEFAULT_TAXONOMY);
  Logger.log("✅ Taxonomy storage successfully reset!");
}