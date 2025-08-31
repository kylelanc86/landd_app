const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');

// Default project statuses organized in a logical workflow
const defaultProjectStatuses = [
  { text: 'In progress', isActiveStatus: true, statusColor: '#1976d2', order: 0 },
  { text: 'Samples Submitted to Lab', isActiveStatus: true, statusColor: '#ff9800', order: 1 },
  { text: 'Lab Analysis Completed', isActiveStatus: true, statusColor: '#9c27b0', order: 2 },
  { text: 'Report sent for review', isActiveStatus: true, statusColor: '#f57c00', order: 3 },
  { text: 'Ready for invoicing', isActiveStatus: true, statusColor: '#388e3c', order: 4 },
  { text: 'Invoice sent', isActiveStatus: true, statusColor: '#7b1fa2', order: 5 },
  { text: 'Invoiced - Awaiting Payment', isActiveStatus: true, statusColor: '#d32f2f', order: 6 },
  { text: 'Job complete', isActiveStatus: false, statusColor: '#4caf50', order: 7 },
  { text: 'On hold', isActiveStatus: false, statusColor: '#ffc107', order: 8 },
  { text: 'Quote sent', isActiveStatus: false, statusColor: '#795548', order: 9 },
  { text: 'Cancelled', isActiveStatus: false, statusColor: '#f44336', order: 10 }
];

async function populateCustomDataFieldGroups() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Check if project status group already exists
    const existingGroup = await CustomDataFieldGroup.findOne({ 
      type: 'project_status', 
      isActive: true 
    });
    
    if (existingGroup) {
      console.log('Project status group already exists. Updating with new structure...');
      
      // Update existing group with new fields
      existingGroup.fields = defaultProjectStatuses.map(status => ({
        ...status,
        isActive: true,
        createdBy: existingGroup.createdBy,
        createdAt: existingGroup.createdAt
      }));
      
      existingGroup.updatedAt = new Date();
      await existingGroup.save();
      
      console.log('✓ Project status group updated successfully');
    } else {
      console.log('Creating new project status group...');
      
      // Create new group
      const newGroup = new CustomDataFieldGroup({
        name: 'Project Status Fields',
        description: 'Custom data fields for project statuses with workflow progression',
        type: 'project_status',
        fields: defaultProjectStatuses.map(status => ({
          ...status,
          isActive: true,
          createdBy: '000000000000000000000000', // Placeholder - will be updated by migration
          createdAt: new Date()
        })),
        createdBy: '000000000000000000000000', // Placeholder - will be updated by migration
        isActive: true
      });
      
      await newGroup.save();
      console.log('✓ Project status group created successfully');
    }
    
    // Display summary
    const group = await CustomDataFieldGroup.findOne({ 
      type: 'project_status', 
      isActive: true 
    });
    
    if (group) {
      console.log('\n=== Project Status Group Summary ===');
      console.log(`Group: ${group.name}`);
      console.log(`Type: ${group.type}`);
      console.log(`Total fields: ${group.fields.length}`);
      
      const activeStatuses = group.fields
        .filter(field => field.isActive && field.isActiveStatus)
        .sort((a, b) => a.order - b.order)
        .map(field => field.text);
      
      const inactiveStatuses = group.fields
        .filter(field => field.isActive && !field.isActiveStatus)
        .sort((a, b) => a.order - b.order)
        .map(field => field.text);
      
      console.log(`\nActive statuses (${activeStatuses.length}):`);
      activeStatuses.forEach(status => console.log(`  - ${status}`));
      
      console.log(`\nInactive statuses (${inactiveStatuses.length}):`);
      inactiveStatuses.forEach(status => console.log(`  - ${status}`));
      
      console.log('\nStatus colors:');
      group.fields.forEach(field => {
        if (field.isActive) {
          console.log(`  - ${field.text}: ${field.statusColor}`);
        }
      });
    }
    
    console.log('\nPopulation completed successfully!');
    
  } catch (error) {
    console.error('Error populating custom data field groups:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
}

// Run the population
populateCustomDataFieldGroups();
