import axios from './axios';

const API_BASE = '/assessments';

const assessmentService = {
  getJobs: () => axios.get(API_BASE).then(res => res.data),
  createJob: (data) => axios.post(API_BASE, data).then(res => res.data),
  updateJob: (jobId, data) => axios.put(`${API_BASE}/${jobId}`, data).then(res => res.data),
  deleteJob: (jobId) => axios.delete(`${API_BASE}/${jobId}`).then(res => res.data),
  getJob: (jobId) => axios.get(`${API_BASE}/${jobId}`).then(res => res.data),
  getItems: (jobId) => axios.get(`${API_BASE}/${jobId}/items`).then(res => res.data),
  addItem: (jobId, data) => axios.post(`${API_BASE}/${jobId}/items`, data).then(res => res.data),
  updateItem: (jobId, itemId, data) => axios.put(`${API_BASE}/${jobId}/items/${itemId}`, data).then(res => res.data),
  deleteItem: (jobId, itemId) => axios.delete(`${API_BASE}/${jobId}/items/${itemId}`).then(res => res.data),
  generatePDF: (assessmentData) => axios.post('/api/pdf/generate-asbestos-assessment', { assessmentData }, { 
    responseType: 'blob',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }).then(res => res.data),
};

export default assessmentService; 