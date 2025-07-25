const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    const User = require('./models/User');
    
    const testLAA = "Fake User";
    console.log(`\n=== Testing LAA lookup for: "${testLAA}" ===`);
    
    const query = {
      $or: [
        { firstName: { $regex: new RegExp(testLAA.split(' ')[0], 'i') }, lastName: { $regex: new RegExp(testLAA.split(' ')[1] || '', 'i') } },
        { firstName: { $regex: new RegExp(testLAA, 'i') } },
        { lastName: { $regex: new RegExp(testLAA, 'i') } }
      ]
    };
    
    console.log('Query:', JSON.stringify(query, null, 2));
    
    const user = await User.findOne(query);
    
    if (user) {
      console.log('✅ User found!');
      console.log('User details:', {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        licences: user.licences
      });
      
      if (user.licences && user.licences.length > 0) {
        // Find the Asbestos Assessor licence
        const asbestosAssessorLicence = user.licences.find(licence => 
          licence.licenceType === 'Asbestos Assessor' || 
          licence.licenceType === 'LAA'
        );
        
        if (asbestosAssessorLicence) {
          console.log(`✅ Found LAA licence: ${asbestosAssessorLicence.licenceNumber} (${asbestosAssessorLicence.state})`);
        } else {
          console.log('❌ No Asbestos Assessor licence found');
        }
      } else {
        console.log('❌ No licences found for user');
      }
    } else {
      console.log('❌ User not found');
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}); 