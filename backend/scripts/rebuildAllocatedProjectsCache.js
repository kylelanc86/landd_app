const mongoose = require('mongoose');
require('dotenv').config();

const allocatedProjectsService = require('../services/allocatedProjectsService');

async function rebuildCache() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔄 Starting allocated projects cache rebuild...');
    console.log('='.repeat(60));
    
    // Rebuild the cache
    await allocatedProjectsService.rebuildAllUsersCache();
    
    console.log('='.repeat(60));
    console.log('✅ Cache rebuild completed successfully!');
    
  } catch (error) {
    console.error('❌ Error rebuilding cache:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
rebuildCache();

