import axios from 'axios';

// Log environment info
console.log('API Environment:', {
  nodeEnv: process.env.NODE_ENV,
  apiUrl: process.env.REACT_APP_API_URL,
  defaultUrl: process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://air-monitoring-backend.onrender.com/api",
  currentUrl: process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://air-monitoring-backend.onrender.com/api")
});

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://air-monitoring-backend.onrender.com/api"),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // Only log non-GET requests
    if (config.method !== 'get') {
      console.log('API Request:', {
        url: config.url,
        method: config.method
      });
    }
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
    // Only log non-GET responses
    if (response.config.method !== 'get') {
      console.log('API Response:', {
        url: response.config.url,
        status: response.status
      });
    }
    return response;
  },
  async (error) => {
    // Always log errors
    console.error('API Response Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    });

    // Handle token expiration
    if (error.response?.status === 401 && error.response?.data?.newToken) {
      const newToken = error.response.data.newToken;
      localStorage.setItem("token", newToken);
      
      // Retry the original request with the new token
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return api(error.config);
    }

    // Handle other 401 errors (not token expiration)
    if (error.response?.status === 401) {
      const token = localStorage.getItem("token");
      const currentUser = localStorage.getItem("currentUser");
      
      // Only redirect to login if we don't have a token or current user
      if (!token && !currentUser) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  login: (credentials) => {
    console.log("Auth Debug - API: Login attempt with credentials:", { email: credentials.email });
    return api.post('/auth/login', credentials)
      .then(response => {
        console.log("Auth Debug - API: Login response received:", {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data
        });
        return response;
      })
      .catch(error => {
        console.error("Auth Debug - API: Login failed:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.response?.data?.message || error.message,
          data: error.response?.data,
          error: error
        });
        throw error;
      });
  },
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('Auth Debug - No token available for getCurrentUser');
      return Promise.reject(new Error('No token available'));
    }
    console.log('Auth Debug - Fetching current user with token:', token.substring(0, 10) + '...');
    return api.get('/auth/me')
      .then(response => {
        console.log('Auth Debug - getCurrentUser response:', response.data);
        return response;
      })
      .catch(error => {
        console.error('Auth Debug - getCurrentUser error:', error);
        throw error;
      });
  },
  updateUser: (userData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      return Promise.reject(new Error('No token available'));
    }
    return api.patch('/auth/update-profile', userData);
  },
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password, email) => api.post('/auth/reset-password', { token, password, email })
};

// Client service
export const clientService = {
  getAll: () => api.get('/clients'),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.patch(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`)
};

// Project service
export const projectService = {
  getAll: () => api.get('/projects').then(response => {
    // Handle both response structures
    const data = response.data;
    return {
      ...response,
      data: Array.isArray(data) 
        ? data 
        : (data.projects || data.data || [])
    };
  }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => {
    // Ensure users is included in the update and is always an array
    const updateData = {
      ...data,
      users: Array.isArray(data.users) ? data.users : (data.users ? [data.users] : [])
    };
    console.log('Project service update data:', updateData);
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
  delete: (id) => api.delete(`/invoices/${id}`)
};

// User service
export const userService = {
  getAll: () => api.get('/users?isActive=true'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`)
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
  checkStatus: () => api.get('/xero/status'),
  disconnect: () => api.post('/xero/disconnect')
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

export default api; 