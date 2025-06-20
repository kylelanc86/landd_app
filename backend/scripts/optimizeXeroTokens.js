const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function optimizeXeroTokens() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('xerotokens');
    
    console.log('=== XEROTOKENS INDEX OPTIMIZATION ===\n');
    
    // Get current indexes
    const currentIndexes = await collection.indexes();
    console.log('Current indexes:');
    currentIndexes.forEach((index, i) => {
      const indexName = index.name || `index_${i}`;
      const indexKeys = Object.entries(index.key).map(([key, value]) => `${key}:${value}`).join(', ');
      console.log(`  ${i + 1}. ${indexName}: { ${indexKeys} }`);
    });
    
    console.log('\n=== DROPPING UNNECESSARY INDEXES ===\n');
    
    // List of indexes to drop (keeping only essential ones)
    const indexesToDrop = [
      'id_token_1',
      'session_state_1', 
      'access_token_1',
      'refresh_token_1'
    ];
    
    // Keep these essential indexes:
    // - _id_ (MongoDB default, can't drop)
    // - expires_at_1 (for cleanup)
    // - tenantId_1 (for multi-tenant support)
    
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
    
    console.log('\n=== VERIFYING OPTIMIZATION ===\n');
    
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
    const dataSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('\n=== RESULTS ===');
    console.log(`Index count: ${stats.nindexes} (was 8)`);
    console.log(`Index size: ${indexSizeMB} MB (was 0.23 MB)`);
    console.log(`Data size: ${dataSizeMB} MB`);
    console.log(`Index to data ratio: ${(stats.totalIndexSize / Math.max(stats.size, 1)).toFixed(1)}x`);
    
    const savings = 0.23 - parseFloat(indexSizeMB);
    console.log(`\n💾 Storage saved: ~${savings.toFixed(2)} MB`);
    
    console.log('\n✅ XEROTOKENS optimization complete!');
    
  } catch (error) {
    console.error('❌ Optimization failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

// Run the optimization
optimizeXeroTokens(); 