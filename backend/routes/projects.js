const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// Get all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find()
      .select('projectID name client type status address startDate endDate description projectManager createdAt updatedAt')
      .populate('client')
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
    const project = await Project.findById(req.params.id).populate('client');
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
      type: req.body.type,
      status: req.body.status,
      address: req.body.address,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      description: req.body.description,
      projectManager: req.body.projectManager || undefined
    });

    console.log('Created project instance:', project.toObject());
    
    // Save the project (this will trigger the pre-save hook)
    const newProject = await project.save();
    console.log('Project saved successfully:', newProject.toObject());
    
    res.status(201).json(newProject);
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
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Update only the fields that are provided
    Object.keys(req.body).forEach(key => {
      if (key !== 'projectID') { // Prevent projectID from being updated
        project[key] = req.body[key];
      }
    });

    const updatedProject = await project.save();
    res.json(updatedProject);
  } catch (err) {
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