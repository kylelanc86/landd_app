const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const clientRoutes = require('./routes/clients');
const sampleRoutes = require('./routes/samples');
const leadAirSampleRoutes = require('./routes/leadAirSamples');
const invoiceRoutes = require('./routes/invoices');
const usersRouter = require('./routes/users');
const xeroRoutes = require('./routes/xero');
const shiftRoutes = require('./routes/shifts');
const timesheetRoutes = require('./routes/timesheets');

const airPumpRoutes = require('./routes/airPumps');
const airPumpCalibrationRoutes = require('./routes/airPumpCalibrations');
const graticuleCalibrationRoutes = require('./routes/graticuleCalibrations');
const efaCalibrationRoutes = require('./routes/efaCalibrations');
const pcmMicroscopeCalibrationRoutes = require('./routes/pcmMicroscopeCalibrations');
const plmMicroscopeCalibrationRoutes = require('./routes/plmMicroscopeCalibrations');
const stereomicroscopeCalibrationRoutes = require('./routes/stereomicroscopeCalibrations');
const hseTestSlideCalibrationRoutes = require('./routes/hseTestSlideCalibrations');
const flowmeterCalibrationRoutes = require('./routes/flowmeterCalibrations');
const primaryFlowmeterCalibrationRoutes = require('./routes/primaryFlowmeterCalibrations');
const furnaceCalibrationRoutes = require('./routes/furnaceCalibrations');
const pneumaticTesterCalibrationRoutes = require('./routes/pneumaticTesterCalibrations');
const sieveCalibrationRoutes = require('./routes/sieveCalibrations');
const massBalanceCalibrationRoutes = require('./routes/massBalanceCalibrations');
const micrometerCalibrationRoutes = require('./routes/micrometerCalibrations');
const caliperCalibrationRoutes = require('./routes/caliperCalibrations');
const mycometerCalibrationRoutes = require('./routes/mycometerCalibrations');
const fumeHoodCalibrationRoutes = require('./routes/fumeHoodCalibrations');
const acetoneVaporiserCalibrationRoutes = require('./routes/acetoneVaporiserCalibrations');
const riLiquidCalibrationRoutes = require('./routes/riLiquidCalibrations');
const calibrationFrequencyRoutes = require('./routes/calibrationFrequency');
const equipmentRoutes = require('./routes/equipment');
const asbestosClearanceRoutes = require('./routes/asbestosClearances');
const asbestosClearanceReportRoutes = require('./routes/asbestosClearanceReports');
const leadClearanceRoutes = require('./routes/leadClearances');
const asbestosRemovalJobRoutes = require('./routes/asbestosRemovalJobs');
const leadRemovalJobRoutes = require('./routes/leadRemovalJobs');
const reportsRoutes = require('./routes/reports');

const reportTemplateRoutes = require('./routes/reportTemplates');
const pdfDocRaptorV2Routes = require('./routes/pdf-docraptor-v2');

const asbestosAssessmentsRoutes = require('./routes/asbestosAssessments');
const sampleItemsRoutes = require('./routes/sampleItems');
const clientSuppliedJobsRoutes = require('./routes/clientSuppliedJobs');
const mycometerJobsRoutes = require('./routes/mycometerJobs');
const invoiceItemsRoutes = require('./routes/invoiceItems');
const iaqRecordsRoutes = require('./routes/iaqRecords');
const blanksRoutes = require('./routes/blanks');
const iaqSamplesRoutes = require('./routes/iaqSamples');
const staffMeetingsRoutes = require('./routes/staffMeetings');
const approvedSuppliersRoutes = require('./routes/approvedSuppliers');
const assetsRoutes = require('./routes/assets');
const controlledDocumentsRoutes = require('./routes/controlledDocuments');
const impartialityRisksRoutes = require('./routes/impartialityRisks');
const feedbackRoutes = require('./routes/feedback');
const incidentsRoutes = require('./routes/incidents');
const calibrationCanonicalRoutes = require('./routes/calibrationCanonical');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// CORS configuration
// Build allowed origins from environment variables
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',  // Added for Windows DNS optimization
];

// Add FRONTEND_URL if set
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Add CORS_ORIGINS if set (comma-separated list)
if (process.env.CORS_ORIGINS) {
  const additionalOrigins = process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(origin => origin);
  allowedOrigins.push(...additionalOrigins);
}

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (uniqueOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', uniqueOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires', 'X-App-Version'],
  exposedHeaders: ['Content-Disposition', 'Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Simplified request logging middleware (only log errors and important events)
app.use((req, res, next) => {
  // Only log non-GET requests and errors
  if (req.method !== 'GET') {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  }
  next();
});

// Base64 clearance photos send compressed + full-resolution data in one JSON body;
// 10mb is too small for typical phone camera originals after base64 encoding.
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '50mb';
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ limit: jsonBodyLimit, extended: true }));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'LandD App Backend API',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Health check endpoints (multiple paths for different routing configurations)
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  };
  res.status(200).json(healthData);
});

// Also add health at root in case DigitalOcean strips /api prefix
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  };
  res.status(200).json(healthData);
});

// Serve L&D logo for PDF generation (e.g. Chain of Custody)
app.get('/api/logo', (req, res) => {
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  if (!fs.existsSync(logoPath)) {
    return res.status(404).send('Logo not found');
  }
  res.sendFile(logoPath, { headers: { 'Content-Type': 'image/png' } });
});

// Serve L&D small logo for PDF watermark (e.g. Lead shift report page 2)
app.get('/api/logo-watermark', (req, res) => {
  const logoPath = path.join(__dirname, 'assets', 'logo_small hi-res.png');
  if (!fs.existsSync(logoPath)) {
    return res.status(404).send('Watermark logo not found');
  }
  res.sendFile(logoPath, { headers: { 'Content-Type': 'image/png' } });
});

// Connect to database
connectDB()
  .then(async () => {
    // Import middleware first
    const requireAuth = require('./middleware/auth');
    const checkTokenBlacklist = require('./middleware/checkTokenBlacklist');
    const invalidateCanonicalCacheOnMutation = require('./middleware/invalidateCanonicalCacheOnMutation');
    const calibrationRouteMiddleware = [
      requireAuth,
      checkTokenBlacklist,
      invalidateCanonicalCacheOnMutation,
    ];
    const mountCalibrationRoutes = (path, router) => {
      app.use(path, ...calibrationRouteMiddleware, router);
    };
    
    // Initialize dashboard stats
    try {
      // Ensure all models are loaded first
      require('./models/Invoice');
      require('./models/DashboardStats');
      
      const dashboardStatsService = require('./services/dashboardStatsService');
      await dashboardStatsService.initializeStats();
      console.log('Dashboard stats initialized successfully');
    } catch (error) {
      console.error('Failed to initialize dashboard stats:', error);
      // Don't fail server startup if stats initialization fails
    }
    
    // // Debug logging for route matching (temporary - remove after fixing)
    // app.use((req, res, next) => {
    //   // Log all API requests to diagnose routing issues
    //   if (req.method !== 'GET' || req.path.includes('api') || req.path.includes('auth') || req.path.includes('login') || req.path.includes('projects') || req.path.includes('users') || req.path.includes('timesheets') || req.path.includes('custom-data')) {
    //     console.log('🔍 Route Debug:', {
    //       method: req.method,
    //       path: req.path,
    //       url: req.url,
    //       originalUrl: req.originalUrl
    //     });
    //   }
    //   next();
    // });
    
    // Routes
    // Mount auth routes at both paths in case DigitalOcean strips /api prefix
    app.use('/api/auth', authRoutes);
    app.use('/auth', authRoutes);  // Also handle if prefix is stripped
    
    // Protected routes with authentication and token blacklist checking
    // Mount each route at both /api/* and /* paths in case DigitalOcean strips /api prefix
    app.use('/api/projects', requireAuth, checkTokenBlacklist, projectRoutes);
    app.use('/projects', requireAuth, checkTokenBlacklist, projectRoutes);
    
    app.use('/api/clients', requireAuth, checkTokenBlacklist, clientRoutes);
    app.use('/clients', requireAuth, checkTokenBlacklist, clientRoutes);
    
    
    app.use('/api/samples', requireAuth, checkTokenBlacklist, sampleRoutes);
    app.use('/samples', requireAuth, checkTokenBlacklist, sampleRoutes);
    app.use('/api/lead-air-samples', requireAuth, checkTokenBlacklist, leadAirSampleRoutes);
    app.use('/lead-air-samples', requireAuth, checkTokenBlacklist, leadAirSampleRoutes);
    
    app.use('/api/invoices', requireAuth, checkTokenBlacklist, invoiceRoutes);
    app.use('/invoices', requireAuth, checkTokenBlacklist, invoiceRoutes);
    
    app.use('/api/users', requireAuth, checkTokenBlacklist, usersRouter);
    app.use('/users', requireAuth, checkTokenBlacklist, usersRouter);
    
    // Mount Xero routes with auth for most endpoints, but allow callback without auth
    app.use('/api/xero', xeroRoutes);
    app.use('/xero', xeroRoutes);
    
    app.use('/api/air-monitoring-shifts', requireAuth, checkTokenBlacklist, shiftRoutes);
    app.use('/air-monitoring-shifts', requireAuth, checkTokenBlacklist, shiftRoutes);
    
    app.use('/api/timesheets', requireAuth, checkTokenBlacklist, timesheetRoutes);
    app.use('/timesheets', requireAuth, checkTokenBlacklist, timesheetRoutes);

    app.use('/api/air-pumps', requireAuth, checkTokenBlacklist, airPumpRoutes);
    app.use('/air-pumps', requireAuth, checkTokenBlacklist, airPumpRoutes);
    
    mountCalibrationRoutes('/api/air-pump-calibrations', airPumpCalibrationRoutes);
    mountCalibrationRoutes('/air-pump-calibrations', airPumpCalibrationRoutes);
    
    mountCalibrationRoutes('/api/graticule-calibrations', graticuleCalibrationRoutes);
    mountCalibrationRoutes('/graticule-calibrations', graticuleCalibrationRoutes);
    
    mountCalibrationRoutes('/api/efa-calibrations', efaCalibrationRoutes);
    mountCalibrationRoutes('/efa-calibrations', efaCalibrationRoutes);
    
    mountCalibrationRoutes('/api/pcm-microscope-calibrations', pcmMicroscopeCalibrationRoutes);
    mountCalibrationRoutes('/pcm-microscope-calibrations', pcmMicroscopeCalibrationRoutes);
    
    mountCalibrationRoutes('/api/plm-microscope-calibrations', plmMicroscopeCalibrationRoutes);
    mountCalibrationRoutes('/plm-microscope-calibrations', plmMicroscopeCalibrationRoutes);
    
    mountCalibrationRoutes('/api/stereomicroscope-calibrations', stereomicroscopeCalibrationRoutes);
    mountCalibrationRoutes('/stereomicroscope-calibrations', stereomicroscopeCalibrationRoutes);
    
    mountCalibrationRoutes('/api/hse-test-slide-calibrations', hseTestSlideCalibrationRoutes);
    mountCalibrationRoutes('/hse-test-slide-calibrations', hseTestSlideCalibrationRoutes);
    
    mountCalibrationRoutes('/api/flowmeter-calibrations', flowmeterCalibrationRoutes);
    mountCalibrationRoutes('/flowmeter-calibrations', flowmeterCalibrationRoutes);

    mountCalibrationRoutes('/api/primary-flowmeter-calibrations', primaryFlowmeterCalibrationRoutes);
    mountCalibrationRoutes('/primary-flowmeter-calibrations', primaryFlowmeterCalibrationRoutes);

    mountCalibrationRoutes('/api/furnace-calibrations', furnaceCalibrationRoutes);
    mountCalibrationRoutes('/furnace-calibrations', furnaceCalibrationRoutes);

    mountCalibrationRoutes('/api/pneumatic-tester-calibrations', pneumaticTesterCalibrationRoutes);
    mountCalibrationRoutes('/pneumatic-tester-calibrations', pneumaticTesterCalibrationRoutes);

    mountCalibrationRoutes('/api/sieve-calibrations', sieveCalibrationRoutes);
    mountCalibrationRoutes('/sieve-calibrations', sieveCalibrationRoutes);

    mountCalibrationRoutes('/api/mass-balance-calibrations', massBalanceCalibrationRoutes);
    mountCalibrationRoutes('/mass-balance-calibrations', massBalanceCalibrationRoutes);

    mountCalibrationRoutes('/api/micrometer-calibrations', micrometerCalibrationRoutes);
    mountCalibrationRoutes('/micrometer-calibrations', micrometerCalibrationRoutes);

    mountCalibrationRoutes('/api/caliper-calibrations', caliperCalibrationRoutes);
    mountCalibrationRoutes('/caliper-calibrations', caliperCalibrationRoutes);

    mountCalibrationRoutes('/api/mycometer-calibrations', mycometerCalibrationRoutes);
    mountCalibrationRoutes('/mycometer-calibrations', mycometerCalibrationRoutes);

    mountCalibrationRoutes('/api/fume-hood-calibrations', fumeHoodCalibrationRoutes);
    mountCalibrationRoutes('/fume-hood-calibrations', fumeHoodCalibrationRoutes);
    
    mountCalibrationRoutes('/api/acetone-vaporiser-calibrations', acetoneVaporiserCalibrationRoutes);
    mountCalibrationRoutes('/acetone-vaporiser-calibrations', acetoneVaporiserCalibrationRoutes);
    
    mountCalibrationRoutes('/api/ri-liquid-calibrations', riLiquidCalibrationRoutes);
    mountCalibrationRoutes('/ri-liquid-calibrations', riLiquidCalibrationRoutes);
    
    app.use('/api/calibration-frequency', requireAuth, checkTokenBlacklist, calibrationFrequencyRoutes);
    app.use('/calibration-frequency', requireAuth, checkTokenBlacklist, calibrationFrequencyRoutes);
    
    app.use('/api/equipment', requireAuth, checkTokenBlacklist, equipmentRoutes);
    app.use('/equipment', requireAuth, checkTokenBlacklist, equipmentRoutes);
    
    app.use('/api/asbestos-clearances', requireAuth, checkTokenBlacklist, asbestosClearanceRoutes);
    app.use('/asbestos-clearances', requireAuth, checkTokenBlacklist, asbestosClearanceRoutes);
    app.use('/api/lead-clearances', requireAuth, checkTokenBlacklist, leadClearanceRoutes);
    app.use('/lead-clearances', requireAuth, checkTokenBlacklist, leadClearanceRoutes);
    
    app.use('/api/asbestos-clearance-reports', requireAuth, checkTokenBlacklist, asbestosClearanceReportRoutes);
    app.use('/asbestos-clearance-reports', requireAuth, checkTokenBlacklist, asbestosClearanceReportRoutes);
    
    app.use('/api/asbestos-removal-jobs', requireAuth, checkTokenBlacklist, asbestosRemovalJobRoutes);
    app.use('/asbestos-removal-jobs', requireAuth, checkTokenBlacklist, asbestosRemovalJobRoutes);
    
    app.use('/api/lead-removal-jobs', requireAuth, checkTokenBlacklist, leadRemovalJobRoutes);
    app.use('/lead-removal-jobs', requireAuth, checkTokenBlacklist, leadRemovalJobRoutes);
    
    app.use('/api/reports', requireAuth, checkTokenBlacklist, reportsRoutes);
    app.use('/reports', requireAuth, checkTokenBlacklist, reportsRoutes);
    
    app.use('/api/uploaded-reports', requireAuth, checkTokenBlacklist, require('./routes/uploadedReports'));
    app.use('/uploaded-reports', requireAuth, checkTokenBlacklist, require('./routes/uploadedReports'));

    app.use('/api/report-templates', requireAuth, checkTokenBlacklist, reportTemplateRoutes);
    app.use('/report-templates', requireAuth, checkTokenBlacklist, reportTemplateRoutes);
    
    app.use('/api/pdf-docraptor-v2', requireAuth, checkTokenBlacklist, pdfDocRaptorV2Routes);
    app.use('/pdf-docraptor-v2', requireAuth, checkTokenBlacklist, pdfDocRaptorV2Routes);
    
    // Additional protected routes with token blacklist checking
    app.use('/api/assessments', requireAuth, checkTokenBlacklist, asbestosAssessmentsRoutes);
    app.use('/assessments', requireAuth, checkTokenBlacklist, asbestosAssessmentsRoutes);
    
    app.use('/api/sample-items', requireAuth, checkTokenBlacklist, sampleItemsRoutes);
    app.use('/sample-items', requireAuth, checkTokenBlacklist, sampleItemsRoutes);
    
    app.use('/api/client-supplied-jobs', requireAuth, checkTokenBlacklist, clientSuppliedJobsRoutes);
    app.use('/client-supplied-jobs', requireAuth, checkTokenBlacklist, clientSuppliedJobsRoutes);

    app.use('/api/mycometer-jobs', requireAuth, checkTokenBlacklist, mycometerJobsRoutes);
    app.use('/mycometer-jobs', requireAuth, checkTokenBlacklist, mycometerJobsRoutes);
    
    app.use('/api/invoice-items', requireAuth, checkTokenBlacklist, invoiceItemsRoutes);
    app.use('/invoice-items', requireAuth, checkTokenBlacklist, invoiceItemsRoutes);
    
    app.use('/api/custom-data-fields', requireAuth, checkTokenBlacklist, require('./routes/customDataFields'));
    app.use('/custom-data-fields', requireAuth, checkTokenBlacklist, require('./routes/customDataFields'));
    
    app.use('/api/custom-data-field-groups', requireAuth, checkTokenBlacklist, require('./routes/customDataFieldGroups'));
    app.use('/custom-data-field-groups', requireAuth, checkTokenBlacklist, require('./routes/customDataFieldGroups'));
    
    app.use('/api/project-audits', requireAuth, checkTokenBlacklist, require('./routes/projectAudits'));
    app.use('/project-audits', requireAuth, checkTokenBlacklist, require('./routes/projectAudits'));

    app.use('/api/iaq-records', requireAuth, checkTokenBlacklist, iaqRecordsRoutes);
    app.use('/iaq-records', requireAuth, checkTokenBlacklist, iaqRecordsRoutes);

    app.use('/api/iaq-samples', requireAuth, checkTokenBlacklist, iaqSamplesRoutes);
    app.use('/iaq-samples', requireAuth, checkTokenBlacklist, iaqSamplesRoutes);

    app.use('/api/blanks', requireAuth, checkTokenBlacklist, blanksRoutes);
    app.use('/blanks', requireAuth, checkTokenBlacklist, blanksRoutes);

    app.use('/api/staff-meetings', requireAuth, checkTokenBlacklist, staffMeetingsRoutes);
    app.use('/staff-meetings', requireAuth, checkTokenBlacklist, staffMeetingsRoutes);

    app.use('/api/approved-suppliers', requireAuth, checkTokenBlacklist, approvedSuppliersRoutes);
    app.use('/approved-suppliers', requireAuth, checkTokenBlacklist, approvedSuppliersRoutes);

    app.use('/api/asset-register', requireAuth, checkTokenBlacklist, assetsRoutes);
    app.use('/asset-register', requireAuth, checkTokenBlacklist, assetsRoutes);

    app.use('/api/controlled-documents', requireAuth, checkTokenBlacklist, controlledDocumentsRoutes);
    app.use('/controlled-documents', requireAuth, checkTokenBlacklist, controlledDocumentsRoutes);

    app.use('/api/impartiality-risks', requireAuth, checkTokenBlacklist, impartialityRisksRoutes);
    app.use('/impartiality-risks', requireAuth, checkTokenBlacklist, impartialityRisksRoutes);

    app.use('/api/feedback', requireAuth, checkTokenBlacklist, feedbackRoutes);
    app.use('/feedback', requireAuth, checkTokenBlacklist, feedbackRoutes);
    app.use('/api/incidents', requireAuth, checkTokenBlacklist, incidentsRoutes);
    app.use('/incidents', requireAuth, checkTokenBlacklist, incidentsRoutes);
    app.use('/api/calibration-canonical', requireAuth, checkTokenBlacklist, calibrationCanonicalRoutes);
    app.use('/calibration-canonical', requireAuth, checkTokenBlacklist, calibrationCanonicalRoutes);

    
    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('=== Error Details ===');
      console.error('Error:', err);
      console.error('Request Headers:', JSON.stringify(req.headers, null, 2));
      console.error('Request Body:', JSON.stringify(req.body, null, 2));
      console.error('=====================');
      
      res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        cors: {
          origin: req.headers.origin,
          allowed: true
        }
      });
    });

    // Start server with HTTP keep-alive enabled for performance
    const PORT = process.env.PORT || 5000;
    const http = require('http');
    
    const server = http.createServer(app);
    
    // Configure timeouts so long-running PDF generation (DocRaptor ~60s) does not get cut off.
    // 65s was too short and caused report generation to time out.
    const longRequestMs = 130000; // 130s — allow upload + DocRaptor + download
    server.timeout = longRequestMs;           // Socket timeout for in-flight requests (no data sent while waiting on DocRaptor)
    server.keepAliveTimeout = longRequestMs; // Keep connection alive long enough for one long request
    server.headersTimeout = longRequestMs + 1000; // Must be greater than keepAliveTimeout

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Request/keep-alive timeout: ${server.timeout}ms`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });