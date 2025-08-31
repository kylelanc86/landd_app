const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CustomDataField = require('../models/CustomDataField');
const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');

async function migrateToCustomDataFieldGroups() {
  try {
    // Debug environment variables
    console.log('Environment check:');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'NOT SET');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Current working directory:', process.cwd());
    console.log('Script directory:', __dirname);
    console.log('Env file path:', path.join(__dirname, '..', '.env'));
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
    }
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Get all unique types from existing custom data fields
    const types = await CustomDataField.distinct('type');
    console.log('Found types:', types);
    
    for (const type of types) {
      console.log(`\nProcessing type: ${type}`);
      
      // Get all fields of this type
      const fields = await CustomDataField.find({ 
        type, 
        isActive: true 
      }).sort({ createdAt: 1 });
      
      console.log(`Found ${fields.length} fields for type ${type}`);
      
      if (fields.length === 0) {
        console.log(`No active fields found for type ${type}, skipping...`);
        continue;
      }
      
      // Check if group already exists
      let group = await CustomDataFieldGroup.findOne({ type, isActive: true });
      
      if (group) {
        console.log(`Group already exists for type ${type}, updating...`);
      } else {
        console.log(`Creating new group for type ${type}...`);
        group = new CustomDataFieldGroup({
          name: `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Fields`,
          description: `Custom data fields for ${type}`,
          type,
          fields: [],
          createdBy: fields[0].createdBy, // Use the first field's creator
          isActive: true
        });
      }
      
      // Convert fields to the new structure
      const newFields = fields.map((field, index) => ({
        text: field.text,
        isActive: field.isActive,
        isActiveStatus: field.isActiveStatus || true,
        statusColor: field.statusColor || '#1976d2',
        legislationTitle: field.legislationTitle,
        jurisdiction: field.jurisdiction,
        order: index,
        createdBy: field.createdBy,
        createdAt: field.createdAt
      }));
      
      // Update the group
      group.fields = newFields;
      group.updatedAt = new Date();
      
      await group.save();
      console.log(`✓ Successfully processed ${newFields.length} fields for type ${type}`);
    }
    
    console.log('\n=== Migration Summary ===');
    
    // Display summary of what was created
    const groups = await CustomDataFieldGroup.find({ isActive: true });
    for (const group of groups) {
      console.log(`\n${group.name} (${group.type}):`);
      console.log(`  - Total fields: ${group.fields.length}`);
      console.log(`  - Active fields: ${group.fields.filter(f => f.isActive).length}`);
      
      if (group.type === 'project_status') {
        const activeStatuses = group.fields.filter(f => f.isActive && f.isActiveStatus).map(f => f.text);
        const inactiveStatuses = group.fields.filter(f => f.isActive && !f.isActiveStatus).map(f => f.text);
        console.log(`  - Active statuses: ${activeStatuses.join(', ')}`);
        console.log(`  - Inactive statuses: ${inactiveStatuses.join(', ')}`);
      }
    }
    
    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
}

// Run the migration
migrateToCustomDataFieldGroups();
