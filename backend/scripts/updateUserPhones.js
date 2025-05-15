const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

async function updateUserPhones() {
  try {
    // First, let's see what users we have
    const users = await User.find();
    console.log('Current users:', users.map(u => ({ email: u.email, phone: u.phone })));

    // Update all users to ensure they have the phone field
    const result = await User.updateMany(
      { phone: { $exists: false } },
      { $set: { phone: '' } }
    );

    console.log(`Updated ${result.modifiedCount} users to include phone field`);

    // Verify the changes
    const updatedUsers = await User.find();
    console.log('Updated users:', updatedUsers.map(u => ({ email: u.email, phone: u.phone })));

    process.exit(0);
  } catch (error) {
    console.error('Error updating user phones:', error);
    process.exit(1);
  }
}

updateUserPhones(); 