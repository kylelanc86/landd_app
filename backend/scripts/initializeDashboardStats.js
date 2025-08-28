const mongoose = require('mongoose');
require('dotenv').config();

// Import models in correct order to avoid schema registration issues
const Job = require('../models/Job');
const Invoice = require('../models/Invoice');
const DashboardStats = require('../models/DashboardStats');

async function initializeDashboardStats() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Initializing dashboard stats...');
    
    // First, let's see what collections exist and what they contain
    console.log('=== INVESTIGATING PROJECT DATA STRUCTURE ===');
    
    // Check Job collection (air_monitoring_jobs)
    const allJobs = await Job.find({}).select('status name projectId');
    console.log('Jobs collection count:', allJobs.length);
    console.log('Job statuses:', [...new Set(allJobs.map(j => j.status))]);
    
    // Check Project collection
    const Project = require('../models/Project');
    const allProjects = await Project.find({}).select('status name projectID department');
    console.log('Projects collection count:', allProjects.length);
    console.log('Project statuses:', [...new Set(allProjects.map(p => p.status))]);
    console.log('Project departments:', [...new Set(allProjects.map(p => p.department))]);
    
    // Check if there are other project-related collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('All collections in database:', collectionNames);
    
    // Look for collections that might contain project data
    const projectRelatedCollections = collectionNames.filter(name => 
      name.includes('project') || name.includes('job') || name.includes('asbestos')
    );
    console.log('Project-related collections:', projectRelatedCollections);
    
    // For now, let's use the Project collection since that's where your main projects are
    const uniqueStatuses = [...new Set(allProjects.map(p => p.status))];
    console.log('Using Project collection statuses:', uniqueStatuses);
    
    // Get counts for each status that actually exists in your database
    const statusCounts = {};
    for (const status of uniqueStatuses) {
      statusCounts[status] = await Project.countDocuments({ status });
    }
    
    console.log('Status counts from Project collection:', statusCounts);
    
    // Calculate totals
    const totalProjects = allProjects.length;
    const activeProjects = totalProjects; // You can define active logic later
    const inactiveProjects = 0; // You can define inactive logic later
    
    // Get outstanding invoices count
    const outstandingInvoices = await Invoice.countDocuments({ status: 'unpaid' });

    console.log('Current counts:');
    console.log('- Total Projects:', totalProjects);
    console.log('- Active Projects:', activeProjects);
    console.log('- Inactive Projects:', inactiveProjects);
    console.log('- Outstanding Invoices:', outstandingInvoices);
    console.log('- Status Breakdown:', statusCounts);

    // Update all stats
    const updatePromises = [
      DashboardStats.updateStat('totalProjects', totalProjects),
      DashboardStats.updateStat('activeProjects', activeProjects),
      DashboardStats.updateStat('inactiveProjects', inactiveProjects),
      DashboardStats.updateStat('outstandingInvoices', outstandingInvoices),
      DashboardStats.updateStat('statusCounts', JSON.stringify(statusCounts))
    ];

    await Promise.all(updatePromises);
    
    console.log('Dashboard stats initialized successfully!');
    
    // Verify the stats were saved
    const savedStats = await DashboardStats.getAllStats();
    console.log('Saved stats:', savedStats);
    
  } catch (error) {
    console.error('Error initializing dashboard stats:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
initializeDashboardStats();
