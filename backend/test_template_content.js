const mongoose = require('mongoose');
const { getTemplateByType } = require('./services/templateService');
require('dotenv').config();

async function testTemplateContent() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database:', mongoose.connection.db.databaseName);
    
    // Test fetching asbestos assessment template
    console.log('\nTesting asbestos assessment template...');
    const assessmentTemplate = await getTemplateByType('asbestosAssessment');
    
    if (assessmentTemplate) {
      console.log('✅ Asbestos assessment template found');
      console.log('Template ID:', assessmentTemplate._id);
      console.log('Template type:', assessmentTemplate.templateType);
      console.log('Has standardSections:', !!assessmentTemplate.standardSections);
      
      if (assessmentTemplate.standardSections) {
        console.log('Available sections:', Object.keys(assessmentTemplate.standardSections));
        
        // Check specific sections
        console.log('\nChecking specific sections:');
        console.log('Introduction title:', assessmentTemplate.standardSections.introductionTitle);
        console.log('Introduction content length:', assessmentTemplate.standardSections.introductionContent?.length || 0);
        console.log('Risk Assessment title:', assessmentTemplate.standardSections.riskAssessmentTitle);
        console.log('Risk Assessment content length:', assessmentTemplate.standardSections.riskAssessmentContent?.length || 0);
        console.log('Control Measures title:', assessmentTemplate.standardSections.controlMeasuresTitle);
        console.log('Control Measures content length:', assessmentTemplate.standardSections.controlMeasuresContent?.length || 0);
      }
    } else {
      console.log('❌ Asbestos assessment template not found');
    }
    
    // Test fetching clearance templates
    console.log('\nTesting clearance templates...');
    const nonFriableTemplate = await getTemplateByType('asbestosClearanceNonFriable');
    const friableTemplate = await getTemplateByType('asbestosClearanceFriable');
    
    console.log('Non-friable template found:', !!nonFriableTemplate);
    console.log('Friable template found:', !!friableTemplate);
    
  } catch (error) {
    console.error('Error testing template content:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testTemplateContent(); 