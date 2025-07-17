const mongoose = require('mongoose');
require('dotenv').config();

async function fixReadyForAnalysis() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
    const assessments = await AsbestosAssessment.find();
    let totalItemsUpdated = 0;
    for (const assessment of assessments) {
      let itemsUpdated = false;
      for (const item of assessment.items) {
        if (typeof item.readyForAnalysis === 'undefined') {
          item.readyForAnalysis = false;
          itemsUpdated = true;
        }
      }
      if (itemsUpdated) {
        await assessment.save();
        totalItemsUpdated += assessment.items.length;
        console.log(`Updated assessment ${assessment._id} with ${assessment.items.length} items`);
      }
    }
    console.log('Total items updated:', totalItemsUpdated);
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixReadyForAnalysis(); 