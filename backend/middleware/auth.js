const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      // Fetch the full user object from the database
      const user = await User.findById(verified.id);
      if (!user) {
        throw new Error('User not found');
      }
      req.user = user;
      next();
    } catch (verifyError) {
      if (verifyError.name === 'TokenExpiredError') {
        console.log('Token expired, attempting to refresh...');
        // Token is expired, try to refresh
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          const user = await User.findById(decoded.id);
          if (user) {
            console.log('User found, generating new token...');
            const newToken = user.generateAuthToken();
            // Set both cases of the header to ensure compatibility
            res.setHeader('new-token', newToken);
            res.setHeader('New-Token', newToken);
            req.user = user;
            console.log('New token generated and set in headers');
            next();
            return;
          } else {
            console.log('User not found for token refresh');
          }
        } else {
          console.log('Invalid token payload for refresh');
        }
      }
      console.error('Token verification failed:', verifyError.message);
      throw verifyError;
    }
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Token verification failed, authorization denied' });
  }
};

module.exports = auth; 