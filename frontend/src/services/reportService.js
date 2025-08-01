import api from './api';

const reportService = {
  // Asbestos Assessment Reports
  getAsbestosAssessmentReports: async (projectId) => {
    const response = await api.get(`/reports/asbestos-assessment/${projectId}`);
    return response.data;
  },

  // Air Monitoring Reports
  getAirMonitoringReports: async (projectId) => {
    const response = await api.get(`/reports/air-monitoring/${projectId}`);
    return response.data;
  },

  // Clearance Reports
  getClearanceReports: async (projectId) => {
    const response = await api.get(`/reports/clearance/${projectId}`);
    return response.data;
  },

  // Fibre ID Reports
  getFibreIdReports: async (projectId) => {
    const response = await api.get(`/reports/fibre-id/${projectId}`);
    return response.data;
  },

  // Project Invoices
  getProjectInvoices: async (projectId) => {
    const response = await api.get(`/reports/invoices/${projectId}`);
    return response.data;
  },

  // Download report
  downloadReport: async (reportId, reportType) => {
    const response = await api.get(`/reports/download/${reportType}/${reportId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // View report (returns URL or data needed to view the report)
  viewReport: async (reportId, reportType) => {
    const response = await api.get(`/reports/view/${reportType}/${reportId}`);
    return response.data;
  },

  // Print report
  printReport: async (reportId, reportType) => {
    const response = await api.get(`/reports/print/${reportType}/${reportId}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default reportService;