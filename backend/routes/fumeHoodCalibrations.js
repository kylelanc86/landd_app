const express = require('express');
const router = express.Router();
const FumeHoodCalibration = require('../models/FumeHoodCalibration');
const {
  calculateEquipmentNextCalibration,
} = require('../utils/calculateEquipmentNextCalibration');

const EQUIPMENT_TYPE = 'Fume Hood';

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  fumeHoodReference: calibration.fumeHoodReference,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
  faceVelocity: calibration.faceVelocity ?? null,
  airChanges: calibration.airChanges ?? null,
  certificates: calibration.certificates || [],
  notes: calibration.notes,
  nextCalibration: calibration.nextCalibration,
  calibratedBy: calibration.calibratedBy
    ? {
        _id: calibration.calibratedBy._id,
        name: `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`,
      }
    : null,
  createdAt: calibration.createdAt,
  updatedAt: calibration.updatedAt,
});

router.get('/', async (req, res) => {
  try {
    const { fumeHoodReference } = req.query;
    const filter = {};
    if (fumeHoodReference) {
      filter.fumeHoodReference = { $regex: fumeHoodReference, $options: 'i' };
    }

    const calibrations = await FumeHoodCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Fume Hood calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Fume Hood calibrations' });
  }
});

router.get('/equipment/:fumeHoodReference', async (req, res) => {
  try {
    const calibrations = await FumeHoodCalibration.find({
      fumeHoodReference: req.params.fumeHoodReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Fume Hood calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Fume Hood calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await FumeHoodCalibration.findById(req.params.id).populate(
      'calibratedBy',
      'firstName lastName'
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Fume Hood calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Fume Hood calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Fume Hood calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      fumeHoodReference,
      date,
      calibrationCompany,
      faceVelocity,
      airChanges,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !fumeHoodReference ||
      !date ||
      !calibrationCompany ||
      !faceVelocity ||
      !airChanges ||
      !calibratedBy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await FumeHoodCalibration.countDocuments();
      calibrationId = `FUH-${String(count + 1).padStart(4, '0')}`;
    }

    const calibration = new FumeHoodCalibration({
      calibrationId,
      fumeHoodReference,
      date: new Date(date),
      calibrationCompany,
      faceVelocity,
      airChanges,
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    });

    await calibration.save();

    res.status(201).json({
      message: 'Fume Hood calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Fume Hood calibration:', error);
    res.status(500).json({ error: 'Failed to create Fume Hood calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      fumeHoodReference,
      date,
      calibrationCompany,
      faceVelocity,
      airChanges,
      certificates,
      notes,
    } = req.body;

    if (
      !fumeHoodReference ||
      !date ||
      !calibrationCompany ||
      !faceVelocity ||
      !airChanges
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      fumeHoodReference,
      date: new Date(date),
      calibrationCompany,
      faceVelocity,
      airChanges,
      notes: notes || '',
      nextCalibration: await calculateEquipmentNextCalibration(date, EQUIPMENT_TYPE),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await FumeHoodCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Fume Hood calibration not found' });
    }

    res.json({
      message: 'Fume Hood calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Fume Hood calibration:', error);
    res.status(500).json({ error: 'Failed to update Fume Hood calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await FumeHoodCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'Fume Hood calibration not found' });
    }

    res.json({ message: 'Fume Hood calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Fume Hood calibration:', error);
    res.status(500).json({ error: 'Failed to delete Fume Hood calibration' });
  }
});

module.exports = router;
