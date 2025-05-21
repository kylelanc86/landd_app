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
      req.user = verified;
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
            res.setHeader('New-Token', newToken);
            req.user = decoded;
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