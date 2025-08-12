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
const calendarEntriesRouter = require('./routes/calendarEntries');
const airPumpRoutes = require('./routes/airPumps');
const airPumpCalibrationRoutes = require('./routes/airPumpCalibrations');
const equipmentRoutes = require('./routes/equipment');
const asbestosClearanceRoutes = require('./routes/asbestosClearances');
const asbestosClearanceReportRoutes = require('./routes/asbestosClearanceReports');
const asbestosRemovalJobRoutes = require('./routes/asbestosRemovalJobs');
const reportsRoutes = require('./routes/reports');

const asbestosClearanceTemplateRoutes = require('./routes/asbestosClearanceTemplates');
const leadAssessmentTemplateRoutes = require('./routes/leadAssessmentTemplates');
const asbestosAssessmentTemplateRoutes = require('./routes/asbestosAssessmentTemplates');
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
      'https://landd-app-frontend1.onrender.com',
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires'],
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
  .then(() => {
    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/air-monitoring-jobs', jobRoutes);
    app.use('/api/samples', sampleRoutes);
    app.use('/api/invoices', invoiceRoutes);
    app.use('/api/users', usersRouter);
    app.use('/api/xero', xeroRoutes);
    app.use('/api/air-monitoring-shifts', shiftRoutes);
    app.use('/api/timesheets', timesheetRoutes);
    app.use('/api/calendar-entries', calendarEntriesRouter);
    app.use('/api/air-pumps', airPumpRoutes);
    app.use('/api/air-pump-calibrations', airPumpCalibrationRoutes);
    app.use('/api/equipment', equipmentRoutes);
    app.use('/api/asbestos-clearances', asbestosClearanceRoutes);
    app.use('/api/asbestos-clearance-reports', asbestosClearanceReportRoutes);
    app.use('/api/asbestos-removal-jobs', asbestosRemovalJobRoutes);
    app.use('/api/reports', reportsRoutes);

    app.use('/api/asbestos-clearance-templates', asbestosClearanceTemplateRoutes);
    app.use('/api/lead-assessment-templates', leadAssessmentTemplateRoutes);
    app.use('/api/asbestos-assessment-templates', asbestosAssessmentTemplateRoutes);
    app.use('/api/pdf-docraptor-v2', pdfDocRaptorV2Routes);
    

    const requireAuth = require('./middleware/auth');
    app.use('/api/assessments', requireAuth, asbestosAssessmentsRoutes);
    app.use('/api/sample-items', requireAuth, sampleItemsRoutes);
    app.use('/api/client-supplied-jobs', requireAuth, clientSuppliedJobsRoutes);
    app.use('/api/invoice-items', invoiceItemsRoutes);


    
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