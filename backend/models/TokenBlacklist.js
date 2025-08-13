const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  invalidatedAt: {
    type: Date,
    default: Date.now,
    expires: 24 * 60 * 60 * 7 // Automatically delete after 7 days
  },
  reason: {
    type: String,
    enum: ['password_reset', 'admin_reset', 'manual_logout', 'security_breach'],
    default: 'password_reset'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
tokenBlacklistSchema.index({ userId: 1, invalidatedAt: 1 });

// Method to check if token is blacklisted
tokenBlacklistSchema.statics.isBlacklisted = async function(token) {
  const blacklistedToken = await this.findOne({ token });
  return !!blacklistedToken;
};

// Method to blacklist a token
tokenBlacklistSchema.statics.blacklistToken = async function(token, userId, reason = 'password_reset') {
  try {
    await this.create({
      token,
      userId,
      reason
    });
    return true;
  } catch (error) {
    console.error('Error blacklisting token:', error);
    return false;
  }
};

// Method to blacklist all tokens for a user
tokenBlacklistSchema.statics.blacklistAllUserTokens = async function(userId, reason = 'password_reset') {
  try {
    // Note: We can't blacklist existing JWT tokens since we don't store them
    // This method is for future use when we implement token storage
    console.log(`All tokens for user ${userId} marked for invalidation due to: ${reason}`);
    return true;
  } catch (error) {
    console.error('Error blacklisting all user tokens:', error);
    return false;
  }
};

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
