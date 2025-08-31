const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');

// Get all custom data field groups
router.get('/', auth, checkPermission(['admin.view']), async (req, res) => {
  try {
    const groups = await CustomDataFieldGroup.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ type: 1, name: 1 });
    
    res.json(groups);
  } catch (error) {
    console.error('Error fetching custom data field groups:', error);
    res.status(500).json({ message: 'Failed to fetch custom data field groups' });
  }
});

// Get custom data field group by type
router.get('/type/:type', auth, checkPermission(['admin.view']), async (req, res) => {
  try {
    const { type } = req.params;
    const group = await CustomDataFieldGroup.findOne({ 
      type, 
      isActive: true 
    }).populate('createdBy', 'firstName lastName');
    
    if (!group) {
      return res.status(404).json({ message: 'No group found for this type' });
    }
    
    res.json(group);
  } catch (error) {
    console.error(`Error fetching custom data field group for type ${req.params.type}:`, error);
    res.status(500).json({ message: 'Failed to fetch custom data field group' });
  }
});

// Special route for project statuses - only requires projects.view permission
router.get('/project-statuses', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const result = await CustomDataFieldGroup.getProjectStatuses();
    res.json(result);
  } catch (error) {
    console.error('Error fetching project statuses from groups:', error);
    res.status(500).json({ message: 'Failed to fetch project statuses' });
  }
});

// Get fields by type (simplified interface)
router.get('/fields/:type', auth, checkPermission(['admin.view']), async (req, res) => {
  try {
    const { type } = req.params;
    const fields = await CustomDataFieldGroup.getFieldsByType(type);
    res.json(fields);
  } catch (error) {
    console.error(`Error fetching fields for type ${req.params.type}:`, error);
    res.status(500).json({ message: 'Failed to fetch fields' });
  }
});

// Create new custom data field group
router.post('/', auth, checkPermission(['admin.edit']), async (req, res) => {
  try {
    const { name, description, type, fields } = req.body;
    
    if (!name || !type || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ 
        message: 'Name, type, and fields array are required' 
      });
    }
    
    // Check if group already exists for this type
    const existingGroup = await CustomDataFieldGroup.findOne({ type, isActive: true });
    if (existingGroup) {
      return res.status(409).json({ 
        message: `A group already exists for type ${type}` 
      });
    }
    
    // Validate fields
    for (const field of fields) {
      if (!field.text) {
        return res.status(400).json({ 
          message: 'All fields must have text' 
        });
      }
    }
    
    const newGroup = new CustomDataFieldGroup({
      name,
      description,
      type,
      fields: fields.map((field, index) => ({
        ...field,
        order: index,
        createdBy: req.user.id
      })),
      createdBy: req.user.id
    });
    
    const savedGroup = await newGroup.save();
    await savedGroup.populate('createdBy', 'firstName lastName');
    
    res.status(201).json(savedGroup);
  } catch (error) {
    console.error('Error creating custom data field group:', error);
    res.status(500).json({ message: 'Failed to create custom data field group' });
  }
});

// Update custom data field group
router.put('/:id', auth, checkPermission(['admin.edit']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, fields } = req.body;
    
    const group = await CustomDataFieldGroup.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description?.trim();
    
    if (fields && Array.isArray(fields)) {
      // Validate fields
      for (const field of fields) {
        if (!field.text) {
          return res.status(400).json({ 
            message: 'All fields must have text' 
          });
        }
      }
      
      // Update fields with proper ordering
      group.fields = fields.map((field, index) => ({
        ...field,
        order: index,
        createdBy: field.createdBy || req.user.id
      }));
    }
    
    group.updatedAt = new Date();
    await group.save();
    
    await group.populate('createdBy', 'firstName lastName');
    res.json(group);
  } catch (error) {
    console.error('Error updating custom data field group:', error);
    res.status(500).json({ message: 'Failed to update custom data field group' });
  }
});

// Delete custom data field group (soft delete)
router.delete('/:id', auth, checkPermission(['admin.edit']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const group = await CustomDataFieldGroup.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    group.isActive = false;
    group.updatedAt = new Date();
    await group.save();
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom data field group:', error);
    res.status(500).json({ message: 'Failed to delete custom data field group' });
  }
});

module.exports = router;
