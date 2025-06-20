import axiosInstance from "./axios";

const clientService = {
  getAll: () => axiosInstance.get("/clients"),
  getById: (id) => axiosInstance.get(`/clients/${id}`),
  create: (data) => axiosInstance.post("/clients", data),
  update: (id, data) => axiosInstance.patch(`/clients/${id}`, data),
  delete: (id) => axiosInstance.delete(`/clients/${id}`),
};

export default clientService; 