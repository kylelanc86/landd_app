const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.log('No auth token for request:', req.path);
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
        return res.status(401).json({
          message: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        });
      }
      return res.status(401).json({ message: 'Token verification failed, authorization denied' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed, authorization denied' });
  }
};

module.exports = auth; 