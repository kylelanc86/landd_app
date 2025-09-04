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

async function fixProjectDataTypes() {
  try {
    console.log('🔧 Starting project data type fixes...');
    
    // Find all projects with data type issues
    const projects = await Project.find({});
    console.log(`📊 Found ${projects.length} projects to check`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const project of projects) {
      let needsUpdate = false;
      const updates = {};
      
      // Fix isLargeProject field
      if (typeof project.isLargeProject === 'string') {
        updates.isLargeProject = project.isLargeProject === "Yes" || project.isLargeProject === "true";
        needsUpdate = true;
        console.log(`🔧 Project ${project.projectID}: Converting isLargeProject from "${project.isLargeProject}" to ${updates.isLargeProject}`);
      }
      
      // Fix reports_present field
      if (typeof project.reports_present === 'string') {
        updates.reports_present = project.reports_present === "Yes" || project.reports_present === "true";
        needsUpdate = true;
        console.log(`🔧 Project ${project.projectID}: Converting reports_present from "${project.reports_present}" to ${updates.reports_present}`);
      }
      
      // Fix createdBy field - if it's a string name, we need to find the user ObjectId
      if (typeof project.createdBy === 'string' && !project.createdBy.match(/^[0-9a-fA-F]{24}$/)) {
        console.log(`🔧 Project ${project.projectID}: createdBy is a string name "${project.createdBy}", need to find ObjectId`);
        // For now, we'll set it to null or a default user ObjectId
        // You might want to manually map these or create a lookup table
        updates.createdBy = null; // or set to a default admin user ObjectId
        needsUpdate = true;
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        try {
          await Project.findByIdAndUpdate(project._id, updates);
          fixedCount++;
          console.log(`✅ Fixed project ${project.projectID}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error fixing project ${project.projectID}:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 Data type fix completed!`);
    console.log(`✅ Fixed: ${fixedCount} projects`);
    console.log(`❌ Errors: ${errorCount} projects`);
    
  } catch (error) {
    console.error('❌ Error in fixProjectDataTypes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
}

// Run the fix
connectDB().then(() => {
  fixProjectDataTypes();
});
