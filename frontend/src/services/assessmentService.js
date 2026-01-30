import axios from './axios';

const API_BASE = '/assessments';

const assessmentService = {
  getJobs: () => {
    console.log("assessmentService.getJobs called");
    return axios.get(API_BASE).then(res => {
      console.log("getJobs response:", res.data);
      return res.data;
    });
  },
  createJob: (data) => {
    console.log("assessmentService.createJob called with:", data);
    return axios.post(API_BASE, data).then(res => res.data);
  },
  updateJob: (jobId, data) => {
    console.log("assessmentService.updateJob called with:", jobId, data);
    return axios.put(`${API_BASE}/${jobId}`, data).then(res => res.data);
  },
  deleteJob: (jobId) => {
    console.log("assessmentService.deleteJob called with:", jobId);
    return axios.delete(`${API_BASE}/${jobId}`).then(res => res.data);
  },
  getJob: (jobId) => {
    console.log("assessmentService.getJob called with:", jobId);
    return axios.get(`${API_BASE}/${jobId}`).then(res => {
      console.log("getJob response:", res.data);
      return res.data;
    });
  },
  getItems: (jobId) => {
    console.log("assessmentService.getItems called with:", jobId);
    return axios.get(`${API_BASE}/${jobId}/items`).then(res => {
      console.log("getItems response:", res.data);
      return res.data;
    });
  },
  addItem: (jobId, data) => {
    console.log("assessmentService.addItem called with:", jobId, data);
    return axios.post(`${API_BASE}/${jobId}/items`, data).then(res => res.data);
  },
  updateItem: (jobId, itemId, data) => {
    console.log("assessmentService.updateItem called with:", jobId, itemId, data);
    return axios.put(`${API_BASE}/${jobId}/items/${itemId}`, data).then(res => res.data);
  },
  deleteItem: (jobId, itemId) => {
    console.log("assessmentService.deleteItem called with:", jobId, itemId);
    return axios.delete(`${API_BASE}/${jobId}/items/${itemId}`).then(res => res.data);
  },
  updateStatus: (jobId, status) => {
    console.log("assessmentService.updateStatus called with:", jobId, status);
    return axios.patch(`${API_BASE}/${jobId}/status`, { status }).then(res => res.data);
  },
  
  // Update analysis data for a specific assessment item
  updateItemAnalysis: (jobId, itemNumber, analysisData) => {
    console.log("assessmentService.updateItemAnalysis called with:", jobId, itemNumber, analysisData);
    return axios.put(`${API_BASE}/${jobId}/items/${itemNumber}/analysis`, analysisData).then(res => res.data);
  },

  generatePDF: (assessmentData) => {
    console.log("assessmentService.generatePDF called with:", assessmentData);
    return axios.post('/api/pdf-docraptor-v2/generate-asbestos-assessment-v3', { assessmentData }, { 
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).then(res => res.data);
  },
};

export default assessmentService; 