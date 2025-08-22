const mongoose = require('mongoose');
const CustomDataField = require('../models/CustomDataField');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const updateIndexes = async () => {
  try {
    console.log('Starting index update...');
    
    // Check if collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    console.log('Available collections:', collectionNames);
    
    // Find the actual collection name for CustomDataField
    const customDataFieldCollection = collectionNames.find(name => 
      name.toLowerCase().includes('customdatafield') || 
      name.toLowerCase().includes('customdata')
    );
    
    if (!customDataFieldCollection) {
      console.log('CustomDataField collection not found. Creating it with initial document...');
      // Create a test document to initialize the collection
      const testField = new CustomDataField({
        type: 'asbestos_removalist',
        text: 'Test Field',
        createdBy: new mongoose.Types.ObjectId()
      });
      await testField.save();
      console.log('Test document created, collection initialized');
    }
    
    // Get the actual collection
    const collection = CustomDataField.collection;
    console.log('Working with collection:', collection.collectionName);
    
    // List existing indexes
    console.log('Existing indexes:');
    const existingIndexes = await collection.indexes();
    existingIndexes.forEach((index, i) => {
      console.log(`  ${i}: ${index.name} - ${JSON.stringify(index.key)}`);
    });
    
    // Drop existing indexes
    console.log('Dropping existing indexes...');
    try {
      const existingIndexes = await collection.indexes();
      console.log('Found indexes to drop:', existingIndexes.length);
      
      // Drop each index individually, skipping the _id index
      for (const index of existingIndexes) {
        if (index.name !== '_id_') {
          try {
            await collection.dropIndex(index.name);
            console.log(`Dropped index: ${index.name}`);
          } catch (dropError) {
            console.log(`Could not drop index ${index.name}:`, dropError.message);
          }
        }
      }
      console.log('Index dropping completed');
    } catch (error) {
      console.log('Error during index dropping:', error.message);
    }
    
    // Wait a moment for indexes to be fully dropped
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify indexes are dropped
    const remainingIndexes = await collection.indexes();
    console.log('Remaining indexes after drop:', remainingIndexes.length);
    remainingIndexes.forEach((index, i) => {
      console.log(`  ${i}: ${index.name} - ${JSON.stringify(index.key)}`);
    });
    
    // Create new indexes
    console.log('Creating new indexes...');
    
    // For legislation: unique on type + text + jurisdiction
    await collection.createIndex(
      { type: 1, text: 1, jurisdiction: 1 }, 
      { 
        unique: true,
        name: 'legislation_type_text_jurisdiction_unique',
        partialFilterExpression: { jurisdiction: { $exists: true } }
      }
    );
    console.log('Legislation index created (type + text + jurisdiction)');
    
    // For non-legislation: unique on type + text (without jurisdiction)
    // We'll create separate indexes for each non-legislation type
    const nonLegislationTypes = ['asbestos_removalist', 'location_description', 'materials_description', 'room_area'];
    
    for (const fieldType of nonLegislationTypes) {
      await collection.createIndex(
        { type: 1, text: 1 }, 
        { 
          unique: true,
          name: `${fieldType}_type_text_unique`,
          partialFilterExpression: { type: fieldType }
        }
      );
      console.log(`Index created for ${fieldType} (type + text)`);
    }
    
    // General index for queries
    await collection.createIndex({ type: 1, text: 1 }, { name: 'type_text_query' });
    console.log('General query index created');
    
    console.log('All indexes updated successfully!');
    
    // Clean up test document if it was created
    if (customDataFieldCollection) {
      await CustomDataField.deleteOne({ text: 'Test Field' });
      console.log('Test document cleaned up');
    }
    
  } catch (error) {
    console.error('Error updating indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
};

// Run the migration
if (require.main === module) {
  connectDB().then(() => {
    updateIndexes();
  });
}

module.exports = { updateIndexes };
