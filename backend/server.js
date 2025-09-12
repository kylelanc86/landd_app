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
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://app.landd.com.au'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
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

// Health check endpoint
app.get('/api/health', (req, res) => {
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
    
    // Routes
    app.use('/api/auth', authRoutes);
    
    // Protected routes with authentication and token blacklist checking
    app.use('/api/projects', requireAuth, checkTokenBlacklist, projectRoutes);
    app.use('/api/clients', requireAuth, checkTokenBlacklist, clientRoutes);
    app.use('/api/air-monitoring-jobs', requireAuth, checkTokenBlacklist, jobRoutes);
    app.use('/api/samples', requireAuth, checkTokenBlacklist, sampleRoutes);
    app.use('/api/invoices', requireAuth, checkTokenBlacklist, invoiceRoutes);
    app.use('/api/users', requireAuth, checkTokenBlacklist, usersRouter);
    // Mount Xero routes with auth for most endpoints, but allow callback without auth
app.use('/api/xero', xeroRoutes);
    app.use('/api/air-monitoring-shifts', requireAuth, checkTokenBlacklist, shiftRoutes);
    app.use('/api/timesheets', requireAuth, checkTokenBlacklist, timesheetRoutes);

    app.use('/api/air-pumps', requireAuth, checkTokenBlacklist, airPumpRoutes);
    app.use('/api/air-pump-calibrations', requireAuth, checkTokenBlacklist, airPumpCalibrationRoutes);
    app.use('/api/equipment', requireAuth, checkTokenBlacklist, equipmentRoutes);
    app.use('/api/asbestos-clearances', requireAuth, checkTokenBlacklist, asbestosClearanceRoutes);
    app.use('/api/asbestos-clearance-reports', requireAuth, checkTokenBlacklist, asbestosClearanceReportRoutes);
    app.use('/api/asbestos-removal-jobs', requireAuth, checkTokenBlacklist, asbestosRemovalJobRoutes);
    app.use('/api/reports', requireAuth, checkTokenBlacklist, reportsRoutes);

    app.use('/api/report-templates', requireAuth, checkTokenBlacklist, reportTemplateRoutes);
    app.use('/api/pdf-docraptor-v2', requireAuth, checkTokenBlacklist, pdfDocRaptorV2Routes);
    
    // Additional protected routes with token blacklist checking
    app.use('/api/assessments', requireAuth, checkTokenBlacklist, asbestosAssessmentsRoutes);
    app.use('/api/sample-items', requireAuth, checkTokenBlacklist, sampleItemsRoutes);
    app.use('/api/client-supplied-jobs', requireAuth, checkTokenBlacklist, clientSuppliedJobsRoutes);
    app.use('/api/invoice-items', requireAuth, checkTokenBlacklist, invoiceItemsRoutes);
    app.use('/api/custom-data-fields', requireAuth, checkTokenBlacklist, require('./routes/customDataFields'));
app.use('/api/custom-data-field-groups', requireAuth, checkTokenBlacklist, require('./routes/customDataFieldGroups'));
app.use('/api/project-audits', requireAuth, checkTokenBlacklist, require('./routes/projectAudits'));


    
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

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });