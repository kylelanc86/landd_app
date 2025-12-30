const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const clientRoutes = require('./routes/clients');
const jobRoutes = require('./routes/jobs');
const sampleRoutes = require('./routes/samples');
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
const calibrationFrequencyRoutes = require('./routes/calibrationFrequency');
const equipmentRoutes = require('./routes/equipment');
const asbestosClearanceRoutes = require('./routes/asbestosClearances');
const asbestosClearanceReportRoutes = require('./routes/asbestosClearanceReports');
const asbestosRemovalJobRoutes = require('./routes/asbestosRemovalJobs');
const reportsRoutes = require('./routes/reports');

const reportTemplateRoutes = require('./routes/reportTemplates');
const pdfDocRaptorV2Routes = require('./routes/pdf-docraptor-v2');

const asbestosAssessmentsRoutes = require('./routes/asbestosAssessments');
const sampleItemsRoutes = require('./routes/sampleItems');
const clientSuppliedJobsRoutes = require('./routes/clientSuppliedJobs');
const invoiceItemsRoutes = require('./routes/invoiceItems');

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// Connect to database
connectDB()
  .then(async () => {
    // Import middleware first
    const requireAuth = require('./middleware/auth');
    const checkTokenBlacklist = require('./middleware/checkTokenBlacklist');
    
    // Initialize dashboard stats
    try {
      // Ensure all models are loaded first
      require('./models/Job');
      require('./models/Invoice');
      require('./models/DashboardStats');
      
      const dashboardStatsService = require('./services/dashboardStatsService');
      await dashboardStatsService.initializeStats();
      console.log('Dashboard stats initialized successfully');
    } catch (error) {
      console.error('Failed to initialize dashboard stats:', error);
      // Don't fail server startup if stats initialization fails
    }
    
    // Debug logging for route matching (temporary - remove after fixing)
    app.use((req, res, next) => {
      // Log all API requests to diagnose routing issues
      if (req.method !== 'GET' || req.path.includes('api') || req.path.includes('auth') || req.path.includes('login') || req.path.includes('projects') || req.path.includes('users') || req.path.includes('timesheets') || req.path.includes('custom-data')) {
        console.log('🔍 Route Debug:', {
          method: req.method,
          path: req.path,
          url: req.url,
          originalUrl: req.originalUrl
        });
      }
      next();
    });
    
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
    
    app.use('/api/air-monitoring-jobs', requireAuth, checkTokenBlacklist, jobRoutes);
    app.use('/air-monitoring-jobs', requireAuth, checkTokenBlacklist, jobRoutes);
    
    app.use('/api/samples', requireAuth, checkTokenBlacklist, sampleRoutes);
    app.use('/samples', requireAuth, checkTokenBlacklist, sampleRoutes);
    
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
    
    app.use('/api/air-pump-calibrations', requireAuth, checkTokenBlacklist, airPumpCalibrationRoutes);
    app.use('/air-pump-calibrations', requireAuth, checkTokenBlacklist, airPumpCalibrationRoutes);
    
    app.use('/api/graticule-calibrations', requireAuth, checkTokenBlacklist, graticuleCalibrationRoutes);
    app.use('/graticule-calibrations', requireAuth, checkTokenBlacklist, graticuleCalibrationRoutes);
    
    app.use('/api/efa-calibrations', requireAuth, checkTokenBlacklist, efaCalibrationRoutes);
    app.use('/efa-calibrations', requireAuth, checkTokenBlacklist, efaCalibrationRoutes);
    
    app.use('/api/pcm-microscope-calibrations', requireAuth, checkTokenBlacklist, pcmMicroscopeCalibrationRoutes);
    app.use('/pcm-microscope-calibrations', requireAuth, checkTokenBlacklist, pcmMicroscopeCalibrationRoutes);
    
    app.use('/api/plm-microscope-calibrations', requireAuth, checkTokenBlacklist, plmMicroscopeCalibrationRoutes);
    app.use('/plm-microscope-calibrations', requireAuth, checkTokenBlacklist, plmMicroscopeCalibrationRoutes);
    
    app.use('/api/stereomicroscope-calibrations', requireAuth, checkTokenBlacklist, stereomicroscopeCalibrationRoutes);
    app.use('/stereomicroscope-calibrations', requireAuth, checkTokenBlacklist, stereomicroscopeCalibrationRoutes);
    
    app.use('/api/hse-test-slide-calibrations', requireAuth, checkTokenBlacklist, hseTestSlideCalibrationRoutes);
    app.use('/hse-test-slide-calibrations', requireAuth, checkTokenBlacklist, hseTestSlideCalibrationRoutes);
    
    app.use('/api/flowmeter-calibrations', requireAuth, checkTokenBlacklist, flowmeterCalibrationRoutes);
    app.use('/flowmeter-calibrations', requireAuth, checkTokenBlacklist, flowmeterCalibrationRoutes);
    
    app.use('/api/calibration-frequency', requireAuth, checkTokenBlacklist, calibrationFrequencyRoutes);
    app.use('/calibration-frequency', requireAuth, checkTokenBlacklist, calibrationFrequencyRoutes);
    
    app.use('/api/equipment', requireAuth, checkTokenBlacklist, equipmentRoutes);
    app.use('/equipment', requireAuth, checkTokenBlacklist, equipmentRoutes);
    
    app.use('/api/asbestos-clearances', requireAuth, checkTokenBlacklist, asbestosClearanceRoutes);
    app.use('/asbestos-clearances', requireAuth, checkTokenBlacklist, asbestosClearanceRoutes);
    
    app.use('/api/asbestos-clearance-reports', requireAuth, checkTokenBlacklist, asbestosClearanceReportRoutes);
    app.use('/asbestos-clearance-reports', requireAuth, checkTokenBlacklist, asbestosClearanceReportRoutes);
    
    app.use('/api/asbestos-removal-jobs', requireAuth, checkTokenBlacklist, asbestosRemovalJobRoutes);
    app.use('/asbestos-removal-jobs', requireAuth, checkTokenBlacklist, asbestosRemovalJobRoutes);
    
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
    
    app.use('/api/invoice-items', requireAuth, checkTokenBlacklist, invoiceItemsRoutes);
    app.use('/invoice-items', requireAuth, checkTokenBlacklist, invoiceItemsRoutes);
    
    app.use('/api/custom-data-fields', requireAuth, checkTokenBlacklist, require('./routes/customDataFields'));
    app.use('/custom-data-fields', requireAuth, checkTokenBlacklist, require('./routes/customDataFields'));
    
    app.use('/api/custom-data-field-groups', requireAuth, checkTokenBlacklist, require('./routes/customDataFieldGroups'));
    app.use('/custom-data-field-groups', requireAuth, checkTokenBlacklist, require('./routes/customDataFieldGroups'));
    
    app.use('/api/project-audits', requireAuth, checkTokenBlacklist, require('./routes/projectAudits'));
    app.use('/project-audits', requireAuth, checkTokenBlacklist, require('./routes/projectAudits'));


    
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
    
    // Configure keep-alive timeouts for better connection reuse
    server.keepAliveTimeout = 65000; // 65 seconds (longer than most load balancers)
    server.headersTimeout = 66000;   // Must be greater than keepAliveTimeout
    
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Keep-alive timeout: ${server.keepAliveTimeout}ms`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });