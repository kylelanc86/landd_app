const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Get the users collection
    const usersCollection = db.collection('users');
    
    // Update all existing users to add the new fields
    const result = await usersCollection.updateMany(
      {}, // Update all documents
      {
        $set: {
          licences: [],
          signature: ""
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users with new fields`);
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the connection
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}); 