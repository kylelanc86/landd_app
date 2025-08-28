const mongoose = require('mongoose');
const CustomDataField = require('../models/CustomDataField');
require('dotenv').config();

async function checkProjectStatuses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Get all project statuses
    const statuses = await CustomDataField.find({ type: 'project_status' });
    
    console.log('\nAll project statuses:');
    statuses.forEach(status => {
      console.log(`- '${status.text}' (Active: ${status.isActiveStatus})`);
    });
    
    // Check for specific status that was causing error
    const labAnalysisStatus = await CustomDataField.findOne({
      type: 'project_status',
      text: 'Lab Analysis Completed'
    });
    
    console.log('\nChecking for "Lab Analysis Completed":');
    if (labAnalysisStatus) {
      console.log(`✓ Found: '${labAnalysisStatus.text}' (Active: ${labAnalysisStatus.isActiveStatus})`);
    } else {
      console.log('✗ Not found');
    }
    
    // Check for similar statuses
    const similarStatuses = await CustomDataField.find({
      type: 'project_status',
      text: { $regex: /lab.*analysis/i }
    });
    
    console.log('\nSimilar statuses (case-insensitive):');
    similarStatuses.forEach(status => {
      console.log(`- '${status.text}' (Active: ${status.isActiveStatus})`);
    });
    
  } catch (error) {
    console.error('Error checking project statuses:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
}

// Run the script
checkProjectStatuses();
