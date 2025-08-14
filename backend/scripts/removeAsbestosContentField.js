const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

const removeAsbestosContentField = async () => {
  try {
    // Connect to MongoDB using the same method as the app
    require('dotenv').config();
    const connectDB = require('../config/db');
    
    // Connect using the app's connection method
    await connectDB();
    
    console.log('=== REMOVING ASBESTOS CONTENT FIELD ===\n');
    
    // Get all assessments
    const assessments = await AsbestosAssessment.find({});
    console.log(`Found ${assessments.length} assessments to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const assessment of assessments) {
      try {
        console.log(`Processing assessment: ${assessment._id}`);
        
        if (!assessment.items || assessment.items.length === 0) {
          console.log(`  No items found, skipping`);
          continue;
        }
        
        let hasChanges = false;
        
        for (const item of assessment.items) {
          // Remove the asbestosContent field if it exists
          if (item.asbestosContent !== undefined) {
            console.log(`  Removing asbestosContent from item ${item.itemNumber}: "${item.asbestosContent}"`);
            delete item.asbestosContent;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await assessment.save();
          updatedCount++;
          console.log(`  Assessment ${assessment._id} updated successfully`);
        }
        
      } catch (error) {
        console.error(`  Error processing assessment ${assessment._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\nField removal completed!');
    console.log(`Successfully updated: ${updatedCount} assessments`);
    console.log(`Errors: ${errorCount} assessments`);
    
  } catch (error) {
    console.error('Field removal failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run field removal
removeAsbestosContentField();
