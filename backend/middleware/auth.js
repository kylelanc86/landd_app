const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      // Fetch the full user object from the database
      const user = await User.findById(verified.id);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Store the token in req for blacklist checking
      req.token = token;
      req.user = user;
      next();
    } catch (verifyError) {
      if (verifyError.name === 'TokenExpiredError') {
        // Token is expired, try to refresh
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          const user = await User.findById(decoded.id);
          if (user) {
            const newToken = user.generateAuthToken();
            // Return 401 with new token to force client to retry with new token
            return res.status(401).json({ 
              message: 'Token expired, please retry with new token',
              newToken: newToken
            });
          } else {
            return res.status(401).json({ message: 'User not found for token refresh' });
          }
        } else {
          return res.status(401).json({ message: 'Invalid token payload for refresh' });
        }
      }
      return res.status(401).json({ message: 'Token verification failed, authorization denied' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed, authorization denied' });
  }
};

module.exports = auth; 