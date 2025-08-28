import customDataFieldService from './customDataFieldService';

// Cache for project statuses to avoid repeated API calls
let statusCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const projectStatusService = {
  // Get all project statuses from custom data fields
  async getAllStatuses() {
    try {
      const response = await customDataFieldService.getByType('project_status');
      return response || [];
    } catch (error) {
      console.error('Error fetching project statuses:', error);
      return [];
    }
  },

  // Get active statuses (isActiveStatus = true)
  async getActiveStatuses() {
    const allStatuses = await this.getAllStatuses();
    return allStatuses
      .filter(status => status.isActiveStatus === true)
      .map(status => status.text)
      .sort();
  },

  // Get inactive statuses (isActiveStatus = false)
  async getInactiveStatuses() {
    const allStatuses = await this.getAllStatuses();
    return allStatuses
      .filter(status => status.isActiveStatus === false)
      .map(status => status.text)
      .sort();
  },

  // Get status with color information
  async getStatusWithColor(statusText) {
    const allStatuses = await this.getAllStatuses();
    const status = allStatuses.find(s => s.text === statusText);
    return status ? status.statusColor || '#1976d2' : '#1976d2';
  },

  // Get all statuses as a single array
  async getAllStatusesAsArray() {
    const allStatuses = await this.getAllStatuses();
    return allStatuses.map(status => status.text).sort();
  },

  // Get all statuses with full object data (including colors)
  async getAllStatusesWithData() {
    const allStatuses = await this.getAllStatuses();
    return allStatuses.sort((a, b) => a.text.localeCompare(b.text));
  },

  // Get statuses with caching for better performance
  async getCachedActiveStatuses() {
    const now = Date.now();
    if (!statusCache || (now - lastFetchTime) > CACHE_DURATION) {
      statusCache = await this.getAllStatuses();
      lastFetchTime = now;
    }
    
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

  // Get status color (maintains compatibility with existing color system)
  getStatusColor(status) {
    const statusColors = {
      "In progress": "#ff9800", // Orange
      "Report sent for review": "#9c27b0", // Purple
      "Ready for invoicing": "#795548", // Brown
      "Invoice sent": "#607d8b", // Blue Grey
      "Job complete": "#4caf50", // Green
      "On hold": "#ff9800", // Orange
      "Quote sent": "#2196f3", // Blue
      "Cancelled": "#f44336", // Red
    };
    return statusColors[status] || "#757575"; // Default grey
  }
};

export default projectStatusService;
