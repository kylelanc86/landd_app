import customDataFieldGroupService from './customDataFieldGroupService';

// Cache for project statuses to avoid repeated API calls
let statusCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Hardcoded status colors - these can be updated dynamically
let hardcodedStatusColors = {
  // Active statuses
  "Assigned": "#1976d2", // Blue
  "In progress": "#ed6c02", // Orange
  "Samples submitted": "#9c27b0", // Purple
  "Lab Analysis Complete": "#2e7d32", // Green
  "Report sent for review": "#d32f2f", // Red
  "Ready for invoicing": "#7b1fa2", // Deep Purple
  "Invoice sent": "#388e3c", // Dark Green
  "Quote sent": "#1976d2", // Blue
  
  // Inactive statuses
  "Job complete": "#424242", // Grey
  "On hold": "#f57c00", // Dark Orange
  "Cancelled": "#d32f2f", // Red
};

const projectStatusService = {
  // Get all project statuses from custom data fields
  async getAllStatuses() {
    try {
      // Use the new project-statuses route that only requires projects.view permission
      const response = await customDataFieldGroupService.getProjectStatuses();
      return response || [];
    } catch (error) {
      console.error('Error fetching project statuses:', error);
      return [];
    }
  },

  // Get active statuses (isActiveStatus = true)
  async getActiveStatuses() {
    const allStatuses = await this.getAllStatuses();
    // Handle new structure where allStatuses is an object with activeStatuses and inactiveStatuses arrays
    if (allStatuses && typeof allStatuses === 'object' && !Array.isArray(allStatuses)) {
      return allStatuses.activeStatuses?.map(status => status.text) || [];
    }
    // Fallback to old structure
    return allStatuses
      .filter(status => status.isActiveStatus === true)
      .map(status => status.text)
      .sort();
  },

  // Get inactive statuses (isActiveStatus = false)
  async getInactiveStatuses() {
    const allStatuses = await this.getAllStatuses();
    // Handle new structure where allStatuses is an object with activeStatuses and inactiveStatuses arrays
    if (allStatuses && typeof allStatuses === 'object' && !Array.isArray(allStatuses)) {
      return allStatuses.inactiveStatuses?.map(status => status.text) || [];
    }
    // Fallback to old structure
    return allStatuses
      .filter(status => status.isActiveStatus === false)
      .map(status => status.text)
      .sort();
  },

  // Get status with color information
  async getStatusWithColor(statusText) {
    const allStatuses = await this.getAllStatuses();
    // Handle new structure where allStatuses is an object with activeStatuses and inactiveStatuses arrays
    if (allStatuses && typeof allStatuses === 'object' && !Array.isArray(allStatuses)) {
      const combinedStatuses = [
        ...(allStatuses.activeStatuses || []),
        ...(allStatuses.inactiveStatuses || [])
      ];
      const status = combinedStatuses.find(s => s.text === statusText);
      return status ? status.statusColor || '#1976d2' : '#1976d2';
    }
    // Fallback to old structure
    const status = allStatuses.find(s => s.text === statusText);
    return status ? status.statusColor || '#1976d2' : '#1976d2';
  },

  // Get all statuses as a single array
  async getAllStatusesAsArray() {
    const allStatuses = await this.getAllStatuses();
    // Handle new structure where allStatuses is an object with activeStatuses and inactiveStatuses arrays
    if (allStatuses && typeof allStatuses === 'object' && !Array.isArray(allStatuses)) {
      const combinedStatuses = [
        ...(allStatuses.activeStatuses || []),
        ...(allStatuses.inactiveStatuses || [])
      ];
      return combinedStatuses.map(status => status.text).sort();
    }
    // Fallback to old structure
    return allStatuses.map(status => status.text).sort();
  },

  // Get all statuses with full object data (including colors)
  async getAllStatusesWithData() {
    const allStatuses = await this.getAllStatuses();
    
    // Handle new structure where allStatuses is an object with activeStatuses and inactiveStatuses arrays
    if (allStatuses && typeof allStatuses === 'object' && !Array.isArray(allStatuses)) {
      // Return the structured response as-is for the context to process
      return allStatuses;
    }
    
    // Fallback to old structure
    return allStatuses.sort((a, b) => a.text.localeCompare(b.text));
  },

  // Get statuses with caching for better performance
  async getCachedActiveStatuses() {
    const now = Date.now();
    if (!statusCache || (now - lastFetchTime) > CACHE_DURATION) {
      statusCache = await this.getAllStatuses();
      lastFetchTime = now;
    }
    
    // Handle new structure where statusCache is an object with activeStatuses and inactiveStatuses arrays
    if (statusCache && typeof statusCache === 'object' && !Array.isArray(statusCache)) {
      return statusCache.activeStatuses?.map(status => status.text) || [];
    }
    
    // Fallback to old structure
    return statusCache
      .filter(status => status.isActiveStatus === true)
      .map(status => status.text)
      .sort();
  },

  async getCachedInactiveStatuses() {
    const now = Date.now();
    if (!statusCache || (now - lastFetchTime) > CACHE_DURATION) {
      statusCache = await this.getAllStatuses();
      lastFetchTime = now;
    }
    
    // Handle new structure where statusCache is an object with activeStatuses and inactiveStatuses arrays
    if (statusCache && typeof statusCache === 'object' && !Array.isArray(statusCache)) {
      return statusCache.inactiveStatuses?.map(status => status.text) || [];
    }
    
    // Fallback to old structure
    return statusCache
      .filter(status => status.isActiveStatus === false)
      .map(status => status.text)
      .sort();
  },

  // Clear cache (useful when statuses are updated)
  clearCache() {
    statusCache = null;
    lastFetchTime = 0;
  },

  // Get status color from hardcoded colors
  getStatusColor(status) {
    return hardcodedStatusColors[status] || "#1976d2"; // Default Material-UI primary blue
  },

  // Get all hardcoded status colors
  getAllHardcodedColors() {
    return { ...hardcodedStatusColors };
  },

  // Update hardcoded colors when they're changed in admin interface
  updateHardcodedColors(updatedColors) {
    console.log('Updating hardcoded status colors:', updatedColors);
    
    // Update the hardcoded colors object
    hardcodedStatusColors = { ...hardcodedStatusColors, ...updatedColors };
    
    // Store in localStorage for persistence across page reloads
    try {
      localStorage.setItem('statusColors', JSON.stringify(hardcodedStatusColors));
    } catch (error) {
      console.warn('Failed to save status colors to localStorage:', error);
    }
    
    // Clear the status cache to force a refresh
    this.clearCache();
    
    console.log('Hardcoded status colors updated successfully');
  },

  // Load hardcoded colors from localStorage on initialization
  loadHardcodedColors() {
    try {
      const savedColors = localStorage.getItem('statusColors');
      if (savedColors) {
        const parsedColors = JSON.parse(savedColors);
        hardcodedStatusColors = { ...hardcodedStatusColors, ...parsedColors };
        console.log('Loaded status colors from localStorage:', parsedColors);
      }
    } catch (error) {
      console.warn('Failed to load status colors from localStorage:', error);
    }
  }
};

// Initialize hardcoded colors from localStorage on module load
projectStatusService.loadHardcodedColors();

export default projectStatusService;
