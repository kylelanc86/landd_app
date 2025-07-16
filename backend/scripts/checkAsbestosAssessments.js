const mongoose = require('mongoose');

async function checkAsbestosAssessments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
    
    const assessments = await AsbestosAssessment.find()
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate('assessorId');

    console.log(`Found ${assessments.length} asbestos assessments`);
    
    if (assessments.length > 0) {
      console.log('First assessment:', JSON.stringify(assessments[0], null, 2));
    } else {
      console.log('No asbestos assessments found in database');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAsbestosAssessments(); 