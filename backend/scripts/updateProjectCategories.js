const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function updateProjectCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all projects
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects`);

    // Check if any projects need category updates
    const projectsNeedingUpdate = projects.filter(project => 
      !project.categories || project.categories.length === 0
    );

    console.log(`${projectsNeedingUpdate.length} projects have no categories`);

    // If you want to add default categories to projects that don't have any
    // Uncomment and modify the following code:
    
    /*
    const defaultCategories = ['Asbestos Material Assessment']; // Add your default categories here
    
    for (const project of projectsNeedingUpdate) {
      project.categories = defaultCategories;
      await project.save();
      console.log(`Updated project ${project.projectID} with categories: ${defaultCategories.join(', ')}`);
    }
    */

    // Or if you want to see which projects have which categories:
    const categoryStats = {};
    projects.forEach(project => {
      if (project.categories && project.categories.length > 0) {
        project.categories.forEach(category => {
          categoryStats[category] = (categoryStats[category] || 0) + 1;
        });
      }
    });

    console.log('\nCurrent category usage:');
    Object.entries(categoryStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`- ${category}: ${count} projects`);
      });

    console.log('\nUpdate complete!');
    
  } catch (error) {
    console.error('Error updating project categories:', error);
  } finally {
    await mongoose.connection.close();
  }
}

updateProjectCategories();
