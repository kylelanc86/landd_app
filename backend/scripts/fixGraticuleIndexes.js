const mongoose = require('mongoose');
require('dotenv').config();

async function fixGraticuleIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/landd');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('graticulecalibrations');

    // List current indexes
    console.log('Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log('Index:', JSON.stringify(index));
    });

    // Drop any old unique indexes on graticuleId
    try {
      await collection.dropIndex({ graticuleId: 1 });
      console.log('✅ Dropped old unique index on graticuleId');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Unique index on graticuleId already doesn\'t exist');
      } else {
        console.error('Error dropping index:', error.message);
      }
    }

    // Drop any composite unique index if it exists
    try {
      await collection.dropIndex({ graticuleId: 1, graticuleEquipmentId: 1 });
      console.log('✅ Dropped composite unique index on graticuleId + graticuleEquipmentId');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Composite unique index already doesn\'t exist');
      } else {
        console.error('Error dropping composite index:', error.message);
      }
    }

    // Create regular (non-unique) indexes for efficient querying
    try {
      await collection.createIndex({ graticuleId: 1 }, { name: 'graticuleId_1' });
      console.log('✅ Created regular index on graticuleId');
    } catch (error) {
      console.error('Error creating graticuleId index:', error.message);
    }

    // Create unique index on calibrationId (if needed for internal use)
    try {
      await collection.createIndex({ calibrationId: 1 }, { unique: true, sparse: true, name: 'calibrationId_unique' });
      console.log('✅ Created unique sparse index on calibrationId');
    } catch (error) {
      console.error('Error creating calibrationId index:', error.message);
    }

    // List indexes again to verify
    console.log('\nUpdated indexes:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log('Index:', JSON.stringify(index));
    });

    console.log('\n✅ Index fix completed successfully!');
    
  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

fixGraticuleIndexes();
