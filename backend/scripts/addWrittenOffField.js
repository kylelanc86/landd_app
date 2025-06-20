const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Client = require('../models/Client');

// Load environment variables
dotenv.config();

async function addWrittenOffField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Update all existing clients to have written_off field set to false
    const result = await Client.updateMany(
      { written_off: { $exists: false } },
      { $set: { written_off: false } }
    );

    console.log(`Updated ${result.modifiedCount} clients with written_off field`);
    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the migration
addWrittenOffField(); 