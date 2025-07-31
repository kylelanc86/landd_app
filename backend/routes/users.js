const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

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
    const { firstName, lastName, email, password, role, phone, licences, signature, workingHours, labApprovals } = req.body;

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
      isActive: true
    });

    await user.save();

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