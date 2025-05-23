const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// Get all projects
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
  console.log('Received project creation request with data:', req.body);
  
  try {
    // Create new project instance
    const project = new Project({
      name: req.body.name,
      client: req.body.client,
      department: req.body.department,
      category: req.body.category,
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
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating project with data:', req.body);
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Update fields
    if (req.body.name) project.name = req.body.name;
    if (req.body.department) project.department = req.body.department;
    if (req.body.category) project.category = req.body.category;
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
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(400).json({ message: err.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
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

module.exports = router; 