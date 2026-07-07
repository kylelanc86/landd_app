const express = require('express');
const router = express.Router();
const FurnaceCalibration = require('../models/FurnaceCalibration');
const {
  calculateFurnaceNextCalibration,
} = require('../utils/calculateFurnaceNextCalibration');

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  furnaceReference: calibration.furnaceReference,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
  uncertaintyOfMeasurement: calibration.uncertaintyOfMeasurement ?? null,
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
    const { furnaceReference } = req.query;

    const filter = {};
    if (furnaceReference) {
      filter.furnaceReference = { $regex: furnaceReference, $options: 'i' };
    }

    const calibrations = await FurnaceCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Furnace calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Furnace calibrations' });
  }
});

router.get('/equipment/:furnaceReference', async (req, res) => {
  try {
    const calibrations = await FurnaceCalibration.find({
      furnaceReference: req.params.furnaceReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Furnace calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Furnace calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await FurnaceCalibration.findById(req.params.id).populate(
      'calibratedBy',
      'firstName lastName'
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Furnace calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Furnace calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Furnace calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      furnaceReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !furnaceReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyOfMeasurement === undefined ||
      uncertaintyOfMeasurement === null ||
      !calibratedBy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await FurnaceCalibration.countDocuments();
      calibrationId = `FUR-${String(count + 1).padStart(4, '0')}`;
    }

    const calibrationData = {
      calibrationId,
      furnaceReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(uncertaintyOfMeasurement)),
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    };

    const calibration = new FurnaceCalibration(calibrationData);
    await calibration.save();

    res.status(201).json({
      message: 'Furnace calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Furnace calibration:', error);
    res.status(500).json({ error: 'Failed to create Furnace calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      furnaceReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
    } = req.body;

    if (
      !furnaceReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyOfMeasurement === undefined ||
      uncertaintyOfMeasurement === null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      furnaceReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(uncertaintyOfMeasurement)),
      notes: notes || '',
      nextCalibration: await calculateFurnaceNextCalibration(date),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await FurnaceCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Furnace calibration not found' });
    }

    res.json({
      message: 'Furnace calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Furnace calibration:', error);
    res.status(500).json({ error: 'Failed to update Furnace calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await FurnaceCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'Furnace calibration not found' });
    }

    res.json({ message: 'Furnace calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Furnace calibration:', error);
    res.status(500).json({ error: 'Failed to delete Furnace calibration' });
  }
});

module.exports = router;
