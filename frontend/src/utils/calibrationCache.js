/**
 * Utility functions for caching calibration widget data
 * Cache duration: 24 hours (daily update)
 */

const CACHE_PREFIX = "calibration_widget_";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Get cached calibration data for a widget
 * @param {string} widgetKey - Unique key for the widget (e.g., 'air-pump', 'flowmeter')
 * @returns {Object|null} Cached data with { nextCalibrationDue, itemsDueInNextMonth, timestamp } or null
 */
export const getCachedCalibrationData = (widgetKey) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${widgetKey}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Check if cache is still valid (less than 24 hours old)
      if (age < CACHE_DURATION) {
        console.log(
          `⚡ Using cached calibration data for ${widgetKey} (age: ${Math.round(
            age / (60 * 60 * 1000)
          )} hours)`
        );
        return data;
      } else {
        console.log(
          `Cache expired for ${widgetKey} (age: ${Math.round(
            age / (60 * 60 * 1000)
          )} hours), fetching fresh data`
        );
      }
    }
  } catch (error) {
    console.warn(`Error reading calibration cache for ${widgetKey}:`, error);
  }
  return null;
};

/**
 * Store calibration data in cache
 * @param {string} widgetKey - Unique key for the widget
 * @param {Object} data - Data to cache with { nextCalibrationDue, itemsDueInNextMonth }
 */
export const setCachedCalibrationData = (widgetKey, data) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${widgetKey}`;
    const cacheData = {
      data: {
        nextCalibrationDue: data.nextCalibrationDue
          ? data.nextCalibrationDue.toISOString()
          : null,
        itemsDueInNextMonth: data.itemsDueInNextMonth,
      },
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log(`✅ Cached calibration data for ${widgetKey}`);
  } catch (error) {
    console.error(`Error caching calibration data for ${widgetKey}:`, error);
  }
};

/**
 * Clear cached calibration data for a specific widget
 * @param {string} widgetKey - Unique key for the widget
 */
export const clearCachedCalibrationData = (widgetKey) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${widgetKey}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error(`Error clearing calibration cache for ${widgetKey}:`, error);
  }
};

/**
 * Clear all calibration widget caches
 */
export const clearAllCalibrationCaches = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log("✅ Cleared all calibration widget caches");
  } catch (error) {
    console.error("Error clearing all calibration caches:", error);
  }
};
