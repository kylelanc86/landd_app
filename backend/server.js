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

// Basic CORS setup for debugging
app.use(cors({
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request Headers:', req.headers);
  next();
});

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cors: {
      origin: req.headers.origin,
      allowed: true
    }
  });
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

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      console.error('Request Headers:', req.headers);
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
      console.log('CORS is configured to allow all origins temporarily');
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  }); 