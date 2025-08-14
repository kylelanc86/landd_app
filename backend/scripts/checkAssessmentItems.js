const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

const checkAssessmentItems = async () => {
  try {
    // Connect to MongoDB using the same method as the app
    require('dotenv').config();
    const connectDB = require('../config/db');
    
    // Connect using the app's connection method
    await connectDB();
    
    console.log('=== CHECKING ASSESSMENT ITEMS ===\n');
    
    // Get all assessments
    const assessments = await AsbestosAssessment.find({});
    console.log(`Total Assessments: ${assessments.length}`);
    
    for (const assessment of assessments) {
      console.log(`\nAssessment: ${assessment._id}`);
      console.log(`  Project: ${assessment.projectId}`);
      console.log(`  Status: ${assessment.status}`);
      console.log(`  Items: ${assessment.items?.length || 0}`);
      
      if (assessment.items && assessment.items.length > 0) {
        for (const item of assessment.items) {
          console.log(`\n    Item ${item.itemNumber}:`);
          console.log(`      Sample Reference: ${item.sampleReference}`);
          console.log(`      Location Description: ${item.locationDescription}`);
          console.log(`      Material Type: ${item.materialType}`);
          console.log(`      Asbestos Content: ${item.asbestosContent}`);
          console.log(`      Ready for Analysis: ${item.readyForAnalysis}`);
          
          // Check for embedded analysis data
          if (item.analysisData) {
            console.log(`      ✅ HAS ANALYSIS DATA:`);
            console.log(`        - Microscope: ${item.analysisData.microscope}`);
            console.log(`        - Sample Type: ${item.analysisData.sampleType}`);
            console.log(`        - Final Result: ${item.analysisData.finalResult}`);
            console.log(`        - Is Analyzed: ${item.analysisData.isAnalyzed}`);
            console.log(`        - Analyzed At: ${item.analysisData.analyzedAt}`);
          } else {
            console.log(`      ❌ NO ANALYSIS DATA`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run check
checkAssessmentItems();
