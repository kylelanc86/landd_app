import axios from 'axios';

// Log environment info
const config = {
  nodeEnv: process.env.NODE_ENV,
  apiUrl: process.env.REACT_APP_API_URL,
  defaultUrl: process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api",
  currentUrl: process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api")
};
// Create axios instance
const api = axios.create({
  baseURL: config.currentUrl,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Handle token expiration
    if (error.response?.status === 401 && error.response?.data?.newToken) {
      const newToken = error.response.data.newToken;
      localStorage.setItem("token", newToken);
      
      // Retry the original request with new token
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return api(error.config);
    }

    // Handle other 401 errors (not token expiration)
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.code;
      
      // Handle token blacklisted specifically
      if (errorCode === 'TOKEN_BLACKLISTED') {
        console.log('Token has been blacklisted, clearing authentication data');
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userPermissions");
        
        // Redirect to login with message
        window.location.href = "/login?message=session_invalidated";
        return Promise.reject(error);
      }
      
      // Handle other 401 errors
      const token = localStorage.getItem("token");
      const currentUser = localStorage.getItem("currentUser");
      
      // Only redirect to login if we don't have a token or current user
      if (!token && !currentUser) {
        window.location.href = "/login";
      }
    }

    // Handle 403 Forbidden (Permission Denied)
    if (error.response?.status === 403) {
      console.log('Permission denied error:', error.response.data);
      
      // Try to get current user info for the permission denied message
      const currentUser = localStorage.getItem("currentUser");
      let userRole = 'employee';
      let userPermissions = [];
      
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser);
          userRole = user.role || 'employee';
          
          // Get user permissions from localStorage if available
          const storedPermissions = localStorage.getItem("userPermissions");
          if (storedPermissions) {
            try {
              userPermissions = JSON.parse(storedPermissions);
            } catch (e) {
              console.error('Error parsing stored permissions:', e);
            }
          }
        } catch (e) {
          console.error('Error parsing current user:', e);
        }
      }
      
      // Extract permission information from the error response
      const { required = [], action = 'perform this action' } = error.response.data;
      
      // Show permission denied message using the global context
      // We'll need to dispatch a custom event since we can't directly access React context here
      const permissionDeniedEvent = new CustomEvent('permissionDenied', {
        detail: {
          requiredPermissions: required,
          userRole,
          userPermissions,
          action
        }
      });
      window.dispatchEvent(permissionDeniedEvent);
      
      // Return a special response that indicates permission was denied
      // This prevents components from updating their state while still allowing the modal to show
      return Promise.resolve({
        data: { 
          permissionDenied: true, 
          action,
          message: 'Permission denied'
        },
        status: 403,
        statusText: 'Forbidden',
        headers: error.response?.headers || {},
        config: error.config
      });
    }

    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return Promise.reject(new Error('No token available'));
    }
    return api.get('/auth/me');
  },
  updateUser: (userData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      return Promise.reject(new Error('No token available'));
    }
    return api.patch('/auth/update-profile', userData);
  },
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password, email) => api.post('/auth/reset-password', { token, password, email }),
  setupPassword: (token, password, email) => api.post('/auth/setup-password', { token, password, email })
};

// Client service
export const clientService = {
  getAll: (params = {}) => {
    console.log("clientService.getAll called with params:", params);
    console.log("params type:", typeof params);
    console.log("params keys:", Object.keys(params));
    console.log("params length:", Object.keys(params).length);
    
    // If no parameters provided, fetch all clients with high limit
    if (Object.keys(params).length === 0) {
      const url = "/clients?limit=10000";
      console.log("Calling client service with URL:", url);
      return api.get(url).then(response => {
        const data = response.data;
        return {
          ...response,
          data: data.clients || data,
          pagination: data.pagination
        };
      });
    }
    
    // If parameters provided, use them for pagination/search
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);

    const url = `/clients?${queryParams.toString()}`;
    console.log("Calling client service with URL:", url);
    return api.get(url).then(response => {
      const data = response.data;
      return {
        ...response,
        data: {
          clients: data.clients || [],
          pagination: data.pagination
        }
      };
    });
  },
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.patch(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`)
};

// Project service
export const projectService = {
  getAll: (params = {}) => {
    console.log("projectService.getAll called with params:", params);
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.department) queryParams.append('department', params.department);
    if (params.projectType) queryParams.append('projectType', params.projectType);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const url = `/projects?${queryParams.toString()}`;
    console.log("Making API call to:", url);
    return api.get(url);
  },
  getAssignedToMe: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    return api.get(`/projects/assigned/me?${queryParams.toString()}`);
  },
  getDashboardStats: () => api.get('/projects/stats/dashboard'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => {
    // Ensure users is included in the update and is always an array
    const updateData = {
      ...data,
      users: Array.isArray(data.users) ? data.users : (data.users ? [data.users] : [])
    };
    return api.put(`/projects/${id}`, updateData);
  },
  delete: (id) => api.delete(`/projects/${id}`),
  getTimeLogs: (projectId) => api.get(`/projects/${projectId}/timelogs`),
};

// Job service
export const jobService = {
  getAll: () => api.get('/air-monitoring-jobs'),
  getById: (id) => api.get(`/air-monitoring-jobs/${id}`),
  create: (data) => api.post('/air-monitoring-jobs', data),
  update: (id, data) => api.patch(`/air-monitoring-jobs/${id}`, data),
  delete: (id) => api.delete(`/air-monitoring-jobs/${id}`)
};

// Sample service
export const sampleService = {
  getAll: () => api.get('/samples'),
  getById: (id) => api.get(`/samples/${id}`),
  getByShift: (shiftId) => api.get(`/samples/shift/${shiftId}`),
  getByProject: (projectId) => api.get(`/samples/project/${projectId}`),
  create: (data) => api.post('/samples', data),
  update: (id, data) => api.patch(`/samples/${id}`, data),
  delete: (id) => api.delete(`/samples/${id}`)
};

// Sample Items service (for fibre ID analysis)
export const sampleItemsService = {
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.projectId) queryParams.append('projectId', params.projectId);
    return api.get(`/sample-items?${queryParams.toString()}`);
  },
  getById: (id) => api.get(`/sample-items/${id}`),
  create: (data) => api.post('/sample-items', data),
  createBulk: (data) => api.post('/sample-items/bulk', data),
  update: (id, data) => api.put(`/sample-items/${id}`, data),
  delete: (id) => api.delete(`/sample-items/${id}`)
};

export const shiftService = {
  getAll: () => api.get('/air-monitoring-shifts'),
  getById: (id) => api.get(`/air-monitoring-shifts/${id}`),
  getByJob: (jobId) => api.get(`/air-monitoring-shifts/job/${jobId}`),
  getByJobs: (jobIds) => api.post('/air-monitoring-shifts/jobs', { jobIds }),
  create: (data) => api.post('/air-monitoring-shifts', data),
  update: (id, data) => api.patch(`/air-monitoring-shifts/${id}`, data),
  delete: (id) => api.delete(`/air-monitoring-shifts/${id}`)
};

// Invoice service
export const invoiceService = {
  getAll: () => api.get('/invoices'),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id, reason) => api.delete(`/invoices/${id}`, { data: { reason } }), // Soft delete
  hardDelete: (id) => api.delete(`/invoices/${id}/hard`), // Hard delete (only for non-Xero invoices)
  restore: (id) => api.post(`/invoices/${id}/restore`), // Restore soft-deleted invoice
  getDeleted: () => api.get('/invoices/deleted/all'), // Get all deleted invoices
  getDeletedById: (id) => api.get(`/invoices/deleted/${id}`), // Get specific deleted invoice
  getOverdueByProject: (projectId) => api.get(`/invoices/overdue/${projectId}`) // Get overdue invoice info for a project
};

// User service
export const userService = {
  getAll: (showInactive = false) => {
    if (showInactive) {
      return api.get('/users'); // Fetch all users (both active and inactive)
    } else {
      return api.get('/users?isActive=true'); // Fetch only active users
    }
  },
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  sendPasswordResetEmail: (email) => api.post('/auth/admin-reset-password', { email })
};

// User preferences service
export const userPreferencesService = {
  getPreferences: () => api.get('/users/preferences/me'),
  updatePreferences: (preferences) => api.put('/users/preferences/me', preferences)
};

// Xero service
export const xeroService = {
  getAuthUrl: () => api.get('/xero/auth-url'),
  handleCallback: (code) => api.get(`/xero/callback?code=${code}`),
  getContacts: () => api.get('/xero/contacts'),
  syncInvoices: async () => {
    try {
      const response = await api.post('/xero/sync-invoices');
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        return {
          data: {
            error: 'XERO_AUTH_REQUIRED',
            message: 'Please connect to Xero first'
          }
        };
      }
      throw error;
    }
  },
  createInvoice: (invoiceData) => api.post('/xero/create-invoice', invoiceData),
  checkStatus: () => api.get('/xero/status'),
  disconnect: () => api.post('/xero/disconnect'),
  cleanupPaidInvoices: () => api.post('/xero/cleanup-paid-invoices')
};

// Timesheet API calls
export const timesheetService = {
  getTimesheets: async (startDate, endDate, userId = null) => {
    const params = new URLSearchParams();
    if (userId) {
      params.append('userId', userId);
    }
    const response = await api.get(`/timesheets/range/${startDate}/${endDate}?${params.toString()}`);
    return response.data;
  },
  getByProject: async (projectId, params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      
      // Use the correct endpoint for project timesheets
      const url = `/timesheets/by-project/${projectId}?${queryParams.toString()}`;
      console.log("Timesheet API request URL:", url);
      console.log("Timesheet API request params:", { projectId, params });
      
      const response = await api.get(url);
      console.log("Raw timesheet API response:", response);
      
      // Check response structure
      if (!response.data) {
        console.warn("No data in timesheet response");
        return { data: [] };
      }
      
      // Handle the response structure we see in the logs
      if (response.data.entries) {
        // If we get the {count, entries} structure from the logs
        return { data: response.data.entries };
      }
      
      return response;
    } catch (error) {
      console.error("Error in timesheetService.getByProject:", error);
      if (error.response) {
        console.error("Error response:", error.response.data);
        console.error("Error status:", error.response.status);
      }
      throw error;
    }
  },
  createTimesheet: async (timesheetData) => {
    const response = await api.post("/timesheets", timesheetData);
    return response.data;
  },
  updateTimesheet: async (id, timesheetData) => {
    const response = await api.put(`/timesheets/${id}`, timesheetData);
    return response.data;
  },
  deleteTimesheet: async (id) => {
    const response = await api.delete(`/timesheets/${id}`);
    return response.data;
  },
  updateTimesheetStatus: async (date, status, userId) => {
    const response = await api.put(`/timesheets/status/${date}`, { status, userId });
    return response.data;
  }
};

// Asbestos Assessment service
export const asbestosAssessmentService = {
  getAsbestosAssessments: () => api.get('/assessments'),
  getAsbestosAssessmentById: (id) => api.get(`/assessments/${id}`),
  createAsbestosAssessment: (data) => api.post('/assessments', data),
  updateAsbestosAssessment: (id, data) => api.put(`/assessments/${id}`, data),
  deleteAsbestosAssessment: (id) => api.delete(`/assessments/${id}`),
  markSampleReadyForAnalysis: (assessmentId, itemId, readyForAnalysis) => 
    api.patch(`/assessments/${assessmentId}/items/${itemId}/ready-for-analysis`, { readyForAnalysis }),
  markAssessmentReadyForAnalysis: (assessmentId) => 
    api.patch(`/assessments/${assessmentId}/ready-for-analysis`),
  getAssessmentsWithReadySamples: () => api.get('/assessments/ready-for-analysis'),
  
  // Additional methods for the new embedded analysis structure
  getJob: (jobId) => api.get(`/assessments/${jobId}`).then(res => res.data),
  updateItemAnalysis: (jobId, itemNumber, analysisData) => 
    api.put(`/assessments/${jobId}/items/${itemNumber}/analysis`, analysisData).then(res => res.data),
  
  // Upload fibre analysis report
  uploadFibreAnalysisReport: (id, reportData) => 
    api.post(`/assessments/${id}/upload-fibre-analysis-report`, reportData).then(res => res.data)
};

// Client Supplied Jobs service
export const clientSuppliedJobsService = {
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.projectId) queryParams.append('projectId', params.projectId);
    if (params.status) queryParams.append('status', params.status);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    return api.get(`/client-supplied-jobs?${queryParams.toString()}`);
  },
  getById: (id) => api.get(`/client-supplied-jobs/${id}`),
  create: (data) => api.post('/client-supplied-jobs', data),
  update: (id, data) => api.put(`/client-supplied-jobs/${id}`, data),
  delete: (id) => api.delete(`/client-supplied-jobs/${id}`),
  getByProject: (projectId) => api.get(`/client-supplied-jobs/by-project/${projectId}`)
};

export default api; 