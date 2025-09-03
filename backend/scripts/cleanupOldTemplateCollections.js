const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import old models for cleanup
const NonFriableClearance = require('../models/clearanceTemplates/asbestos/NonFriableClearance');
const FriableClearance = require('../models/clearanceTemplates/asbestos/FriableClearance');
const MixedClearance = require('../models/clearanceTemplates/asbestos/MixedClearance');
const LeadAssessment = require('../models/assessmentTemplates/lead/LeadAssessment');
const AsbestosAssessmentTemplate = require('../models/assessmentTemplates/asbestos/AsbestosAssessmentTemplate');

// Import new unified model for verification
const ReportTemplate = require('../models/ReportTemplate');

const cleanupOldTemplateCollections = async () => {
  try {
    console.log('Starting cleanup of old template collections...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database');
    
    // Verify that migration was successful
    const totalTemplates = await ReportTemplate.countDocuments();
    console.log(`Verifying migration: ${totalTemplates} templates found in unified collection`);
    
    if (totalTemplates < 5) {
      console.error('Migration verification failed! Expected at least 5 templates, found:', totalTemplates);
      console.error('Please run the migration script first and verify it was successful.');
      return;
    }
    
    console.log('Migration verification successful. Proceeding with cleanup...');
    
    // Count documents in old collections before deletion
    const nonFriableCount = await NonFriableClearance.countDocuments();
    const friableCount = await FriableClearance.countDocuments();
    const mixedCount = await MixedClearance.countDocuments();
    const leadCount = await LeadAssessment.countDocuments();
    const asbestosCount = await AsbestosAssessmentTemplate.countDocuments();
    
    console.log('Documents in old collections:');
    console.log(`- NonFriableClearance: ${nonFriableCount}`);
    console.log(`- FriableClearance: ${friableCount}`);
    console.log(`- MixedClearance: ${mixedCount}`);
    console.log(`- LeadAssessment: ${leadCount}`);
    console.log(`- AsbestosAssessmentTemplate: ${asbestosCount}`);
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete all data from the old template collections!');
    console.log('Make sure you have verified that the migration was successful and have a backup.');
    console.log('\nTo proceed, set the CONFIRM_CLEANUP environment variable to "true"');
    
    if (process.env.CONFIRM_CLEANUP !== 'true') {
      console.log('Cleanup cancelled. Set CONFIRM_CLEANUP=true to proceed.');
      return;
    }
    
    console.log('Proceeding with cleanup...');
    
    // Delete old collections
    if (nonFriableCount > 0) {
      await NonFriableClearance.deleteMany({});
      console.log('✓ Deleted NonFriableClearance collection');
    }
    
    if (friableCount > 0) {
      await FriableClearance.deleteMany({});
      console.log('✓ Deleted FriableClearance collection');
    }
    
    if (mixedCount > 0) {
      await MixedClearance.deleteMany({});
      console.log('✓ Deleted MixedClearance collection');
    }
    
    if (leadCount > 0) {
      await LeadAssessment.deleteMany({});
      console.log('✓ Deleted LeadAssessment collection');
    }
    
    if (asbestosCount > 0) {
      await AsbestosAssessmentTemplate.deleteMany({});
      console.log('✓ Deleted AsbestosAssessmentTemplate collection');
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('All old template collections have been removed.');
    console.log('Your application is now using the unified reportTemplates collection.');
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run cleanup if called directly
if (require.main === module) {
  cleanupOldTemplateCollections()
    .then(() => {
      console.log('Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupOldTemplateCollections;
