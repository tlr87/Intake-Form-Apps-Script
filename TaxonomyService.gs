/**
 * Taxonomy Service
 * Stores and manages Spam vs. Review keyword categories.
 */
var TaxonomyService = (function () {

  var PROPERTY_KEY = 'KEYWORD_TAXONOMY_JSON';

  /**
   * Retrieves the stored taxonomy JSON object.
   * Initializes default configuration if none exists.
   */
  function getTaxonomy() {
    var stored = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_KEY);

    if (!stored) {
      saveTaxonomy(CONFIG.DEFAULT_TAXONOMY);
      return CONFIG.DEFAULT_TAXONOMY;
    }

    try {
      return JSON.parse(stored);
    } catch (e) {
      Logger.log(
        'Error parsing taxonomy JSON: ' + e.toString()
      );

      return CONFIG.DEFAULT_TAXONOMY;
    }
  }

  /**
   * ============================================================================
   * ADMIN ACCESS CONTROL
   * ============================================================================
   *
   * Only users listed in CONFIG.ADMIN_USERS may access or modify
   * the RD3 Tech live taxonomy.
   *
   * This check is performed server-side so changing the AdminUI URL
   * does not bypass the protection.
   * ============================================================================
   */
  function requireAdminAccess() {

    var activeUser = Session.getActiveUser();

    var userEmail = activeUser
      ? String(activeUser.getEmail() || '')
          .toLowerCase()
          .trim()
      : '';

    if (!userEmail) {
      throw new Error(
        'Admin access required. '
      );
    }

    var allowedUsers = (
      CONFIG.ADMIN_USERS || []
    ).map(function (email) {
      return String(email)
        .toLowerCase()
        .trim();
    });

    if (allowedUsers.indexOf(userEmail) === -1) {
      throw new Error(
        'Access denied. This function is restricted to RD3 Tech administrators.'
      );
    }

    return true;
  }

  /**
   * Saves new taxonomy JSON to ScriptProperties.
   *
   * @param {Object|String} taxonomyObj
   */
  function saveTaxonomy(taxonomyObj) {

    var jsonString =
      (typeof taxonomyObj === 'string')
        ? taxonomyObj
        : JSON.stringify(taxonomyObj);

    // Validate JSON before saving.
    JSON.parse(jsonString);

    PropertiesService
      .getScriptProperties()
      .setProperty(
        PROPERTY_KEY,
        jsonString
      );
  }

  return {
    getTaxonomy: getTaxonomy,
    saveTaxonomy: saveTaxonomy,
    requireAdminAccess: requireAdminAccess,
    DEFAULT_TAXONOMY: CONFIG.DEFAULT_TAXONOMY
  };

})();

/**
 * ============================================================================
 * Server-side API endpoints for Google Script Run (AdminUI.html)
 * ============================================================================
 */

/**
 * Get the current active taxonomy.
 *
 * Admin access is required.
 */
function apiGetTaxonomy() {

  TaxonomyService.requireAdminAccess();

  var taxonomy =
    TaxonomyService.getTaxonomy();

  return JSON.stringify(
    taxonomy,
    null,
    2
  );
}

/**
 * Save the active taxonomy.
 *
 * Admin access is required.
 */
function apiSaveTaxonomy(jsonStr) {

  try {

    TaxonomyService.requireAdminAccess();

    TaxonomyService.saveTaxonomy(jsonStr);

    return {
      success: true,
      message: 'Taxonomy saved successfully!'
    };

  } catch (err) {

    return {
      success: false,
      message:
        'Failed to save taxonomy: ' +
        err.toString()
    };
  }
}

/**
 * ============================================================================
 * Reset Taxonomy To Default
 * ============================================================================
 *
 * Overwrites the stored Script Properties taxonomy with the
 * DEFAULT_TAXONOMY defined in Config.gs.
 *
 * Admin access is required.
 * ============================================================================
 */
function resetTaxonomyToDefault() {

  TaxonomyService.requireAdminAccess();

  TaxonomyService.saveTaxonomy(
    TaxonomyService.DEFAULT_TAXONOMY
  );

  Logger.log(
    '✅ Taxonomy storage successfully reset!'
  );
}