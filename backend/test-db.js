const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

// Load environment variables
dotenv.config();

const testConnection = async () => {
  try {
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    console.log('Attempting to connect to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB successfully');
    
    // List all users
    const users = await User.find({});
    console.log('\nUsers in database:');
    console.log(JSON.stringify(users, null, 2));
    
    // Test specific user
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    console.log('\nAdmin user details:');
    console.log(adminUser ? JSON.stringify(adminUser, null, 2) : 'Admin user not found');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testConnection(); 