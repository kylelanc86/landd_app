const express = require("express");
const router = express.Router();
const Timesheet = require("../models/Timesheet");
const TimesheetStatus = require("../models/TimesheetStatus");
const auth = require("../middleware/auth");
const { ROLE_PERMISSIONS } = require("../config/permissions");
const { format, eachDayOfInterval } = require('date-fns');
const mongoose = require('mongoose');
const Project = require("../models/Project");

// Helper function to check permissions
const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
};

// Get timesheets for a date range
router.get("/range/:startDate/:endDate", auth, async (req, res) => {
  try {
    console.log('Range request received:', {
      params: req.params,
      query: req.query,
      user: req.user._id,
      headers: req.headers
    });

    // Validate date parameters
    if (!req.params.startDate || !req.params.endDate) {
      console.log('Missing date parameters');
      return res.json([]);
    }

    // Create dates at the start of the day in UTC
    let startDate, endDate;
    try {
      // Parse dates in yyyy-MM-dd format
      startDate = new Date(req.params.startDate);
      endDate = new Date(req.params.endDate);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log('Invalid date format:', { startDate: req.params.startDate, endDate: req.params.endDate });
        return res.json([]);
      }

      // Set time to start/end of day in UTC
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);

      // Validate date range
      if (startDate > endDate) {
        console.log('Invalid date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
        return res.json([]);
      }

      console.log('Parsed dates:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateLocal: startDate.toString(),
        endDateLocal: endDate.toString()
      });
    } catch (error) {
      console.error('Error parsing dates:', error);
      return res.json([]);
    }
    
    // Build query based on whether we're looking at a specific user's timesheets
    const query = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // If userId is provided and user has permission to approve timesheets, show that user's timesheets
    if (req.query.userId && hasPermission(req.user, 'timesheets.approve')) {
      try {
        query.userId = new mongoose.Types.ObjectId(req.query.userId);
        console.log('Using provided userId in query:', req.query.userId);
      } catch (error) {
        console.error('Invalid user ID format:', error);
        return res.json([]);
      }
    } else {
      // Otherwise, only show the current user's timesheets
      query.userId = req.user._id;
      console.log('Using current user ID in query:', req.user._id);
    }
    
    console.log('Final query:', JSON.stringify(query, null, 2));
    
    try {
      const timesheets = await Timesheet.find(query)
        .sort({ date: 1, startTime: 1 })
        .populate('userId', 'firstName lastName')
        .populate('projectId', 'name')
        .populate('finalisedBy', 'firstName lastName');
      
      console.log('Found timesheets:', {
        count: timesheets.length,
        entries: timesheets.map(t => ({
          id: t._id,
          date: t.date,
          startTime: t.startTime,
          endTime: t.endTime,
          userId: t.userId?._id,
          projectId: t.projectId?._id,
          isAdminWork: t.isAdminWork,
          isBreak: t.isBreak
        }))
      });
      
      res.json(timesheets || []);
    } catch (error) {
      console.error('Database error:', error);
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    res.json([]);
  }
});

// Get timesheets for a specific date
router.get("/:date", auth, async (req, res) => {
  try {
    // Parse date in yyyy-MM-dd format
    const date = new Date(req.params.date);
    date.setUTCHours(0, 0, 0, 0);
    
    console.log('Fetching timesheets for date:', {
      inputDate: req.params.date,
      parsedDate: date.toISOString()
    });

    const timesheets = await Timesheet.find({
      userId: req.user._id,
      date: date
    }).sort({ startTime: 1 });

    console.log('Found timesheets:', timesheets.length);
    res.json(timesheets);
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new timesheet entry
router.post("/", auth, async (req, res) => {
  try {
    const { startTime, endTime, projectId, description, isAdminWork, isBreak, projectInputType, date } = req.body;
    
    console.log('Creating new timesheet entry:', {
      startTime,
      endTime,
      projectId,
      description,
      isAdminWork,
      isBreak,
      projectInputType,
      date
    });

    // Validate required fields
    if (!startTime || !endTime || !date) {
      console.log('Missing required fields:', { startTime, endTime, date });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create date object in UTC
    const entryDate = new Date(date);
    entryDate.setUTCHours(0, 0, 0, 0);
    console.log('Created date object:', entryDate.toISOString());

    // Create timesheet object with conditional projectId
    const timesheetData = {
      userId: req.user._id,
      date: entryDate,
      startTime,
      endTime,
      description: description || "",
      isAdminWork,
      isBreak,
    };

    // Only add projectId and projectInputType if it's not admin work or break
    if (!isAdminWork && !isBreak) {
      if (!projectId) {
        console.log('Missing projectId for project work');
        return res.status(400).json({ message: "Project ID is required for project work" });
      }
      if (!projectInputType) {
        console.log('Missing projectInputType for project work');
        return res.status(400).json({ message: "Project input type is required for project work" });
      }
      timesheetData.projectId = projectId;
      timesheetData.projectInputType = projectInputType;

      // Update project status to "In progress" if it's currently "Assigned"
      try {
        const project = await Project.findById(projectId);
        if (project && project.status === 'Assigned') {
          project.status = 'In progress';
          await project.save();
          console.log(`Updated project ${project._id} status to In progress`);
        }
      } catch (projectError) {
        console.error('Error updating project status:', projectError);
        // Don't fail the timesheet creation if project update fails
      }
    }

    const timesheet = new Timesheet(timesheetData);

    console.log('Saving timesheet:', timesheet);
    const newTimesheet = await timesheet.save();
    console.log('Timesheet saved successfully:', newTimesheet);
    
    res.status(201).json(newTimesheet);
  } catch (error) {
    console.error("Error creating timesheet:", error);
    res.status(400).json({ message: error.message });
  }
});

// Delete a timesheet entry
router.delete("/:id", auth, async (req, res) => {
  try {
    const timesheet = await Timesheet.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet entry not found" });
    }

    await timesheet.deleteOne();
    res.json({ message: "Timesheet entry deleted" });
  } catch (error) {
    console.error("Error deleting timesheet:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update a timesheet entry
router.put("/:id", auth, async (req, res) => {
  try {
    const { startTime, endTime, projectId, description, isAdminWork, isBreak, projectInputType, date } = req.body;
    
    console.log('Updating timesheet entry:', {
      id: req.params.id,
      startTime,
      endTime,
      projectId,
      description,
      isAdminWork,
      isBreak,
      projectInputType,
      date
    });

    // Validate required fields
    if (!startTime || !endTime || !date) {
      console.log('Missing required fields:', { startTime, endTime, date });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create date object in UTC
    const entryDate = new Date(date);
    entryDate.setUTCHours(0, 0, 0, 0);
    console.log('Created date object:', entryDate.toISOString());

    // Create update object with conditional projectId
    const updateData = {
      date: entryDate,
      startTime,
      endTime,
      description: description || "",
      isAdminWork,
      isBreak,
    };

    // Only add projectId and projectInputType if it's not admin work or break
    if (!isAdminWork && !isBreak) {
      if (!projectId) {
        console.log('Missing projectId for project work');
        return res.status(400).json({ message: "Project ID is required for project work" });
      }
      if (!projectInputType) {
        console.log('Missing projectInputType for project work');
        return res.status(400).json({ message: "Project input type is required for project work" });
      }
      updateData.projectId = projectId;
      updateData.projectInputType = projectInputType;
    } else {
      // Clear projectId and projectInputType for admin work or break
      updateData.projectId = null;
      updateData.projectInputType = null;
    }

    // Find and update the timesheet
    const timesheet = await Timesheet.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet entry not found" });
    }

    console.log('Timesheet updated successfully:', timesheet);
    res.json(timesheet);
  } catch (error) {
    console.error("Error updating timesheet:", error);
    res.status(400).json({ message: error.message });
  }
});

// Approve a timesheet entry
router.put("/:id/approve", auth, async (req, res) => {
  try {
    // Check if user has permission to approve timesheets
    if (!hasPermission(req.user, 'timesheets.approve')) {
      return res.status(403).json({ message: "Not authorized to approve timesheets" });
    }

    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet entry not found" });
    }

    timesheet.isApproved = true;
    timesheet.approvedBy = req.user._id;
    timesheet.approvedAt = new Date();
    await timesheet.save();

    res.json(timesheet);
  } catch (error) {
    console.error("Error approving timesheet:", error);
    res.status(500).json({ message: error.message });
  }
});

// Reject a timesheet entry
router.put("/:id/reject", auth, async (req, res) => {
  try {
    // Check if user has permission to approve timesheets
    if (!hasPermission(req.user, 'timesheets.approve')) {
      return res.status(403).json({ message: "Not authorized to reject timesheets" });
    }

    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet entry not found" });
    }

    timesheet.isApproved = false;
    timesheet.rejectedBy = req.user._id;
    timesheet.rejectedAt = new Date();
    await timesheet.save();

    res.json(timesheet);
  } catch (error) {
    console.error("Error rejecting timesheet:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update timesheet status for a specific date
router.put("/status/:date", auth, async (req, res) => {
  try {
    const { status, userId } = req.body;
    
    // Parse date in yyyy-MM-dd format
    const date = new Date(req.params.date);
    date.setUTCHours(0, 0, 0, 0);

    console.log('Updating timesheet status:', {
      inputDate: req.params.date,
      parsedDate: date.toISOString(),
      status,
      userId,
      user: req.user._id
    });

    // Validate status
    if (!["incomplete", "finalised", "absent"].includes(status)) {
      console.log('Invalid status:', status);
      return res.status(400).json({ message: "Invalid status" });
    }

    // Validate userId
    if (!userId) {
      console.log('No userId provided');
      return res.status(400).json({ message: "User ID is required" });
    }

    try {
      // Convert userId to ObjectId to validate format
      const targetUserId = new mongoose.Types.ObjectId(userId);
      
      // Find or create the timesheet status for this date
      const timesheetStatus = await TimesheetStatus.findOneAndUpdate(
        { userId: targetUserId, date: date },
        {
          status,
          updatedBy: req.user._id,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      console.log('Updated timesheet status:', timesheetStatus);

      // If status is absent, delete any existing timesheet entries
      if (status === "absent") {
        try {
          const deletedEntries = await Timesheet.deleteMany({
            userId: targetUserId,
            date: date
          });
          console.log('Deleted entries for absent status:', deletedEntries.deletedCount);
        } catch (error) {
          console.error('Error deleting entries for absent status:', error);
          // Continue execution even if deletion fails
        }
      }

      // If status is finalised and no entries exist, create a default entry
      if (status === "finalised") {
        try {
          const existingEntries = await Timesheet.find({
            userId: targetUserId,
            date: date
          });

          if (existingEntries.length === 0) {
            const newEntry = new Timesheet({
              userId: targetUserId,
              date: date,
              startTime: "09:00",
              endTime: "17:00",
              description: "Auto-generated entry for finalised status",
              isAdminWork: true,
              status: "finalised"
            });
            await newEntry.save();
            console.log('Created new entry for finalised status:', newEntry);
          }
        } catch (error) {
          console.error('Error creating default entry for finalised status:', error);
          // Continue execution even if creation fails
        }
      }

      res.json(timesheetStatus);
    } catch (error) {
      if (error instanceof mongoose.Error.CastError) {
        console.log('Invalid user ID format:', error);
        return res.status(400).json({ message: "Invalid user ID format" });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error updating timesheet status:", error);
    res.status(500).json({ 
      message: "Error updating timesheet status",
      details: error.message 
    });
  }
});

// Get timesheet status for a date range
router.get("/status/range/:startDate/:endDate", auth, async (req, res) => {
  try {
    console.log('Status range request received:', {
      params: req.params,
      query: req.query,
      user: req.user._id
    });

    // Validate date parameters
    if (!req.params.startDate || !req.params.endDate) {
      console.log('Missing date parameters');
      return res.json([]);
    }

    // Create dates at the start of the day in UTC
    let startDate, endDate;
    try {
      // Parse dates in yyyy-MM-dd format
      startDate = new Date(req.params.startDate);
      endDate = new Date(req.params.endDate);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log('Invalid date format:', { startDate: req.params.startDate, endDate: req.params.endDate });
        return res.json([]);
      }

      // Set time to start/end of day in UTC
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);

      // Validate date range
      if (startDate > endDate) {
        console.log('Invalid date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
        return res.json([]);
      }

      console.log('Parsed dates:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateLocal: startDate.toString(),
        endDateLocal: endDate.toString()
      });
    } catch (error) {
      console.error('Error parsing dates:', error);
      return res.json([]);
    }

    const query = {
      date: { $gte: startDate, $lte: endDate }
    };

    // If userId is provided and user has permission, show that user's statuses
    if (req.query.userId && hasPermission(req.user, 'timesheets.approve')) {
      try {
        query.userId = new mongoose.Types.ObjectId(req.query.userId);
      } catch (error) {
        console.error('Invalid user ID format:', error);
        return res.json([]);
      }
    } else {
      query.userId = req.user._id;
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    try {
      const statuses = await TimesheetStatus.find(query)
        .populate('userId', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName')
        .sort({ date: 1 });

      console.log('Found statuses:', statuses.length);
      res.json(statuses || []);
    } catch (error) {
      console.error('Database error:', error);
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching timesheet statuses:", error);
    res.json([]);
  }
});

// Get timesheet review data for a date range
router.get("/review/:startDate/:endDate", auth, async (req, res) => {
  try {
    console.log('Review endpoint - Request details:', {
      startDate: req.params.startDate,
      endDate: req.params.endDate,
      userId: req.query.userId,
      currentUser: {
        id: req.user._id,
        role: req.user.role
      }
    });

    // Parse dates in yyyy-MM-dd format
    let start, end;
    try {
      start = new Date(req.params.startDate);
      end = new Date(req.params.endDate);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date format:', { startDate: req.params.startDate, endDate: req.params.endDate });
        return res.status(400).json({ message: "Invalid date format. Expected yyyy-MM-dd" });
      }

      // Set time to start/end of day in UTC
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);

      console.log('Parsed dates:', {
        start: start.toISOString(),
        end: end.toISOString()
      });
    } catch (error) {
      console.error('Error parsing dates:', error);
      return res.status(400).json({ message: "Error parsing dates" });
    }
    
    // Build query based on whether we're looking at a specific user's timesheets
    const query = {
      date: {
        $gte: start,
        $lte: end
      }
    };

    // If userId is provided and user has permission to approve timesheets, show that user's timesheets
    if (req.query.userId && hasPermission(req.user, 'timesheets.approve')) {
      try {
        query.userId = new mongoose.Types.ObjectId(req.query.userId);
        console.log('Review endpoint - Using provided userId in query:', req.query.userId);
      } catch (error) {
        console.error('Review endpoint - Invalid user ID format:', error);
        return res.status(400).json({ message: "Invalid user ID format" });
      }
    } else {
      // Otherwise, only show the current user's timesheets
      query.userId = req.user._id;
      console.log('Review endpoint - Using current user ID in query:', req.user._id);
    }
    
    console.log('Review endpoint - Final query:', JSON.stringify(query, null, 2));
    
    // Get all timesheet entries for the date range
    const entries = await Timesheet.find(query)
      .populate('userId', 'firstName lastName')
      .populate('finalisedBy', 'firstName lastName');

    // Get all timesheet statuses for the date range
    const statuses = await TimesheetStatus.find(query)
      .populate('userId', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    console.log('Review endpoint - Found data:', {
      entriesCount: entries.length,
      statusesCount: statuses.length
    });

    // Create a map of statuses by date
    const statusMap = {};
    statuses.forEach(status => {
      const date = format(new Date(status.date), 'yyyy-MM-dd');
      // Only store non-incomplete statuses
      if (status.status && status.status !== 'incomplete') {
        statusMap[date] = status.status;
      }
    });

    // Group entries by user and date
    const timesheetData = entries.reduce((acc, entry) => {
      if (!entry.userId) return acc; // Skip entries with no user

      const date = format(new Date(entry.date), 'yyyy-MM-dd');
      const userId = entry.userId._id.toString();
      const key = `${userId}-${date}`;

      if (!acc[key]) {
        acc[key] = {
          userId: userId,
          userName: `${entry.userId.firstName} ${entry.userId.lastName}`,
          date: date,
          totalTime: 0,
          projectTime: 0,
          status: statusMap[date] || 'incomplete',
          authorizationStatus: entry.isApproved ? 'authorized' : 
                             entry.rejectedBy ? 'query' : 'to_be_authorized'
        };
      }

      // Calculate time in minutes
      const [startHours, startMinutes] = entry.startTime.split(':').map(Number);
      const [endHours, endMinutes] = entry.endTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      let duration = endTotalMinutes - startTotalMinutes;
      if (duration < 0) duration += 24 * 60;

      acc[key].totalTime += duration;
      if (!entry.isAdminWork && !entry.isBreak) {
        acc[key].projectTime += duration;
      }

      return acc;
    }, {});

    // Create entries for all days in the month
    const allDays = eachDayOfInterval({ start, end });
    const completeData = allDays.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const userId = req.query.userId || req.user._id.toString();
      const key = `${userId}-${dateStr}`;
      
      // Get user name from first entry if available
      const userName = entries[0]?.userId ? 
        `${entries[0].userId.firstName} ${entries[0].userId.lastName}` : 
        'No User';
      
      return timesheetData[key] || {
        userId: userId,
        userName: userName,
        date: dateStr,
        totalTime: 0,
        projectTime: 0,
        status: statusMap[dateStr] || 'incomplete',
        authorizationStatus: 'to_be_authorized'
      };
    });

    res.json(completeData);
  } catch (error) {
    console.error("Review endpoint - Error:", error);
    res.status(500).json({ 
      message: "Error fetching timesheet review data",
      details: error.message 
    });
  }
});

// Get timesheets by project ID
router.get("/by-project/:projectId", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log('Fetching timesheets by project:', {
      projectId,
      startDate,
      endDate,
      user: req.user._id
    });

    // Build query
    const query = { projectId: new mongoose.Types.ObjectId(projectId) };
    
    // Add date range filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
      
      query.date = {
        $gte: start,
        $lte: end
      };
    }

    console.log('Timesheet query:', JSON.stringify(query, null, 2));

    // Find timesheets for this project
    const timesheets = await Timesheet.find(query)
      .populate('userId', 'firstName lastName')
      .populate('projectId', 'name projectID')
      .sort({ date: -1, startTime: -1 });

    console.log(`Found ${timesheets.length} timesheets for project ${projectId}`);

    res.json({
      count: timesheets.length,
      entries: timesheets
    });
  } catch (error) {
    console.error("Error fetching timesheets by project:", error);
    res.status(500).json({ 
      message: "Error fetching timesheets by project",
      details: error.message 
    });
  }
});

// Authorize a timesheet for a specific user and date
router.put("/:userId/:date/approve", auth, async (req, res) => {
  try {
    // Check if user has permission to approve timesheets
    if (!hasPermission(req.user, 'timesheets.approve')) {
      return res.status(403).json({ message: "Not authorized to approve timesheets" });
    }

    const { userId, date } = req.params;
    
    // Find all timesheet entries for this user and date
    const timesheets = await Timesheet.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: new Date(date)
    });

    if (!timesheets || timesheets.length === 0) {
      return res.status(404).json({ message: "No timesheet entries found for this date" });
    }

    // Update all entries for this date
    const updatePromises = timesheets.map(timesheet => {
      timesheet.isApproved = true;
      timesheet.approvedBy = req.user._id;
      timesheet.approvedAt = new Date();
      return timesheet.save();
    });

    await Promise.all(updatePromises);

    // Update the timesheet status
    await TimesheetStatus.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        date: new Date(date)
      },
      {
        status: 'authorized',
        updatedBy: req.user._id,
        updatedAt: new Date()
      },
      { upsert: true }
    );

    res.json({ message: "Timesheet authorized successfully" });
  } catch (error) {
    console.error("Error authorizing timesheet:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 