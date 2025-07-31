const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Client = require('../models/Client');
const User = require('../models/User');
const Timesheet = require('../models/Timesheet');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const { ROLE_PERMISSIONS } = require('../config/permissions');

// Define active and inactive statuses at module level
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



    // Build query
    const query = {};

    // Add department filter if specified
    if (department && department !== 'all') {
      query.department = department;
    }

    // Handle status filtering
    if (status && status !== 'all') {
      try {
        if (status === 'all_active') {
          // Filter for all active statuses
          query.status = { $in: activeStatuses };
        } else if (status === 'all_inactive') {
          // Filter for all inactive statuses
          query.status = { $in: inactiveStatuses };
        } else {
          // Handle specific status or comma-separated list
        const statusArray = status.includes(',') ? status.split(',') : [status];
        
        if (statusArray.includes('unknown')) {
          const allKnownStatuses = [...activeStatuses, ...inactiveStatuses];
          query.status = { $nin: allKnownStatuses };
        } else {
          query.status = { $in: statusArray };
          }
        }
      } catch (error) {
        throw new Error(`Invalid status filter: ${error.message}`);
      }
    }

    // Add search filter if specified
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { projectID: { $regex: search, $options: 'i' } },
        { 'client.name': { $regex: search, $options: 'i' } },
      ];
    }

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

      // Transform the response
      const response = {
        data: projects.map(project => ({
          ...project.toObject(),
          client: project.client?.name || '',
          department: project.department || '',
          assignedTo: project.users?.map(user => `${user.firstName} ${user.lastName}`).join(', ') || '',
          d_Date: project.d_Date,
          reports_present: project.reports_present || false
        })),
        pagination: {
          total,
          pages,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      d_Date: req.body.d_Date,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      description: req.body.description,
      workOrder: req.body.workOrder,
      users: req.body.users || [],
      isLargeProject: req.body.isLargeProject || false,
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
    
    // If this is a client supplied project, automatically create a job
    if (newProject.department === 'Client Supplied') {
      try {
        const jobCount = await ClientSuppliedJob.countDocuments();
        const jobNumber = `CSJ-${String(jobCount + 1).padStart(4, '0')}`;
        
        const job = new ClientSuppliedJob({
          projectId: newProject._id,
          jobNumber,
          status: 'Pending'
        });
        
        await job.save();
        console.log(`Automatically created client supplied job ${jobNumber} for project ${newProject.projectID}`);
      } catch (jobError) {
        console.error('Error creating automatic client supplied job:', jobError);
        // Don't fail the project creation if job creation fails
      }
    }
    
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
    project.d_Date = req.body.d_Date !== undefined ? req.body.d_Date : project.d_Date;
    project.startDate = req.body.startDate || project.startDate;
    project.endDate = req.body.endDate || project.endDate;
    project.description = req.body.description || project.description;
    project.workOrder = req.body.workOrder || project.workOrder;
    project.users = req.body.users || project.users;
    project.isLargeProject = req.body.isLargeProject !== undefined ? req.body.isLargeProject : project.isLargeProject;
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

// Get projects assigned to current user
router.get('/assigned/me', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'projectID',
      sortOrder = 'desc',
      status
    } = req.query;

    const userId = req.user.id;

    // Build query for user's assigned projects
    const query = {
      users: userId
    };

    // Add status filter if specified
    if (status) {
      try {
        const statusArray = status.includes(',') ? status.split(',') : [status];
        query.status = { $in: statusArray };
      } catch (error) {
        throw new Error(`Invalid status filter: ${error.message}`);
      }
    }

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
        .select('projectID name department status client users createdAt d_Date');

      // Transform the response
      const response = {
        data: projects.map(project => ({
          _id: project._id,
          projectID: project.projectID,
          name: project.name,
          department: project.department || '',
          status: project.status,
          client: project.client?.name || '',
          users: project.users,
          createdAt: project.createdAt,
          d_Date: project.d_Date
        })),
        pagination: {
          total,
          pages,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get project statistics for dashboard
router.get('/stats/dashboard', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const stats = await Project.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to object format
    const statsObject = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    // Calculate active projects count
    const activeProjects = stats.filter(stat => 
      activeStatuses.includes(stat._id)
    ).reduce((sum, stat) => sum + stat.count, 0);

    res.json({
      activeProjects,
      reviewProjects: statsObject['Report sent for review'] || 0,
      invoiceProjects: statsObject['Ready for invoicing'] || 0,
      labCompleteProjects: statsObject['Lab Analysis Complete'] || 0,
      samplesSubmittedProjects: statsObject['Samples submitted'] || 0,
      inProgressProjects: statsObject['In progress'] || 0,
      totalProjects: Object.values(statsObject).reduce((sum, count) => sum + count, 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 