const express = require('express');
const router = express.Router();
const RiLiquidCalibration = require('../models/RiLiquidCalibration');
const RiLiquidBottle = require('../models/RiLiquidBottle');
const CalibrationFrequency = require('../models/CalibrationFrequency');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

const ALLOWED_REFRACTIVE_INDICES = [1.55, 1.67, 1.70];

const refractiveIndexPrefix = (value) => {
  const numericValue = Number(value);
  return numericValue === 1.7 ? '1.70' : numericValue.toFixed(2);
};

// Get all RI Liquid calibrations
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      bottleId,
      status, 
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {};
    if (bottleId) filter.bottleId = bottleId;
    if (status) filter.status = status;
    // emptyOnly: only emptied bottles; includeEmpty: active + empty; default: active only
    if (req.query.emptyOnly === 'true') {
      filter.isEmpty = true;
    } else if (req.query.includeEmpty !== 'true') {
      filter.isEmpty = { $ne: true };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await RiLiquidCalibration.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await RiLiquidCalibration.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        bottleId: cal.bottleId,
        date: cal.date,
        refractiveIndex: cal.refractiveIndex,
        asbestosTypeVerified: cal.asbestosTypeVerified,
        dateOpened: cal.dateOpened,
        batchNumber: cal.batchNumber,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        isEmpty: cal.isEmpty,
        dateEmptied: cal.dateEmptied,
        calibratedBy: cal.calibratedBy,
        createdAt: cal.createdAt,
        updatedAt: cal.updatedAt
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
    console.error('Error fetching RI Liquid calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get active bottles, including legacy bottles represented only by calibration records
router.get('/bottles/active', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const [bottles, activeCalibrations] = await Promise.all([
      RiLiquidBottle.find({ isEmpty: { $ne: true } }).sort({ bottleId: 1 }).lean(),
      RiLiquidCalibration.find({ isEmpty: { $ne: true } })
        .sort({ date: -1 })
        .populate('calibratedBy', 'firstName lastName')
        .lean()
    ]);

    const latestCalibrationByBottle = new Map();
    activeCalibrations.forEach((calibration) => {
      if (
        calibration.bottleId &&
        !latestCalibrationByBottle.has(calibration.bottleId)
      ) {
        latestCalibrationByBottle.set(calibration.bottleId, calibration);
      }
    });

    const bottleById = new Map();
    bottles.forEach((bottle) => {
      bottleById.set(bottle.bottleId, {
        ...bottle,
        latestCalibration:
          latestCalibrationByBottle.get(bottle.bottleId) || null
      });
    });

    // Existing installations stored bottle details only on calibrations.
    latestCalibrationByBottle.forEach((calibration, bottleId) => {
      if (!bottleById.has(bottleId)) {
        bottleById.set(bottleId, {
          bottleId,
          refractiveIndex: calibration.refractiveIndex,
          batchNumber: calibration.batchNumber,
          dateOpened: calibration.dateOpened,
          isEmpty: false,
          isLegacy: true,
          latestCalibration: calibration
        });
      }
    });

    const data = Array.from(bottleById.values()).sort((a, b) =>
      a.bottleId.localeCompare(b.bottleId, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );

    res.json({ data });
  } catch (error) {
    console.error('Error fetching active RI Liquid bottles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get empty bottles with all calibration records for history
router.get('/bottles/empty', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const [bottles, emptyCalibrations] = await Promise.all([
      RiLiquidBottle.find({ isEmpty: true }).lean(),
      RiLiquidCalibration.find({ isEmpty: true })
        .sort({ date: -1 })
        .populate('calibratedBy', 'firstName lastName')
        .lean()
    ]);

    const calibrationsByBottle = new Map();
    emptyCalibrations.forEach((calibration) => {
      const records = calibrationsByBottle.get(calibration.bottleId) || [];
      records.push(calibration);
      calibrationsByBottle.set(calibration.bottleId, records);
    });

    const bottleById = new Map();
    bottles.forEach((bottle) => {
      bottleById.set(bottle.bottleId, {
        ...bottle,
        calibrations: calibrationsByBottle.get(bottle.bottleId) || []
      });
    });

    calibrationsByBottle.forEach((calibrations, bottleId) => {
      if (!bottleById.has(bottleId)) {
        const latest = calibrations[0];
        const dateEmptied = calibrations.reduce(
          (latestDate, calibration) =>
            calibration.dateEmptied &&
            (!latestDate ||
              new Date(calibration.dateEmptied) > new Date(latestDate))
              ? calibration.dateEmptied
              : latestDate,
          null
        );
        bottleById.set(bottleId, {
          bottleId,
          refractiveIndex: latest.refractiveIndex,
          batchNumber: latest.batchNumber,
          dateOpened: latest.dateOpened,
          isEmpty: true,
          dateEmptied,
          isLegacy: true,
          calibrations
        });
      }
    });

    const data = Array.from(bottleById.values()).sort(
      (a, b) =>
        new Date(b.dateEmptied || 0).getTime() -
        new Date(a.dateEmptied || 0).getTime()
    );

    res.json({ data });
  } catch (error) {
    console.error('Error fetching empty RI Liquid bottles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create an RI Liquid bottle and assign the next ID for its refractive index
router.post('/bottles', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const refractiveIndex = Number(req.body.refractiveIndex);
    const batchNumber = req.body.batchNumber?.trim();
    const dateOpened = new Date(req.body.dateOpened);

    if (
      !ALLOWED_REFRACTIVE_INDICES.includes(refractiveIndex) ||
      !batchNumber ||
      !req.body.dateOpened ||
      Number.isNaN(dateOpened.getTime())
    ) {
      return res.status(400).json({
        message:
          'Refractive index, batch number, and a valid date opened are required'
      });
    }

    const prefix = refractiveIndexPrefix(refractiveIndex);
    const bottleIdPattern = new RegExp(`^${prefix.replace('.', '\\.')}-(\\d+)$`);

    // The unique bottleId index protects against simultaneous allocations.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [bottleIds, calibrationBottleIds] = await Promise.all([
        RiLiquidBottle.distinct('bottleId', { bottleId: bottleIdPattern }),
        RiLiquidCalibration.distinct('bottleId', { bottleId: bottleIdPattern })
      ]);

      const highestNumber = [...bottleIds, ...calibrationBottleIds].reduce(
        (highest, bottleId) => {
          const match = bottleId.match(bottleIdPattern);
          return match ? Math.max(highest, Number(match[1])) : highest;
        },
        0
      );

      try {
        const bottle = await RiLiquidBottle.create({
          bottleId: `${prefix}-${highestNumber + 1}`,
          refractiveIndex,
          batchNumber,
          dateOpened
        });
        return res.status(201).json(bottle);
      } catch (error) {
        if (error.code !== 11000 || attempt === 2) throw error;
      }
    }
  } catch (error) {
    console.error('Error creating RI Liquid bottle:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get calibrations by bottle ID
router.get('/bottle/:bottleId', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { bottleId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await RiLiquidCalibration.countDocuments({ bottleId: bottleId });
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await RiLiquidCalibration.find({ bottleId: bottleId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        bottleId: cal.bottleId,
        date: cal.date,
        refractiveIndex: cal.refractiveIndex,
        asbestosTypeVerified: cal.asbestosTypeVerified,
        dateOpened: cal.dateOpened,
        batchNumber: cal.batchNumber,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        isEmpty: cal.isEmpty,
        dateEmptied: cal.dateEmptied,
        calibratedBy: cal.calibratedBy,
        createdAt: cal.createdAt,
        updatedAt: cal.updatedAt
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
    console.error('Error fetching RI Liquid calibrations by bottle:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await RiLiquidCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ message: 'RI Liquid calibration record not found' });
    }

    const calibrationData = {
      _id: calibration._id,
      bottleId: calibration.bottleId,
      date: calibration.date,
      refractiveIndex: calibration.refractiveIndex,
      asbestosTypeVerified: calibration.asbestosTypeVerified,
      dateOpened: calibration.dateOpened,
      batchNumber: calibration.batchNumber,
      status: calibration.status,
      nextCalibration: calibration.nextCalibration,
      notes: calibration.notes,
      isEmpty: calibration.isEmpty,
      dateEmptied: calibration.dateEmptied,
      calibratedBy: calibration.calibratedBy,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    };

    res.json(calibrationData);
  } catch (error) {
    console.error('Error fetching RI Liquid calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const {
      equipmentId,
      bottleId,
      date,
      asbestosTypeVerified,
      notes,
      technicianId
    } = req.body;
    const requestedBottleId = bottleId || equipmentId;

    // Validate required fields
    if (!requestedBottleId || !date || !asbestosTypeVerified || !technicianId) {
      return res.status(400).json({
        message:
          'Bottle ID, calibration date, asbestos type, and technician are required'
      });
    }

    const bottle =
      await RiLiquidBottle.findOne({
        bottleId: requestedBottleId,
        isEmpty: { $ne: true }
      }).lean();
    const legacyBottleCalibration = bottle
      ? null
      : await RiLiquidCalibration.findOne({
          bottleId: requestedBottleId,
          isEmpty: { $ne: true }
        })
          .sort({ date: -1 })
          .lean();

    const bottleDetails = bottle || legacyBottleCalibration;
    if (!bottleDetails) {
      return res.status(400).json({
        message: 'Please select an active RI Liquid bottle'
      });
    }

    // Validate asbestos type
    const allowedAsbestosTypes = ['Chrysotile', 'Amosite', 'Crocidolite'];
    if (!allowedAsbestosTypes.includes(asbestosTypeVerified)) {
      return res.status(400).json({ message: 'Asbestos type verified must be one of: Chrysotile, Amosite, or Crocidolite' });
    }

    // Auto-calculate status based on refractive index and asbestos type
    const passCombinations = [
      { refractiveIndex: 1.55, asbestosType: 'Chrysotile' },
      { refractiveIndex: 1.67, asbestosType: 'Amosite' },
      { refractiveIndex: 1.70, asbestosType: 'Crocidolite' }
    ];
    
    const refractiveIndexValue = Number(bottleDetails.refractiveIndex);
    const isPass = passCombinations.some(combo => 
      Math.abs(refractiveIndexValue - combo.refractiveIndex) < 0.001 && 
      asbestosTypeVerified === combo.asbestosType
    );
    
    const calculatedStatus = isPass ? 'Pass' : 'Fail';

    // Calculate next calibration date (6 months from calibration date)
    let nextCalibration = null;
    try {
      const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
        equipmentType: 'RI Liquids' 
      });
      
      const calibrationDate = new Date(date);
      if (calibrationFreqConfig) {
        if (calibrationFreqConfig.frequencyUnit === 'years') {
          calibrationDate.setFullYear(calibrationDate.getFullYear() + calibrationFreqConfig.frequencyValue);
        } else {
          calibrationDate.setMonth(calibrationDate.getMonth() + calibrationFreqConfig.frequencyValue);
        }
        nextCalibration = calibrationDate;
      } else {
        // Default to 6 months
        calibrationDate.setMonth(calibrationDate.getMonth() + 6);
        nextCalibration = calibrationDate;
      }
    } catch (error) {
      console.error('Error calculating next calibration date:', error);
      // Default to 6 months
      const calibrationDate = new Date(date);
      calibrationDate.setMonth(calibrationDate.getMonth() + 6);
      nextCalibration = calibrationDate;
    }

    const calibrationData = {
      bottleId: requestedBottleId,
      date: new Date(date),
      refractiveIndex: refractiveIndexValue,
      asbestosTypeVerified: asbestosTypeVerified,
      dateOpened: new Date(bottleDetails.dateOpened),
      batchNumber: bottleDetails.batchNumber,
      status: calculatedStatus,
      calibratedBy: technicianId,
      nextCalibration: nextCalibration,
      notes: notes || ''
    };

    const calibration = new RiLiquidCalibration(calibrationData);
    await calibration.save();

    const populatedCalibration = await RiLiquidCalibration.findById(calibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating RI Liquid calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update calibration record
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const calibration = await RiLiquidCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    // Update fields
    if (req.body.date !== undefined) calibration.date = new Date(req.body.date);
    if (req.body.refractiveIndex !== undefined) calibration.refractiveIndex = parseFloat(req.body.refractiveIndex);
    if (req.body.asbestosTypeVerified !== undefined) calibration.asbestosTypeVerified = req.body.asbestosTypeVerified;
    if (req.body.dateOpened !== undefined) calibration.dateOpened = new Date(req.body.dateOpened);
    if (req.body.batchNumber !== undefined) calibration.batchNumber = req.body.batchNumber.trim();
    if (req.body.notes !== undefined) calibration.notes = req.body.notes;
    if (req.body.technicianId !== undefined) calibration.calibratedBy = req.body.technicianId;

    // Validate refractive index if being updated
    if (req.body.refractiveIndex !== undefined) {
      const allowedRefractiveIndices = [1.55, 1.67, 1.70];
      const refractiveIndexValue = parseFloat(req.body.refractiveIndex);
      if (!allowedRefractiveIndices.includes(refractiveIndexValue)) {
        return res.status(400).json({ message: 'Refractive index must be one of: 1.55, 1.67, or 1.70' });
      }
    }

    // Validate asbestos type if being updated
    if (req.body.asbestosTypeVerified !== undefined) {
      const allowedAsbestosTypes = ['Chrysotile', 'Amosite', 'Crocidolite'];
      if (!allowedAsbestosTypes.includes(req.body.asbestosTypeVerified)) {
        return res.status(400).json({ message: 'Asbestos type verified must be one of: Chrysotile, Amosite, or Crocidolite' });
      }
    }

    // Auto-calculate status if refractive index or asbestos type changed
    if (req.body.refractiveIndex !== undefined || req.body.asbestosTypeVerified !== undefined) {
      const refractiveIndexValue = calibration.refractiveIndex;
      const asbestosType = calibration.asbestosTypeVerified;
      
      const passCombinations = [
        { refractiveIndex: 1.55, asbestosType: 'Chrysotile' },
        { refractiveIndex: 1.67, asbestosType: 'Amosite' },
        { refractiveIndex: 1.70, asbestosType: 'Crocidolite' }
      ];
      
      const isPass = passCombinations.some(combo => 
        Math.abs(refractiveIndexValue - combo.refractiveIndex) < 0.001 && 
        asbestosType === combo.asbestosType
      );
      
      calibration.status = isPass ? 'Pass' : 'Fail';
    }

    // Recalculate next calibration if calibration date changed
    if (req.body.date !== undefined) {
      try {
        const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
          equipmentType: 'RI Liquids' 
        });
        
        const calibrationDate = new Date(calibration.date);
        if (calibrationFreqConfig) {
          if (calibrationFreqConfig.frequencyUnit === 'years') {
            calibrationDate.setFullYear(calibrationDate.getFullYear() + calibrationFreqConfig.frequencyValue);
          } else {
            calibrationDate.setMonth(calibrationDate.getMonth() + calibrationFreqConfig.frequencyValue);
          }
          calibration.nextCalibration = calibrationDate;
        } else {
          // Default to 6 months
          calibrationDate.setMonth(calibrationDate.getMonth() + 6);
          calibration.nextCalibration = calibrationDate;
        }
      } catch (error) {
        console.error('Error recalculating next calibration date:', error);
      }
    }

    const updatedCalibration = await calibration.save();

    const populatedCalibration = await RiLiquidCalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating RI Liquid calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await RiLiquidCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    await calibration.deleteOne();
    res.json({ message: 'Calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting RI Liquid calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark bottle as empty (marks all calibrations for a bottle as empty)
router.put('/bottle/:bottleId/mark-empty', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const { bottleId } = req.params;
    const dateEmptied = new Date();
    
    const [calibrationResult, bottleResult] = await Promise.all([
      RiLiquidCalibration.updateMany(
        { bottleId },
        { isEmpty: true, dateEmptied }
      ),
      RiLiquidBottle.updateOne(
        { bottleId },
        { isEmpty: true, dateEmptied }
      )
    ]);

    if (calibrationResult.matchedCount === 0 && bottleResult.matchedCount === 0) {
      return res.status(404).json({ message: 'RI Liquid bottle not found' });
    }

    res.json({ 
      message: 'Bottle marked as empty successfully',
      updatedCount:
        calibrationResult.modifiedCount + bottleResult.modifiedCount
    });
  } catch (error) {
    console.error('Error marking bottle as empty:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
