const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function analyzeIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    let totalDataSize = 0;
    let totalStorageSize = 0;
    let totalIndexSize = 0;
    let totalDocuments = 0;
    
    console.log('=== DATABASE INDEX ANALYSIS ===\n');
    
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        const indexes = await db.collection(collection.name).indexes();
        
        const dataSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const storageSizeMB = (stats.storageSize / 1024 / 1024).toFixed(2);
        const indexSizeMB = (stats.totalIndexSize / 1024 / 1024).toFixed(2);
        
        totalDataSize += stats.size;
        totalStorageSize += stats.storageSize;
        totalIndexSize += stats.totalIndexSize;
        totalDocuments += stats.count;
        
        console.log(`📊 ${collection.name.toUpperCase()}`);
        console.log(`   Documents: ${stats.count.toLocaleString()}`);
        console.log(`   Data size: ${dataSizeMB} MB`);
        console.log(`   Storage size: ${storageSizeMB} MB`);
        console.log(`   Index size: ${indexSizeMB} MB`);
        console.log(`   Index count: ${stats.nindexes}`);
        
        if (indexes.length > 0) {
          console.log('   Indexes:');
          indexes.forEach((index, i) => {
            const indexName = index.name || `index_${i}`;
            const indexKeys = Object.entries(index.key).map(([key, value]) => `${key}:${value}`).join(', ');
            console.log(`     ${i + 1}. ${indexName}: { ${indexKeys} }`);
          });
        }
        
        // Highlight potential issues
        const indexToDataRatio = stats.totalIndexSize / Math.max(stats.size, 1);
        if (indexToDataRatio > 2) {
          console.log(`   ⚠️  WARNING: Index size is ${indexToDataRatio.toFixed(1)}x larger than data size!`);
        }
        
        if (stats.nindexes > 5) {
          console.log(`   ⚠️  WARNING: Collection has ${stats.nindexes} indexes (consider reducing)`);
        }
        
        console.log('');
        
      } catch (error) {
        console.log(`❌ Error analyzing ${collection.name}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total collections: ${collections.length}`);
    console.log(`Total documents: ${totalDocuments.toLocaleString()}`);
    console.log(`Total data size: ${(totalDataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total storage size: ${(totalStorageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total index size: ${(totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Index to data ratio: ${(totalIndexSize / Math.max(totalDataSize, 1)).toFixed(2)}x`);
    
    // Recommendations
    console.log('\n=== RECOMMENDATIONS ===');
    if (totalIndexSize > totalDataSize) {
      console.log('🔴 CRITICAL: Index size exceeds data size - immediate cleanup needed!');
    }
    
    if ((totalIndexSize / Math.max(totalDataSize, 1)) > 1.5) {
      console.log('🟡 WARNING: Index size is more than 1.5x data size - consider cleanup');
    }
    
    if (totalIndexSize > 500 * 1024 * 1024) { // 500MB
      console.log('🟡 WARNING: Total index size exceeds 500MB - review index strategy');
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Run cleanup script to remove redundant indexes');
    console.log('2. Review model definitions to prevent future redundant indexes');
    console.log('3. Monitor index usage patterns');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Analysis complete - connection closed');
  }
}

// Run the analysis
analyzeIndexes(); 