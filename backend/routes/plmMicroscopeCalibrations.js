const express = require('express');
const router = express.Router();
const PLMMicroscopeCalibration = require('../models/PLMMicroscopeCalibration');
const Equipment = require('../models/Equipment');
const CalibrationFrequency = require('../models/CalibrationFrequency');

// Get all PLM microscope calibrations
router.get('/', async (req, res) => {
  try {
    const { microscopeReference } = req.query;
    
    let filter = {};
    if (microscopeReference) {
      filter.microscopeReference = { $regex: microscopeReference, $options: 'i' };
    }

    const calibrations = await PLMMicroscopeCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    const data = calibrations.map(calibration => ({
      _id: calibration._id,
      calibrationId: calibration.calibrationId,
      microscopeReference: calibration.microscopeReference,
      date: calibration.date,
      servicingCompany: calibration.servicingCompany,
      serviceReportUrl: calibration.serviceReportUrl,
      notes: calibration.notes,
      nextCalibration: calibration.nextCalibration,
      calibratedBy: calibration.calibratedBy ? {
        _id: calibration.calibratedBy._id,
        name: `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
      } : null,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching PLM microscope calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch PLM microscope calibrations' });
  }
});

// Get all PLM microscopes from equipment
router.get('/equipment', async (req, res) => {
  try {
    const microscopes = await Equipment.find({ 
      equipmentType: 'Polarised Light Microscope'
    }).sort({ equipmentReference: 1 });

    res.json(microscopes);
  } catch (error) {
    console.error('Error fetching PLM microscopes:', error);
    res.status(500).json({ error: 'Failed to fetch PLM microscopes' });
  }
});

// Get calibrations by microscope reference
router.get('/equipment/:microscopeReference', async (req, res) => {
  try {
    const calibrations = await PLMMicroscopeCalibration.find({
      microscopeReference: req.params.microscopeReference
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    const data = calibrations.map(calibration => ({
      _id: calibration._id,
      calibrationId: calibration.calibrationId,
      microscopeReference: calibration.microscopeReference,
      date: calibration.date,
      servicingCompany: calibration.servicingCompany,
      serviceReportUrl: calibration.serviceReportUrl,
      notes: calibration.notes,
      nextCalibration: calibration.nextCalibration,
      calibratedBy: calibration.calibratedBy ? {
        _id: calibration.calibratedBy._id,
        name: `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
      } : null,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching PLM microscope calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch PLM microscope calibrations' });
  }
});

// Create new PLM microscope calibration
router.post('/', async (req, res) => {
  try {
    console.log('PLM Microscope calibration creation request:', req.body);
    
    const {
      microscopeReference,
      date,
      servicingCompany,
      serviceReportUrl,
      notes,
      calibratedBy
    } = req.body;

    // Generate calibration ID if not provided
    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await PLMMicroscopeCalibration.countDocuments();
      calibrationId = `PLM-${String(count + 1).padStart(4, '0')}`;
    }

    // Validate required fields
    if (!microscopeReference || !date || !servicingCompany || !calibratedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate nextCalibration based on calibration frequency if not provided
    let nextCalibrationDate = null;
    if (!req.body.nextCalibration) {
      try {
        const equipment = await Equipment.findOne({ equipmentReference: microscopeReference });
        let frequencyInMonths = null;
        
        if (equipment && equipment.equipmentType) {
          // Try to get calibration frequency from CalibrationFrequency model (preferred source)
          const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
            equipmentType: equipment.equipmentType 
          });
          
          if (calibrationFreqConfig) {
            // Convert to months if needed
            if (calibrationFreqConfig.frequencyUnit === 'years') {
              frequencyInMonths = calibrationFreqConfig.frequencyValue * 12;
            } else {
              frequencyInMonths = calibrationFreqConfig.frequencyValue;
            }
          } else if (equipment.calibrationFrequency) {
            // Fall back to equipment's calibrationFrequency field
            frequencyInMonths = equipment.calibrationFrequency;
          }
        }
        
        if (frequencyInMonths) {
          const nextDue = new Date(date);
          nextDue.setMonth(nextDue.getMonth() + frequencyInMonths);
          nextCalibrationDate = nextDue;
        }
      } catch (error) {
        console.error('Error calculating next calibration date:', error);
        // Continue without nextCalibration if calculation fails
      }
    } else {
      nextCalibrationDate = new Date(req.body.nextCalibration);
    }

    const calibrationData = {
      calibrationId,
      microscopeReference,
      date: new Date(date),
      servicingCompany,
      serviceReportUrl: serviceReportUrl || null,
      notes: notes || '',
      nextCalibration: nextCalibrationDate,
      calibratedBy
    };

    console.log('Calibration data to save:', calibrationData);
    
    const calibration = new PLMMicroscopeCalibration(calibrationData);
    await calibration.save();

    console.log('Calibration saved successfully:', calibration);

    res.status(201).json({
      message: 'PLM microscope calibration created successfully',
      calibration: calibration
    });
  } catch (error) {
    console.error('Error creating PLM microscope calibration:', error);
    res.status(500).json({ error: 'Failed to create PLM microscope calibration' });
  }
});

// Update PLM microscope calibration
router.put('/:id', async (req, res) => {
  try {
    const {
      microscopeReference,
      date,
      servicingCompany,
      serviceReportUrl,
      notes
    } = req.body;

    // Validate required fields
    if (!microscopeReference || !date || !servicingCompany) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get existing calibration to check if nextCalibration needs to be recalculated
    const existingCalibration = await PLMMicroscopeCalibration.findById(req.params.id);
    if (!existingCalibration) {
      return res.status(404).json({ error: 'PLM microscope calibration not found' });
    }
    
    const updateData = {
      microscopeReference,
      date: new Date(date),
      servicingCompany,
      serviceReportUrl: serviceReportUrl || null,
      notes: notes || ''
    };

    // If nextCalibration is provided, include it; otherwise calculate it based on equipment calibration frequency
    // Always recalculate if not provided to ensure it's set
    if (req.body.nextCalibration) {
      updateData.nextCalibration = new Date(req.body.nextCalibration);
    } else {
      // Calculate nextCalibration based on calibration frequency configuration
      try {
        const equipment = await Equipment.findOne({ equipmentReference: microscopeReference });
        let frequencyInMonths = null;
        
        if (equipment && equipment.equipmentType) {
          // Try to get calibration frequency from CalibrationFrequency model (preferred source)
          const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
            equipmentType: equipment.equipmentType 
          });
          
          if (calibrationFreqConfig) {
            // Convert to months if needed
            if (calibrationFreqConfig.frequencyUnit === 'years') {
              frequencyInMonths = calibrationFreqConfig.frequencyValue * 12;
            } else {
              frequencyInMonths = calibrationFreqConfig.frequencyValue;
            }
          } else if (equipment.calibrationFrequency) {
            // Fall back to equipment's calibrationFrequency field
            frequencyInMonths = equipment.calibrationFrequency;
          }
        }
        
        if (frequencyInMonths) {
          const nextDue = new Date(date);
          nextDue.setMonth(nextDue.getMonth() + frequencyInMonths);
          updateData.nextCalibration = nextDue;
        }
      } catch (error) {
        console.error('Error calculating next calibration date:', error);
        // Continue without nextCalibration if calculation fails
      }
    }

    const calibration = await PLMMicroscopeCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'PLM microscope calibration updated successfully',
      calibration: calibration
    });
  } catch (error) {
    console.error('Error updating PLM microscope calibration:', error);
    res.status(500).json({ error: 'Failed to update PLM microscope calibration' });
  }
});

// Delete PLM microscope calibration
router.delete('/:id', async (req, res) => {
  try {
    const calibration = await PLMMicroscopeCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'PLM microscope calibration not found' });
    }

    res.json({ message: 'PLM microscope calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting PLM microscope calibration:', error);
    res.status(500).json({ error: 'Failed to delete PLM microscope calibration' });
  }
});

module.exports = router;
