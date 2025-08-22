const mongoose = require('mongoose');
const CustomDataField = require('../models/CustomDataField');

const fixIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring');
    console.log('Connected to MongoDB');
    
    const collection = CustomDataField.collection;
    
    // Drop ALL indexes except _id
    console.log('Dropping all indexes...');
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await collection.dropIndex(index.name);
          console.log(`Dropped index: ${index.name}`);
        } catch (e) {
          console.log(`Could not drop ${index.name}:`, e.message);
        }
      }
    }
    
    // Create only the correct indexes
    console.log('Creating correct indexes...');
    
    // For legislation: unique on type + text + jurisdiction
    await collection.createIndex(
      { type: 1, text: 1, jurisdiction: 1 }, 
      { 
        unique: true,
        name: 'legislation_unique',
        partialFilterExpression: { jurisdiction: { $exists: true } }
      }
    );
    console.log('Created legislation index (type + text + jurisdiction)');
    
    // General index for queries (non-unique)
    await collection.createIndex({ type: 1, text: 1 }, { name: 'query_index' });
    console.log('Created general query index');
    
    console.log('Index fix completed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

fixIndexes();
