import api from "./axios";

const swmsCategoryService = {
  getAll: async () => {
    const response = await api.get("/swms-categories");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/swms-categories/${id}`);
    return response.data;
  },

  create: async (category) => {
    const response = await api.post("/swms-categories", category);
    return response.data;
  },

  update: async (id, category) => {
    const response = await api.put(`/swms-categories/${id}`, category);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/swms-categories/${id}`);
    return response.data;
  },
};

export default swmsCategoryService;
