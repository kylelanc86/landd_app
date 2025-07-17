const mongoose = require('mongoose');
const Project = require('../models/Project');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');
require('dotenv').config();

const createClientSuppliedJobs = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all client supplied projects that don't have jobs yet
    const clientSuppliedProjects = await Project.find({ department: 'Client Supplied' });
    console.log(`Found ${clientSuppliedProjects.length} client supplied projects`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const project of clientSuppliedProjects) {
      // Check if a job already exists for this project
      const existingJob = await ClientSuppliedJob.findOne({ projectId: project._id });
      
      if (existingJob) {
        console.log(`Job already exists for project ${project.projectID} - skipping`);
        skippedCount++;
        continue;
      }

      // Create a new job
      const jobCount = await ClientSuppliedJob.countDocuments();
      const jobNumber = `CSJ-${String(jobCount + 1).padStart(4, '0')}`;
      
      const job = new ClientSuppliedJob({
        projectId: project._id,
        jobNumber,
        status: 'Pending'
      });

      await job.save();
      console.log(`Created job ${jobNumber} for project ${project.projectID}`);
      createdCount++;
    }

    console.log(`\nSummary:`);
    console.log(`- Created: ${createdCount} jobs`);
    console.log(`- Skipped: ${skippedCount} projects (jobs already exist)`);
    console.log(`- Total processed: ${clientSuppliedProjects.length} projects`);

  } catch (error) {
    console.error('Error creating client supplied jobs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
createClientSuppliedJobs(); 