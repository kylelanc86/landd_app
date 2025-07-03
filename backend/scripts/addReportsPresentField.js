const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

const addReportsPresentField = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Update all projects to have reports_present: false
    const result = await Project.updateMany(
      { reports_present: { $exists: false } },
      { $set: { reports_present: false } }
    );

    console.log(`Updated ${result.modifiedCount} projects with reports_present: false`);
    console.log('All existing projects now have reports_present field set to false');

    // Verify the update
    const totalProjects = await Project.countDocuments();
    const projectsWithField = await Project.countDocuments({ reports_present: { $exists: true } });
    
    console.log(`Total projects: ${totalProjects}`);
    console.log(`Projects with reports_present field: ${projectsWithField}`);

    mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

addReportsPresentField(); 