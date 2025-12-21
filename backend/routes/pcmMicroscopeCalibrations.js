const express = require('express');
const router = express.Router();
const PCMMicroscopeCalibration = require('../models/PCMMicroscopeCalibration');
const Equipment = require('../models/Equipment');
const GraticuleCalibration = require('../models/GraticuleCalibration');
const CalibrationFrequency = require('../models/CalibrationFrequency');

// Get all PCM microscope calibrations
router.get('/', async (req, res) => {
  try {
    const { microscopeReference } = req.query;
    
    let filter = {};
    if (microscopeReference) {
      filter.microscopeReference = { $regex: microscopeReference, $options: 'i' };
    }

    const calibrations = await PCMMicroscopeCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    const data = calibrations.map(calibration => ({
      _id: calibration._id,
      calibrationId: calibration.calibrationId,
      microscopeReference: calibration.microscopeReference,
      date: calibration.date,
      servicingCompany: calibration.servicingCompany,
      graticule: calibration.graticule,
      graticuleArea: calibration.graticuleArea,
      constant25mm: calibration.constant25mm,
      constant13mm: calibration.constant13mm,
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
    console.error('Error fetching PCM microscope calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch PCM microscope calibrations' });
  }
});

// Get all PCM microscopes from equipment
router.get('/equipment', async (req, res) => {
  try {
    const microscopes = await Equipment.find({ 
      equipmentType: 'Microscope',
      section: 'Air Monitoring'
    }).sort({ equipmentReference: 1 });

    res.json(microscopes);
  } catch (error) {
    console.error('Error fetching PCM microscopes:', error);
    res.status(500).json({ error: 'Failed to fetch PCM microscopes' });
  }
});

// Get graticules from equipment with latest calibration data
router.get('/graticules', async (req, res) => {
  try {
    const graticules = await Equipment.find({ 
      equipmentType: 'Graticule',
      section: 'Air Monitoring'
    }).sort({ equipmentReference: 1 });

    // Get latest calibration data for each graticule
    const graticulesWithCalibration = await Promise.all(
      graticules.map(async (graticule) => {
        // Get the latest calibration for this graticule
        const latestCalibration = await GraticuleCalibration.findOne({
          graticuleId: graticule.equipmentReference
        }).sort({ date: -1 });

        let area = null;
        if (latestCalibration && latestCalibration.scale) {
          // Extract diameter from scale field (format: "100 µm (Area: 7853.98 µm²)")
          const diameterMatch = latestCalibration.scale.match(/(\d+(?:\.\d+)?)\s*µm/);
          if (diameterMatch) {
            const diameter = parseFloat(diameterMatch[1]);
            // Calculate area using formula: (π * diameter²) / 4
            area = (Math.PI * diameter * diameter) / 4;
          }
        }

        return {
          ...graticule.toObject(),
          latestCalibration: latestCalibration ? {
            date: latestCalibration.date,
            scale: latestCalibration.scale,
            area: area
          } : null
        };
      })
    );

    res.json(graticulesWithCalibration);
  } catch (error) {
    console.error('Error fetching graticules:', error);
    res.status(500).json({ error: 'Failed to fetch graticules' });
  }
});

// Get calibrations by microscope reference
router.get('/equipment/:microscopeReference', async (req, res) => {
  try {
    const calibrations = await PCMMicroscopeCalibration.find({
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
      graticule: calibration.graticule,
      graticuleArea: calibration.graticuleArea,
      constant25mm: calibration.constant25mm,
      constant13mm: calibration.constant13mm,
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
    console.error('Error fetching PCM microscope calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch PCM microscope calibrations' });
  }
});

// Create new PCM microscope calibration
router.post('/', async (req, res) => {
  try {
    console.log('PCM Microscope calibration creation request:', req.body);
    
    const {
      microscopeReference,
      date,
      servicingCompany,
      graticule,
      graticuleArea,
      constant25mm,
      constant13mm,
      serviceReportUrl,
      notes,
      calibratedBy
    } = req.body;

    // Generate calibration ID if not provided
    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await PCMMicroscopeCalibration.countDocuments();
      calibrationId = `PCM-${String(count + 1).padStart(4, '0')}`;
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
      graticule: graticule || null,
      graticuleArea: graticuleArea ? parseFloat(graticuleArea) : null,
      constant25mm: constant25mm ? parseFloat(constant25mm) : null,
      constant13mm: constant13mm ? parseFloat(constant13mm) : null,
      serviceReportUrl: serviceReportUrl || null,
      notes: notes || '',
      nextCalibration: nextCalibrationDate,
      calibratedBy
    };

    console.log('Calibration data to save:', calibrationData);
    
    const calibration = new PCMMicroscopeCalibration(calibrationData);
    await calibration.save();

    console.log('Calibration saved successfully:', calibration);

    res.status(201).json({
      message: 'PCM microscope calibration created successfully',
      calibration: calibration
    });
  } catch (error) {
    console.error('Error creating PCM microscope calibration:', error);
    res.status(500).json({ error: 'Failed to create PCM microscope calibration' });
  }
});

// Update PCM microscope calibration
router.put('/:id', async (req, res) => {
  try {
    const {
      microscopeReference,
      date,
      servicingCompany,
      graticule,
      graticuleArea,
      constant25mm,
      constant13mm,
      serviceReportUrl,
      notes
    } = req.body;

    // Validate required fields
    if (!microscopeReference || !date || !servicingCompany) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get existing calibration to check if nextCalibration needs to be recalculated
    const existingCalibration = await PCMMicroscopeCalibration.findById(req.params.id);
    if (!existingCalibration) {
      return res.status(404).json({ error: 'PCM microscope calibration not found' });
    }
    
    const updateData = {
      microscopeReference,
      date: new Date(date),
      servicingCompany,
      graticule: graticule || null,
      graticuleArea: graticuleArea ? parseFloat(graticuleArea) : null,
      constant25mm: constant25mm ? parseFloat(constant25mm) : null,
      constant13mm: constant13mm ? parseFloat(constant13mm) : null,
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

    const calibration = await PCMMicroscopeCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'PCM microscope calibration updated successfully',
      calibration: calibration
    });
  } catch (error) {
    console.error('Error updating PCM microscope calibration:', error);
    res.status(500).json({ error: 'Failed to update PCM microscope calibration' });
  }
});

// Delete PCM microscope calibration
router.delete('/:id', async (req, res) => {
  try {
    const calibration = await PCMMicroscopeCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'PCM microscope calibration not found' });
    }

    res.json({ message: 'PCM microscope calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting PCM microscope calibration:', error);
    res.status(500).json({ error: 'Failed to delete PCM microscope calibration' });
  }
});

module.exports = router;
