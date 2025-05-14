const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Database name:', process.env.MONGODB_URI.split('/').pop().split('?')[0]);
    
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    isConnected = true;
    console.log('Connected to MongoDB successfully');
    console.log('Database name:', db.connection.db.databaseName);
    console.log('Available collections:', Object.keys(db.connection.collections));
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

module.exports = connectDB; 