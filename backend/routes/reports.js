const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Project = require('../models/Project');
const AirMonitoringJob = require('../models/Job');
const Shift = require('../models/Shift');
const Sample = require('../models/Sample');
const Invoice = require('../models/Invoice');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

// Get Asbestos Assessment Reports
router.get('/asbestos-assessment/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const assessments = await AsbestosAssessment.find({ projectId: req.params.projectId })
      .populate('projectId')
      .populate('assessorId');

    const reports = assessments
      .filter(assessment => assessment.status === 'complete' || assessment.status === 'approved')
      .map(assessment => ({
        id: assessment._id,
        date: assessment.assessmentDate || assessment.createdAt,
        type: 'asbestos_assessment',
        reference: assessment.projectId.projectID,
        description: assessment.description || 'Asbestos Assessment Report',
        status: assessment.status,
        assessorName: assessment.assessorId ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : 'Unknown'
      }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Air Monitoring Reports
router.get('/air-monitoring/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const jobs = await AirMonitoringJob.find({ projectId: req.params.projectId })
      .populate('projectId');

    const reports = [];
    for (const job of jobs) {
      const shifts = await Shift.find({ job: job._id });
      for (const shift of shifts) {
        if (shift.status === 'analysis_complete' || shift.status === 'shift_complete') {
          reports.push({
            id: shift._id,
            date: shift.date,
            type: 'air_monitoring',
            reference: job.projectId.projectID,
            description: job.descriptionOfWorks || 'Air Monitoring Report',
            status: shift.status,
            jobName: job.name,
            shiftName: shift.name
          });
        }
      }
    }

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Clearance Reports
router.get('/clearance/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    // TODO: Implement clearance reports retrieval
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Fibre ID Reports
router.get('/fibre-id/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    // TODO: Implement fibre ID reports retrieval
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Project Invoices
router.get('/invoices/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const invoices = await Invoice.find({ project: req.params.projectId })
      .populate('project')
      .sort({ createdAt: -1 });

    const reports = invoices.map(invoice => ({
      id: invoice._id,
      date: invoice.createdAt,
      type: 'invoice',
      reference: invoice.invoiceNumber,
      description: `Invoice for ${invoice.project?.name || 'Unknown Project'}`,
      status: invoice.status,
      amount: invoice.totalAmount
    }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download report
router.get('/download/:type/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const { type, id } = req.params;

    switch (type) {
      case 'air_monitoring':
        // TODO: Implement air monitoring report download
        break;

      case 'clearance':
        // TODO: Implement clearance report download
        break;

      case 'fibre_id':
        // TODO: Implement fibre ID report download
        break;

      case 'invoice':
        // TODO: Implement invoice download
        break;

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.status(501).json({ message: 'Report download not implemented yet' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// View report
router.get('/view/:type/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const { type, id } = req.params;

    switch (type) {
      case 'air_monitoring':
        // TODO: Implement air monitoring report view
        break;

      case 'clearance':
        // TODO: Implement clearance report view
        break;

      case 'fibre_id':
        // TODO: Implement fibre ID report view
        break;

      case 'invoice':
        // TODO: Implement invoice view
        break;

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.status(501).json({ message: 'Report view not implemented yet' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Print report
router.get('/print/:type/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const { type, id } = req.params;

    switch (type) {
      case 'air_monitoring':
        // TODO: Implement air monitoring report print
        break;

      case 'clearance':
        // TODO: Implement clearance report print
        break;

      case 'fibre_id':
        // TODO: Implement fibre ID report print
        break;

      case 'invoice':
        // TODO: Implement invoice print
        break;

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.status(501).json({ message: 'Report print not implemented yet' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;