const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('Auth Middleware: Incoming request', req.method, req.originalUrl);
    if (!token) {
      console.log('Auth Middleware: No token provided in request');
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }
    console.log('Auth Middleware: Token received');
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Auth Middleware: Token verified, user id:', verified.id);
      // Fetch the full user object from the database
      const user = await User.findById(verified.id);
      if (!user) {
        console.log('Auth Middleware: User not found for id:', verified.id);
        throw new Error('User not found');
      }
      req.user = user;
      console.log('Auth Middleware: User found and attached to req.user:', user.email || user._id);
      next();
    } catch (verifyError) {
      if (verifyError.name === 'TokenExpiredError') {
        console.log('Auth Middleware: Token expired, attempting to refresh...');
        // Token is expired, try to refresh
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          const user = await User.findById(decoded.id);
          if (user) {
            console.log('Auth Middleware: User found for refresh, generating new token...');
            const newToken = user.generateAuthToken();
            // Return 401 with new token to force client to retry with new token
            return res.status(401).json({ 
              message: 'Token expired, please retry with new token',
              newToken: newToken
            });
          } else {
            console.log('Auth Middleware: User not found for token refresh');
            return res.status(401).json({ message: 'User not found for token refresh' });
          }
        } else {
          console.log('Auth Middleware: Invalid token payload for refresh');
          return res.status(401).json({ message: 'Invalid token payload for refresh' });
        }
      }
      console.error('Auth Middleware: Token verification failed:', verifyError.message);
      return res.status(401).json({ message: 'Token verification failed, authorization denied' });
    }
  } catch (err) {
    console.error('Auth Middleware: General error:', err.message);
    return res.status(401).json({ message: 'Token verification failed, authorization denied' });
  }
};

module.exports = auth; 