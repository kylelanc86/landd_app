const mongoose = require('mongoose');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');

const checkAnalystFields = async () => {
  try {
    require('dotenv').config();
    const connectDB = require('../config/db');
    await connectDB();
    
    console.log('=== CHECKING ANALYST FIELDS ===\n');
    
    const jobIds = [
      '694b51718c4a62765f8edbb8',
      '695ae5ca5f5ab9948903e57c',
      '695ae60b5f5ab9948903e603',
      '695b2450e1c3e040c30211e3',
      '695c8ece98964bfdba798959'
    ];
    
    for (const jobId of jobIds) {
      const job = await ClientSuppliedJob.findById(jobId);
      if (!job) continue;
      
      console.log(`\nJob: ${jobId}`);
      console.log(`  Job analyst: ${job.analyst || 'N/A'}`);
      
      if (job.samples && job.samples.length > 0) {
        job.samples.forEach((sample, index) => {
          console.log(`\n  Sample ${index + 1}: ${sample.labReference}`);
          console.log(`    analysedBy: ${sample.analysedBy || 'undefined'}`);
          console.log(`    analysedBy type: ${typeof sample.analysedBy}`);
          // Check for old field name
          if (sample.analyzedBy !== undefined) {
            console.log(`    ⚠️  FOUND OLD FIELD: analyzedBy = ${sample.analyzedBy}`);
          }
          // Check in analysisData
          if (sample.analysisData) {
            console.log(`    analysisData.analysedBy: ${sample.analysisData.analysedBy || 'undefined'}`);
            if (sample.analysisData.analyzedBy !== undefined) {
              console.log(`    ⚠️  FOUND OLD FIELD in analysisData: analyzedBy = ${sample.analysisData.analyzedBy}`);
            }
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkAnalystFields();
