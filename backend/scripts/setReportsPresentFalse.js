const mongoose = require('mongoose');
require('dotenv').config();

const Project = require('../models/Project');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function setReportsPresentFalse() {
  try {
    console.log('🔄 Updating all projects to set reports_present = false...');

    const result = await Project.updateMany(
      {},
      { $set: { reports_present: false } }
    );

    console.log(`📊 Matched projects: ${result.matchedCount ?? result.n}`);
    console.log(`🛠️  Modified projects: ${result.modifiedCount ?? result.nModified}`);
    console.log('✅ Update complete.');
  } catch (error) {
    console.error('❌ Error updating projects:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

connectDB().then(setReportsPresentFalse);

