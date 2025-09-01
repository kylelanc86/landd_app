import api from './api';

class ProjectAuditService {
  // Get audit trail for a project with pagination
  static async getProjectAuditTrail(projectId, page = 1, limit = 50) {
    try {
      const response = await api.get(`/project-audits/${projectId}`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching project audit trail:', error);
      throw error;
    }
  }

  // Get all audit trail for a project (no pagination)
  static async getAllProjectAuditTrail(projectId) {
    try {
      const response = await api.get(`/project-audits/${projectId}/all`);
      return response.data;
    } catch (error) {
      console.error('Error fetching all project audit trail:', error);
      throw error;
    }
  }
}

export default ProjectAuditService;
