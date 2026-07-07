const express = require('express');
const router = express.Router();
const MicrometerCalibration = require('../models/MicrometerCalibration');
const {
  calculateEquipmentNextCalibration,
} = require('../utils/calculateEquipmentNextCalibration');

const EQUIPMENT_TYPE = 'Micrometer';

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  micrometerReference: calibration.micrometerReference,
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
    const { micrometerReference } = req.query;
    const filter = {};
    if (micrometerReference) {
      filter.micrometerReference = { $regex: micrometerReference, $options: 'i' };
    }

    const calibrations = await MicrometerCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Micrometer calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Micrometer calibrations' });
  }
});

router.get('/equipment/:micrometerReference', async (req, res) => {
  try {
    const calibrations = await MicrometerCalibration.find({
      micrometerReference: req.params.micrometerReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Micrometer calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Micrometer calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await MicrometerCalibration.findById(
      req.params.id
    ).populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ error: 'Micrometer calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Micrometer calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Micrometer calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      micrometerReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !micrometerReference ||
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
      const count = await MicrometerCalibration.countDocuments();
      calibrationId = `MIC-${String(count + 1).padStart(4, '0')}`;
    }

    const calibration = new MicrometerCalibration({
      calibrationId,
      micrometerReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(uncertaintyOfMeasurement)),
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    });

    await calibration.save();

    res.status(201).json({
      message: 'Micrometer calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Micrometer calibration:', error);
    res.status(500).json({ error: 'Failed to create Micrometer calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      micrometerReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
    } = req.body;

    if (
      !micrometerReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyOfMeasurement === undefined ||
      uncertaintyOfMeasurement === null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      micrometerReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(uncertaintyOfMeasurement)),
      notes: notes || '',
      nextCalibration: await calculateEquipmentNextCalibration(date, EQUIPMENT_TYPE),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await MicrometerCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Micrometer calibration not found' });
    }

    res.json({
      message: 'Micrometer calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Micrometer calibration:', error);
    res.status(500).json({ error: 'Failed to update Micrometer calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await MicrometerCalibration.findByIdAndDelete(
      req.params.id
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Micrometer calibration not found' });
    }

    res.json({ message: 'Micrometer calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Micrometer calibration:', error);
    res.status(500).json({ error: 'Failed to delete Micrometer calibration' });
  }
});

module.exports = router;
