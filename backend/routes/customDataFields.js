const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const CustomDataField = require('../models/CustomDataField');

// Get all custom data fields by type
router.get('/:type', auth, checkPermission(['admin.view']), async (req, res) => {
  try {
    const { type } = req.params;
    
    // Validate type
    const validTypes = ['asbestos_removalist', 'location_description', 'materials_description', 'room_area', 'legislation', 'project_status'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type parameter' });
    }

    const fields = await CustomDataField.find({ 
      type, 
      isActive: true 
    })
    .sort({ text: 1 })
    .populate('createdBy', 'firstName lastName');

    res.json(fields);
  } catch (error) {
    console.error('Error fetching custom data fields:', error);
    res.status(500).json({ message: 'Failed to fetch custom data fields' });
  }
});

// Create new custom data field
router.post('/', auth, checkPermission(['admin.edit']), async (req, res) => {
  try {
            const { type, text, legislationTitle, jurisdiction, isActiveStatus, statusColor } = req.body;
    
    console.log('Creating custom data field:', { type, text, legislationTitle, jurisdiction });
    
    if (!type || !text) {
      return res.status(400).json({ message: 'Type and text are required' });
    }

    // Validate type
    const validTypes = ['asbestos_removalist', 'location_description', 'materials_description', 'room_area', 'legislation', 'project_status'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type parameter' });
    }

    // No duplicate checking - just create the field

    const newFieldData = {
      type,
      text: text.trim(),
      createdBy: req.user.id
    };

    // Add legislation fields if they exist
    if (legislationTitle) newFieldData.legislationTitle = legislationTitle.trim();
    if (jurisdiction) newFieldData.jurisdiction = jurisdiction.trim();
    
    // Add isActiveStatus field for project_status type
            if (type === 'project_status' && isActiveStatus !== undefined) {
          newFieldData.isActiveStatus = isActiveStatus;
        }
        if (type === 'project_status' && statusColor) {
          newFieldData.statusColor = statusColor;
        }

    const newField = new CustomDataField(newFieldData);

    const savedField = await newField.save();
    await savedField.populate('createdBy', 'firstName lastName');
    
    res.status(201).json(savedField);
  } catch (error) {
    console.error('Error creating custom data field:', error);
    if (error.code === 11000) {
      res.status(409).json({ message: 'This field already exists' });
    } else {
      res.status(500).json({ message: 'Failed to create custom data field' });
    }
  }
});

// Update custom data field
router.put('/:id', auth, checkPermission(['admin.edit']), async (req, res) => {
  try {
            const { id } = req.params;
        const { text, legislationTitle, jurisdiction, isActiveStatus, statusColor } = req.body;
    
    console.log('Updating custom data field:', { id, text, legislationTitle, jurisdiction });
    
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const field = await CustomDataField.findById(id);
    if (!field) {
      return res.status(404).json({ message: 'Field not found' });
    }

    // For legislation, ensure all required fields are provided
    if (field.type === 'legislation') {
      if (!legislationTitle || !jurisdiction) {
        return res.status(400).json({ 
          message: 'Legislation Title and Jurisdiction are required for legislation items' 
        });
      }
    }
    if (!field) {
      return res.status(404).json({ message: 'Field not found' });
    }

    // No need for manual duplicate checking - the database indexes handle this automatically

    field.text = text.trim();
    
    // Update legislation fields if they exist
    if (legislationTitle !== undefined) field.legislationTitle = legislationTitle.trim();
    if (jurisdiction !== undefined) field.jurisdiction = jurisdiction.trim();
    
    // Update isActiveStatus field for project_status type
            if (field.type === 'project_status' && isActiveStatus !== undefined) {
          field.isActiveStatus = isActiveStatus;
        }
        if (field.type === 'project_status' && statusColor) {
          field.statusColor = statusColor;
        }
    
    field.updatedAt = new Date();
    await field.save();
    
    await field.populate('createdBy', 'firstName lastName');
    res.json(field);
  } catch (error) {
    console.error('Error updating custom data field:', error);
    console.error('Error details:', {
      id: req.params.id,
      text: req.body.text,
      legislationTitle: req.body.legislationTitle,
      jurisdiction: req.body.jurisdiction,
      errorMessage: error.message,
      errorStack: error.stack
    });
    res.status(500).json({ message: 'Failed to update custom data field' });
  }
});

// Delete custom data field (soft delete)
router.delete('/:id', auth, checkPermission(['admin.edit']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const field = await CustomDataField.findById(id);
    if (!field) {
      return res.status(404).json({ message: 'Field not found' });
    }

    // Soft delete by setting isActive to false
    field.isActive = false;
    await field.save();
    
    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom data field:', error);
    res.status(500).json({ message: 'Failed to delete custom data field' });
  }
});

// Get all custom data fields (for admin view)
router.get('/', auth, checkPermission(['admin.view']), async (req, res) => {
  try {
    const fields = await CustomDataField.find({ isActive: true })
      .sort({ type: 1, text: 1 })
      .populate('createdBy', 'firstName lastName');

    res.json(fields);
  } catch (error) {
    console.error('Error fetching all custom data fields:', error);
    res.status(500).json({ message: 'Failed to fetch custom data fields' });
  }
});

module.exports = router;
