const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * Middleware to check if a JWT token is blacklisted
 * This should be used after the auth middleware that decodes the JWT
 */
const checkTokenBlacklist = async (req, res, next) => {
  try {
    console.log('CheckTokenBlacklist middleware hit for:', req.path);
    // Get the token from the request (should be set by auth middleware)
    const token = req.token;
    
    if (!token) {
      console.log('No token in checkTokenBlacklist for:', req.path);
      return res.status(401).json({ 
        message: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    
    if (isBlacklisted) {
      console.log(`Blacklisted token detected for user: ${req.user?._id}`);
      return res.status(401).json({ 
        message: 'Session has expired. Please log in again.',
        code: 'TOKEN_BLACKLISTED'
      });
    }

    // Token is valid, proceed
    next();
  } catch (error) {
    console.error('Error checking token blacklist:', error);
    // If there's an error checking the blacklist, allow the request to proceed
    // This prevents the blacklist from becoming a single point of failure
    next();
  }
};

module.exports = checkTokenBlacklist;
