import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    console.log("API Request:", {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });

    // Skip auth check for login and register endpoints
    if (config.url === '/auth/login' || config.url === '/auth/register') {
      return config;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      // Don't reject the promise, just return the config without the token
      // This allows the request to fail naturally with a 401
      return config;
    }

    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // For Xero-related endpoints, just reject the error without redirecting
      if (error.config.url.includes('/xero/')) {
        const errorMessage = error.response?.data?.message || 'Not connected to Xero';
        console.log('Xero auth error:', errorMessage);
        // Don't reject the promise, return a custom error response
        return Promise.resolve({
          data: {
            error: 'XERO_AUTH_REQUIRED',
            message: errorMessage,
            connected: false
          }
        });
      }
      
      // For other endpoints, clear auth data and redirect if not on login page
      if (!window.location.pathname.includes('/login')) {
        console.log('Auth error, clearing session and redirecting to login');
        localStorage.removeItem("token");
        localStorage.removeItem('currentUser');
        // Use replace instead of href to prevent back button issues
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  login: (credentials) => {
    console.log("AuthService: Login attempt with credentials:", credentials);
    return api.post('/auth/login', { email: credentials.email, password: credentials.password });
  },
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return Promise.reject(new Error('No token available'));
    }
    return api.get('/auth/me');
  }
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
  getAll: () => api.get('/jobs'),
  getById: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  delete: (id) => api.delete(`/jobs/${id}`)
};

// Sample service
export const sampleService = {
  getAll: () => api.get('/samples'),
  getById: (id) => api.get(`/samples/${id}`),
  create: (data) => api.post('/samples', data),
  update: (id, data) => api.put(`/samples/${id}`, data),
  delete: (id) => api.delete(`/samples/${id}`)
};

export const shiftService = {
  getAll: () => api.get('/shifts'),
  getById: (id) => api.get(`/shifts/${id}`),
  create: (data) => api.post('/shifts', data),
  update: (id, data) => api.put(`/shifts/${id}`, data),
  delete: (id) => api.delete(`/shifts/${id}`)
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
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
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

export default api; 