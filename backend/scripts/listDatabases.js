const mongoose = require('mongoose');
require('dotenv').config();

async function listDatabases() {
  try {
    console.log('Connecting to MongoDB cluster...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!\n');

    // Get all databases
    const adminDb = mongoose.connection.db.admin();
    const dbList = await adminDb.listDatabases();
    
    console.log('Available databases in cluster:');
    dbList.databases.forEach(db => {
      console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

listDatabases(); 