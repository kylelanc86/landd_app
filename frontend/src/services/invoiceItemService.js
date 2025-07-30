import api from './axios';

const invoiceItemService = {
  // Get all invoice items
  getAll: async () => {
    try {
      const response = await api.get('/invoice-items');
      return response.data;
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      throw error;
    }
  },

  // Create a new invoice item
  create: async (invoiceItem) => {
    try {
      const response = await api.post('/invoice-items', invoiceItem);
      return response.data;
    } catch (error) {
      console.error('Error creating invoice item:', error);
      throw error;
    }
  },

  // Update an existing invoice item
  update: async (id, invoiceItem) => {
    try {
      const response = await api.put(`/invoice-items/${id}`, invoiceItem);
      return response.data;
    } catch (error) {
      console.error('Error updating invoice item:', error);
      throw error;
    }
  },

  // Delete an invoice item
  delete: async (id) => {
    try {
      const response = await api.delete(`/invoice-items/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting invoice item:', error);
      throw error;
    }
  },
};

export default invoiceItemService; 