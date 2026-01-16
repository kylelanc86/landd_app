const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
const SampleItem = require('../models/SampleItem');

const migrateAnalysisData = async () => {
  try {
    // Connect to MongoDB using the same method as the app
    require('dotenv').config();
    const connectDB = require('../config/db');
    
    // Connect using the app's connection method
    await connectDB();
    
    console.log('Starting analysis data migration...');
    
    // Get all assessments
    const assessments = await AsbestosAssessment.find({});
    console.log(`Found ${assessments.length} assessments to process`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const assessment of assessments) {
      try {
        console.log(`Processing assessment: ${assessment._id}`);
        
        // Check if assessment has items
        if (!assessment.items || assessment.items.length === 0) {
          console.log(`  No items found, skipping`);
          continue;
        }
        
        let hasChanges = false;
        
        // Process each item
        for (const item of assessment.items) {
          // Check if item already has analysisData
          if (item.analysisData && item.analysisData.isAnalysed) {
            console.log(`  Item ${item.itemNumber} already has analysis data, skipping`);
            continue;
          }
          
          // Look for existing sample item data
          const sampleItem = await SampleItem.findOne({
            projectId: assessment.projectId,
            labReference: item.sampleReference
          });
          
          if (sampleItem && sampleItem.analysisData) {
            console.log(`  Found sample item data for item ${item.itemNumber}`);
            
            // Migrate the data
            item.analysisData = {
              microscope: sampleItem.analysisData.microscope || "LD-PLM-1",
              sampleDescription: sampleItem.analysisData.sampleDescription || item.locationDescription,
              sampleType: sampleItem.analysisData.sampleType || "mass",
              sampleMass: sampleItem.analysisData.sampleMass || null,
              sampleDimensions: sampleItem.analysisData.sampleDimensions || null,
              ashing: sampleItem.analysisData.ashing || "no",
              crucibleNo: sampleItem.analysisData.crucibleNo || null,
              fibres: sampleItem.analysisData.fibres || [],
              finalResult: sampleItem.analysisData.finalResult || "",
              analysedBy: sampleItem.analysedBy || null,
              analysedAt: sampleItem.analysedAt || new Date(),
              isAnalysed: true
            };
            
            hasChanges = true;
            console.log(`  Migrated analysis data for item ${item.itemNumber}`);
          }
        }
        
        // Save if changes were made
        if (hasChanges) {
          await assessment.save();
          migratedCount++;
          console.log(`  Assessment ${assessment._id} updated successfully`);
        }
        
      } catch (error) {
        console.error(`  Error processing assessment ${assessment._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`Successfully migrated: ${migratedCount} assessments`);
    console.log(`Errors: ${errorCount} assessments`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
migrateAnalysisData();
