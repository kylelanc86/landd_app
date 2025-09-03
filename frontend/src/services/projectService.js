import axiosInstance from "./axios";

const projectService = {
  getAll: async (params = {}) => {
    const response = await axiosInstance.get("/projects", { params });
    return response.data;
  },
  getById: (id) => axiosInstance.get(`/projects/${id}`),
  create: (data) => axiosInstance.post("/projects", data),
  update: (id, data) => axiosInstance.put(`/projects/${id}`, data),
  delete: (id) => axiosInstance.delete(`/projects/${id}`),
  checkDependencies: (id) => axiosInstance.get(`/projects/${id}/dependencies`),
  getDashboardStats: async () => {
    const response = await axiosInstance.get("/projects/stats/dashboard");
    return response.data;
  },
};

export default projectService; 