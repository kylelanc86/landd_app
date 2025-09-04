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

// Add index on users field for Project collection
const addUsersIndex = async () => {
  try {
    console.log('🚀 Starting users index creation...');
    const startTime = Date.now();
    
    // Get the Project collection
    const db = mongoose.connection.db;
    const projectsCollection = db.collection('projects');
    
    // Check if index already exists
    const existingIndexes = await projectsCollection.indexes();
    const usersIndexExists = existingIndexes.some(index => 
      index.key && index.key.users === 1
    );
    
    if (usersIndexExists) {
      console.log('✅ Users index already exists, skipping...');
      return;
    }
    
    // Create the index
    console.log('📊 Creating index on users field...');
    await projectsCollection.createIndex({ "users": 1 });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Users index created successfully!');
    console.log(`⏱️ Index creation took: ${duration}ms`);
    
    // Verify the index was created
    const newIndexes = await projectsCollection.indexes();
    const usersIndex = newIndexes.find(index => 
      index.key && index.key.users === 1
    );
    
    if (usersIndex) {
      console.log('✅ Index verification successful:', usersIndex);
    } else {
      console.log('❌ Index verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error creating users index:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await addUsersIndex();
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
};

// Run the migration
main();
