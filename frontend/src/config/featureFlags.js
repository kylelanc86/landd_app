// Feature Flags Configuration
// This file controls which features are enabled/disabled in the application
// Set to false to disable features for production deployment

export const FEATURE_FLAGS = {
  // Core functionality (always enabled)
  CORE: {
    PROJECTS: true,
    CLIENTS: true,
    USERS: true,
    INVOICES: true,
    TIMESHEETS: true,
    CALENDAR: true,
    AIR_MONITORING: true,
    LABORATORY: true,
  },

  // Advanced functionality (can be disabled for initial deployment)
  ADVANCED: {
    RECORDS: false,           // Asset register, audits, calibrations, etc.
    SURVEYS: false,           // Asbestos, lead, mould assessments
    ASBESTOS_REMOVAL: true,  // Asbestos removal job management
    FIBRE_ID: false,          // Fibre identification and client supplied jobs
    REPORTS: false,           // Report generation and templates
  },

  // Admin functionality
  ADMIN: {
    ADMIN_DASHBOARD: true,
    CUSTOM_DATA_FIELDS: true,
    INVOICE_ITEMS: true,
    USER_MANAGEMENT: true,
    TEMPLATE_MANAGEMENT: false, // Report templates
  },
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (featurePath) => {
  const pathParts = featurePath.split('.');
  let current = FEATURE_FLAGS;
  
  for (const part of pathParts) {
    if (current[part] === undefined) {
      console.warn(`Feature flag path "${featurePath}" not found`);
      return false;
    }
    current = current[part];
  }
  
  return current === true;
};

// Helper function to check multiple features
export const areFeaturesEnabled = (featurePaths) => {
  return featurePaths.every(path => isFeatureEnabled(path));
};

// Helper function to check if any feature is enabled
export const isAnyFeatureEnabled = (featurePaths) => {
  return featurePaths.some(path => isFeatureEnabled(path));
};

// Convenience functions for common feature checks
export const isRecordsEnabled = () => isFeatureEnabled('ADVANCED.RECORDS');
export const isSurveysEnabled = () => isFeatureEnabled('ADVANCED.SURVEYS');
export const isAsbestosRemovalEnabled = () => isFeatureEnabled('ADVANCED.ASBESTOS_REMOVAL');
export const isFibreIdEnabled = () => isFeatureEnabled('ADVANCED.FIBRE_ID');
export const isReportsEnabled = () => isFeatureEnabled('ADVANCED.REPORTS');

// Export default for easy importing
export default FEATURE_FLAGS;
