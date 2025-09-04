const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Add compound indexes for better query performance
const addCompoundIndexes = async () => {
  try {
    console.log('🚀 Starting compound indexes creation...');
    const startTime = Date.now();
    
    // Get the Project collection
    const db = mongoose.connection.db;
    const projectsCollection = db.collection('projects');
    
    // Check existing indexes
    const existingIndexes = await projectsCollection.indexes();
    console.log('📊 Existing indexes:', existingIndexes.map(idx => idx.key));
    
    // 1. Compound index for users + projectID (for /assigned/me endpoint)
    const usersProjectIdIndex = existingIndexes.find(index => 
      index.key && index.key.users === 1 && index.key.projectID === -1
    );
    
    if (!usersProjectIdIndex) {
      console.log('📊 Creating compound index on users + projectID...');
      await projectsCollection.createIndex({ "users": 1, "projectID": -1 });
      console.log('✅ Compound index users + projectID created');
    } else {
      console.log('✅ Compound index users + projectID already exists');
    }
    
    // 2. Compound index for users + createdAt (for sorting by date)
    const usersCreatedAtIndex = existingIndexes.find(index => 
      index.key && index.key.users === 1 && index.key.createdAt === -1
    );
    
    if (!usersCreatedAtIndex) {
      console.log('📊 Creating compound index on users + createdAt...');
      await projectsCollection.createIndex({ "users": 1, "createdAt": -1 });
      console.log('✅ Compound index users + createdAt created');
    } else {
      console.log('✅ Compound index users + createdAt already exists');
    }
    
    // 3. Index on status field (for status filtering)
    const statusIndex = existingIndexes.find(index => 
      index.key && index.key.status === 1
    );
    
    if (!statusIndex) {
      console.log('📊 Creating index on status...');
      await projectsCollection.createIndex({ "status": 1 });
      console.log('✅ Index on status created');
    } else {
      console.log('✅ Index on status already exists');
    }
    
    // 4. Index on department field (for department filtering)
    const departmentIndex = existingIndexes.find(index => 
      index.key && index.key.department === 1
    );
    
    if (!departmentIndex) {
      console.log('📊 Creating index on department...');
      await projectsCollection.createIndex({ "department": 1 });
      console.log('✅ Index on department created');
    } else {
      console.log('✅ Index on department already exists');
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ All compound indexes processed!');
    console.log(`⏱️ Index creation took: ${duration}ms`);
    
    // Verify all indexes
    const newIndexes = await projectsCollection.indexes();
    console.log('📊 Final indexes:', newIndexes.map(idx => idx.key));
    
  } catch (error) {
    console.error('❌ Error creating compound indexes:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await addCompoundIndexes();
    console.log('🎉 Compound indexes migration completed successfully!');
  } catch (error) {
    console.error('💥 Compound indexes migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
};

// Run the migration
main();
