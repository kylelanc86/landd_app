const express = require("express");
const router = express.Router();
const Timesheet = require("../models/Timesheet");
const TimesheetStatus = require("../models/TimesheetStatus");
const auth = require("../middleware/auth");
const { ROLE_PERMISSIONS } = require("../config/permissions");
const { format, eachDayOfInterval } = require('date-fns');
const mongoose = require('mongoose');

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
      // Parse dates and ensure they're in UTC
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
      } catch (error) {
        console.error('Invalid user ID format:', error);
        return res.json([]);
      }
    } else {
      // Otherwise, only show the current user's timesheets
      query.userId = req.user._id;
    }
    
    console.log('Query:', JSON.stringify(query, null, 2));
    
    try {
      const timesheets = await Timesheet.find(query)
        .sort({ date: 1, startTime: 1 })
        .populate('userId', 'firstName lastName')
        .populate('projectId', 'name')
        .populate('finalisedBy', 'firstName lastName');
      
      console.log('Found timesheets:', timesheets.length);
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
    // Create date object at UTC midnight
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

    // Validate projectId and projectInputType if not admin work or break
    if (!isAdminWork && !isBreak && !projectId) {
      console.log('Missing projectId for project work');
      return res.status(400).json({ message: "Project ID is required for project work" });
    }

    if (!isAdminWork && !isBreak && !projectInputType) {
      console.log('Missing projectInputType for project work');
      return res.status(400).json({ message: "Project input type is required for project work" });
    }

    // Create date object in UTC
    const entryDate = new Date(date);
    entryDate.setUTCHours(0, 0, 0, 0);
    console.log('Created date object:', entryDate.toISOString());

    const timesheet = new Timesheet({
      userId: req.user._id,
      date: entryDate,
      startTime,
      endTime,
      projectId: isAdminWork || isBreak ? null : projectId,
      description: description || "",
      isAdminWork,
      isBreak,
      projectInputType: isAdminWork || isBreak ? null : projectInputType,
    });

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

    // Validate projectId and projectInputType if not admin work or break
    if (!isAdminWork && !isBreak && !projectId) {
      console.log('Missing projectId for project work');
      return res.status(400).json({ message: "Project ID is required for project work" });
    }

    if (!isAdminWork && !isBreak && !projectInputType) {
      console.log('Missing projectInputType for project work');
      return res.status(400).json({ message: "Project input type is required for project work" });
    }

    // Create date object in UTC
    const entryDate = new Date(date);
    entryDate.setUTCHours(0, 0, 0, 0);
    console.log('Created date object:', entryDate.toISOString());

    // Find and update the timesheet
    const timesheet = await Timesheet.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        date: entryDate,
        startTime,
        endTime,
        projectId: isAdminWork || isBreak ? null : projectId,
        description: description || "",
        isAdminWork,
        isBreak,
        projectInputType: isAdminWork || isBreak ? null : projectInputType,
      },
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
    const date = new Date(req.params.date);
    date.setUTCHours(0, 0, 0, 0);

    console.log('Updating timesheet status:', {
      date: date.toISOString(),
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
      // Parse dates and ensure they're in UTC
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
    const { startDate, endDate } = req.params;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    console.log('Fetching timesheets from', start.toISOString(), 'to', end.toISOString());
    
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
      } catch (error) {
        console.error('Invalid user ID format:', error);
        return res.status(400).json({ message: "Invalid user ID format" });
      }
    } else {
      // Otherwise, only show the current user's timesheets
      query.userId = req.user._id;
    }
    
    console.log('Query:', query);
    
    // Get all timesheet entries for the date range
    const entries = await Timesheet.find(query)
      .populate('userId', 'firstName lastName')
      .populate('finalisedBy', 'firstName lastName');

    console.log('Found timesheets:', entries.length);

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
          status: entry.status || 'incomplete',
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
        status: 'incomplete',
        authorizationStatus: 'to_be_authorized'
      };
    });

    res.json(completeData);
  } catch (error) {
    console.error("Error fetching timesheet review data:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 