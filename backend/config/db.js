const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection pooling settings
      maxPoolSize: 10, // Maximum number of connections in the pool (default is 100)
      minPoolSize: 2, // Minimum number of connections to keep alive (keeps connections warm)
      serverSelectionTimeoutMS: 5000, // How long to wait for server selection
      socketTimeoutMS: 45000, // How long to wait for a socket operation
      // Keep connections alive to prevent them from closing
      heartbeatFrequencyMS: 10000, // Send heartbeat every 10 seconds to keep connections alive
    });

    isConnected = true;
    
    // Monitor connection pool status
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected - connection pool ready');
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      isConnected = false;
    });
    
    // Log pool size when connection is established
    const poolSize = mongoose.connection.db?.serverConfig?.connectionPool?.totalConnectionCount || 'unknown';
    console.log(`✅ Connected to MongoDB successfully (pool ready, size: ${poolSize})`);
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

module.exports = connectDB; 