import axiosInstance from "./axios";

const asbestosRemovalJobService = {
  getAll: async (params = {}) => {
    const response = await axiosInstance.get("/asbestos-removal-jobs", { params });
    return response.data;
  },
  
  getById: (id) => axiosInstance.get(`/asbestos-removal-jobs/${id}`),
  getDetails: (id, params = {}) => axiosInstance.get(`/asbestos-removal-jobs/${id}/details`, { params }),
  getClearances: (id) => axiosInstance.get(`/asbestos-removal-jobs/${id}/clearances`),
  
  create: (data) => axiosInstance.post("/asbestos-removal-jobs", data),
  
  update: (id, data) => axiosInstance.put(`/asbestos-removal-jobs/${id}`, data),
  
  delete: (id) => axiosInstance.delete(`/asbestos-removal-jobs/${id}`),
};

export default asbestosRemovalJobService; 