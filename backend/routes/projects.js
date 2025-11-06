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

// Cache for project statuses
const statusCache = {
  data: null,
  timestamp: null,
  TTL: 10 * 60 * 1000, // 10 minutes in milliseconds
};

// Helper function to invalidate the status cache
const invalidateStatusCache = () => {
  statusCache.data = null;
  statusCache.timestamp = null;
};

// Helper function to get active and inactive statuses from custom data field groups (with caching)
const getProjectStatuses = async (forceRefresh = false) => {
  try {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && statusCache.data && statusCache.timestamp) {
      const cacheAge = now - statusCache.timestamp;
      if (cacheAge < statusCache.TTL) {
        console.log(`[PROJECTS] Using cached statuses (age: ${Math.round(cacheAge / 1000)}s)`);
        return statusCache.data;
      } else {
        console.log(`[PROJECTS] Cache expired (age: ${Math.round(cacheAge / 1000)}s), refreshing...`);
      }
    }

    // Fetch from database
    console.log(`[PROJECTS] Fetching statuses from database...`);
    const fetchStartTime = Date.now();
    const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');
    const group = await CustomDataFieldGroup.findOne({ 
      type: 'project_status', 
      isActive: true 
    });
    
    if (!group) {
      const result = { activeStatuses: [], inactiveStatuses: [] };
      // Cache even empty result
      statusCache.data = result;
      statusCache.timestamp = Date.now();
      return result;
    }
    
    const activeStatuses = group.fields
      .filter(field => field.isActive && field.isActiveStatus)
      .sort((a, b) => a.order - b.order)
      .map(field => field.text);
    
    const inactiveStatuses = group.fields
      .filter(field => field.isActive && !field.isActiveStatus)
      .sort((a, b) => a.order - b.order)
      .map(field => field.text);
    
    const result = { activeStatuses, inactiveStatuses };
    const fetchTime = Date.now() - fetchStartTime;
    console.log(`[PROJECTS] Statuses fetched from database in ${fetchTime}ms`);
    
    // Update cache
    statusCache.data = result;
    statusCache.timestamp = Date.now();
    
    return result;
  } catch (error) {
    console.error('Error fetching project statuses from custom data field groups:', error);
    // Return cached data if available, even if expired, as fallback
    if (statusCache.data) {
      console.log('[PROJECTS] Database error, returning stale cache as fallback');
      return statusCache.data;
    }
    // Return empty arrays if database query fails and no cache
    return { activeStatuses: [], inactiveStatuses: [] };
  }
};

// Cache invalidation function will be exported at the end of the file

// Get status counts for all projects (optimized to only count active projects by default)
router.get('/status-counts', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get active/inactive statuses for filtering
    const { activeStatuses, inactiveStatuses } = await getProjectStatuses();
    
    // Build query - only count active projects for better performance
    // This matches the projects page behavior (only shows active projects)
    const activeQuery = activeStatuses.length > 0 
      ? { status: { $in: activeStatuses } }
      : {};
    
    // Aggregate counts for active projects only (much faster with ~200 vs 5000+)
    const activeCounts = await Project.aggregate([
      {
        $match: activeQuery
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Also get inactive counts if needed (but make it optional/fast)
    const inactiveCounts = inactiveStatuses.length > 0 
      ? await Project.aggregate([
          {
            $match: { status: { $in: inactiveStatuses } }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ])
      : [];

    // Transform the results into a more usable format
    const statusCounts = {};
    
    // Process active counts
    activeCounts.forEach(item => {
      const status = item._id || 'Unknown';
      const count = item.count;
      statusCounts[status] = count;
    });
    
    // Process inactive counts
    inactiveCounts.forEach(item => {
      const status = item._id || 'Unknown';
      const count = item.count;
      statusCounts[status] = count;
    });

    // Calculate totals
    const totalActive = activeCounts.reduce((sum, item) => sum + item.count, 0);
    const totalInactive = inactiveCounts.reduce((sum, item) => sum + item.count, 0);
    statusCounts.all = totalActive + totalInactive;
    statusCounts.all_active = totalActive;
    statusCounts.all_inactive = totalInactive;

    const queryTime = Date.now() - startTime;
    console.log(`[PROJECTS] Status counts completed in ${queryTime}ms (active: ${totalActive}, inactive: ${totalInactive})`);

    res.json({ statusCounts });
  } catch (error) {
    console.error('Error fetching status counts:', error);
    res.status(500).json({ message: 'Failed to fetch status counts' });
  }
});

// Get all projects
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  const requestStartTime = Date.now();
  console.log(`[PROJECTS] Starting getAll request - Page: ${req.query.page}, Limit: ${req.query.limit}, Search: ${req.query.search}, Status: ${req.query.status}`);
  console.log(`[PROJECTS] Full query object:`, req.query);
  
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      department,
      status
    } = req.query;

    // Get status arrays from custom data fields
    const statusStartTime = Date.now();
    const { activeStatuses, inactiveStatuses } = await getProjectStatuses();
    const statusTime = Date.now() - statusStartTime;
    console.log(`[PROJECTS] Status fetching completed in ${statusTime}ms`);
    console.log(`[PROJECTS] Active statuses:`, activeStatuses);
    console.log(`[PROJECTS] Inactive statuses:`, inactiveStatuses);

    // Build query
    const query = {};

    // Add department filter if specified
    if (department && department !== 'all') {
      query.department = department;
    }

    // Handle status filtering
    // DEFAULT: Only show active projects unless explicitly requested otherwise
    // This prevents inactive projects from being loaded when no status filter is provided
    if (status && status !== 'all') {
      try {
        console.log(`[PROJECTS] Processing status filter: ${status}`);
        if (status === 'all_active') {
          // Filter for all active statuses from custom data fields
          if (activeStatuses.length > 0) {
            query.status = { $in: activeStatuses };
            console.log(`[PROJECTS] Applied active status filter:`, query.status);
          } else {
            console.log(`[PROJECTS] No active statuses available, returning empty result`);
            query.status = { $in: [] }; // Return no results if no active statuses defined
          }
        } else if (status === 'all_inactive') {
          // Filter for all inactive statuses from custom data fields
          if (inactiveStatuses.length > 0) {
            query.status = { $in: inactiveStatuses };
            console.log(`[PROJECTS] Applied inactive status filter:`, query.status);
          } else {
            console.log(`[PROJECTS] No inactive statuses available, returning empty result`);
            query.status = { $in: [] }; // Return no results if no inactive statuses defined
          }
        } else {
          // Handle specific status or comma-separated list
          const statusArray = status.includes(',') ? status.split(',') : [status];
          
          if (statusArray.includes('unknown')) {
            const allKnownStatuses = [...activeStatuses, ...inactiveStatuses];
            query.status = { $nin: allKnownStatuses };
          } else {
            query.status = { $in: statusArray };
          }
          console.log(`[PROJECTS] Applied specific status filter:`, query.status);
        }
      } catch (error) {
        throw new Error(`Invalid status filter: ${error.message}`);
      }
    } else {
      // DEFAULT BEHAVIOR: If no status filter provided, only show active projects
      // This prevents inactive projects from appearing when statuses aren't loaded yet
      if (activeStatuses.length > 0) {
        query.status = { $in: activeStatuses };
        console.log(`[PROJECTS] No status filter provided, defaulting to active projects only`);
      } else {
        console.log(`[PROJECTS] No active statuses available and no filter provided, returning empty result`);
        query.status = { $in: [] }; // Return no results if no active statuses defined
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const queryBuildTime = Date.now() - requestStartTime;
    console.log(`[PROJECTS] Query building completed in ${queryBuildTime}ms`);
    console.log(`[PROJECTS] Final query:`, JSON.stringify(query, null, 2));
    
    try {
      let projects, total;

      if (search) {
        console.log(`[PROJECTS] Starting optimized search for: "${search}"`);
        console.log(`[PROJECTS] Base query:`, JSON.stringify(query, null, 2));
        
        const searchStartTime = Date.now();
        
        // Use MongoDB aggregation pipeline for efficient single-query search
        // This searches both project fields AND client names in one database operation
        const searchRegex = new RegExp(search, 'i'); // Case-insensitive regex
        
        // Collection names (Mongoose automatically pluralizes model names)
        // 'clients' and 'users' are the standard MongoDB collection names
        const clientsCollection = 'clients';
        const usersCollection = 'users';
        
        // Build aggregation pipeline
        const pipeline = [
          // Stage 1: Match base filters (status, department, etc.)
          {
            $match: query
          },
          
          // Stage 2: Lookup client information
          {
            $lookup: {
              from: clientsCollection,
              localField: 'client',
              foreignField: '_id',
              as: 'clientData'
            }
          },
          
          // Stage 3: Unwind client data (we expect one client per project)
          {
            $unwind: {
              path: '$clientData',
              preserveNullAndEmptyArrays: true // Keep projects even if client lookup fails
            }
          },
          
          // Stage 4: Match search criteria - project fields OR client name
          {
            $match: {
              $or: [
                { name: searchRegex },
                { projectID: searchRegex },
                { 'clientData.name': searchRegex }
              ]
            }
          },
          
          // Stage 5: Lookup user information
          {
            $lookup: {
              from: usersCollection,
              localField: 'users',
              foreignField: '_id',
              as: 'usersData',
              pipeline: [
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                    _id: 1
                  }
                }
              ]
            }
          },
          
          // Stage 6: Sort in database (more efficient than JavaScript sorting)
          {
            $sort: {
              [sortBy]: sortOrder === 'desc' ? -1 : 1
            }
          },
          
          // Stage 7: Project/reshape the output to match expected format
          {
            $project: {
              _id: 1,
              projectID: 1,
              name: 1,
              client: {
                _id: '$clientData._id',
                name: '$clientData.name'
              },
              users: {
                $map: {
                  input: '$usersData',
                  as: 'user',
                  in: {
                    _id: '$$user._id',
                    firstName: '$$user.firstName',
                    lastName: '$$user.lastName'
                  }
                }
              },
              department: 1,
              status: 1,
              address: 1,
              d_Date: 1,
              workOrder: 1,
              categories: 1,
              description: 1,
              notes: 1,
              projectContact: 1,
              budget: 1,
              isLargeProject: 1,
              reports_present: 1,
              createdAt: 1,
              updatedAt: 1,
              startDate: 1,
              endDate: 1
            }
          }
        ];
        
        // Execute aggregation
        const aggregationResult = await Project.aggregate(pipeline);
        const searchTime = Date.now() - searchStartTime;
        
        console.log(`[PROJECTS] Aggregation search completed in ${searchTime}ms`);
        console.log(`[PROJECTS] Found ${aggregationResult.length} matching projects`);
        
        // Convert aggregation results to Mongoose documents (for consistency with non-search queries)
        // This allows us to use .toObject() and other Mongoose methods if needed
        projects = aggregationResult.map(item => {
          // Convert to plain object format that matches what find() returns
          const project = {
            ...item,
            // Ensure client is properly formatted (null if no client)
            client: item.client && item.client._id ? item.client : null,
            // Ensure users array is properly formatted
            users: item.users || []
          };
          return project;
        });
        
        // Get total count (for pagination info)
        total = projects.length;
        
        // Note: We're returning all results for client-side pagination
        // This is fine since we only have ~200 active projects
        // If needed later, we can add server-side pagination here with $skip and $limit
        
        console.log(`[PROJECTS] Returning ${projects.length} projects from optimized search`);
      } else {
        // Use regular find for non-search queries
        const countStartTime = Date.now();
        total = await Project.countDocuments(query);
        const countTime = Date.now() - countStartTime;
        console.log(`[PROJECTS] Count query completed in ${countTime}ms`);
        
        const dataStartTime = Date.now();
        projects = await Project.find(query)
          .select('projectID name department status client users d_Date workOrder categories description notes projectContact budget isLargeProject reports_present createdAt updatedAt startDate endDate address')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('client', 'name')
          .populate('users', 'firstName lastName');
        const dataTime = Date.now() - dataStartTime;
        console.log(`[PROJECTS] Data query completed in ${dataTime}ms`);
      }

      const pages = Math.ceil(total / parseInt(limit));

      // Transform the response
      const response = {
        data: projects.map(project => {
          // Handle both aggregated and populated project formats
          const projectObj = project.toObject ? project.toObject() : project;
          
          return {
            ...projectObj,
            client: project.client || projectObj.client || null,
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

      const totalTime = Date.now() - requestStartTime;
      console.log(`[PROJECTS] getAll completed in ${totalTime}ms - Projects: ${projects.length}, Total: ${total}`);
      
      res.json(response);
    } catch (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.log(`[PROJECTS] getAll ERROR after ${totalTime}ms: ${error.message}`);
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
    
    // Validate categories before creating project
    const validCategories = [
      'Asbestos Management Plan',
      'Air Monitoring and Clearance',
      'Asbestos Materials Assessment',
      'Asbestos & Lead Paint Assessment',
      'Clearance Certificate',
      'Client Supplied - Bulk ID',
      'Client Supplied - Soil/dust (AS4964)',
      'Client Supplied - WA Guidelines',
      'Client Supplied - Fibre Count',
      'Hazardous Materials Management Plan',
      'Intrusive Asbestos Assessment',
      'Intrusive Hazardous Materials Assessment',
      'Lead Dust Assessment',
      'Lead Paint Assessment',
      'Lead Paint/Dust Assessment',
      'Mould/Moisture Assessment',
      'Mould/Moisture Validation',
      'Residential Asbestos Assessment',
      'Silica Air Monitoring',
      'Other'
    ];
    
    const processedCategories = req.body.categories 
      ? req.body.categories
          .filter(category => category && typeof category === 'string')
          .map(category => category.trim())
          .filter(category => validCategories.includes(category))
      : [];

    // Create new project instance
    const project = new Project({
      name: req.body.name,
      client: req.body.client,
      department: req.body.department,
      categories: processedCategories,
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
      notes: req.body.notes || "",
      budget: parseFloat(req.body.budget) || 0
    });
    
    console.log('Project instance created:', project);
    
    // Save the project (this will trigger the pre-save hook)
    const newProject = await project.save();
    
    // If this is a client supplied project, automatically create a job
    if (newProject.department === 'Client Supplied') {
      try {
        const job = new ClientSuppliedJob({
          projectId: newProject._id,
          status: 'Pending'
        });
        
        await job.save();
        console.log(`Automatically created client supplied job for project ${newProject.projectID}`);
        
        // Update the project's reports_present field to true
        await Project.findByIdAndUpdate(
          newProject._id,
          { reports_present: true }
        );
        console.log(`Updated project ${newProject._id} reports_present to true due to automatic client supplied job creation`);
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
    console.log('🔍 PROJECT UPDATE REQUEST START', {
      projectId: req.params.id,
      requestBody: req.body,
      requestBodyKeys: Object.keys(req.body),
      timestamp: new Date().toISOString()
    });

    const project = await Project.findById(req.params.id);
    if (!project) {
      console.log('❌ PROJECT NOT FOUND', { projectId: req.params.id });
      return res.status(404).json({ message: 'Project not found' });
    }

    // Clean up any malformed users data in existing project
    if (project.users && Array.isArray(project.users)) {
      const originalUsers = project.users;
      const cleanedUsers = project.users
        .filter(user => {
          // Keep valid ObjectIds
          if (typeof user === 'object' && user._id) return true;
          // Keep valid ObjectId strings
          if (typeof user === 'string' && /^[0-9a-fA-F]{24}$/.test(user.trim())) return true;
          return false;
        })
        .map(user => {
          // Convert to ObjectId if it's a string
          if (typeof user === 'string') {
            return user.trim();
          }
          return user;
        });
      
      if (originalUsers.length !== cleanedUsers.length) {
        console.log('🔍 CLEANED UP EXISTING PROJECT USERS', {
          projectId: project._id,
          originalUsers,
          cleanedUsers,
          originalCount: originalUsers.length,
          cleanedCount: cleanedUsers.length
        });
        project.users = cleanedUsers;
      }
    }

    console.log('🔍 EXISTING PROJECT DATA', {
      projectId: project._id,
      projectID: project.projectID,
      name: project.name,
      department: project.department,
      status: project.status,
      categories: project.categories,
      categoriesType: typeof project.categories,
      isCategoriesArray: Array.isArray(project.categories),
      client: project.client,
      workOrder: project.workOrder,
      users: project.users,
      allFields: Object.keys(project.toObject())
    });

    // Store old status before updating
    const oldStatus = project.status;
    
    // Check if user is trying to set status to "Job complete" and if they have permission
    if (req.body.status === "Job complete") {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Admin and manager users can always set "Job complete"
      // Employee users need the canSetJobComplete permission
      if (user.role === 'employee' && !user.canSetJobComplete) {
        return res.status(403).json({ 
          message: 'You do not have permission to set project status to "Job complete"',
          requiredPermission: 'canSetJobComplete'
        });
      }
      
      // When status is set to "Job complete", clear the end date
      req.body.endDate = null;
    }
    
    // Update project fields
    console.log('🔍 UPDATING PROJECT FIELDS', {
      projectId: project._id,
      fieldUpdates: {
        name: { from: project.name, to: req.body.name || project.name, changed: req.body.name !== undefined },
        client: { from: project.client, to: req.body.client || project.client, changed: req.body.client !== undefined },
        department: { from: project.department, to: req.body.department || project.department, changed: req.body.department !== undefined },
        status: { from: project.status, to: req.body.status || project.status, changed: req.body.status !== undefined },
        categories: { from: project.categories, to: req.body.categories, changed: req.body.categories !== undefined },
        address: { from: project.address, to: req.body.address || project.address, changed: req.body.address !== undefined },
        workOrder: { from: project.workOrder, to: req.body.workOrder || project.workOrder, changed: req.body.workOrder !== undefined },
        users: { from: project.users, to: req.body.users || project.users, changed: req.body.users !== undefined }
      }
    });

    project.name = req.body.name || project.name;
    project.client = req.body.client || project.client;
    project.department = req.body.department || project.department;
    
    // Handle categories validation - filter out invalid categories
    if (req.body.categories !== undefined) {
      const validCategories = [
        'Asbestos Management Plan',
        'Air Monitoring and Clearance',
        'Asbestos Materials Assessment',
        'Asbestos & Lead Paint Assessment',
        'Clearance Certificate',
        'Client Supplied - Bulk ID',
        'Client Supplied - Soil/dust (AS4964)',
        'Client Supplied - WA Guidelines',
        'Client Supplied - Fibre Count',
        'Hazardous Materials Management Plan',
        'Intrusive Asbestos Assessment',
        'Intrusive Hazardous Materials Assessment',
        'Lead Dust Assessment',
        'Lead Paint Assessment',
        'Lead Paint/Dust Assessment',
        'Mould/Moisture Assessment',
        'Mould/Moisture Validation',
        'Residential Asbestos Assessment',
        'Silica Air Monitoring',
        'Other'
      ];
      
      console.log('🔍 CATEGORIES VALIDATION', {
        originalCategories: req.body.categories,
        categoriesType: typeof req.body.categories,
        isArray: Array.isArray(req.body.categories)
      });
      
      // Filter out invalid categories and trim whitespace
      const processedCategories = req.body.categories
        .filter(category => category && typeof category === 'string')
        .map(category => category.trim())
        .filter(category => validCategories.includes(category));
      
      console.log('🔍 CATEGORIES AFTER PROCESSING', {
        processedCategories,
        validCategoriesCount: processedCategories.length,
        originalCount: req.body.categories.length
      });
      
      project.categories = processedCategories;
    }
    
    project.status = req.body.status || project.status;
    project.address = req.body.address || project.address;
    project.d_Date = req.body.d_Date !== undefined ? req.body.d_Date : project.d_Date;
    project.startDate = req.body.startDate || project.startDate;
    project.endDate = req.body.endDate || project.endDate;
    project.description = req.body.description || project.description;
    project.workOrder = req.body.workOrder || project.workOrder;
    // Handle users field - clean up any malformed data from older imports
    if (req.body.users !== undefined) {
      if (Array.isArray(req.body.users)) {
        // Filter out any invalid user IDs and clean up strings
        const cleanedUsers = req.body.users
          .filter(user => {
            // Accept both string IDs and populated user objects
            if (typeof user === 'string' && user.trim()) return true;
            if (typeof user === 'object' && user._id) return true;
            return false;
          })
          .map(user => {
            // Extract ID from populated objects or clean up string IDs
            if (typeof user === 'object' && user._id) {
              return user._id;
            }
            if (typeof user === 'string') {
              const trimmed = user.trim();
              // Remove any carriage returns or newlines
              return trimmed.replace(/[\r\n]/g, '');
            }
            return user;
          })
          .filter(user => {
            // Check if it's a valid ObjectId format
            return /^[0-9a-fA-F]{24}$/.test(user);
          });
        
        console.log('🔍 USERS FIELD PROCESSING', {
          originalUsers: req.body.users,
          cleanedUsers,
          originalCount: req.body.users.length,
          cleanedCount: cleanedUsers.length
        });
        
        project.users = cleanedUsers;
      } else {
        console.log('🔍 USERS FIELD NOT ARRAY', { users: req.body.users, type: typeof req.body.users });
        // If users is not an array, set to empty array
        project.users = [];
      }
    }
    project.isLargeProject = req.body.isLargeProject !== undefined ? req.body.isLargeProject : project.isLargeProject;
    project.projectContact = req.body.projectContact || project.projectContact;
    project.notes = req.body.notes !== undefined ? req.body.notes : project.notes;
    project.budget = req.body.budget !== undefined ? parseFloat(req.body.budget) || 0 : project.budget;

    // Fix any string dates that might have been sent from frontend
    if (req.body.updatedAt && typeof req.body.updatedAt === 'string') {
      console.log('🔍 Converting updatedAt from string to Date:', req.body.updatedAt);
      project.updatedAt = new Date(req.body.updatedAt);
    }

    console.log('🔍 PROJECT BEFORE SAVE', {
      projectId: project._id,
      projectID: project.projectID,
      name: project.name,
      department: project.department,
      status: project.status,
      categories: project.categories,
      categoriesType: typeof project.categories,
      isCategoriesArray: Array.isArray(project.categories),
      client: project.client,
      workOrder: project.workOrder,
      users: project.users,
      modifiedPaths: project.modifiedPaths(),
      isModified: project.isModified()
    });

    console.log('🔄 ATTEMPTING TO SAVE PROJECT', { projectId: project._id });
    
    // Add detailed validation before save
    try {
      await project.validate();
      console.log('✅ PROJECT VALIDATION PASSED', { projectId: project._id });
    } catch (validationError) {
      console.error('❌ PROJECT VALIDATION FAILED', {
        projectId: project._id,
        validationError: validationError.message,
        validationErrors: validationError.errors,
        errorName: validationError.name
      });
      throw validationError;
    }
    
    const updatedProject = await project.save();
    console.log('✅ PROJECT SAVED SUCCESSFULLY', { projectId: project._id });
    
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
    console.error('❌ PROJECT UPDATE ERROR', {
      projectId: req.params.id,
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
      validationErrors: err.errors,
      errorCode: err.code,
      timestamp: new Date().toISOString()
    });

    if (err.errors) {
      console.error('❌ VALIDATION ERRORS DETAILS', {
        projectId: req.params.id,
        validationErrors: Object.keys(err.errors).map(key => ({
          field: key,
          message: err.errors[key].message,
          value: err.errors[key].value,
          kind: err.errors[key].kind,
          path: err.errors[key].path
        }))
      });
    }

    res.status(400).json({ 
      message: err.message,
      validationErrors: err.errors,
      errorName: err.name,
      errorCode: err.code
    });
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

    // Get active/inactive statuses for filtering (with caching)
    const { activeStatuses, inactiveStatuses } = await getProjectStatuses();

    // Build query for user's assigned projects
    const queryStartTime = Date.now();
    const query = {
      users: userId
    };

    // Handle status filtering
    // DEFAULT: Only show active projects unless explicitly requested otherwise
    if (status && status !== 'all') {
      try {
        if (status === 'all_active') {
          // Filter for all active statuses
          if (activeStatuses.length > 0) {
            query.status = { $in: activeStatuses };
            console.log(`[${userId}] Applied active status filter to assigned projects`);
          } else {
            query.status = { $in: [] }; // Return no results if no active statuses defined
          }
        } else if (status === 'all_inactive') {
          // Filter for all inactive statuses
          if (inactiveStatuses.length > 0) {
            query.status = { $in: inactiveStatuses };
            console.log(`[${userId}] Applied inactive status filter to assigned projects`);
          } else {
            query.status = { $in: [] }; // Return no results if no inactive statuses defined
          }
        } else {
          // Handle specific status or comma-separated list
          const statusArray = status.includes(',') ? status.split(',') : [status];
          query.status = { $in: statusArray };
          console.log(`[${userId}] Applied specific status filter to assigned projects:`, query.status);
        }
      } catch (error) {
        throw new Error(`Invalid status filter: ${error.message}`);
      }
    } else {
      // DEFAULT BEHAVIOR: If no status filter provided, only show active projects
      // This matches the projects page behavior
      if (activeStatuses.length > 0) {
        query.status = { $in: activeStatuses };
        console.log(`[${userId}] No status filter provided, defaulting to active projects only for assigned projects`);
      } else {
        console.log(`[${userId}] No active statuses available and no filter provided, returning empty result`);
        query.status = { $in: [] }; // Return no results if no active statuses defined
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const queryBuildTime = Date.now() - queryStartTime;
    console.log(`[${userId}] Query building completed in ${queryBuildTime}ms`);
    
    try {
      const dbStartTime = Date.now();
      
      // Count query timing
      const countStartTime = Date.now();
      const total = await Project.countDocuments(query);
      const countTime = Date.now() - countStartTime;
      console.log(`[${userId}] Count query completed in ${countTime}ms`);
      
      const pages = Math.ceil(total / parseInt(limit));

      // Data query timing
      const dataStartTime = Date.now();
      const projects = await Project.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('client', 'name')
        .select('projectID name department status client users createdAt d_Date');
      const dataTime = Date.now() - dataStartTime;
      console.log(`[${userId}] Data query completed in ${dataTime}ms`);
      
      const dbTime = Date.now() - dbStartTime;
      console.log(`[${userId}] Total database operations completed in ${dbTime}ms (Count: ${countTime}ms, Data: ${dataTime}ms)`);

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

// Export router as default
module.exports = router;

// Export cache invalidation function for use in other routes
module.exports.invalidateStatusCache = invalidateStatusCache; 