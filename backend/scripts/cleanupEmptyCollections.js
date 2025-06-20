const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function cleanupEmptyCollections() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('=== EMPTY COLLECTION CLEANUP ===\n');
    
    let totalSavings = 0;
    const emptyCollections = [];
    
    // Find empty collections
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        
        if (stats.count === 0) {
          const indexSizeMB = (stats.totalIndexSize / 1024 / 1024).toFixed(2);
          emptyCollections.push({
            name: collection.name,
            indexSize: stats.totalIndexSize,
            indexSizeMB: parseFloat(indexSizeMB),
            indexCount: stats.nindexes
          });
          
          console.log(`📊 ${collection.name.toUpperCase()}`);
          console.log(`   Documents: ${stats.count}`);
          console.log(`   Index size: ${indexSizeMB} MB`);
          console.log(`   Index count: ${stats.nindexes}`);
          console.log('');
        }
      } catch (error) {
        console.log(`❌ Error checking ${collection.name}: ${error.message}`);
      }
    }
    
    if (emptyCollections.length === 0) {
      console.log('✅ No empty collections found!');
      return;
    }
    
    console.log(`Found ${emptyCollections.length} empty collections with indexes.\n`);
    
    // Drop indexes from empty collections
    for (const collectionInfo of emptyCollections) {
      const collection = db.collection(collectionInfo.name);
      
      console.log(`=== CLEANING ${collectionInfo.name.toUpperCase()} ===`);
      console.log(`Dropping ${collectionInfo.indexCount} indexes (${collectionInfo.indexSizeMB} MB)...\n`);
      
      try {
        // Get all indexes except _id_ (which can't be dropped)
        const indexes = await collection.indexes();
        const indexesToDrop = indexes.filter(index => index.name !== '_id_');
        
        for (const index of indexesToDrop) {
          try {
            console.log(`  Dropping: ${index.name}`);
            await collection.dropIndex(index.name);
            console.log(`  ✅ Dropped: ${index.name}`);
          } catch (error) {
            if (error.message.includes('index not found')) {
              console.log(`  ⚠️  Already dropped: ${index.name}`);
            } else {
              console.log(`  ❌ Error dropping ${index.name}: ${error.message}`);
            }
          }
        }
        
        // Verify cleanup
        const updatedStats = await collection.stats();
        const updatedIndexSizeMB = (updatedStats.totalIndexSize / 1024 / 1024).toFixed(2);
        const saved = collectionInfo.indexSizeMB - parseFloat(updatedIndexSizeMB);
        
        console.log(`\n  📊 Results:`);
        console.log(`    Index count: ${updatedStats.nindexes} (was ${collectionInfo.indexCount})`);
        console.log(`    Index size: ${updatedIndexSizeMB} MB (was ${collectionInfo.indexSizeMB} MB)`);
        console.log(`    💾 Saved: ~${saved.toFixed(2)} MB\n`);
        
        totalSavings += saved;
        
      } catch (error) {
        console.log(`❌ Error cleaning ${collectionInfo.name}: ${error.message}\n`);
      }
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Collections cleaned: ${emptyCollections.length}`);
    console.log(`Total storage saved: ~${totalSavings.toFixed(2)} MB`);
    console.log('\n✅ Empty collection cleanup complete!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

// Run the cleanup
cleanupEmptyCollections(); 