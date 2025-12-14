const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const Sample = require('../models/Sample');
const Project = require('../models/Project');
const User = require('../models/User');
const Client = require('../models/Client');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const mongoose = require('mongoose');
const axios = require('axios');
const {
  syncAirMonitoringForJob,
} = require("../services/asbestosRemovalJobSyncService");
const { sendMail } = require("../services/mailer");

// Debug middleware to log all requests to shifts routes
router.use((req, res, next) => {
  console.log('=== SHIFTS ROUTE HIT ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Full URL:', req.url);
  next();
});

// Get all shifts
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shifts = await Shift.find()
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shifts by job ID
router.get('/job/:jobId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    // Check if the job exists in either AirMonitoringJob or AsbestosRemovalJob
    const airMonitoringJob = await mongoose.model('AirMonitoringJob').findById(req.params.jobId);
    const asbestosRemovalJob = await mongoose.model('AsbestosRemovalJob').findById(req.params.jobId);
    
    if (!airMonitoringJob && !asbestosRemovalJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Fetch the shifts for this job
    const shifts = await Shift.find({ job: req.params.jobId })
      .populate({
        path: 'job',
        select: 'jobID name projectId status asbestosRemovalist description projectName client',
        populate: {
          path: 'projectId',
          select: 'projectID name'
        }
      })
      .populate('samples');
    
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get shifts by multiple job IDs
router.post('/jobs', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const { jobIds } = req.body;
    const shifts = await Shift.find({ job: { $in: jobIds } })
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Proxy endpoint for Google Maps Static API to avoid CORS issues
router.get('/proxy-static-map', auth, checkPermission(['jobs.view']), async (req, res) => {
  console.log('=== PROXY ENDPOINT HIT ===');
  console.log('Request URL:', req.url);
  console.log('Request query:', req.query);
  console.log('User:', req.user);
  try {
    const { url, crop } = req.query;
    
    if (!url) {
      return res.status(400).json({ message: 'URL parameter is required' });
    }

    // Validate that it's a Google Maps Static API URL
    if (!url.includes('maps.googleapis.com/maps/api/staticmap')) {
      return res.status(400).json({ message: 'Invalid URL - must be Google Maps Static API' });
    }

    console.log('Proxying Google Maps Static API request:', url);
    console.log('Crop requested:', crop);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'LandD-App/1.0'
      }
    });

    console.log('Google Maps API response status:', response.status);
    console.log('Google Maps API response headers:', response.headers);
    console.log('Response data size:', response.data.length);

    // Check if the response is actually an image
    if (response.data.length < 1000) {
      // Likely an error response, let's see what it contains
      const errorText = Buffer.from(response.data).toString('utf-8');
      console.log('Small response body (likely error):', errorText);
      return res.status(400).json({ 
        message: 'Google Maps API returned error response',
        error: errorText 
      });
    }

    let imageBuffer = response.data;

    // If crop is requested, crop the bottom portion to remove Google footer
    if (crop === 'true') {
      try {
        const sharp = require('sharp');
        // Get image metadata to determine actual size
        const metadata = await sharp(response.data).metadata();
        console.log('Original image dimensions:', metadata.width, 'x', metadata.height);
        
        // Crop the bottom ~20% to remove Google footer/watermark
        const cropHeight = Math.floor(metadata.height * 0.8);
        
        imageBuffer = await sharp(response.data)
          .extract({ left: 0, top: 0, width: metadata.width, height: cropHeight })
          .toBuffer();
        console.log('Image cropped successfully to:', metadata.width, 'x', cropHeight);
      } catch (cropError) {
        console.error('Error cropping image:', cropError);
        console.error('Crop error details:', cropError.message);
        // If cropping fails, return original image
        console.log('Returning original uncropped image due to crop error');
      }
    }

    // Set appropriate headers for image response
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/png',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    res.send(imageBuffer);
  } catch (error) {
    console.error('Error proxying static map:', error);
    res.status(500).json({ 
      message: 'Failed to fetch static map image',
      error: error.message 
    });
  }
});

// Get single shift
router.get('/:id', auth, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'jobID name projectId status asbestosRemovalist description projectName client',
        populate: {
          path: 'projectId',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName');
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new shift
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    console.log('Creating shift with data:', req.body);
    
    // Validate required fields
    const requiredFields = ['job', 'jobModel', 'name', 'date', 'startTime', 'endTime', 'supervisor'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({ 
        message: 'Missing required fields', 
        fields: missingFields 
      });
    }
    
    const shift = new Shift(req.body);
    console.log('Shift object created:', shift);
    
    const newShift = await shift.save();
    console.log('Shift saved successfully:', newShift._id);

    if (
      (req.body.jobModel && req.body.jobModel === 'AsbestosRemovalJob') ||
      (!req.body.jobModel && newShift.jobModel === 'AsbestosRemovalJob')
    ) {
      await syncAirMonitoringForJob(newShift.job);
    }
    
    res.status(201).json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      errors: error.errors
    });
    res.status(400).json({ 
      message: error.message,
      details: error.errors || {}
    });
  }
});

// Update a shift
router.patch('/:id', auth, checkPermission(['jobs.edit', 'jobs.authorize_reports']), async (req, res) => {
  try {
    console.log('PATCH /shifts/:id - Request body:', req.body);
    console.log('PATCH /shifts/:id - Shift ID:', req.params.id);
    
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      console.log('Shift not found:', req.params.id);
      return res.status(404).json({ message: 'Shift not found' });
    }
    
    console.log('Found shift:', shift._id);

    // Only update the fields that are provided in the request
    const allowedUpdates = [
      'status',
      'reportApprovedBy',
      'reportIssueDate',
      'analysedBy',
      'analysisDate',
      'samplesReceivedDate',
      'descriptionOfWorks',
      'notes',
      'defaultSampler',
      'revision',
      'sitePlan',
      'sitePlanData'
    ];

    // Filter out any fields that aren't in allowedUpdates
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    // Update each field individually
    for (const [key, value] of Object.entries(updates)) {
      shift[key] = value;
    }
    
    // Ensure descriptionOfWorks is set (for existing shifts that might not have it)
    if (!shift.descriptionOfWorks) {
      shift.descriptionOfWorks = "";
    }
    
    // Ensure jobModel is set (for existing shifts that might not have it)
    if (!shift.jobModel) {
      shift.jobModel = "AsbestosRemovalJob"; // Default to AsbestosRemovalJob since we're phasing out AirMonitoringJob
    }
    
    console.log('Shift before validation:', {
      _id: shift._id,
      descriptionOfWorks: shift.descriptionOfWorks,
      status: shift.status,
      job: shift.job,
      jobModel: shift.jobModel
    });

    try {
      // Validate the document before saving
      const validationError = shift.validateSync();
      if (validationError) {
        console.log('Validation error:', validationError);
        return res.status(400).json({ 
          message: 'Validation error updating shift',
          details: validationError.message,
          errors: validationError.errors
        });
      }

      const updatedShift = await shift.save();
      if (shift.job && shift.jobModel === 'AsbestosRemovalJob') {
        await syncAirMonitoringForJob(shift.job);
      }

      // Update project's reports_present field if shift is completed
      if (updatedShift.status === 'analysis_complete' || updatedShift.status === 'shift_complete' || updatedShift.reportApprovedBy) {
        try {
          const populatedShift = await Shift.findById(updatedShift._id)
            .populate({
              path: 'job',
              populate: {
                path: 'projectId',
                select: '_id'
              }
            });
          if (populatedShift.job && populatedShift.job.projectId) {
            await Project.findByIdAndUpdate(
              populatedShift.job.projectId._id,
              { reports_present: true }
            );
            console.log(`Updated project ${populatedShift.job.projectId._id} reports_present to true due to completed shift`);
          }
        } catch (error) {
          console.error("Error updating project reports_present field:", error);
        }
      }
      res.json(updatedShift);
    } catch (saveError) {
      return res.status(400).json({ 
        message: 'Error saving shift',
        details: saveError.message,
        errors: saveError.errors
      });
    }
  } catch (error) {
    res.status(400).json({ 
      message: error.message,
      details: error.stack
    });
  }
});

// Update a shift (PUT)
router.put('/:id', auth, checkPermission(['jobs.edit', 'jobs.authorize_reports']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    const previousJobId = shift.job ? shift.job.toString() : null;


    // Update all fields from the request body
    Object.assign(shift, req.body);

    try {
      // Validate before saving
      const validationError = shift.validateSync();
      if (validationError) {
        return res.status(400).json({ 
          message: 'Validation error updating shift',
          details: validationError.message,
          errors: validationError.errors
        });
      }

      const updatedShift = await shift.save();

      const updatedJobId = updatedShift.job ? updatedShift.job.toString() : null;

      if (updatedJobId && updatedShift.jobModel === 'AsbestosRemovalJob') {
        await syncAirMonitoringForJob(updatedJobId);
      }

      if (
        previousJobId &&
        updatedJobId &&
        previousJobId !== updatedJobId
      ) {
        await syncAirMonitoringForJob(previousJobId);
      }
      
      
      res.json(updatedShift);
    } catch (saveError) {
      return res.status(400).json({ 
        message: 'Error saving shift',
        details: saveError.message,
        errors: saveError.errors
      });
    }
  } catch (error) {
    res.status(400).json({ 
      message: error.message,
      details: error.stack
    });
  }
});

// Reopen a shift for editing (admin only)
router.patch('/:id/reopen', auth, checkPermission(['admin.update']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Check if shift is in a state that can be reopened
    if (!['analysis_complete', 'shift_complete', 'samples_submitted_to_lab'].includes(shift.status)) {
      return res.status(400).json({ 
        message: `Cannot reopen shift with status: ${shift.status}` 
      });
    }

    // Reopen by setting status back to a state that allows editing
    // For shifts that are completed at analysis level, go back to sampling_complete
    // For shifts that are fully complete, go back to analysis_complete
    let newStatus = 'sampling_complete';
    if (shift.status === 'shift_complete') {
      newStatus = 'analysis_complete';
    }

    shift.status = newStatus;
    
    // Clear report approval fields to indicate the shift needs re-approval
    if (shift.status === 'analysis_complete') {
      shift.reportApprovedBy = '';
      shift.reportIssueDate = null;
    }

    const updatedShift = await shift.save();
    if (shift.job && (shift.jobModel === 'AsbestosRemovalJob' || !shift.jobModel)) {
      await syncAirMonitoringForJob(shift.job);
    }
    res.json({
      message: 'Shift reopened successfully',
      shift: updatedShift
    });
  } catch (error) {
    console.error('Error reopening shift:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a shift
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const shift = await Shift.findByIdAndDelete(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    if (
      shift.job &&
      (shift.jobModel === 'AsbestosRemovalJob' || !shift.jobModel)
    ) {
      await syncAirMonitoringForJob(shift.job);
    }
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save site plan data for a shift
router.patch('/:id/site-plan', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    const { sitePlan, sitePlanData } = req.body;
    
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Update site plan fields
    shift.sitePlan = sitePlan;
    if (sitePlanData) {
      shift.sitePlanData = sitePlanData;
    } else if (!sitePlan) {
      // If sitePlan is false, clear the sitePlanData
      shift.sitePlanData = undefined;
    }

    await shift.save();
    res.json(shift);
  } catch (error) {
    console.error('Error saving site plan:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get site plan data for a shift
router.get('/:id/site-plan', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .select('sitePlan sitePlanData');
    
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    res.json({
      sitePlan: shift.sitePlan,
      sitePlanData: shift.sitePlanData
    });
  } catch (error) {
    console.error('Error fetching site plan:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate Chain of Custody PDF for a shift
router.get('/:id/chain-of-custody', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'jobID name projectId status asbestosRemovalist description projectName client',
        populate: {
          path: 'projectId',
          select: 'projectID name client',
          populate: {
            path: 'client',
            select: 'name contact1Name contact1Email address'
          }
        }
      });

    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Get samples directly from Sample collection
    const samples = await Sample.find({ shift: req.params.id })
      .select('sampleNumber cowlNo fullSampleID')
      .sort({ fullSampleID: 1 });
    
    console.log('Samples found:', samples.length);
    console.log('Sample data:', JSON.stringify(samples, null, 2));

    // Generate a simple HTML-based COC document
    const fs = require('fs');
    const path = require('path');
    
    // Load logo
    const logoPath = path.join(__dirname, '../assets/logo.png');
    let logoBase64 = '';
    try {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    } catch (error) {
      console.warn('Could not load logo:', error.message);
    }

    // Get project and client info
    const project = shift.job?.projectId;
    const client = project?.client;
    const projectName = project?.name || 'Unknown Project';
    const projectID = project?.projectID || 'LDJxxxx';
    const clientName = client?.name || 'Unknown Client';

    // Format shift date
    const shiftDate = shift.date ? new Date(shift.date).toLocaleDateString('en-GB') : 'N/A';
    
    // Get submission info
    let submittedBy = shift.submittedBy;
    if (!submittedBy && req.user) {
      // Fallback to current user if submittedBy is not set
      submittedBy = `${req.user.firstName} ${req.user.lastName}`;
    }
    if (!submittedBy) {
      submittedBy = 'Not provided';
    }
    
    const submissionDate = shift.samplesReceivedDate 
      ? new Date(shift.samplesReceivedDate).toLocaleDateString('en-GB') 
      : shiftDate;
    
    console.log('Shift submittedBy:', shift.submittedBy);
    console.log('Final submittedBy:', submittedBy);

    // Create simple HTML document
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chain of Custody - ${projectID}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    .logo {
      max-width: 200px;
      max-height: 80px;
    }
    .company-info {
      text-align: right;
      font-size: 12px;
    }
    h1 {
      text-align: center;
      color: #333;
      border-bottom: 3px solid #16b12b;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .info-section {
      margin-bottom: 30px;
    }
    .info-row {
      display: flex;
      margin-bottom: 10px;
    }
    .info-label {
      font-weight: bold;
      width: 200px;
    }
    .info-value {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #16b12b;
      color: white;
    }
    .signature-section {
      margin-top: 50px;
    }
    .signature-row {
      display: flex;
      justify-content: flex-start;
      margin-top: 30px;
    }
    .signature-box {
      width: 300px;
      border-top: 1px solid #333;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
    <div class="company-info">
      Lancaster & Dickenson Consulting Pty Ltd<br />
      4/6 Dacre Street, Mitchell ACT 2911<br />
      enquiries@landd.com.au<br />
      (02) 6241 2779
    </div>
  </div>

  <h1>CHAIN OF CUSTODY</h1>

  <div class="info-section">
    <div class="info-row">
      <div class="info-label">Client:</div>
      <div class="info-value">${clientName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Project:</div>
      <div class="info-value">${projectName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">L&D Reference:</div>
      <div class="info-value">${projectID}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Shift Date:</div>
      <div class="info-value">${shiftDate}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Number of Samples:</div>
      <div class="info-value">${samples.length}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Sample Number</th>
        <th>Cowl Number</th>
      </tr>
    </thead>
    <tbody>
      ${samples.map((sample) => `
        <tr>
          <td>${sample.fullSampleID || sample.sampleNumber || 'N/A'}</td>
          <td>${sample.cowlNo || 'N/A'}</td>
        </tr>
      `).join('')}
      ${samples.length < 10 ? Array(10 - samples.length).fill('<tr><td></td><td></td></tr>').join('') : ''}
    </tbody>
  </table>

  <div class="signature-section">
    <div class="signature-row">
      <div class="signature-box">
        <strong>Submitted By:</strong><br />${submittedBy}<br /><br />
        <strong>Date:</strong><br />${submissionDate}
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Use puppeteer to generate PDF
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${projectID}: Chain of Custody - ${shiftDate}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating Chain of Custody PDF:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post(
  '/:id/send-for-authorisation',
  auth,
  checkPermission(['jobs.edit']),
  async (req, res) => {
    try {
      const shift = await Shift.findById(req.params.id)
        .populate({
          path: 'job',
          populate: {
            path: 'projectId',
            select: 'projectID name client',
            populate: {
              path: 'client',
              select: 'name',
            },
          },
        });

      if (!shift) {
        return res.status(404).json({ message: 'Shift not found' });
      }

      if (!['analysis_complete', 'shift_complete'].includes(shift.status)) {
        return res.status(400).json({
          message:
            'Shift must have analysis completed before sending for authorisation',
        });
      }

      if (shift.reportApprovedBy) {
        return res
          .status(400)
          .json({ message: 'Report has already been authorised' });
      }

      const signatoryUsers = await User.find({
        reportProofer: true,
        isActive: true,
      }).select('firstName lastName email');

      if (signatoryUsers.length === 0) {
        return res
          .status(400)
          .json({ message: 'No report proofer users found' });
      }

      let projectName =
        shift.job?.projectId?.name ||
        shift.job?.projectName ||
        'Unknown Project';
      let projectID =
        shift.job?.projectId?.projectID || shift.job?.jobID || 'N/A';
      let clientName =
        shift.job?.projectId?.client?.name ||
        shift.job?.client ||
        'the client';

      if (
        shift.job?.projectId &&
        typeof shift.job.projectId === 'string'
      ) {
        const projectDoc = await Project.findById(
          shift.job.projectId
        ).populate('client', 'name');
        if (projectDoc) {
          projectName = projectDoc.name || projectName;
          projectID = projectDoc.projectID || projectID;
          clientName = projectDoc.client?.name || clientName;
        }
      } else if (
        shift.job?.projectId &&
        shift.job.projectId?.client &&
        typeof shift.job.projectId.client === 'string'
      ) {
        const clientDoc = await Client.findById(
          shift.job.projectId.client
        ).select('name');
        if (clientDoc) {
          clientName = clientDoc.name || clientName;
        }
      }

      const requesterName =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || 'A user';

      const shiftName = shift.name || 'Air Monitoring Shift';
      const shiftDate = shift.date
        ? new Date(shift.date).toLocaleDateString('en-GB')
        : 'N/A';

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const jobId =
        typeof shift.job?.id === 'string'
          ? shift.job.id
          : shift.job?._id?.toString() || shift.job?.toString();
      const jobUrl = `${frontendUrl}/asbestos-removal/jobs/${jobId}/details`;

      await Promise.all(
        signatoryUsers.map(async (user) => {
          await sendMail({
            to: user.email,
            subject: `Report Authorisation Required - ${projectID}: ${shiftName}`,
            text: `
An air monitoring shift report is ready for authorisation.

Project: ${projectName} (${projectID})
Client: ${clientName}
Shift: ${shiftName}
Shift Date: ${shiftDate}
Requested by: ${requesterName}

Review the report at: ${jobUrl}
            `.trim(),
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="margin-bottom: 30px;">
                  <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                  <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
                </div>
                <div style="color: #333; line-height: 1.6;">
                  <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Authorisation Required</h2>
                  <p>Hello ${user.firstName},</p>
                  <p>An air monitoring shift report is ready for your authorisation:</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                    <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                    <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
                    <p style="margin: 5px 0;"><strong>Shift:</strong> ${shiftName}</p>
                    <p style="margin: 5px 0;"><strong>Shift Date:</strong> ${shiftDate}</p>
                    <p style="margin: 5px 0;"><strong>Requested by:</strong> ${requesterName}</p>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${jobUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Report</a>
                  </div>
                  <p>Please review and authorise the report at your earliest convenience.</p>
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                  <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
                </div>
              </div>
            `,
          });
        })
      );

      return res.json({
        message: `Authorisation request emails sent successfully to ${signatoryUsers.length} signatory user(s)`,
        recipients: signatoryUsers.map((user) => ({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        })),
      });
    } catch (error) {
      console.error('Error sending authorisation request emails:', error);
      return res.status(500).json({
        message: 'Failed to send authorisation request emails',
        error: error.message,
      });
    }
  }
);

module.exports = router;