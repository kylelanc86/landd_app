const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
const SampleItem = require('../models/SampleItem');



const checkAnalysisData = async () => {
  try {
    // Connect to MongoDB using the same method as the app
    require('dotenv').config();
    const connectDB = require('../config/db');
    
    // Connect using the app's connection method
    await connectDB();
    
    console.log('=== CHECKING ANALYSIS DATA ===\n');
    
    // Check assessments
    const assessments = await AsbestosAssessment.find({});
    console.log(`Total Assessments: ${assessments.length}`);
    
    let itemsWithAnalysis = 0;
    let itemsWithoutAnalysis = 0;
    
    for (const assessment of assessments) {
      console.log(`\nAssessment: ${assessment._id}`);
      console.log(`  Project: ${assessment.projectId}`);
      console.log(`  Status: ${assessment.status}`);
      console.log(`  Items: ${assessment.items?.length || 0}`);
      
      if (assessment.items && assessment.items.length > 0) {
        for (const item of assessment.items) {
          if (item.analysisData && item.analysisData.isAnalysed) {
            itemsWithAnalysis++;
            console.log(`    Item ${item.itemNumber}: ✅ HAS ANALYSIS DATA`);
            console.log(`      - Microscope: ${item.analysisData.microscope}`);
            console.log(`      - Final Result: ${item.analysisData.finalResult}`);
            console.log(`      - Analysed At: ${item.analysisData.analysedAt}`);
          } else {
            itemsWithoutAnalysis++;
            console.log(`    Item ${item.itemNumber}: ❌ NO ANALYSIS DATA`);
            console.log(`      - Sample Ref: ${item.sampleReference}`);
            console.log(`      - Ready for Analysis: ${item.readyForAnalysis}`);
          }
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Items with analysis data: ${itemsWithAnalysis}`);
    console.log(`Items without analysis data: ${itemsWithoutAnalysis}`);
    
    // Check sample items
    const sampleItems = await SampleItem.find({});
    console.log(`\nTotal Sample Items: ${sampleItems.length}`);
    
    let sampleItemsWithAnalysis = 0;
    for (const sample of sampleItems) {
      if (sample.analysisData) {
        sampleItemsWithAnalysis++;
      }
    }
    console.log(`Sample Items with analysis data: ${sampleItemsWithAnalysis}`);
    
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run check
checkAnalysisData();
