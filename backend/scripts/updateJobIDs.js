const mongoose = require('mongoose');
const AirMonitoringJob = require('../models/Job');
require('dotenv').config();

async function updateJobIDs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all jobs without a jobID
    const jobs = await AirMonitoringJob.find({ jobID: { $exists: false } });
    console.log(`Found ${jobs.length} jobs without jobID`);

    // Update each job with a unique jobID
    for (const job of jobs) {
      const jobID = `AMJ-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4)}`;
      job.jobID = jobID;
      await job.save();
      console.log(`Updated job ${job._id} with jobID: ${jobID}`);
    }

    console.log('Finished updating job IDs');
  } catch (error) {
    console.error('Error updating job IDs:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

updateJobIDs(); 