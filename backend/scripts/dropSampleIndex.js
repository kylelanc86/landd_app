const mongoose = require('mongoose');
require('dotenv').config();

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.collections();
    
    for (let collection of collections) {
      const indexes = await collection.indexes();
      console.log(`Collection ${collection.collectionName} indexes:`, indexes);
    }

    // Drop the sampleNumber index from samples collection
    await db.collection('samples').dropIndex('sampleNumber_1');
    console.log('Successfully dropped sampleNumber index');

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

dropIndex(); 