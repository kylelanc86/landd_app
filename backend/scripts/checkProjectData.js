const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Import the Project model
const Project = require('../models/Project');

async function checkProjectData() {
  try {
    console.log('🔍 Checking project data types...');
    
    // Find the specific project that was causing issues
    const project = await Project.findById('68b8437d5dc0dd94b3f63868');
    
    if (project) {
      console.log('📊 Project data:');
      console.log(`- projectID: ${project.projectID} (${typeof project.projectID})`);
      console.log(`- isLargeProject: ${project.isLargeProject} (${typeof project.isLargeProject})`);
      console.log(`- reports_present: ${project.reports_present} (${typeof project.reports_present})`);
      console.log(`- createdBy: ${project.createdBy} (${typeof project.createdBy})`);
      console.log(`- client: ${project.client} (${typeof project.client})`);
      
      // Check if these are the problematic values
      if (typeof project.isLargeProject === 'string') {
        console.log('⚠️  isLargeProject is a string!');
      }
      if (typeof project.reports_present === 'string') {
        console.log('⚠️  reports_present is a string!');
      }
      if (typeof project.createdBy === 'string' && !project.createdBy.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('⚠️  createdBy is a string name!');
      }
    } else {
      console.log('❌ Project not found');
    }
    
    // Also check a few random projects
    console.log('\n🔍 Checking random projects...');
    const randomProjects = await Project.find({}).limit(5);
    
    for (const proj of randomProjects) {
      console.log(`\nProject ${proj.projectID}:`);
      console.log(`- isLargeProject: ${proj.isLargeProject} (${typeof proj.isLargeProject})`);
      console.log(`- reports_present: ${proj.reports_present} (${typeof proj.reports_present})`);
      console.log(`- createdBy: ${proj.createdBy} (${typeof proj.createdBy})`);
    }
    
  } catch (error) {
    console.error('❌ Error checking project data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
}

// Run the check
connectDB().then(() => {
  checkProjectData();
});
