const mongoose = require('mongoose');
const TokenBlacklist = require('../models/TokenBlacklist');
require('dotenv').config();

/**
 * Script to clean up expired tokens from the token blacklist
 * This can be run manually or scheduled as a cron job
 */
async function cleanupTokenBlacklist() {
  try {
    console.log('Starting token blacklist cleanup...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to database');
    
    // Find and delete expired tokens
    const now = new Date();
    const result = await TokenBlacklist.deleteMany({
      invalidatedAt: { $lt: now }
    });
    
    console.log(`Cleanup completed. Removed ${result.deletedCount} expired tokens.`);
    
    // Get current blacklist stats
    const totalTokens = await TokenBlacklist.countDocuments();
    console.log(`Total tokens remaining in blacklist: ${totalTokens}`);
    
    // Show breakdown by reason
    const breakdown = await TokenBlacklist.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('Blacklist breakdown by reason:');
    breakdown.forEach(item => {
      console.log(`  ${item._id}: ${item.count} tokens`);
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupTokenBlacklist();
}

module.exports = cleanupTokenBlacklist;
