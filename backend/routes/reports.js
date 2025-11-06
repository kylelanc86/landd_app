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
    const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
    
    const clearances = await AsbestosClearance.find({ 
      projectId: req.params.projectId,
      status: { $in: ['complete', 'Site Work Complete'] }
    })
      .populate('projectId', 'name projectID')
      .populate('createdBy', 'firstName lastName')
      .sort({ clearanceDate: -1 });

    const reports = clearances.map(clearance => ({
      id: clearance._id,
      date: clearance.clearanceDate,
      type: 'clearance',
      reference: clearance.projectId?.projectID || 'Unknown',
      description: `${clearance.clearanceType} Asbestos Clearance Report`,
      status: clearance.status,
      clearanceType: clearance.clearanceType,
      LAA: clearance.LAA,
      asbestosRemovalist: clearance.asbestosRemovalist,
      additionalInfo: `${clearance.clearanceType} • ${clearance.LAA} • ${clearance.asbestosRemovalist}`
    }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Fibre ID Reports
router.get('/fibre-id/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const ClientSuppliedJob = require('../models/ClientSuppliedJob');
    
    const jobs = await ClientSuppliedJob.find({ 
      projectId: req.params.projectId,
      status: 'Completed'
    }).populate('projectId');

    const reports = jobs.map(job => ({
      id: job._id,
      date: job.analysisDate || job.updatedAt,
      type: 'fibre_id',
      reference: job.projectId?.projectID || job._id.toString(),
      description: 'Fibre ID Analysis Report',
      status: job.status,
      analyst: job.analyst || 'Unknown',
      sampleCount: job.sampleCount
    }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Project Invoices
router.get('/invoices/:projectId', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const invoices = await Invoice.find({ 
      projectId: req.params.projectId,
      isDeleted: { $ne: true }
    })
      .populate('projectId', 'name projectID')
      .populate('client', 'name')
      .sort({ createdAt: -1 });

    const reports = invoices.map(invoice => ({
      id: invoice._id,
      date: invoice.date,
      type: 'invoice',
      reference: invoice.invoiceID,
      description: `Invoice for ${invoice.projectId?.name || 'Unknown Project'}`,
      status: invoice.status,
      amount: invoice.amount,
      additionalInfo: `$${Number(invoice.amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} • ${invoice.xeroClientName || invoice.client?.name || 'Unknown Client'}`
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
        // Get shift data and generate air monitoring report
        const shift = await Shift.findById(id).populate('job');
        if (!shift) {
          return res.status(404).json({ message: 'Shift not found' });
        }
        
        // Redirect to the existing air monitoring report generation endpoint
        return res.redirect(`/api/pdf-docraptor-v2/generate-air-monitoring-report?shiftId=${id}`);

      case 'clearance':
        // Get clearance data and generate clearance report
        const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
        const clearance = await AsbestosClearance.findById(id);
        if (!clearance) {
          return res.status(404).json({ message: 'Clearance not found' });
        }
        
        // Redirect to the existing clearance report generation endpoint
        return res.redirect(`/api/pdf-docraptor-v2/generate-asbestos-clearance-v2`);

      case 'fibre_id':
        // Get fibre ID job data and generate report
        const ClientSuppliedJob = require('../models/ClientSuppliedJob');
        const fibreJob = await ClientSuppliedJob.findById(id);
        if (!fibreJob) {
          return res.status(404).json({ message: 'Fibre ID job not found' });
        }
        
        // Redirect to the existing fibre ID report generation endpoint
        return res.redirect(`/api/pdf-docraptor-v2/generate-client-supplied-fibre-id`);

      case 'invoice':
        // Get invoice data and generate invoice PDF
        const invoice = await Invoice.findById(id);
        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }
        
        // Redirect to the existing invoice generation endpoint
        return res.redirect(`/api/pdf-docraptor-v2/generate-invoice`);

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
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
        // Get shift data for viewing
        const shift = await Shift.findById(id).populate('job');
        if (!shift) {
          return res.status(404).json({ message: 'Shift not found' });
        }
        
        // Return shift data for frontend viewing
        res.json({
          type: 'air_monitoring',
          data: shift,
          viewUrl: `/air-monitoring/analysis?shiftId=${id}`
        });
        break;

      case 'clearance':
        // Get clearance data for viewing
        const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
        const clearance = await AsbestosClearance.findById(id).populate('projectId');
        if (!clearance) {
          return res.status(404).json({ message: 'Clearance not found' });
        }
        
        // Return clearance data for frontend viewing
        res.json({
          type: 'clearance',
          data: clearance,
          viewUrl: `/clearances/${id}`
        });
        break;

      case 'fibre_id':
        // Get fibre ID job data for viewing
        const ClientSuppliedJob = require('../models/ClientSuppliedJob');
        const fibreJob = await ClientSuppliedJob.findById(id).populate('projectId');
        if (!fibreJob) {
          return res.status(404).json({ message: 'Fibre ID job not found' });
        }
        
        // Return fibre ID job data for frontend viewing
        res.json({
          type: 'fibre_id',
          data: fibreJob,
          viewUrl: `/fibre-id/client-supplied/${id}/samples`
        });
        break;

      case 'invoice':
        // Get invoice data for viewing
        const invoice = await Invoice.findById(id).populate('projectId').populate('client');
        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }
        
        // Return invoice data for frontend viewing
        res.json({
          type: 'invoice',
          data: invoice,
          viewUrl: `/invoices/edit/${id}`
        });
        break;

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
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
        // Get shift data and generate air monitoring report for printing
        const shift = await Shift.findById(id).populate('job');
        if (!shift) {
          return res.status(404).json({ message: 'Shift not found' });
        }
        
        // Redirect to the existing air monitoring report generation endpoint with print flag
        return res.redirect(`/api/pdf-docraptor-v2/generate-air-monitoring-report?shiftId=${id}&print=true`);

      case 'clearance':
        // Get clearance data and generate clearance report for printing
        const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
        const clearance = await AsbestosClearance.findById(id);
        if (!clearance) {
          return res.status(404).json({ message: 'Clearance not found' });
        }
        
        // Redirect to the existing clearance report generation endpoint with print flag
        return res.redirect(`/api/pdf-docraptor-v2/generate-asbestos-clearance-v2?print=true`);

      case 'fibre_id':
        // Get fibre ID job data and generate report for printing
        const ClientSuppliedJob = require('../models/ClientSuppliedJob');
        const fibreJob = await ClientSuppliedJob.findById(id);
        if (!fibreJob) {
          return res.status(404).json({ message: 'Fibre ID job not found' });
        }
        
        // Redirect to the existing fibre ID report generation endpoint with print flag
        return res.redirect(`/api/pdf-docraptor-v2/generate-client-supplied-fibre-id?print=true`);

      case 'invoice':
        // Get invoice data and generate invoice PDF for printing
        const invoice = await Invoice.findById(id);
        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }
        
        // Redirect to the existing invoice generation endpoint with print flag
        return res.redirect(`/api/pdf-docraptor-v2/generate-invoice?print=true`);

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;