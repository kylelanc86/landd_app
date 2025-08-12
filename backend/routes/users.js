const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const crypto = require('crypto');
const { sendMail } = require('../services/mailer');

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

// Get all users
router.get('/', auth, checkPermission(['users.view']), async (req, res) => {
  try {
    const query = {};
    
    // If isActive parameter is provided, filter by active status
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new user
router.post('/', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, role, phone, licences, signature, workingHours, labApprovals } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate setup password token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupExpires = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    // Create new user without password
    user = new User({
      firstName,
      lastName,
      email,
      password: crypto.randomBytes(32).toString('hex'), // Temporary random password
      role: role || 'employee',
      phone,
      licences: licences || [],
      signature: signature || '',
      workingHours: workingHours || {
        monday: { enabled: false, hours: 0 },
        tuesday: { enabled: false, hours: 0 },
        wednesday: { enabled: false, hours: 0 },
        thursday: { enabled: false, hours: 0 },
        friday: { enabled: false, hours: 0 },
        saturday: { enabled: false, hours: 0 },
        sunday: { enabled: false, hours: 0 }
      },
      labApprovals: labApprovals || {
        fibreCounting: false,
        fibreIdentification: false
      },
      isActive: true,
      setupPasswordToken: setupToken,
      setupPasswordExpires: setupExpires,
      passwordSet: false
    });

    await user.save();

    // Send welcome email with setup link
    try {
      const logoBase64 = await loadLogoAsBase64();
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const setupUrl = `${frontendUrl}/setup-password?token=${setupToken}&email=${encodeURIComponent(email)}`;
      
      await sendMail({
        from: "L&D APP ADMIN",
        to: user.email,
        subject: 'Welcome to L&D Consulting - Set Up Your Account',
        text: `Welcome to L&D Consulting! Please click the link to set up your account password: ${setupUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
              <div style="text-align: left;">
                <h1 style="color:rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
              </div>
              <div style="text-align: right;">
                ${logoBase64 ? `<img src="${logoBase64}" alt="L&D Consulting Logo" style="height: 60px; width: 150px;">` : ''}
              </div>
            </div>
            <div style="color: #333; line-height: 1.6;">
              <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Welcome to L&D Consulting!</h2>
              <p>Hello ${firstName},</p>
              <p>Your account has been created successfully. To get started, you need to set up your password.</p>
              <p>Click the button below to securely set up your account password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${setupUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Up Password</a>
              </div>
              <p>This link will expire in 24 hours for security reasons.</p>
              <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 14px;">${setupUrl}</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email. If you need assistance, please contact our support team.</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail user creation if email fails
    }

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user
router.put('/:id', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, role, phone, isActive, licences, signature, workingHours, labApprovals } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (role) user.role = role;
    // Always update phone field, even if it's an empty string
    user.phone = phone || '';
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (licences !== undefined) user.licences = licences;
    if (signature !== undefined) user.signature = signature;
    if (workingHours !== undefined) user.workingHours = workingHours;
    if (labApprovals !== undefined) user.labApprovals = labApprovals;

    await user.save();

    // Return updated user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete user
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Instead of deleting, set isActive to false
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user preferences
router.get('/preferences/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('userPreferences');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.userPreferences || {});
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ message: 'Error fetching preferences' });
  }
});

// Update user preferences
router.put('/preferences/me', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { userPreferences: req.body },
      { new: true, runValidators: true }
    ).select('userPreferences');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.userPreferences || {});
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ message: 'Error updating preferences' });
  }
});

module.exports = router; 