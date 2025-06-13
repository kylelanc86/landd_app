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

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Catch-all CORS middleware (must be first)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://landd-app-frontend1.onrender.com");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://landd-app-frontend.onrender.com',
      'https://air-monitoring-frontend.onrender.com',
      'https://landd-app-frontend1.onrender.com'
    ];
    
    // Log the incoming origin
    console.log('Incoming request origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin - allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('Origin blocked:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Add request logging middleware
app.use((req, res, next) => {
  console.log('=== Request Details ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('=====================');
  next();
});

app.use(express.json());

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
    environment: process.env.NODE_ENV,
    cors: {
      origin: req.headers.origin,
      allowed: true
    },
    headers: req.headers
  };
  console.log('Health check response:', healthData);
  res.status(200).json(healthData);
});

// Pre-flight OPTIONS handler
app.options('*', cors(corsOptions));

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
      console.log('CORS Configuration:', corsOptions);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  }); 