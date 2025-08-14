const mongoose = require('mongoose');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
const SampleItem = require('../models/SampleItem');

const debugSampleItems = async () => {
  try {
    // Connect to MongoDB using the same method as the app
    require('dotenv').config();
    const connectDB = require('../config/db');
    
    // Connect using the app's connection method
    await connectDB();
    
    console.log('=== DEBUGGING SAMPLE ITEMS ===\n');
    
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
          console.log(`    Item ${item.itemNumber}: ${item.sampleReference}`);
        }
      }
    }
    
    // Get all sample items
    const sampleItems = await SampleItem.find({});
    console.log(`\nTotal Sample Items: ${sampleItems.length}`);
    
    for (const sample of sampleItems) {
      console.log(`\nSample Item: ${sample._id}`);
      console.log(`  Project ID: ${sample.projectId}`);
      console.log(`  Lab Reference: ${sample.labReference}`);
      console.log(`  Has Analysis Data: ${!!sample.analysisData}`);
      if (sample.analysisData) {
        console.log(`  Final Result: ${sample.analysisData.finalResult}`);
        console.log(`  Analyzed At: ${sample.analyzedAt}`);
      }
    }
    
    // Try to find matches
    console.log('\n=== LOOKING FOR MATCHES ===');
    for (const assessment of assessments) {
      if (assessment.items && assessment.items.length > 0) {
        for (const item of assessment.items) {
          console.log(`\nLooking for match for assessment item: ${item.sampleReference}`);
          
          // Try different field combinations
          const matchByLabRef = await SampleItem.findOne({
            labReference: item.sampleReference
          });
          
          const matchByProjectAndLabRef = await SampleItem.findOne({
            projectId: assessment.projectId,
            labReference: item.sampleReference
          });
          
          console.log(`  Match by labReference only: ${matchByLabRef ? 'YES' : 'NO'}`);
          console.log(`  Match by projectId + labReference: ${matchByProjectAndLabRef ? 'YES' : 'NO'}`);
          
          if (matchByLabRef) {
            console.log(`    Sample Item ID: ${matchByLabRef._id}`);
            console.log(`    Project ID: ${matchByLabRef.projectId}`);
            console.log(`    Lab Reference: ${matchByLabRef.labReference}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run debug
debugSampleItems();
