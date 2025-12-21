/**
 * Script to check flowmeter calibration records in MongoDB
 * Run with: node backend/scripts/checkFlowmeterCalibrations.js
 * OR from backend directory: node scripts/checkFlowmeterCalibrations.js
 */

const path = require('path');

// Load environment variables from backend directory
// Try multiple possible locations for .env file
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

// Verify MONGODB_URI is loaded
if (!process.env.MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not found in environment variables.');
  console.error(`Looking for .env file at: ${envPath}`);
  console.error('Please ensure MONGODB_URI is set in your .env file.');
  process.exit(1);
}

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const checkFlowmeterCalibrations = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Try different possible collection names
    const possibleCollections = [
      'flowmetercalibrations',
      'flowmeterCalibrations',
      'flowmeter_calibrations'
    ];

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('\n=== All Collections in Database ===');
    collectionNames.forEach(name => {
      if (name.toLowerCase().includes('flowmeter')) {
        console.log(`  ✓ ${name} (FLOWMETER RELATED)`);
      } else {
        console.log(`  - ${name}`);
      }
    });

    // Check for flowmeter calibration collections
    const flowmeterCollections = collectionNames.filter(name => 
      name.toLowerCase().includes('flowmeter') && name.toLowerCase().includes('calibration')
    );

    if (flowmeterCollections.length > 0) {
      console.log('\n=== Flowmeter Calibration Collections Found ===');
      for (const collectionName of flowmeterCollections) {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`\nCollection: ${collectionName}`);
        console.log(`  Total documents: ${count}`);

        if (count > 0) {
          const samples = await collection.find().limit(5).toArray();
          console.log(`  Sample documents (first 5):`);
          samples.forEach((doc, index) => {
            console.log(`    ${index + 1}. ID: ${doc._id}, flowmeterId: ${doc.flowmeterId}, date: ${doc.date}`);
          });
        }
      }
    } else {
      console.log('\n=== No Flowmeter Calibration Collections Found ===');
      console.log('Checking if using model name...');
      
      // Try to use the model directly
      const FlowmeterCalibration = require('../models/FlowmeterCalibration');
      const count = await FlowmeterCalibration.countDocuments();
      console.log(`\nUsing FlowmeterCalibration model:`);
      console.log(`  Total documents: ${count}`);
      
      if (count > 0) {
        const samples = await FlowmeterCalibration.find().limit(5).lean();
        console.log(`  Sample documents (first 5):`);
        samples.forEach((doc, index) => {
          console.log(`    ${index + 1}. ID: ${doc._id}, flowmeterId: ${doc.flowmeterId}, date: ${doc.date}`);
        });
      }
    }

    // Also check Equipment collection for flowrateCalibrations data
    console.log('\n=== Checking Equipment Collection for flowrateCalibrations ===');
    const Equipment = require('../models/Equipment');
    const equipmentWithFlowrateCal = await Equipment.find({
      equipmentType: 'Site flowmeter',
      flowrateCalibrations: { $exists: true, $ne: {} }
    }).lean();

    console.log(`Equipment records with flowrateCalibrations: ${equipmentWithFlowrateCal.length}`);
    equipmentWithFlowrateCal.forEach((eq, index) => {
      console.log(`  ${index + 1}. ${eq.equipmentReference}:`, 
        eq.flowrateCalibrations ? Object.keys(eq.flowrateCalibrations).length + ' flowrates' : 'none');
    });

    await mongoose.connection.close();
    console.log('\n✓ Check complete');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkFlowmeterCalibrations();
