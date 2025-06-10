import api from "./api";

const getAll = () => api.get("/calendar-entries");

const getById = (id) => api.get(`/calendar-entries/${id}`);

const create = (data) => api.post("/calendar-entries", data);

const update = (id, data) => api.put(`/calendar-entries/${id}`, data);

const remove = (id) => api.delete(`/calendar-entries/${id}`);

const calendarEntryService = {
  getAll,
  getById,
  create,
  update,
  remove,
};

export default calendarEntryService; 