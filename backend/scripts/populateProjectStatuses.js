const mongoose = require('mongoose');
const CustomDataField = require('../models/CustomDataField');
require('dotenv').config();

// Default project statuses based on the old hardcoded enum
const defaultStatuses = [
  { text: 'In progress', isActiveStatus: true },
  { text: 'Report sent for review', isActiveStatus: true },
  { text: 'Ready for invoicing', isActiveStatus: true },
  { text: 'Invoice sent', isActiveStatus: true },
  { text: 'Job complete', isActiveStatus: false },
  { text: 'On hold', isActiveStatus: false },
  { text: 'Quote sent', isActiveStatus: false },
  { text: 'Cancelled', isActiveStatus: false }
];

async function populateProjectStatuses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Check if statuses already exist
    const existingStatuses = await CustomDataField.find({ type: 'project_status' });
    
    if (existingStatuses.length > 0) {
      console.log(`Found ${existingStatuses.length} existing project statuses. Skipping population.`);
      console.log('Existing statuses:', existingStatuses.map(s => s.text));
      return;
    }
    
    // Add each default status
    const addedStatuses = [];
    for (const status of defaultStatuses) {
      const newStatus = new CustomDataField({
        type: 'project_status',
        text: status.text,
        isActiveStatus: status.isActiveStatus
      });
      
      await newStatus.save();
      addedStatuses.push(newStatus);
      console.log(`Added status: ${status.text} (${status.isActiveStatus ? 'Active' : 'Inactive'})`);
    }
    
    console.log(`\nSuccessfully added ${addedStatuses.length} project statuses to the database.`);
    
    // Display summary
    const activeCount = addedStatuses.filter(s => s.isActiveStatus).length;
    const inactiveCount = addedStatuses.filter(s => !s.isActiveStatus).length;
    
    console.log(`\nSummary:`);
    console.log(`- Active statuses: ${activeCount}`);
    console.log(`- Inactive statuses: ${inactiveCount}`);
    console.log(`- Total: ${addedStatuses.length}`);
    
  } catch (error) {
    console.error('Error populating project statuses:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
}

// Run the script
populateProjectStatuses();
