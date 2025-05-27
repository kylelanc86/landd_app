const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { sendMail } = require('../services/mailer');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      firstName,
      lastName,
      email,
      password,
      role: role || 'employee'
    });

    await user.save();

    // Generate token
    const token = user.generateAuthToken();

    res.status(201).json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        notifications: user.notifications
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log('User found:', { id: user._id, email: user.email, role: user.role });

    // Check password
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('User is inactive:', email);
      return res.status(400).json({ message: 'Account is inactive' });
    }

    // Generate token
    try {
      const token = user.generateAuthToken();
      console.log('Token generated successfully');
      
      res.json({
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          notifications: user.notifications
        }
      });
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      throw tokenError;
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user profile
router.patch('/update-profile', auth, async (req, res) => {
  try {
    const { phone, password, notifications } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update phone if provided
    if (phone !== undefined) {
      user.phone = phone;
    }

    // Update password if provided
    if (password) {
      user.password = password;
    }

    // Update notifications if provided
    if (notifications) {
      user.notifications = notifications;
    }

    await user.save();

    // Return updated user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request for email:', email);
  try {
    if (!email) {
      console.error('No email provided in request');
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    console.log('User found:', user ? 'yes' : 'no');
    if (!user) {
      // Always respond with success to prevent email enumeration
      return res.json({ message: 'If this email is registered, you will receive a password reset link.' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    console.log('Generated reset token');
    
    try {
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
      await user.save();
      console.log('Saved reset token to user');
    } catch (saveError) {
      console.error('Error saving reset token:', saveError);
      throw saveError;
    }

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    console.log('Attempting to send email to:', user.email);
    console.log('Email configuration:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE,
      user: process.env.EMAIL_USER ? 'set' : 'not set',
      pass: process.env.EMAIL_PASS ? 'set' : 'not set'
    });

    try {
      await sendMail({
        to: user.email,
        subject: 'Password Reset Request',
        text: `You requested a password reset. Click the link to reset your password: ${resetUrl}`,
        html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a></p>`
      });
      console.log('Email sent successfully');
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      throw emailError;
    }

    res.json({ message: 'If this email is registered, you will receive a password reset link.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      message: 'Error sending password reset email.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body;
  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Error resetting password.' });
  }
});

module.exports = router; 