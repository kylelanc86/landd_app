import axiosInstance from "./axios";

const leadRemovalJobService = {
  getAll: async (params = {}) => {
    const response = await axiosInstance.get("/lead-removal-jobs", { params });
    return response.data;
  },

  getById: (id) => axiosInstance.get(`/lead-removal-jobs/${id}`),
  getDetails: (id, params = {}) =>
    axiosInstance.get(`/lead-removal-jobs/${id}/details`, { params }),
  getClearances: (jobId) =>
    axiosInstance.get(`/lead-removal-jobs/${jobId}/clearances`),

  create: (data) => axiosInstance.post("/lead-removal-jobs", data),

  update: (id, data) => axiosInstance.put(`/lead-removal-jobs/${id}`, data),

  delete: (id) => axiosInstance.delete(`/lead-removal-jobs/${id}`),
};

export default leadRemovalJobService;
