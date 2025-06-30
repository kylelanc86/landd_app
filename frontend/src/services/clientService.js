import axiosInstance from "./axios";

const clientService = {
  getAll: (params = {}) => {
    // If no parameters provided, fetch all clients with high limit
    if (Object.keys(params).length === 0) {
      return axiosInstance.get("/clients?limit=10000");
    }
    // If parameters provided, use them for pagination/search
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    return axiosInstance.get(`/clients?${queryParams.toString()}`);
  },
  getById: (id) => axiosInstance.get(`/clients/${id}`),
  create: (data) => axiosInstance.post("/clients", data),
  update: (id, data) => axiosInstance.patch(`/clients/${id}`, data),
  delete: (id) => axiosInstance.delete(`/clients/${id}`),
};

export default clientService; 