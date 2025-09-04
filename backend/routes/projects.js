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

// Helper function to get active and inactive statuses from custom data field groups
const getProjectStatuses = async () => {
  try {
    const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');
    const group = await CustomDataFieldGroup.findOne({ 
      type: 'project_status', 
      isActive: true 
    });
    
    if (!group) {
      return { activeStatuses: [], inactiveStatuses: [] };
    }
    
    const activeStatuses = group.fields
      .filter(field => field.isActive && field.isActiveStatus)
      .sort((a, b) => a.order - b.order)
      .map(field => field.text);
    
    const inactiveStatuses = group.fields
      .filter(field => field.isActive && !field.isActiveStatus)
      .sort((a, b) => a.order - b.order)
      .map(field => field.text);
    
    return { activeStatuses, inactiveStatuses };
  } catch (error) {
    console.error('Error fetching project statuses from custom data field groups:', error);
    // Return empty arrays if database query fails
    return { activeStatuses: [], inactiveStatuses: [] };
  }
};

// Get status counts for all projects
router.get('/status-counts', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const counts = await Project.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform the results into a more usable format
    const statusCounts = {};
    let totalActive = 0;
    let totalInactive = 0;

    counts.forEach(item => {
      const status = item._id || 'Unknown';
      const count = item.count;
      statusCounts[status] = count;
    });

    // Get total count
    const totalCount = await Project.countDocuments();
    statusCounts.all = totalCount;

    res.json({ statusCounts });
  } catch (error) {
    console.error('Error fetching status counts:', error);
    res.status(500).json({ message: 'Failed to fetch status counts' });
  }
});

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

    // Get status arrays from custom data fields
    const { activeStatuses, inactiveStatuses } = await getProjectStatuses();

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
          // Filter for all active statuses from custom data fields
          query.status = { $in: activeStatuses };
        } else if (status === 'all_inactive') {
          // Filter for all inactive statuses from custom data fields
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
    
    // Update dashboard stats after project creation
    try {
      const dashboardStatsService = require('../services/dashboardStatsService');
      await dashboardStatsService.updateStatsOnProjectCreate(newProject.status);
    } catch (statsError) {
      console.error('Error updating dashboard stats on project creation:', statsError);
      // Don't fail the project creation if stats update fails
    }

    // Log project creation to audit trail
    try {
      const ProjectAuditService = require('../services/projectAuditService');
      await ProjectAuditService.logProjectCreation(newProject._id, req.user._id, `Project "${newProject.name}" created`);
    } catch (auditError) {
      console.error('Error logging project creation to audit trail:', auditError);
      // Don't fail the project creation if audit logging fails
    }
    
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

    // Store old status before updating
    const oldStatus = project.status;
    
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
    
    // Update dashboard stats if status changed
    if (req.body.status && req.body.status !== oldStatus) {
      try {
        const dashboardStatsService = require('../services/dashboardStatsService');
        await dashboardStatsService.updateStatsOnProjectStatusChange(oldStatus, req.body.status);
      } catch (statsError) {
        console.error('Error updating dashboard stats on project status change:', statsError);
        // Don't fail the project update if stats update fails
      }

      // Log status change to audit trail
      try {
        console.log('🔍 Logging status change to audit trail:', {
          projectId: project._id,
          oldStatus,
          newStatus: req.body.status,
          userId: req.user._id
        });
        const ProjectAuditService = require('../services/projectAuditService');
        await ProjectAuditService.logStatusChange(
          project._id, 
          oldStatus, 
          req.body.status, 
          req.user._id, 
          `Status changed from "${oldStatus}" to "${req.body.status}"`
        );
        console.log('🔍 Status change logged successfully');
      } catch (auditError) {
        console.error('Error logging status change to audit trail:', auditError);
        // Don't fail the project update if audit logging fails
      }
    }
    
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

// Check project dependencies (for deletion)
router.get('/:id/dependencies', auth, checkPermission(['projects.delete']), async (req, res) => {
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

    const dependencyInfo = {
      canDelete: dependencies.length === 0,
      dependencies: {
        invoices: linkedInvoices.length,
        jobs: linkedJobs.length,
        asbestosRemovalJobs: linkedAsbestosRemovalJobs.length,
        clientSuppliedJobs: linkedClientSuppliedJobs.length,
        timesheets: linkedTimesheets.length,
        sampleItems: linkedSampleItems.length,
        assessments: linkedAssessments.length,
        clearances: linkedClearances.length
      },
      message: dependencies.length > 0 
        ? `Cannot delete project. It has linked records: ${dependencies.join(', ')}. Please remove or reassign these records before deleting the project.`
        : 'Project can be deleted - no linked records found.'
    };

    res.json(dependencyInfo);
  } catch (err) {
    console.error('Error checking project dependencies:', err);
    res.status(500).json({ message: err.message });
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

    // Store project status for dashboard stats update
    const projectStatus = project.status;
    
    await project.deleteOne();
    
    // Update dashboard stats after project deletion
    try {
      const dashboardStatsService = require('../services/dashboardStatsService');
      await dashboardStatsService.updateStatsOnProjectDelete(projectStatus);
    } catch (statsError) {
      console.error('Error updating dashboard stats on project deletion:', statsError);
      // Don't fail the project deletion if stats update fails
    }
    
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

      // Invoice processing removed for performance

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

      const totalTime = Date.now() - startTime;
      console.log(`[${userId}] getAssignedToMe completed in ${totalTime}ms (DB: ${dbTime}ms)`);

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
    const dashboardStatsService = require('../services/dashboardStatsService');
    
    // Get fast dashboard stats from cache table
    const stats = await dashboardStatsService.getDashboardStats();
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 