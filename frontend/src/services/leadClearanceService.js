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

  getSampling: async (clearanceId) => {
    const response = await axios.get(`${API_BASE_URL}/${clearanceId}/sampling`);
    return response.data;
  },

  updateSampling: async (clearanceId, { preWorksSamples, validationSamples }) => {
    const response = await axios.patch(`${API_BASE_URL}/${clearanceId}/sampling`, {
      preWorksSamples,
      validationSamples,
    });
    return response.data;
  },

  getItems: async (clearanceId) => {
    const response = await axios.get(`${API_BASE_URL}/${clearanceId}/items`);
    return response.data;
  },

  addItem: async (clearanceId, itemData) => {
    const response = await axios.post(`${API_BASE_URL}/${clearanceId}/items`, itemData);
    return response.data;
  },

  updateItem: async (clearanceId, itemId, itemData) => {
    const response = await axios.put(`${API_BASE_URL}/${clearanceId}/items/${itemId}`, itemData);
    return response.data;
  },

  deleteItem: async (clearanceId, itemId) => {
    const response = await axios.delete(`${API_BASE_URL}/${clearanceId}/items/${itemId}`);
    return response.data;
  },

  addPhotoToItem: async (clearanceId, itemId, photoData, includeInReport = true) => {
    const response = await axios.post(
      `${API_BASE_URL}/${clearanceId}/items/${itemId}/photos`,
      { photoData, includeInReport }
    );
    return response.data;
  },

  deletePhotoFromItem: async (clearanceId, itemId, photoId) => {
    const response = await axios.delete(
      `${API_BASE_URL}/${clearanceId}/items/${itemId}/photos/${photoId}`
    );
    return response.data;
  },

  togglePhotoInReport: async (clearanceId, itemId, photoId) => {
    const response = await axios.patch(
      `${API_BASE_URL}/${clearanceId}/items/${itemId}/photos/${photoId}/toggle`
    );
    return response.data;
  },

  updatePhotoDescription: async (clearanceId, itemId, photoId, description) => {
    const response = await axios.patch(
      `${API_BASE_URL}/${clearanceId}/items/${itemId}/photos/${photoId}/description`,
      { description }
    );
    return response.data;
  },
};

export default leadClearanceService;
