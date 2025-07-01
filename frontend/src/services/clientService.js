import axiosInstance from "./axios";

const clientService = {
  getAll: (params = {}) => {
    console.log("clientService.getAll called with params:", params);
    console.log("params type:", typeof params);
    console.log("params keys:", Object.keys(params));
    console.log("params length:", Object.keys(params).length);
    
    // If no parameters provided, fetch all clients with high limit
    if (Object.keys(params).length === 0) {
      const url = "/clients?limit=10000";
      console.log("Calling client service with URL:", url);
      return axiosInstance.get(url);
    }
    // If parameters provided, use them for pagination/search
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    const url = `/clients?${queryParams.toString()}`;
    console.log("Calling client service with URL:", url);
    return axiosInstance.get(url);
  },
  getById: (id) => axiosInstance.get(`/clients/${id}`),
  create: (data) => axiosInstance.post("/clients", data),
  update: (id, data) => axiosInstance.patch(`/clients/${id}`, data),
  delete: (id) => axiosInstance.delete(`/clients/${id}`),
};

export default clientService; 