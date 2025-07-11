const mongoose = require('mongoose');
const AsbestosAssessmentTemplate = require('./models/assessmentTemplates/asbestos/AsbestosAssessmentTemplate');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testAsbestosAssessmentTemplate() {
  try {
    console.log('Testing asbestos assessment template route...');
    
    // Test the exact same query as the route
    const templates = await AsbestosAssessmentTemplate.find()
      .sort({ createdAt: -1 });

    console.log('Found templates:', templates.length);
    console.log('Template details:', JSON.stringify(templates, null, 2));
    
    if (templates.length === 0) {
      console.log('No templates found. Checking if collection exists...');
      
      // Check if the collection exists
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Available collections:', collections.map(c => c.name));
      
      // Check if there are any documents in the collection
      const count = await AsbestosAssessmentTemplate.countDocuments();
      console.log('Total documents in collection:', count);
    }
    
  } catch (error) {
    console.error('Error testing asbestos assessment template:', error);
  } finally {
    mongoose.connection.close();
  }
}

testAsbestosAssessmentTemplate(); 