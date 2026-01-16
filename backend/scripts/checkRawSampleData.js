const mongoose = require('mongoose');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');

const checkRawSampleData = async () => {
  try {
    require('dotenv').config();
    const connectDB = require('../config/db');
    await connectDB();
    
    console.log('=== CHECKING RAW SAMPLE DATA ===\n');
    
    const jobId = '694b51718c4a62765f8edbb8';
    const job = await ClientSuppliedJob.findById(jobId).lean(); // Use lean() to get raw data
    
    if (!job) {
      console.log('Job not found');
      return;
    }
    
    console.log(`Job: ${jobId}`);
    console.log(`\nFull sample object (first sample):`);
    if (job.samples && job.samples.length > 0) {
      const sample = job.samples[0];
      console.log(JSON.stringify(sample, null, 2));
    }
    
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkRawSampleData();
