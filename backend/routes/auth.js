const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const crypto = require('crypto');
const { sendMail } = require('../services/mailer');
const TokenBlacklist = require('../models/TokenBlacklist');

// Use global fetch if available (Node.js 18+), otherwise use node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}


// Update the loadLogoAsBase64 function
async function loadLogoAsBase64() {
  try {
    console.log('Attempting to load logo from:', `${process.env.FRONTEND_URL}/logo.png`);
    
    if (!process.env.FRONTEND_URL) {
      console.warn('FRONTEND_URL not set, skipping logo loading');
      return null;
    }
    
    const response = await fetch(`${process.env.FRONTEND_URL}/logo.png`);
    if (!response.ok) {
      console.warn(`Logo fetch failed with status: ${response.status}`);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    console.log('Logo loaded successfully, size:', buffer.byteLength);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error loading logo:', error.message);
    // Don't fail the entire request if logo loading fails
    return null;
  }
}

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
        notifications: user.notifications,
        labSignatory: user.labSignatory || false
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

    // Check if user has set up their password
    if (!user.passwordSet) {
      console.log('User has not set up password:', email);
      return res.status(400).json({ message: 'Please check your email and set up your password before logging in.' });
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
          notifications: user.notifications,
          labSignatory: user.labSignatory || false
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
    
    // Ensure labSignatory field is present for backward compatibility
    if (user && user.labSignatory === undefined) {
      user.labSignatory = false;
    }
    
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
    const logoBase64 = await loadLogoAsBase64();
    // Use FRONTEND_URL environment variable, fallback to production URL if not set
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.landd.com.au';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    console.log('Attempting to send email to:', user.email);
    console.log('Using frontend URL for reset:', frontendUrl);
    console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
    console.log('Email configuration:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE,
      user: process.env.EMAIL_USER ? 'set' : 'not set',
      pass: process.env.EMAIL_PASS ? 'set' : 'not set'
    });

    try {
      await sendMail({
        from: "L&D APP ADMIN",
        to: user.email,
        subject: 'Password Reset Request - L&D Consulting',
        text: `You requested a password reset. Click the link to reset your password: ${resetUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
              <div style="text-align: left;">
                <h1 style="color:rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting</h1>
              </div>
              <div style="text-align: right;">
                ${logoBase64 ? `<img src="${logoBase64}" alt="L&D Consulting Logo" style="height: 60px; width: 150px;">` : ''}
              </div>
            </div>
            <div style="color: #333; line-height: 1.6;">
              <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Password Reset Request</h2>
              <p>Hello,</p>
              <p>We received a request to reset the password for your L&D Consulting account. If you didn't make this request, you can safely ignore this email.</p>
              <p>To reset your password, click the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
              </div>
              <p>This link will expire in 1 hour for security reasons.</p>
              <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email. If you need assistance, please contact our support team.</p>
            </div>
          </div>
        `
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

// Validate Reset Password Token
router.post('/validate-reset-token', async (req, res) => {
  const { email, token } = req.body;
  console.log('Token validation request:');
  console.log('  Email:', email);
  console.log('  Token (first 8 chars):', token ? token.substring(0, 8) + '...' : 'NOT PROVIDED');
  
  try {
    if (!email || !token) {
      console.error('Missing required fields for token validation');
      return res.status(400).json({ message: 'Email and token are required.' });
    }

    // Normalize email to prevent case-sensitivity issues
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Normalized email:', normalizedEmail);

    // Find user with matching email, token, and check if token is not expired
    const user = await User.findOne({
      email: normalizedEmail,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('Invalid or expired reset token for email:', normalizedEmail);
      return res.status(400).json({ 
        message: 'Invalid or expired token.',
        expired: true 
      });
    }

    console.log('Valid reset token found for user:', {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    res.json({ 
      message: 'Token is valid.',
      valid: true 
    });
  } catch (err) {
    console.error('Token validation error:', err);
    res.status(500).json({ message: 'Error validating token.' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body;
  console.log('Password reset attempt:');
  console.log('  Email:', email);
  console.log('  Token (first 8 chars):', token ? token.substring(0, 8) + '...' : 'NOT PROVIDED');
  
  try {
    if (!email || !token || !password) {
      console.error('Missing required fields for password reset');
      return res.status(400).json({ message: 'Email, token, and password are required.' });
    }

    // Normalize email to prevent case-sensitivity issues
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Normalized email:', normalizedEmail);

    // CRITICAL SECURITY CHECK: Find ALL users with this token
    const allUsersWithToken = await User.find({ resetPasswordToken: token });
    console.log('SECURITY CHECK: Found', allUsersWithToken.length, 'users with this token');
    
    if (allUsersWithToken.length > 1) {
      console.error('CRITICAL SECURITY ISSUE: Multiple users have the same reset token!');
      console.error('Users with token:', allUsersWithToken.map(u => ({ id: u._id, email: u.email })));
      
      // Invalidate all tokens for security
      for (const user of allUsersWithToken) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        console.log('Invalidated token for user:', user.email);
      }
      
      return res.status(500).json({ 
        message: 'Security issue detected. Please request a new password reset link.' 
      });
    }

    // DATABASE DEBUGGING: Log the exact query being executed
    const query = {
      email: normalizedEmail,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    };
    console.log('DATABASE QUERY DEBUG:');
    console.log('  Query:', JSON.stringify(query, null, 2));
    console.log('  Normalized email:', normalizedEmail);
    console.log('  Token (first 8 chars):', token.substring(0, 8) + '...');
    console.log('  Current timestamp:', new Date().toISOString());
    console.log('  Expiry threshold:', new Date(Date.now()).toISOString());

    // Find user by email and token with strict validation
    const user = await User.findOne(query);
    
    // DATABASE DEBUGGING: Log what was found
    if (user) {
      console.log('DATABASE RESULT: User found successfully');
      console.log('  User ID:', user._id);
      console.log('  User email:', user.email);
      console.log('  User resetPasswordToken:', user.resetPasswordToken ? user.resetPasswordToken.substring(0, 8) + '...' : 'NULL');
      console.log('  User resetPasswordExpires:', user.resetPasswordExpires ? new Date(user.resetPasswordExpires).toISOString() : 'NULL');
    } else {
      console.log('DATABASE RESULT: No user found with query');
      
      // Additional debugging: Check if user exists at all
      const userByEmail = await User.findOne({ email: normalizedEmail });
      if (userByEmail) {
        console.log('DEBUG: User exists but token/expiry mismatch');
        console.log('  User ID:', userByEmail._id);
        console.log('  User email:', userByEmail.email);
        console.log('  User resetPasswordToken:', userByEmail.resetPasswordToken ? userByEmail.resetPasswordToken.substring(0, 8) + '...' : 'NULL');
        console.log('  User resetPasswordExpires:', userByEmail.resetPasswordExpires ? new Date(userByEmail.resetPasswordExpires).toISOString() : 'NULL');
      } else {
        console.log('DEBUG: No user found with email:', normalizedEmail);
      }
      
      // Check if token exists for any user
      const userByToken = await User.findOne({ resetPasswordToken: token });
      if (userByToken) {
        console.log('DEBUG: Token exists for different user');
        console.log('  User ID:', userByToken._id);
        console.log('  User email:', userByToken.email);
        console.log('  User resetPasswordToken:', userByToken.resetPasswordToken ? userByToken.resetPasswordToken.substring(0, 8) + '...' : 'NULL');
        console.log('  User resetPasswordExpires:', userByToken.resetPasswordExpires ? new Date(userByToken.resetPasswordExpires).toISOString() : 'NULL');
      } else {
        console.log('DEBUG: No user found with token');
      }
    }

    if (!user) {
      console.log('Invalid or expired reset token for email:', normalizedEmail);
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }

    console.log('Valid reset token found for user:', {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    // Additional security: Verify the token matches exactly
    if (user.resetPasswordToken !== token) {
      console.error('Token mismatch for user:', user._id);
      return res.status(400).json({ message: 'Invalid token.' });
    }

    // Additional security: Verify the email matches exactly
    if (user.email.toLowerCase() !== normalizedEmail) {
      console.error('Email mismatch for user:', user._id);
      return res.status(400).json({ message: 'Invalid email.' });
    }

    // Store the old password hash for audit purposes (but don't expose it)
    const oldPasswordHash = user.password.substring(0, 10) + '...';
    
    // Set the new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Mark that password has been set (for new users)
    if (!user.passwordSet) {
      user.passwordSet = true;
    }
    
    await user.save();
    console.log('Password successfully reset for user:', {
      id: user._id,
      email: user.email,
      oldPasswordHash: oldPasswordHash
    });
    
    // SECURITY: Blacklist all existing JWT tokens for this user
    // Note: We can't blacklist specific JWT tokens since we don't store them
    // But we can log this for audit purposes and implement future token storage
    console.log('SECURITY: Password changed for user, all existing sessions should be invalidated');
    console.log('User ID for token blacklisting:', user._id);
    
    // TODO: Implement JWT token storage and blacklisting
    // For now, we'll rely on JWT expiration and frontend token clearing
    
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Error resetting password.' });
  }
});

// Setup Password for New Users
router.post('/setup-password', async (req, res) => {
  const { email, token, password } = req.body;
  try {
    const user = await User.findOne({
      email,
      setupPasswordToken: token,
      setupPasswordExpires: { $gt: Date.now() },
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired setup token.' });
    }
    
    if (user.passwordSet) {
      return res.status(400).json({ message: 'Password has already been set for this account.' });
    }
    
    // Set the password and mark as set
    user.password = password;
    user.setupPasswordToken = undefined;
    user.setupPasswordExpires = undefined;
    user.passwordSet = true;
    
    await user.save();
    
    // SECURITY: Log that a new password was set
    console.log('SECURITY: New password set for user:', {
      id: user._id,
      email: user.email
    });
    console.log('Note: This is a new user setup, no existing sessions to invalidate');
    
    res.json({ message: 'Password has been set successfully. You can now log in.' });
  } catch (err) {
    console.error('Setup password error:', err);
    res.status(500).json({ message: 'Error setting up password.' });
  }
});

// Admin-triggered password reset
router.post('/admin-reset-password', auth, checkPermission(['users.manage']), async (req, res) => {
  const { email } = req.body;
  const adminUser = req.user;
  
  console.log('Admin reset password request:');
  console.log('  Admin user:', adminUser.email, adminUser._id);
  console.log('  Target email:', email);
  
  try {
    if (!email) {
      console.error('No email provided in admin reset password request');
      return res.status(400).json({ message: 'Email is required' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Prevent admin from accidentally resetting their own password
    if (normalizedEmail === adminUser.email.toLowerCase()) {
      console.warn('Admin attempted to reset their own password via admin endpoint');
      return res.status(400).json({ 
        message: 'Please use the regular password reset for your own account.' 
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    console.log('User found for reset:', user ? `yes (${user._id})` : 'no');
    
    if (!user) {
      // Always respond with success to prevent email enumeration
      console.log('No user found for email:', normalizedEmail);
      return res.json({ message: 'If this email is registered, a password reset link will be sent.' });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('User is inactive, cannot send reset email:', normalizedEmail);
      return res.status(400).json({ message: 'Cannot send password reset to inactive users.' });
    }

    // Generate token
    let token = crypto.randomBytes(32).toString('hex');
    console.log('Generated reset token for admin reset');
    
    // CRITICAL SECURITY: Ensure no other user has this token
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const existingTokenUser = await User.findOne({ resetPasswordToken: token });
      if (!existingTokenUser) {
        console.log('Token is unique, proceeding...');
        break;
      }
      
      console.error(`Token collision detected (attempt ${attempts + 1}), regenerating...`);
      console.error('Colliding user:', existingTokenUser.email, existingTokenUser._id);
      
      // Regenerate token
      token = crypto.randomBytes(32).toString('hex');
      attempts++;
      
      if (attempts >= maxAttempts) {
        console.error('Failed to generate unique token after', maxAttempts, 'attempts');
        return res.status(500).json({ 
          message: 'Unable to generate secure reset token. Please try again.' 
        });
      }
    }
    
    // Additional security: Clear any existing reset tokens for this user
    if (user.resetPasswordToken) {
      console.log('Clearing existing reset token for user:', user.email);
    }
    
    // Clear any existing reset tokens
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
    
    await user.save();
    console.log('Saved reset token to user:', user._id);

    // Send email using existing forgot password template
    console.log('Loading logo for email');
    const logoBase64 = await loadLogoAsBase64();
    console.log('Logo loaded:', logoBase64 ? 'success' : 'failed');
    
    // Use FRONTEND_URL environment variable, fallback to production URL if not set
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.landd.com.au';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
    console.log('Reset URL generated:', resetUrl);
    console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
    
    console.log('Sending email to:', user.email);
    await sendMail({
      from: "L&D APP ADMIN",
      to: user.email,
      subject: 'Password Reset Request - L&D Consulting',
      text: `A password reset was requested for your L&D Consulting account. Click the link to reset your password: ${resetUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <div style="text-align: left;">
              <h1 style="color:rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting</h1>
            </div>
            <div style="text-align: right;">
              ${logoBase64 ? `<img src="${logoBase64}" alt="L&D Consulting Logo" style="height: 60px; width: 150px;">` : ''}
            </div>
          </div>
          <div style="color: #333; line-height: 1.6;">
            <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Password Reset Request</h2>
            <p>Hello ${user.firstName},</p>
            <p>A password reset was requested for your L&D Consulting account by an administrator. If you didn't make this request, you can safely ignore this email.</p>
            <p>To reset your password, click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email. If you need assistance, please contact our support team.</p>
          </div>
        </div>
      `
    });
    console.log('Email sent successfully to:', user.email);

    res.json({ message: 'Password reset email has been sent successfully.' });
  } catch (err) {
    console.error('Admin reset password error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      message: 'Error sending password reset email.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router; 