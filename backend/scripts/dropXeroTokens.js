const mongoose = require('mongoose');
require('dotenv').config();

async function dropXeroTokens() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/landd');
    console.log('Connected to MongoDB');

    // Drop the xerotokens collection
    await mongoose.connection.db.dropCollection('xerotokens');
    console.log('Successfully dropped xerotokens collection');

    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropXeroTokens(); 