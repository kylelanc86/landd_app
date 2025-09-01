const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const ProjectAuditService = require('../services/projectAuditService');

// GET /api/project-audits/:projectId - Get audit trail for a project
router.get('/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await ProjectAuditService.getProjectAuditTrailPaginated(
      projectId,
      parseInt(page),
      parseInt(limit)
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching project audit trail:', error);
    res.status(500).json({ message: 'Failed to fetch audit trail', error: error.message });
  }
});

// GET /api/project-audits/:projectId/all - Get all audit trail for a project (no pagination)
router.get('/:projectId/all', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const { projectId } = req.params;

    const auditTrail = await ProjectAuditService.getProjectAuditTrail(projectId);

    res.json({ auditTrail });
  } catch (error) {
    console.error('Error fetching project audit trail:', error);
    res.status(500).json({ message: 'Failed to fetch audit trail', error: error.message });
  }
});

module.exports = router;
