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
    
    // First, let's see what users exist
    console.log('Checking existing users...');
    const existingUsers = await User.find({}).select('firstName lastName email licences');
    console.log(`Found ${existingUsers.length} users:`);
    existingUsers.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.email}) - Licences: ${user.licences?.length || 0}`);
    });
    
    // Create a test user with Asbestos Assessor licence if none exist
    if (existingUsers.length === 0) {
      console.log('\nCreating test user with Asbestos Assessor licence...');
      const testUser = new User({
        firstName: 'Patrick',
        lastName: 'Cerone',
        email: 'patrick.cerone@landd.com.au',
        password: 'testpassword123',
        role: 'employee',
        licences: [
          {
            state: 'ACT',
            licenceNumber: 'AA00031',
            licenceType: 'Asbestos Assessor'
          }
        ]
      });
      
      await testUser.save();
      console.log('Test user created successfully');
    }
    
    // Test the lookup functionality
    const testLAA = "Patrick Cerone";
    console.log(`\nLooking up user for LAA: ${testLAA}`);
    
    const user = await User.findOne({
      $or: [
        { firstName: { $regex: new RegExp(testLAA.split(' ')[0], 'i') }, lastName: { $regex: new RegExp(testLAA.split(' ')[1] || '', 'i') } },
        { firstName: { $regex: new RegExp(testLAA, 'i') } },
        { lastName: { $regex: new RegExp(testLAA, 'i') } }
      ]
    });
    
    if (user) {
      console.log('User found:', {
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
          console.log(`Found LAA licence: ${asbestosAssessorLicence.licenceNumber} (${asbestosAssessorLicence.state})`);
        } else {
          console.log('No Asbestos Assessor licence found');
        }
      } else {
        console.log('No licences found for user');
      }
    } else {
      console.log('User not found');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}); 