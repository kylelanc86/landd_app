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

async function updateUserRoles() {
  try {
    // First, let's see what users we have
    const users = await User.find();
    console.log('Current users:', users.map(u => ({ email: u.email, role: u.role })));

    // Update specific users with their roles
    const updates = [
      { email: 'kylelanc86@gmail.com', role: 'admin' },
      { email: 'jordan@landd.com.au', role: 'manager' }
    ];

    for (const update of updates) {
      const result = await User.updateOne(
        { email: update.email },
        { $set: { role: update.role } }
      );
      console.log(`Updated ${update.email} to ${update.role}:`, result);
    }

    // Verify the changes
    const updatedUsers = await User.find();
    console.log('Updated users:', updatedUsers.map(u => ({ email: u.email, role: u.role })));

    process.exit(0);
  } catch (error) {
    console.error('Error updating user roles:', error);
    process.exit(1);
  }
}

updateUserRoles(); 