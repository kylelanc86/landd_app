const express = require('express');
const router = express.Router();
const PrimaryFlowmeterCalibration = require('../models/PrimaryFlowmeterCalibration');
const {
  calculatePrimaryFlowmeterNextCalibration,
} = require('../utils/calculatePrimaryFlowmeterNextCalibration');

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  flowmeterReference: calibration.flowmeterReference,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
  uncertaintyOfMeasurement:
    calibration.uncertaintyOfMeasurement ?? calibration.error ?? null,
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
    const { flowmeterReference } = req.query;

    const filter = {};
    if (flowmeterReference) {
      filter.flowmeterReference = { $regex: flowmeterReference, $options: 'i' };
    }

    const calibrations = await PrimaryFlowmeterCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Primary Flowmeter calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Primary Flowmeter calibrations' });
  }
});

router.get('/equipment/:flowmeterReference', async (req, res) => {
  try {
    const calibrations = await PrimaryFlowmeterCalibration.find({
      flowmeterReference: req.params.flowmeterReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error(
      'Error fetching Primary Flowmeter calibrations by equipment:',
      error
    );
    res.status(500).json({
      error: 'Failed to fetch Primary Flowmeter calibrations',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await PrimaryFlowmeterCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ error: 'Primary Flowmeter calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Primary Flowmeter calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Primary Flowmeter calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      flowmeterReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    const measurementValue =
      uncertaintyOfMeasurement !== undefined && uncertaintyOfMeasurement !== null
        ? uncertaintyOfMeasurement
        : req.body.error;

    if (
      !flowmeterReference ||
      !date ||
      !calibrationCompany ||
      measurementValue === undefined ||
      measurementValue === null ||
      !calibratedBy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await PrimaryFlowmeterCalibration.countDocuments();
      calibrationId = `PFM-${String(count + 1).padStart(4, '0')}`;
    }

    const calibrationData = {
      calibrationId,
      flowmeterReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(measurementValue)),
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    };

    const calibration = new PrimaryFlowmeterCalibration(calibrationData);
    await calibration.save();

    res.status(201).json({
      message: 'Primary Flowmeter calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Primary Flowmeter calibration:', error);
    res.status(500).json({ error: 'Failed to create Primary Flowmeter calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      flowmeterReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
    } = req.body;

    const measurementValue =
      uncertaintyOfMeasurement !== undefined && uncertaintyOfMeasurement !== null
        ? uncertaintyOfMeasurement
        : req.body.error;

    if (
      !flowmeterReference ||
      !date ||
      !calibrationCompany ||
      measurementValue === undefined ||
      measurementValue === null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      flowmeterReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(measurementValue)),
      notes: notes || '',
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    updateData.nextCalibration = await calculatePrimaryFlowmeterNextCalibration(
      date
    );

    const calibration = await PrimaryFlowmeterCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Primary Flowmeter calibration not found' });
    }

    res.json({
      message: 'Primary Flowmeter calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Primary Flowmeter calibration:', error);
    res.status(500).json({ error: 'Failed to update Primary Flowmeter calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await PrimaryFlowmeterCalibration.findByIdAndDelete(
      req.params.id
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Primary Flowmeter calibration not found' });
    }

    res.json({ message: 'Primary Flowmeter calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Primary Flowmeter calibration:', error);
    res.status(500).json({ error: 'Failed to delete Primary Flowmeter calibration' });
  }
});

module.exports = router;
