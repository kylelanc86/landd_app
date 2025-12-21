const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function testProjectsAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get projects with active statuses
    const activeStatuses = [
      "In progress",
      "Samples Submitted to Lab", 
      "Lab Analysis Completed",
      "Report sent for review",
      "Ready for invoicing",
      "Invoice sent",
      "Invoiced - Awaiting Payment",
    ];
    
    console.log('Looking for projects with statuses:', activeStatuses);
    
    const activeProjects = await Project.find({
      status: { $in: activeStatuses }
    }).select('projectID name status client').limit(10);
    
    console.log(`Found ${activeProjects.length} active projects:`);
    activeProjects.forEach(p => {
      console.log(`- ${p.projectID}: ${p.name} (Status: ${p.status})`);
    });
    
    // Test the same logic that the frontend uses
    const allProjects = await Project.find({}).select('projectID name status client').limit(50);
    
    console.log(`\nTesting frontend filtering logic on ${allProjects.length} projects:`);
    
    const frontendActiveStatuses = [
      "in progress",
      "samples submitted to lab",
      "lab analysis completed", 
      "report sent for review",
      "ready for invoicing",
      "invoice sent",
      "invoiced - awaiting payment",
    ];
    
    const filteredProjects = allProjects.filter(project => {
      const projectStatus = project.status?.toLowerCase();
      const isActive = frontendActiveStatuses.some(
        status => projectStatus === status.toLowerCase()
      );
      console.log(`Project ${project.projectID}: "${project.status}" -> "${projectStatus}" -> ${isActive}`);
      return isActive;
    });
    
    console.log(`\nFiltered result: ${filteredProjects.length} projects match frontend filter`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testProjectsAPI();
