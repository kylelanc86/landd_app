const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const checkTokenBlacklist = require('../middleware/checkTokenBlacklist');

// Configure express-fileupload
const fileUpload = require('express-fileupload');

// Middleware for file uploads
router.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  abortOnLimit: true,
  responseOnLimit: 'File size limit has been reached',
  uploadTimeout: 60000, // 60 seconds
  createParentPath: true
}));

// Import mongoose models
const mongoose = require('mongoose');

// Define UploadedReport schema
const uploadedReportSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  reportType: {
    type: String,
    required: true,
    enum: ['asbestos-assessment', 'asbestos-removal-jobs', 'clearance', 'fibre-id', 'other']
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  reportDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['completed', 'in_progress', 'draft'],
    default: 'completed'
  },
  asbestosRemovalist: {
    type: String,
    default: ''
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create model if it doesn't exist
let UploadedReport;
try {
  UploadedReport = mongoose.model('UploadedReport');
} catch (error) {
  UploadedReport = mongoose.model('UploadedReport', uploadedReportSchema);
}

// Upload report endpoint
router.post('/upload', requireAuth, checkTokenBlacklist, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      reportType,
      reportDate,
      description,
      status,
      projectId,
      asbestosRemovalist
    } = req.body;

    if (!reportType || !reportDate || !projectId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const file = req.files.file;
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, and PNG files are allowed.' 
      });
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../uploads/reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.name);
    const fileName = 'report-' + uniqueSuffix + fileExtension;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    await file.mv(filePath);

    // Create uploaded report record
    const uploadedReport = new UploadedReport({
      projectId,
      reportType,
      fileName: fileName,
      originalFileName: file.name,
      filePath: filePath,
      fileSize: file.size,
      mimeType: file.mimetype,
      reportDate: new Date(reportDate),
      description: description || '',
      status: status || 'completed',
      asbestosRemovalist: asbestosRemovalist || '',
      uploadedBy: req.user._id
    });

    await uploadedReport.save();

    res.status(201).json({
      message: 'Report uploaded successfully',
      report: uploadedReport
    });
  } catch (error) {
    console.error('Error uploading report:', error);
    res.status(500).json({ error: 'Failed to upload report' });
  }
});

// Get uploaded reports for a project
router.get('/project/:projectId', requireAuth, checkTokenBlacklist, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reportType } = req.query;

    let query = { projectId };
    if (reportType) {
      query.reportType = reportType;
    }

    const reports = await UploadedReport.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ reportDate: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching uploaded reports:', error);
    res.status(500).json({ error: 'Failed to fetch uploaded reports' });
  }
});

// Download uploaded report
router.get('/download/:reportId', requireAuth, checkTokenBlacklist, async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await UploadedReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if file exists
    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(report.filePath, report.originalFileName);
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// Delete uploaded report
router.delete('/:reportId', requireAuth, checkTokenBlacklist, async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await UploadedReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Delete file from filesystem
    if (fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }

    // Delete record from database
    await UploadedReport.findByIdAndDelete(reportId);

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
