import axiosInstance from "./axios";

const userService = {
  getAll: () => axiosInstance.get("/users"),
  getById: (id) => axiosInstance.get(`/users/${id}`),
  create: (data) => axiosInstance.post("/users", data),
  update: (id, data) => axiosInstance.put(`/users/${id}`, data),
  delete: (id) => axiosInstance.delete(`/users/${id}`),
};

export default userService; 