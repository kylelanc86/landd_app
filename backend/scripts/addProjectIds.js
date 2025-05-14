const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Project = require('../models/Project');

// Load environment variables from the correct path
dotenv.config({ path: path.join(__dirname, '../.env') });

async function addProjectIds() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all projects
    const projects = await Project.find().sort({ createdAt: 1 });
    console.log(`Found ${projects.length} projects`);

    // Add projectIDs to each project
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const projectId = `LDX${String(i + 1).padStart(5, '0')}`;
      
      console.log(`Adding projectID ${projectId} to project: ${project.name}`);
      
      project.projectID = projectId;
      await project.save();
    }

    console.log('Successfully added projectIDs to all projects');
    
    // Verify the changes
    const updatedProjects = await Project.find();
    console.log('\nUpdated projects:');
    updatedProjects.forEach(project => {
      console.log(`Project: ${project.name}, ID: ${project.projectID}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
addProjectIds(); 