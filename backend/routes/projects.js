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
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      department,
      status
    } = req.query;

    console.log('=== BACKEND PROJECTS REQUEST ===');
    console.log('Received request with params:', { page, limit, sortBy, sortOrder, search, department, status });
    console.log('Search param type:', typeof search);
    console.log('Search param value:', search);
    console.log('Search param length:', search ? search.length : 0);
    console.log('==============================');

    // Build query
    const query = {};

    // Add department filter if specified
    if (department && department !== 'all') {
      query.department = department;
    }

    // Add status filter if specified
    if (status) {
      try {
        // Handle both string and array status values
        const statusArray = status.includes(',') ? status.split(',') : [status];
        
        if (statusArray.includes('unknown')) {
          // For unknown status, we need to find projects with statuses not in active or inactive arrays
          // We'll need to handle this differently since we can't use $in for "not in"
          const activeStatuses = [
            'Assigned',
            'In progress', 
            'Samples submitted',
            'Lab Analysis Complete',
            'Report sent for review',
            'Ready for invoicing',
            'Invoice sent'
          ];
          const inactiveStatuses = [
            'Job complete',
            'On hold',
            'Quote sent',
            'Cancelled'
          ];
          const allKnownStatuses = [...activeStatuses, ...inactiveStatuses];
          
          query.status = { $nin: allKnownStatuses };
          console.log('Using unknown status filter - excluding known statuses:', allKnownStatuses);
        } else {
          query.status = { $in: statusArray };
          console.log('Using status filter:', query.status);
        }
      } catch (error) {
        console.error('Error processing status filter:', error);
        throw new Error(`Invalid status filter: ${error.message}`);
      }
    }

    // Add search filter if specified
    if (search) {
      console.log('=== BUILDING SEARCH QUERY ===');
      console.log('Search term received:', search);
      console.log('Search term type:', typeof search);
      console.log('Search term length:', search.length);
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { projectID: { $regex: search, $options: 'i' } },
        { 'client.name': { $regex: search, $options: 'i' } },
      ];
      console.log('Search query built:', query.$or);
      console.log('==========================');
    } else {
      console.log('=== NO SEARCH TERM ===');
      console.log('Search parameter is empty or not provided');
      console.log('==========================');
    }

    console.log('=== FINAL QUERY ===');
    console.log('Final query:', JSON.stringify(query, null, 2));
    console.log('========================');

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    try {
      const total = await Project.countDocuments(query);
      const pages = Math.ceil(total / parseInt(limit));

      // Get projects with pagination and sorting
      const projects = await Project.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('client', 'name')
        .populate('users', 'firstName lastName');

      console.log('Query results:', { total, projectsCount: projects.length });

      // Transform the response
      const response = {
        data: projects.map(project => ({
          ...project.toObject(),
          client: project.client?.name || '',
          department: project.department || '',
          assignedTo: project.users?.map(user => `${user.firstName} ${user.lastName}`).join(', ') || ''
        })),
        pagination: {
          total,
          pages,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      };

      console.log('Sending response with pagination:', response.pagination);
      res.json(response);
    } catch (error) {
      console.error('Error executing database query:', error);
      // Add more detailed error information
      const errorDetails = {
        message: error.message,
        name: error.name,
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
        errors: error.errors
      };
      console.error('Detailed error information:', errorDetails);
      throw new Error(`Database error: ${JSON.stringify(errorDetails)}`);
    }
  } catch (error) {
    console.error('Error in GET /projects:', error);
    // Send more detailed error response
    res.status(500).json({ 
      message: error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    });
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
  try {
    console.log('=== CREATING NEW PROJECT ===');
    console.log('Request body:', req.body);
    console.log('Client ID:', req.body.client);
    console.log('Department:', req.body.department);
    console.log('Users:', req.body.users);
    console.log('============================');
    
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
      workOrder: req.body.workOrder,
      users: req.body.users || [],
      projectContact: req.body.projectContact || {
        name: "",
        number: "",
        email: ""
      },
      notes: req.body.notes || ""
    });
    
    console.log('Project instance created:', project);
    
    // Save the project (this will trigger the pre-save hook)
    const newProject = await project.save();
    
    // Populate the users before sending response
    const populatedProject = await Project.findById(newProject._id)
      .populate('client')
      .populate('users');
    
    res.status(201).json(populatedProject);
  } catch (err) {
    console.error('Error saving project:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    if (err.errors) {
      console.error('Validation errors:', err.errors);
      Object.keys(err.errors).forEach(key => {
        console.error(`Validation error for ${key}:`, err.errors[key].message);
      });
    }
    res.status(400).json({ 
      message: err.message,
      validationErrors: err.errors,
      details: 'Project creation failed'
    });
  }
});

// Update project
router.put('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Update project fields
    project.name = req.body.name || project.name;
    project.client = req.body.client || project.client;
    project.department = req.body.department || project.department;
    project.categories = req.body.categories || project.categories;
    project.status = req.body.status || project.status;
    project.address = req.body.address || project.address;
    project.startDate = req.body.startDate || project.startDate;
    project.endDate = req.body.endDate || project.endDate;
    project.description = req.body.description || project.description;
    project.workOrder = req.body.workOrder || project.workOrder;
    project.users = req.body.users || project.users;
    project.projectContact = req.body.projectContact || project.projectContact;
    project.notes = req.body.notes !== undefined ? req.body.notes : project.notes;

    const updatedProject = await project.save();
    
    // Populate the users before sending response
    const populatedProject = await Project.findById(updatedProject._id)
      .populate('client')
      .populate('users');
    
    res.json(populatedProject);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(400).json({ message: err.message });
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