import axiosInstance from "./axios";

const asbestosRemovalJobService = {
  getAll: async (params = {}) => {
    const response = await axiosInstance.get("/asbestos-removal-jobs", { params });
    return response.data;
  },
  
  getById: (id) => axiosInstance.get(`/asbestos-removal-jobs/${id}`),
  
  create: (data) => axiosInstance.post("/asbestos-removal-jobs", data),
  
  update: (id, data) => axiosInstance.put(`/asbestos-removal-jobs/${id}`, data),
  
  delete: (id) => axiosInstance.delete(`/asbestos-removal-jobs/${id}`),
};

export default asbestosRemovalJobService; 