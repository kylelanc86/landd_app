import axios from "./axios";

const API_BASE_URL = "/lead-clearances";

const leadClearanceService = {
  getAll: async (params = {}) => {
    const response = await axios.get(API_BASE_URL, { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await axios.get(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  create: async (clearanceData) => {
    const response = await axios.post(API_BASE_URL, clearanceData);
    return response.data;
  },

  update: async (id, clearanceData) => {
    const response = await axios.put(`${API_BASE_URL}/${id}`, clearanceData);
    return response.data;
  },

  delete: async (id) => {
    const response = await axios.delete(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/status`, {
      status,
    });
    return response.data;
  },

  markReportViewed: async (id) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}`, {
      reportViewedAt: new Date().toISOString(),
    });
    return response.data;
  },

  authorise: async (id) => {
    const response = await axios.post(`${API_BASE_URL}/${id}/authorise`);
    return response.data;
  },

  sendForAuthorisation: async (id) => {
    const response = await axios.post(
      `${API_BASE_URL}/${id}/send-for-authorisation`
    );
    return response.data;
  },
};

export default leadClearanceService;
