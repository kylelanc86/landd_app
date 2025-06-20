const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function testModels() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected successfully!\n');
    
    // Test Project model
    console.log('=== TESTING PROJECT MODEL ===');
    const Project = require('../models/Project');
    
    // Test 1: Count projects
    const projectCount = await Project.countDocuments();
    console.log(`✅ Project count: ${projectCount}`);
    
    // Test 2: Find one project
    const oneProject = await Project.findOne().lean();
    if (oneProject) {
      console.log(`✅ Found project: ${oneProject.name} (${oneProject.projectID})`);
    } else {
      console.log('⚠️  No projects found');
    }
    
    // Test 3: Test compound index queries
    const projectsByStatus = await Project.find({ status: 'Assigned' }).limit(5).lean();
    console.log(`✅ Projects with 'Assigned' status: ${projectsByStatus.length}`);
    
    const projectsByDepartment = await Project.find({ 
      status: 'Assigned', 
      department: 'Asbestos & HAZMAT' 
    }).limit(5).lean();
    console.log(`✅ Projects with status 'Assigned' and department 'Asbestos & HAZMAT': ${projectsByDepartment.length}`);
    
    // Test Client model
    console.log('\n=== TESTING CLIENT MODEL ===');
    const Client = require('../models/Client');
    
    const clientCount = await Client.countDocuments();
    console.log(`✅ Client count: ${clientCount}`);
    
    const oneClient = await Client.findOne().lean();
    if (oneClient) {
      console.log(`✅ Found client: ${oneClient.name}`);
    } else {
      console.log('⚠️  No clients found');
    }
    
    // Test User model
    console.log('\n=== TESTING USER MODEL ===');
    const User = require('../models/User');
    
    const userCount = await User.countDocuments();
    console.log(`✅ User count: ${userCount}`);
    
    const oneUser = await User.findOne().lean();
    if (oneUser) {
      console.log(`✅ Found user: ${oneUser.fullName} (${oneUser.email})`);
    } else {
      console.log('⚠️  No users found');
    }
    
    // Test XeroToken model
    console.log('\n=== TESTING XEROTOKEN MODEL ===');
    const XeroToken = require('../models/XeroToken');
    
    const tokenCount = await XeroToken.countDocuments();
    console.log(`✅ XeroToken count: ${tokenCount}`);
    
    // Test basic CRUD operations
    console.log('\n=== TESTING BASIC CRUD ===');
    
    // Test create (without saving)
    const testProject = new Project({
      name: 'Test Project',
      client: oneClient?._id || new mongoose.Types.ObjectId(),
      department: 'Asbestos & HAZMAT',
      status: 'Assigned'
    });
    
    console.log(`✅ Project validation: ${testProject.validateSync() ? '❌ Failed' : '✅ Passed'}`);
    
    console.log('\n✅ All model tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

// Run the tests
testModels(); 