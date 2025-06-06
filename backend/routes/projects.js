const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const User = require('../models/User');
const Timesheet = require('../models/Timesheet');

// Get all projects
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const projects = await Project.find()
      .select('projectID name client department category status address startDate endDate description users createdAt updatedAt')
      .populate('client')
      .populate('users')
      .sort({ createdAt: -1 });
    
    console.log('Projects being sent to frontend:', JSON.stringify(projects.map(p => ({
      id: p._id,
      projectID: p.projectID,
      name: p.name
    })), null, 2));
    
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get single project
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client')
      .populate('users');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create project
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  console.log('Received project creation request with data:', req.body);
  
  try {
    // Create new project instance
    const project = new Project({
      name: req.body.name,
      client: req.body.client,
      department: req.body.department,
      categories: req.body.categories || [],
      status: req.body.status,
      address: req.body.address,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      description: req.body.description,
      users: req.body.users || []
    });

    console.log('Created project instance:', project.toObject());
    
    // Save the project (this will trigger the pre-save hook)
    const newProject = await project.save();
    console.log('Project saved successfully:', newProject.toObject());
    
    // Populate the users before sending response
    const populatedProject = await Project.findById(newProject._id)
      .populate('client')
      .populate('users');
    
    res.status(201).json(populatedProject);
  } catch (err) {
    console.error('Error saving project:', err);
    if (err.errors) {
      console.error('Validation errors:', err.errors);
    }
    res.status(400).json({ 
      message: err.message,
      validationErrors: err.errors,
      details: 'Project creation failed'
    });
  }
});

// Update project
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    console.log('Updating project with data:', req.body);
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if status is being changed
    if (req.body.status && req.body.status !== project.status) {
      // Require additional permission for status changes
      const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];
      if (!rolePermissions.includes('projects.change_status')) {
        return res.status(403).json({ 
          message: 'You do not have permission to change project status',
          required: ['projects.change_status']
        });
      }
    }

    // If users are being updated, validate that all users are active
    if (req.body.users) {
      const userIds = Array.isArray(req.body.users) ? req.body.users : [];
      const users = await User.find({ _id: { $in: userIds } });
      const inactiveUsers = users.filter(user => !user.isActive);
      
      if (inactiveUsers.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot assign inactive users to projects',
          inactiveUsers: inactiveUsers.map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`
          }))
        });
      }
    }

    // Update fields
    if (req.body.name) project.name = req.body.name;
    if (req.body.department) project.department = req.body.department;
    if (req.body.categories) project.categories = req.body.categories;
    if (req.body.status) project.status = req.body.status;
    if (req.body.address) project.address = req.body.address;
    if (req.body.startDate) project.startDate = req.body.startDate;
    if (req.body.endDate) project.endDate = req.body.endDate;
    if (req.body.description) project.description = req.body.description;
    
    // Always update users array, defaulting to empty array if not provided
    project.users = Array.isArray(req.body.users) ? req.body.users : [];
    console.log('Updated users array:', project.users);

    const updatedProject = await project.save();
    
    // Populate the users before sending response
    const populatedProject = await Project.findById(updatedProject._id)
      .populate('client')
      .populate('users');
    
    console.log('Updated project:', populatedProject.toObject());
    res.json(populatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete project
router.delete('/:id', auth, checkPermission(['projects.delete']), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await project.deleteOne();
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get time logs for a project
router.get('/:id/timelogs', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const timesheets = await Timesheet.find({ projectId: req.params.id })
      .populate('userId', 'firstName lastName')
      .sort({ date: -1, startTime: -1 });
    
    res.json(timesheets);
  } catch (err) {
    console.error('Error fetching project time logs:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 