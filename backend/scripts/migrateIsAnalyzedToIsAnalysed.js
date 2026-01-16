const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');

/**
 * Migration script to convert isAnalyzed (American spelling) to isAnalysed (British spelling)
 * This ensures compatibility after the merge that standardized on British spelling
 */
const migrateIsAnalyzedToIsAnalysed = async () => {
  try {
    // Connect to MongoDB
    require('dotenv').config();
    const connectDB = require('../config/db');
    await connectDB();
    
    console.log('=== MIGRATING isAnalyzed → isAnalysed ===\n');
    
    let totalUpdated = 0;
    let assessmentItemsUpdated = 0;
    let clientSuppliedSamplesUpdated = 0;
    
    // 1. Migrate AsbestosAssessment items
    console.log('Processing AsbestosAssessment items...');
    const assessments = await AsbestosAssessment.find({});
    console.log(`Found ${assessments.length} assessments to check`);
    
    for (const assessment of assessments) {
      if (!assessment.items || assessment.items.length === 0) {
        continue;
      }
      
      let hasChanges = false;
      
      for (const item of assessment.items) {
        if (item.analysisData && item.analysisData.isAnalyzed !== undefined) {
          // Check if old field exists but new field doesn't
          if (item.analysisData.isAnalyzed !== undefined && item.analysisData.isAnalysed === undefined) {
            item.analysisData.isAnalysed = item.analysisData.isAnalyzed;
            delete item.analysisData.isAnalyzed;
            hasChanges = true;
            assessmentItemsUpdated++;
            console.log(`  ✓ Updated item ${item.itemNumber} in assessment ${assessment._id}`);
          }
        }
      }
      
      if (hasChanges) {
        await assessment.save();
        totalUpdated++;
      }
    }
    
    console.log(`\nAssessment items: ${assessmentItemsUpdated} items updated in ${totalUpdated} assessments`);
    
    // 2. Migrate ClientSuppliedJob samples
    console.log('\nProcessing ClientSuppliedJob samples...');
    const clientSuppliedJobs = await ClientSuppliedJob.find({});
    console.log(`Found ${clientSuppliedJobs.length} client supplied jobs to check`);
    
    let jobsUpdated = 0;
    
    for (const job of clientSuppliedJobs) {
      if (!job.samples || job.samples.length === 0) {
        continue;
      }
      
      let hasChanges = false;
      
      for (const sample of job.samples) {
        if (sample.analysisData && sample.analysisData.isAnalyzed !== undefined) {
          // Check if old field exists but new field doesn't
          if (sample.analysisData.isAnalyzed !== undefined && sample.analysisData.isAnalysed === undefined) {
            sample.analysisData.isAnalysed = sample.analysisData.isAnalyzed;
            delete sample.analysisData.isAnalyzed;
            hasChanges = true;
            clientSuppliedSamplesUpdated++;
            console.log(`  ✓ Updated sample ${sample.labReference} in job ${job._id}`);
          }
        }
      }
      
      if (hasChanges) {
        await job.save();
        jobsUpdated++;
      }
    }
    
    console.log(`\nClient supplied samples: ${clientSuppliedSamplesUpdated} samples updated in ${jobsUpdated} jobs`);
    
    // Summary
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total assessment items migrated: ${assessmentItemsUpdated}`);
    console.log(`Total client supplied samples migrated: ${clientSuppliedSamplesUpdated}`);
    console.log(`Total assessments updated: ${totalUpdated}`);
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
  migrateIsAnalyzedToIsAnalysed()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateIsAnalyzedToIsAnalysed;
