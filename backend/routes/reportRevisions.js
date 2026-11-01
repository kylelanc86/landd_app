'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const {
  listHistory,
  streamRevisionPdf,
} = require('../services/reportRevisionService');

const REPORT_TYPES = new Set([
  'shift',
  'lead_shift',
  'clearance',
  'enclosure_certificate',
  'lead_clearance',
  'fibre_id',
  'fibre_count',
  'asbestos_assessment',
  'mycometer',
]);

router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const reportType = String(req.query.reportType || '');
    const reportId = String(req.query.reportId || '');
    const reportKey = req.query.reportKey ? String(req.query.reportKey) : reportType;
    if (!REPORT_TYPES.has(reportType) || !reportId) {
      return res.status(400).json({ message: 'A report is required to load revision history' });
    }
    const entries = await listHistory({ reportType, reportId, reportKey });
    res.json({ entries });
  } catch (err) {
    console.error('Failed to list revision history:', err);
    res.status(500).json({
      message: 'Revision history could not be loaded. Try again. If this keeps happening, contact tech support.',
    });
  }
});

router.get('/:id/pdf', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    return await streamRevisionPdf(req.params.id, res);
  } catch (err) {
    console.error('Failed to download revision PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'The retained PDF could not be downloaded. Contact tech support.',
      });
    }
  }
});

module.exports = router;
