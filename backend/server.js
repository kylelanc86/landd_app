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

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

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

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ message: 'Something went wrong!' });
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