const mongoose = require('mongoose');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');

/**
 * Migration script to convert analyzedBy/analyzedAt (American spelling) 
 * to analysedBy/analysedAt (British spelling) in ClientSuppliedJob samples
 */
const migrateAnalyzedToAnalysed = async () => {
  try {
    require('dotenv').config();
    const connectDB = require('../config/db');
    await connectDB();
    
    console.log('=== MIGRATING analyzedBy/analyzedAt → analysedBy/analysedAt ===\n');
    
    let jobsUpdated = 0;
    let samplesUpdated = 0;
    
    // Get all client supplied jobs
    const clientSuppliedJobs = await ClientSuppliedJob.find({}).lean(); // Use lean() to get raw data
    console.log(`Found ${clientSuppliedJobs.length} client supplied jobs to check`);
    
    for (const job of clientSuppliedJobs) {
      if (!job.samples || job.samples.length === 0) {
        continue;
      }
      
      let hasChanges = false;
      const updatedSamples = [];
      
      for (const sample of job.samples) {
        const updatedSample = { ...sample };
        let sampleChanged = false;
        
        // Migrate analyzedBy → analysedBy
        if (sample.analyzedBy !== undefined && sample.analysedBy === undefined) {
          updatedSample.analysedBy = sample.analyzedBy;
          delete updatedSample.analyzedBy;
          sampleChanged = true;
        }
        
        // Migrate analyzedAt → analysedAt (on sample level)
        if (sample.analyzedAt !== undefined && sample.analysedAt === undefined) {
          updatedSample.analysedAt = sample.analyzedAt;
          delete updatedSample.analyzedAt;
          sampleChanged = true;
        }
        
        // Migrate analyzedAt → analysedAt (in analysisData)
        if (sample.analysisData && sample.analysisData.analyzedAt !== undefined) {
          if (!updatedSample.analysisData) {
            updatedSample.analysisData = { ...sample.analysisData };
          }
          if (updatedSample.analysisData.analysedAt === undefined) {
            updatedSample.analysisData.analysedAt = sample.analysisData.analyzedAt;
          }
          delete updatedSample.analysisData.analyzedAt;
          sampleChanged = true;
        }
        
        updatedSamples.push(updatedSample);
        
        if (sampleChanged) {
          hasChanges = true;
          samplesUpdated++;
          console.log(`  ✓ Updated sample ${sample.labReference} in job ${job._id}`);
        }
      }
      
      if (hasChanges) {
        // Use findByIdAndUpdate to ensure the update is saved
        await ClientSuppliedJob.findByIdAndUpdate(
          job._id,
          { $set: { samples: updatedSamples } },
          { new: true }
        );
        jobsUpdated++;
      }
    }
    
    console.log(`\n=== MIGRATION SUMMARY ===`);
    console.log(`Total samples migrated: ${samplesUpdated}`);
    console.log(`Total jobs updated: ${jobsUpdated}`);
    console.log('\n✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
if (require.main === module) {
  migrateAnalyzedToAnalysed()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateAnalyzedToAnalysed;
