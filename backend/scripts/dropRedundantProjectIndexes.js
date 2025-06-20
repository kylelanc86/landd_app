const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function dropRedundantProjectIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('projects');
    
    console.log('=== DROPPING REDUNDANT PROJECT INDEXES ===\n');
    
    // List of redundant single-field indexes to drop
    const indexesToDrop = [
      'projectID_1',
      'name_1', 
      'projectID_-1'
    ];
    
    for (const indexName of indexesToDrop) {
      try {
        console.log(`Dropping index: ${indexName}`);
        await collection.dropIndex(indexName);
        console.log(`✅ Successfully dropped: ${indexName}`);
      } catch (error) {
        if (error.message.includes('index not found')) {
          console.log(`⚠️  Index not found (already dropped): ${indexName}`);
        } else {
          console.log(`❌ Error dropping ${indexName}: ${error.message}`);
        }
      }
    }
    
    console.log('\n=== VERIFYING CLEANUP ===\n');
    
    // Get updated indexes
    const updatedIndexes = await collection.indexes();
    console.log('Remaining indexes:');
    updatedIndexes.forEach((index, i) => {
      const indexName = index.name || `index_${i}`;
      const indexKeys = Object.entries(index.key).map(([key, value]) => `${key}:${value}`).join(', ');
      console.log(`  ${i + 1}. ${indexName}: { ${indexKeys} }`);
    });
    
    // Get updated stats
    const stats = await collection.stats();
    const indexSizeMB = (stats.totalIndexSize / 1024 / 1024).toFixed(2);
    
    console.log('\n=== RESULTS ===');
    console.log(`Index count: ${stats.nindexes}`);
    console.log(`Index size: ${indexSizeMB} MB`);
    console.log('\n✅ Redundant project indexes dropped!');
    console.log('💡 Remember to restart your app to prevent automatic index recreation');
    
  } catch (error) {
    console.error('❌ Operation failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

// Run the cleanup
dropRedundantProjectIndexes(); 