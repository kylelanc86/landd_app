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

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    try {
      let projects, total;

      if (search) {
        // Use aggregation for search to properly search through client names
        const aggregationPipeline = [
          {
            $lookup: {
              from: 'clients',
              localField: 'client',
              foreignField: '_id',
              as: 'clientData'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'users',
              foreignField: '_id',
              as: 'userData'
            }
          },
          {
            $match: {
              $and: [
                // Apply other filters first
                ...(query.department ? [{ department: query.department }] : []),
                ...(query.status ? [{ status: query.status }] : []),
                // Then apply search filter
                {
                  $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { projectID: { $regex: search, $options: 'i' } },
                    { 'clientData.name': { $regex: search, $options: 'i' } }
                  ]
                }
              ]
            }
          },
          {
            $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
          }
        ];

        // Get total count for pagination
        const countPipeline = [...aggregationPipeline, { $count: "total" }];
        const countResult = await Project.aggregate(countPipeline);
        total = countResult.length > 0 ? countResult[0].total : 0;

        // Get paginated results
        const dataPipeline = [
          ...aggregationPipeline,
          { $skip: skip },
          { $limit: parseInt(limit) }
        ];
        
        const aggregationResult = await Project.aggregate(dataPipeline);
        
        // Transform aggregation result to match expected format
        projects = aggregationResult.map(project => ({
          ...project,
          client: project.clientData?.[0] || null,
          users: project.userData || []
        }));
      } else {
        // Use regular find for non-search queries
        total = await Project.countDocuments(query);
        projects = await Project.find(query)
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('client', 'name')
          .populate('users', 'firstName lastName');
      }

      const pages = Math.ceil(total / parseInt(limit));

      // Transform the response
      const response = {
        data: projects.map(project => {
          // Handle both aggregated and populated project formats
          const projectObj = project.toObject ? project.toObject() : project;
          
          return {
            ...projectObj,
            client: project.client?.name || projectObj.client?.name || '',
            department: projectObj.department || '',
            assignedTo: project.users?.map(user => `${user.firstName} ${user.lastName}`).join(', ') || 
                       projectObj.users?.map(user => `${user.firstName} ${user.lastName}`).join(', ') || '',
            d_Date: projectObj.d_Date,
            reports_present: projectObj.reports_present || false
          };
        }),
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

         // Check for linked invoices
     const Invoice = require('../models/Invoice');
     const linkedInvoices = await Invoice.find({ projectId: req.params.id });
     
     // Check for linked jobs
     const Job = require('../models/Job');
     const linkedJobs = await Job.find({ projectId: req.params.id });
    
    // Check for linked asbestos removal jobs
    const AsbestosRemovalJob = require('../models/AsbestosRemovalJob');
    const linkedAsbestosRemovalJobs = await AsbestosRemovalJob.find({ projectId: req.params.id });
    
    // Check for linked client supplied jobs
    const ClientSuppliedJob = require('../models/ClientSuppliedJob');
    const linkedClientSuppliedJobs = await ClientSuppliedJob.find({ projectId: req.params.id });
    
    // Check for linked timesheets
    const Timesheet = require('../models/Timesheet');
    const linkedTimesheets = await Timesheet.find({ projectId: req.params.id });
    
    // Check for linked sample items
    const SampleItem = require('../models/SampleItem');
    const linkedSampleItems = await SampleItem.find({ projectId: req.params.id });
    
    // Check for linked asbestos assessments
    const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
    const linkedAssessments = await AsbestosAssessment.find({ projectId: req.params.id });
    
    // Check for linked asbestos clearances
    const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
    const linkedClearances = await AsbestosClearance.find({ projectId: req.params.id });

    // Build dependency summary
    const dependencies = [];
    if (linkedInvoices.length > 0) dependencies.push(`${linkedInvoices.length} invoice(s)`);
    if (linkedJobs.length > 0) dependencies.push(`${linkedJobs.length} job(s)`);
    if (linkedAsbestosRemovalJobs.length > 0) dependencies.push(`${linkedAsbestosRemovalJobs.length} asbestos removal job(s)`);
    if (linkedClientSuppliedJobs.length > 0) dependencies.push(`${linkedClientSuppliedJobs.length} client supplied job(s)`);
    if (linkedTimesheets.length > 0) dependencies.push(`${linkedTimesheets.length} timesheet(s)`);
    if (linkedSampleItems.length > 0) dependencies.push(`${linkedSampleItems.length} sample item(s)`);
    if (linkedAssessments.length > 0) dependencies.push(`${linkedAssessments.length} assessment(s)`);
    if (linkedClearances.length > 0) dependencies.push(`${linkedClearances.length} clearance(s)`);

    if (dependencies.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete project. It has linked records: ${dependencies.join(', ')}. Please remove or reassign these records before deleting the project.`,
        dependencies: {
          invoices: linkedInvoices.length,
          jobs: linkedJobs.length,
          asbestosRemovalJobs: linkedAsbestosRemovalJobs.length,
          clientSuppliedJobs: linkedClientSuppliedJobs.length,
          timesheets: linkedTimesheets.length,
          sampleItems: linkedSampleItems.length,
          assessments: linkedAssessments.length,
          clearances: linkedClearances.length
        }
      });
    }

    await project.deleteOne();
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
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
    const startTime = Date.now();
    console.log(`[${req.user.id}] Starting getAssignedToMe request`);
    
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
      const dbStartTime = Date.now();
      const total = await Project.countDocuments(query);
      const pages = Math.ceil(total / parseInt(limit));

      // Get projects with pagination and sorting
      const projects = await Project.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('client', 'name')
        .select('projectID name department status client users createdAt d_Date');
      
      const dbTime = Date.now() - dbStartTime;
      console.log(`[${userId}] Database query completed in ${dbTime}ms`);

      // Get overdue invoice data for all projects in a single aggregation
      const invoiceStartTime = Date.now();
      const projectIds = projects.map(p => p._id);
      
      // Aggregate invoice data for all projects (both overdue and general invoice info)
      const invoiceData = await require('../models/Invoice').aggregate([
        {
          $match: {
            projectId: { $in: projectIds },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$projectId',
            invoices: { $push: '$$ROOT' },
            overdueDays: {
              $max: {
                $cond: [
                  { 
                    $and: [
                      { $eq: ['$status', 'unpaid'] },
                      { $lt: ['$dueDate', new Date()] }
                    ]
                  },
                  {
                    $ceil: {
                      $divide: [
                        { $subtract: [new Date(), '$dueDate'] },
                        1000 * 60 * 60 * 24
                      ]
                    }
                  },
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            invoices: 1,
            overdueDays: { $max: ['$overdueDays', 0] }
          }
        }
      ]);
      
      const invoiceTime = Date.now() - invoiceStartTime;
      console.log(`[${userId}] Invoice aggregation completed in ${invoiceTime}ms`);

      // Create maps for quick lookup
      const overdueMap = {};
      const invoiceMap = {};
      
      invoiceData.forEach(item => {
        const projectId = item._id.toString();
        
        // Handle overdue invoices
        if (item.overdueDays > 0) {
          overdueMap[projectId] = {
            overdueInvoice: true,
            overdueDays: item.overdueDays
          };
        }
        
        // Handle general invoice info
        if (item.invoices && item.invoices.length > 0) {
          // Get the most recent invoice for this project
          const latestInvoice = item.invoices.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          
          // Calculate days until due for unpaid invoices
          let daysUntilDue = null;
          if (latestInvoice.status === 'unpaid' && latestInvoice.dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(latestInvoice.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            const diffTime = dueDate - today;
            daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
          
          invoiceMap[projectId] = {
            hasInvoice: true,
            status: latestInvoice.status,
            xeroStatus: latestInvoice.xeroStatus,
            daysUntilDue: daysUntilDue,
            amount: latestInvoice.amount,
            invoiceID: latestInvoice.invoiceID
          };
        }
      });

      // Transform the response with both overdue and invoice data
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
          d_Date: project.d_Date,
          overdueInvoice: overdueMap[project._id.toString()] || { overdueInvoice: false, overdueDays: 0 },
          invoiceInfo: invoiceMap[project._id.toString()] || { hasInvoice: false }
        })),
        pagination: {
          total,
          pages,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      };

      const totalTime = Date.now() - startTime;
      console.log(`[${userId}] getAssignedToMe completed in ${totalTime}ms (DB: ${dbTime}ms, Invoice: ${invoiceTime}ms)`);

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