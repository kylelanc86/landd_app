import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Services
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

// Client Services
export const clientService = {
  getAll: async () => {
    const response = await api.get('/clients');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  create: async (clientData) => {
    const response = await api.post('/clients', clientData);
    return response.data;
  },

  update: async (id, clientData) => {
    const response = await api.patch(`/clients/${id}`, clientData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
};

// Project Services
export const projectService = {
  getAll: async () => {
    const response = await api.get('/projects');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  create: async (projectData) => {
    const response = await api.post('/projects', projectData);
    return response.data;
  },

  update: async (id, projectData) => {
    const response = await api.patch(`/projects/${id}`, projectData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },
};

// Job Services
export const jobService = {
  getAll: async () => {
    const response = await api.get('/jobs');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
  },

  create: async (jobData) => {
    const response = await api.post('/jobs', jobData);
    return response.data;
  },

  update: async (id, jobData) => {
    const response = await api.patch(`/jobs/${id}`, jobData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/jobs/${id}`);
    return response.data;
  },
};

// Sample Services
export const sampleService = {
  getAll: async () => {
    const response = await api.get('/samples');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/samples/${id}`);
    return response.data;
  },

  create: async (sampleData) => {
    const response = await api.post('/samples', sampleData);
    return response.data;
  },

  update: async (id, sampleData) => {
    const response = await api.patch(`/samples/${id}`, sampleData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/samples/${id}`);
    return response.data;
  },
}; 