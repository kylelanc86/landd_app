const ProjectAudit = require('../models/ProjectAudit');

class ProjectAuditService {
  // Log project creation
  static async logProjectCreation(projectId, createdBy, notes = null) {
    try {
      const auditEntry = new ProjectAudit({
        projectId,
        action: 'created',
        changedBy: createdBy,
        notes: notes || 'Project created'
      });
      
      await auditEntry.save();
      console.log(`Project creation logged for project ${projectId}`);
    } catch (error) {
      console.error('Error logging project creation:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  // Log status change
  static async logStatusChange(projectId, oldStatus, newStatus, changedBy, notes = null) {
    try {
      console.log('🔍 Creating audit entry for status change:', {
        projectId,
        oldStatus,
        newStatus,
        changedBy,
        notes
      });
      
      const auditEntry = new ProjectAudit({
        projectId,
        action: 'status_changed',
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
        changedBy,
        notes: notes || `Status changed from "${oldStatus}" to "${newStatus}"`
      });
      
      await auditEntry.save();
      console.log(`🔍 Status change logged for project ${projectId}: ${oldStatus} -> ${newStatus}`);
    } catch (error) {
      console.error('Error logging status change:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  // Log general project update
  static async logProjectUpdate(projectId, field, oldValue, newValue, changedBy, notes = null) {
    try {
      const auditEntry = new ProjectAudit({
        projectId,
        action: 'updated',
        field,
        oldValue: oldValue?.toString() || '',
        newValue: newValue?.toString() || '',
        changedBy,
        notes: notes || `${field} updated`
      });
      
      await auditEntry.save();
      console.log(`Project update logged for project ${projectId}: ${field}`);
    } catch (error) {
      console.error('Error logging project update:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  // Get audit trail for a project
  static async getProjectAuditTrail(projectId) {
    try {
      const auditTrail = await ProjectAudit.find({ projectId })
        .populate('changedBy', 'firstName lastName email')
        .sort({ timestamp: -1 })
        .lean();
      
      return auditTrail;
    } catch (error) {
      console.error('Error fetching project audit trail:', error);
      throw error;
    }
  }

  // Get audit trail with pagination
  static async getProjectAuditTrailPaginated(projectId, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;
      
      const [auditTrail, total] = await Promise.all([
        ProjectAudit.find({ projectId })
          .populate('changedBy', 'firstName lastName email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ProjectAudit.countDocuments({ projectId })
      ]);
      
      return {
        auditTrail,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching paginated project audit trail:', error);
      throw error;
    }
  }
}

module.exports = ProjectAuditService;
