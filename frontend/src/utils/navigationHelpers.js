/**
 * Navigation helper functions for the databases page
 */

/**
 * Navigate to databases page with projects view and optional filters
 * @param {Function} navigate - React Router navigate function
 * @param {Object} filters - Optional filters to apply
 * @param {string} filters.status - Status filter (e.g., 'active', 'completed')
 * @param {string} filters.department - Department filter
 * @param {string} filters.search - Search term
 */
export const navigateToProjects = (navigate, filters = {}) => {
  const params = new URLSearchParams();
  params.set('db', 'projects');
  
  if (filters.status) params.set('status', filters.status);
  if (filters.department) params.set('department', filters.department);
  if (filters.search) params.set('search', filters.search);
  
  const url = `/databases?${params.toString()}`;
  navigate(url);
};

/**
 * Navigate to databases page with clients view
 * @param {Function} navigate - React Router navigate function
 */
export const navigateToClients = (navigate) => {
  navigate('/databases?db=clients');
};

/**
 * Navigate to databases page with invoices view
 * @param {Function} navigate - React Router navigate function
 */
export const navigateToInvoices = (navigate) => {
  navigate('/databases?db=invoices');
};

/**
 * Navigate to databases page with specific database type and filters
 * @param {Function} navigate - React Router navigate function
 * @param {string} databaseType - 'projects', 'clients', or 'invoices'
 * @param {Object} filters - Optional filters to apply
 */
export const navigateToDatabase = (navigate, databaseType, filters = {}) => {
  const params = new URLSearchParams();
  params.set('db', databaseType);
  
  if (filters.status) params.set('status', filters.status);
  if (filters.department) params.set('department', filters.department);
  if (filters.search) params.set('search', filters.search);
  
  const url = `/databases?${params.toString()}`;
  navigate(url);
}; 