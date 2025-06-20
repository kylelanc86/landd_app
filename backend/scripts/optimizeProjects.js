const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function optimizeProjects() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('projects');
    
    console.log('=== PROJECTS INDEX ANALYSIS ===\n');
    
    // Get current indexes
    const currentIndexes = await collection.indexes();
    console.log('Current indexes (15 total):');
    currentIndexes.forEach((index, i) => {
      const indexName = index.name || `index_${i}`;
      const indexKeys = Object.entries(index.key).map(([key, value]) => `${key}:${value}`).join(', ');
      console.log(`  ${i + 1}. ${indexName}: { ${indexKeys} }`);
    });
    
    // Get current stats
    const stats = await collection.stats();
    console.log(`\nCurrent stats:`);
    console.log(`  Documents: ${stats.count.toLocaleString()}`);
    console.log(`  Data size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Index size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n=== IDENTIFYING REDUNDANT INDEXES ===\n');
    
    // Analyze for redundant indexes
    const redundantIndexes = [];
    
    // Check for single-field indexes that are covered by compound indexes
    const singleFieldIndexes = currentIndexes.filter(index => 
      Object.keys(index.key).length === 1 && index.name !== '_id_'
    );
    
    const compoundIndexes = currentIndexes.filter(index => 
      Object.keys(index.key).length > 1
    );
    
    console.log('Single-field indexes:');
    singleFieldIndexes.forEach(index => {
      const field = Object.keys(index.key)[0];
      console.log(`  - ${index.name}: { ${field}:${index.key[field]} }`);
      
      // Check if this field is covered by a compound index
      const coveredByCompound = compoundIndexes.some(compound => 
        compound.key[field] !== undefined
      );
      
      if (coveredByCompound) {
        redundantIndexes.push(index.name);
        console.log(`    ⚠️  REDUNDANT: Covered by compound index`);
      }
    });
    
    console.log('\nCompound indexes:');
    compoundIndexes.forEach(index => {
      const indexKeys = Object.entries(index.key).map(([key, value]) => `${key}:${value}`).join(', ');
      console.log(`  - ${index.name}: { ${indexKeys} }`);
    });
    
    // Identify specific redundant indexes
    const specificRedundant = [
      'status_1',           // Covered by status_1_department_1
      'department_1',       // Covered by status_1_department_1  
      'projectID_1',        // Covered by projectID_-1
      'name_1',             // Covered by compound indexes
      'client_1',           // Covered by client_1_createdAt_-1
      'users_1',            // Covered by users_1_createdAt_-1
      'createdAt_-1'        // Covered by multiple compound indexes
    ];
    
    console.log('\n=== RECOMMENDED INDEXES TO DROP ===\n');
    specificRedundant.forEach(indexName => {
      const exists = currentIndexes.some(index => index.name === indexName);
      if (exists) {
        console.log(`  - ${indexName} (redundant single-field index)`);
        redundantIndexes.push(indexName);
      }
    });
    
    console.log(`\nTotal redundant indexes to drop: ${redundantIndexes.length}`);
    
    if (redundantIndexes.length === 0) {
      console.log('\n✅ No redundant indexes found!');
      return;
    }
    
    console.log('\n=== DROPPING REDUNDANT INDEXES ===\n');
    
    for (const indexName of redundantIndexes) {
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
    const updatedStats = await collection.stats();
    const indexSizeMB = (updatedStats.totalIndexSize / 1024 / 1024).toFixed(2);
    const dataSizeMB = (updatedStats.size / 1024 / 1024).toFixed(2);
    
    console.log('\n=== RESULTS ===');
    console.log(`Index count: ${updatedStats.nindexes} (was 15)`);
    console.log(`Index size: ${indexSizeMB} MB (was ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`Data size: ${dataSizeMB} MB`);
    
    const savings = (stats.totalIndexSize - updatedStats.totalIndexSize) / 1024 / 1024;
    console.log(`\n💾 Storage saved: ~${savings.toFixed(2)} MB`);
    
    console.log('\n✅ PROJECTS optimization complete!');
    
  } catch (error) {
    console.error('❌ Optimization failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

// Run the optimization
optimizeProjects(); 