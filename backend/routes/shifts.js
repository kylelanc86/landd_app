const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const mongoose = require('mongoose');
const axios = require('axios');

// Debug middleware to log all requests to shifts routes
router.use((req, res, next) => {
  console.log('=== SHIFTS ROUTE HIT ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Full URL:', req.url);
  next();
});

// Get all shifts
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shifts = await Shift.find()
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shifts by job ID
router.get('/job/:jobId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    // Check if the job exists in either AirMonitoringJob or AsbestosRemovalJob
    const airMonitoringJob = await mongoose.model('AirMonitoringJob').findById(req.params.jobId);
    const asbestosRemovalJob = await mongoose.model('AsbestosRemovalJob').findById(req.params.jobId);
    
    if (!airMonitoringJob && !asbestosRemovalJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Fetch the shifts for this job
    const shifts = await Shift.find({ job: req.params.jobId })
      .populate({
        path: 'job',
        select: 'jobID name projectId status asbestosRemovalist description projectName client',
        populate: {
          path: 'projectId',
          select: 'projectID name'
        }
      })
      .populate('samples');
    
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get shifts by multiple job IDs
router.post('/jobs', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const { jobIds } = req.body;
    const shifts = await Shift.find({ job: { $in: jobIds } })
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Proxy endpoint for Google Maps Static API to avoid CORS issues
router.get('/proxy-static-map', auth, checkPermission(['jobs.view']), async (req, res) => {
  console.log('=== PROXY ENDPOINT HIT ===');
  console.log('Request URL:', req.url);
  console.log('Request query:', req.query);
  console.log('User:', req.user);
  try {
    const { url, crop } = req.query;
    
    if (!url) {
      return res.status(400).json({ message: 'URL parameter is required' });
    }

    // Validate that it's a Google Maps Static API URL
    if (!url.includes('maps.googleapis.com/maps/api/staticmap')) {
      return res.status(400).json({ message: 'Invalid URL - must be Google Maps Static API' });
    }

    console.log('Proxying Google Maps Static API request:', url);
    console.log('Crop requested:', crop);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'LandD-App/1.0'
      }
    });

    console.log('Google Maps API response status:', response.status);
    console.log('Google Maps API response headers:', response.headers);
    console.log('Response data size:', response.data.length);

    // Check if the response is actually an image
    if (response.data.length < 1000) {
      // Likely an error response, let's see what it contains
      const errorText = Buffer.from(response.data).toString('utf-8');
      console.log('Small response body (likely error):', errorText);
      return res.status(400).json({ 
        message: 'Google Maps API returned error response',
        error: errorText 
      });
    }

    let imageBuffer = response.data;

    // If crop is requested, crop the bottom portion to remove Google footer
    if (crop === 'true') {
      try {
        const sharp = require('sharp');
        // Get image metadata to determine actual size
        const metadata = await sharp(response.data).metadata();
        console.log('Original image dimensions:', metadata.width, 'x', metadata.height);
        
        // Crop the bottom ~20% to remove Google footer/watermark
        const cropHeight = Math.floor(metadata.height * 0.8);
        
        imageBuffer = await sharp(response.data)
          .extract({ left: 0, top: 0, width: metadata.width, height: cropHeight })
          .toBuffer();
        console.log('Image cropped successfully to:', metadata.width, 'x', cropHeight);
      } catch (cropError) {
        console.error('Error cropping image:', cropError);
        console.error('Crop error details:', cropError.message);
        // If cropping fails, return original image
        console.log('Returning original uncropped image due to crop error');
      }
    }

    // Set appropriate headers for image response
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/png',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    res.send(imageBuffer);
  } catch (error) {
    console.error('Error proxying static map:', error);
    res.status(500).json({ 
      message: 'Failed to fetch static map image',
      error: error.message 
    });
  }
});

// Get single shift
router.get('/:id', auth, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'jobID name projectId status asbestosRemovalist description projectName client',
        populate: {
          path: 'projectId',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName');
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new shift
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    console.log('Creating shift with data:', req.body);
    
    // Validate required fields
    const requiredFields = ['job', 'jobModel', 'name', 'date', 'startTime', 'endTime', 'supervisor'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({ 
        message: 'Missing required fields', 
        fields: missingFields 
      });
    }
    
    const shift = new Shift(req.body);
    console.log('Shift object created:', shift);
    
    const newShift = await shift.save();
    console.log('Shift saved successfully:', newShift._id);
    
    res.status(201).json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      errors: error.errors
    });
    res.status(400).json({ 
      message: error.message,
      details: error.errors || {}
    });
  }
});

// Update a shift
router.patch('/:id', auth, checkPermission(['jobs.edit', 'jobs.authorize_reports']), async (req, res) => {
  try {
    console.log('PATCH /shifts/:id - Request body:', req.body);
    console.log('PATCH /shifts/:id - Shift ID:', req.params.id);
    
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      console.log('Shift not found:', req.params.id);
      return res.status(404).json({ message: 'Shift not found' });
    }
    
    console.log('Found shift:', shift._id);

    // Only update the fields that are provided in the request
    const allowedUpdates = [
      'status',
      'reportApprovedBy',
      'reportIssueDate',
      'analysedBy',
      'analysisDate',
      'samplesReceivedDate',
      'descriptionOfWorks',
      'notes',
      'defaultSampler',
      'revision',
      'sitePlan',
      'sitePlanData'
    ];

    // Filter out any fields that aren't in allowedUpdates
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    // Update each field individually
    for (const [key, value] of Object.entries(updates)) {
      shift[key] = value;
    }
    
    // Ensure descriptionOfWorks is set (for existing shifts that might not have it)
    if (!shift.descriptionOfWorks) {
      shift.descriptionOfWorks = "";
    }
    
    // Ensure jobModel is set (for existing shifts that might not have it)
    if (!shift.jobModel) {
      shift.jobModel = "AsbestosRemovalJob"; // Default to AsbestosRemovalJob since we're phasing out AirMonitoringJob
    }
    
    console.log('Shift before validation:', {
      _id: shift._id,
      descriptionOfWorks: shift.descriptionOfWorks,
      status: shift.status,
      job: shift.job,
      jobModel: shift.jobModel
    });

    try {
      // Validate the document before saving
      const validationError = shift.validateSync();
      if (validationError) {
        console.log('Validation error:', validationError);
        return res.status(400).json({ 
          message: 'Validation error updating shift',
          details: validationError.message,
          errors: validationError.errors
        });
      }

      const updatedShift = await shift.save();
      // Update project's reports_present field if shift is completed
      if (updatedShift.status === 'analysis_complete' || updatedShift.status === 'shift_complete' || updatedShift.reportApprovedBy) {
        try {
          const populatedShift = await Shift.findById(updatedShift._id)
            .populate({
              path: 'job',
              populate: {
                path: 'projectId',
                select: '_id'
              }
            });
          if (populatedShift.job && populatedShift.job.projectId) {
            await Project.findByIdAndUpdate(
              populatedShift.job.projectId._id,
              { reports_present: true }
            );
            console.log(`Updated project ${populatedShift.job.projectId._id} reports_present to true due to completed shift`);
          }
        } catch (error) {
          console.error("Error updating project reports_present field:", error);
        }
      }
      res.json(updatedShift);
    } catch (saveError) {
      return res.status(400).json({ 
        message: 'Error saving shift',
        details: saveError.message,
        errors: saveError.errors
      });
    }
  } catch (error) {
    res.status(400).json({ 
      message: error.message,
      details: error.stack
    });
  }
});

// Update a shift (PUT)
router.put('/:id', auth, checkPermission(['jobs.edit', 'jobs.authorize_reports']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }


    // Update all fields from the request body
    Object.assign(shift, req.body);

    try {
      // Validate before saving
      const validationError = shift.validateSync();
      if (validationError) {
        return res.status(400).json({ 
          message: 'Validation error updating shift',
          details: validationError.message,
          errors: validationError.errors
        });
      }

      const updatedShift = await shift.save();
      
      
      res.json(updatedShift);
    } catch (saveError) {
      return res.status(400).json({ 
        message: 'Error saving shift',
        details: saveError.message,
        errors: saveError.errors
      });
    }
  } catch (error) {
    res.status(400).json({ 
      message: error.message,
      details: error.stack
    });
  }
});

// Delete a shift
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const shift = await Shift.findByIdAndDelete(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save site plan data for a shift
router.patch('/:id/site-plan', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    const { sitePlan, sitePlanData } = req.body;
    
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Update site plan fields
    shift.sitePlan = sitePlan;
    if (sitePlanData) {
      shift.sitePlanData = sitePlanData;
    } else if (!sitePlan) {
      // If sitePlan is false, clear the sitePlanData
      shift.sitePlanData = undefined;
    }

    await shift.save();
    res.json(shift);
  } catch (error) {
    console.error('Error saving site plan:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get site plan data for a shift
router.get('/:id/site-plan', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .select('sitePlan sitePlanData');
    
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    res.json({
      sitePlan: shift.sitePlan,
      sitePlanData: shift.sitePlanData
    });
  } catch (error) {
    console.error('Error fetching site plan:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;