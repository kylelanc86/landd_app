const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

const populateAnalysisData = async () => {
  try {
    // Connect to MongoDB using the same method as the app
    require('dotenv').config();
    const connectDB = require('../config/db');
    
    // Connect using the app's connection method
    await connectDB();
    
    console.log('=== POPULATING MISSING ANALYSIS DATA ===\n');
    
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
          // Check if item has analysisData but is missing key fields
          if (item.analysisData && !item.analysisData.isAnalysed) {
            console.log(`  Updating item ${item.itemNumber}`);
            
            // Set isAnalysed to true if we have basic analysis data
            if (item.analysisData.microscope && item.analysisData.sampleType) {
              item.analysisData.isAnalysed = true;
              item.analysisData.analysedAt = new Date();
              
              // Use existing asbestosContent as finalResult if available
              if (item.asbestosContent && !item.analysisData.finalResult) {
                item.analysisData.finalResult = item.asbestosContent;
                console.log(`    Set finalResult to: ${item.asbestosContent}`);
              }
              
              hasChanges = true;
              console.log(`    Updated analysis data for item ${item.itemNumber}`);
            }
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
    
    console.log('\nPopulation completed!');
    console.log(`Successfully updated: ${updatedCount} assessments`);
    console.log(`Errors: ${errorCount} assessments`);
    
  } catch (error) {
    console.error('Population failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run population
populateAnalysisData();
