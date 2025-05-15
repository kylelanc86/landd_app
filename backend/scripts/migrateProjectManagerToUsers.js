const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring';
console.log('Connecting to MongoDB:', MONGODB_URI);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Import the Project model
const Project = require('../models/Project');

async function migrateProjectManagerToUsers() {
  try {
    console.log('Starting migration...');
    
    // Find all projects
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects to migrate`);

    // Update each project
    for (const project of projects) {
      console.log(`Processing project: ${project._id}`);
      
      // If project has projectManager, convert it to users array
      if (project.projectManager) {
        project.users = [project.projectManager];
        // Remove the projectManager field
        project.projectManager = undefined;
        
        // Save the updated project
        await project.save();
        console.log(`Updated project ${project._id}: converted projectManager to users array`);
      } else {
        console.log(`Project ${project._id} has no projectManager, skipping`);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
migrateProjectManagerToUsers(); 