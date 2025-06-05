import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
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
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Only handle auth errors for non-Xero endpoints
    if (error.response?.status === 401 && !error.config.url.includes('/xero')) {
      console.log('Auth Debug - Received 401 error, attempting token refresh');
      
      try {
        const response = await authService.getCurrentUser();
        if (response.data) {
          console.log('Auth Debug - Token refresh successful');
          // Update token in localStorage
          localStorage.setItem('token', response.data.token);
          // Update current user object
          const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
          currentUser.token = response.data.token;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          // Retry the original request
          const config = error.config;
          config.headers.Authorization = `Bearer ${response.data.token}`;
          console.log('Auth Debug - Retrying request with refreshed token');
          return api(config);
        }
      } catch (refreshError) {
        console.error('Auth Debug - Token refresh failed:', refreshError);
        // Only redirect to login if we're not already on the login page
        // and if the error is not from the token refresh attempt itself
        if (!window.location.pathname.includes('/login') && 
            !error.config.url.includes('/auth/current-user')) {
          console.log('Auth Debug - Redirecting to login page');
          localStorage.removeItem("token");
          localStorage.removeItem("currentUser");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  login: (credentials) => {
    console.log("Auth Debug - Login attempt");
    return api.post('/auth/login', credentials);
  },
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('Auth Debug - No token available for getCurrentUser');
      return Promise.reject(new Error('No token available'));
    }
    console.log('Auth Debug - Fetching current user');
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
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => {
    // Ensure users is included in the update
    const updateData = {
      ...data,
      users: Array.isArray(data.users) ? data.users : []
    };
    console.log('Project service update data:', updateData);
    return api.patch(`/projects/${id}`, updateData);
  },
  delete: (id) => api.delete(`/projects/${id}`)
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