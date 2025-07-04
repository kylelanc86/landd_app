import axiosInstance from "./axios";

const projectService = {
  getAll: async () => {
    const response = await axiosInstance.get("/projects");
    return { data: response.data };
  },
  getById: (id) => axiosInstance.get(`/projects/${id}`),
  create: (data) => axiosInstance.post("/projects", data),
  update: (id, data) => axiosInstance.put(`/projects/${id}`, data),
  delete: (id) => axiosInstance.delete(`/projects/${id}`),
};

export default projectService; 