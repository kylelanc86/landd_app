const mongoose = require('mongoose');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');

const checkMigratedSamples = async () => {
  try {
    require('dotenv').config();
    const connectDB = require('../config/db');
    await connectDB();
    
    console.log('=== CHECKING MIGRATED SAMPLES ===\n');
    
    // Get the jobs that were migrated
    const jobIds = [
      '694b51718c4a62765f8edbb8',
      '695ae5ca5f5ab9948903e57c',
      '695ae60b5f5ab9948903e603',
      '695b2450e1c3e040c30211e3',
      '695c8ece98964bfdba798959'
    ];
    
    for (const jobId of jobIds) {
      const job = await ClientSuppliedJob.findById(jobId);
      if (!job) {
        console.log(`Job ${jobId} not found`);
        continue;
      }
      
      console.log(`\nJob: ${jobId}`);
      console.log(`  Job Type: ${job.jobType}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Samples: ${job.samples?.length || 0}`);
      
      if (job.samples && job.samples.length > 0) {
        job.samples.forEach((sample, index) => {
          console.log(`\n  Sample ${index + 1}: ${sample.labReference}`);
          console.log(`    Has analysisData: ${!!sample.analysisData}`);
          if (sample.analysisData) {
            console.log(`    isAnalysed: ${sample.analysisData.isAnalysed}`);
            console.log(`    isAnalysed type: ${typeof sample.analysisData.isAnalysed}`);
            console.log(`    isAnalyzed (old): ${sample.analysisData.isAnalyzed}`);
            console.log(`    analysedAt: ${sample.analysedAt}`);
            console.log(`    has analysedBy: ${!!sample.analysedBy}`);
            console.log(`    finalResult: ${sample.analysisData.finalResult || 'N/A'}`);
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

checkMigratedSamples();
