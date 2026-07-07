const express = require('express');
const router = express.Router();
const PneumaticTesterCalibration = require('../models/PneumaticTesterCalibration');
const {
  calculatePneumaticTesterNextCalibration,
} = require('../utils/calculatePneumaticTesterNextCalibration');

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  pneumaticTesterReference: calibration.pneumaticTesterReference,
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
    const { pneumaticTesterReference } = req.query;

    const filter = {};
    if (pneumaticTesterReference) {
      filter.pneumaticTesterReference = {
        $regex: pneumaticTesterReference,
        $options: 'i',
      };
    }

    const calibrations = await PneumaticTesterCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Pneumatic Tester calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Pneumatic Tester calibrations' });
  }
});

router.get('/equipment/:pneumaticTesterReference', async (req, res) => {
  try {
    const calibrations = await PneumaticTesterCalibration.find({
      pneumaticTesterReference: req.params.pneumaticTesterReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error(
      'Error fetching Pneumatic Tester calibrations by equipment:',
      error
    );
    res.status(500).json({
      error: 'Failed to fetch Pneumatic Tester calibrations',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await PneumaticTesterCalibration.findById(
      req.params.id
    ).populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ error: 'Pneumatic Tester calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Pneumatic Tester calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Pneumatic Tester calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      pneumaticTesterReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !pneumaticTesterReference ||
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
      const count = await PneumaticTesterCalibration.countDocuments();
      calibrationId = `PNT-${String(count + 1).padStart(4, '0')}`;
    }

    const calibrationData = {
      calibrationId,
      pneumaticTesterReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(uncertaintyOfMeasurement)),
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    };

    const calibration = new PneumaticTesterCalibration(calibrationData);
    await calibration.save();

    res.status(201).json({
      message: 'Pneumatic Tester calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Pneumatic Tester calibration:', error);
    res.status(500).json({ error: 'Failed to create Pneumatic Tester calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      pneumaticTesterReference,
      date,
      calibrationCompany,
      uncertaintyOfMeasurement,
      certificates,
      notes,
    } = req.body;

    if (
      !pneumaticTesterReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyOfMeasurement === undefined ||
      uncertaintyOfMeasurement === null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      pneumaticTesterReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyOfMeasurement: Math.abs(parseFloat(uncertaintyOfMeasurement)),
      notes: notes || '',
      nextCalibration: await calculatePneumaticTesterNextCalibration(date),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await PneumaticTesterCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Pneumatic Tester calibration not found' });
    }

    res.json({
      message: 'Pneumatic Tester calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Pneumatic Tester calibration:', error);
    res.status(500).json({ error: 'Failed to update Pneumatic Tester calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await PneumaticTesterCalibration.findByIdAndDelete(
      req.params.id
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Pneumatic Tester calibration not found' });
    }

    res.json({ message: 'Pneumatic Tester calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Pneumatic Tester calibration:', error);
    res.status(500).json({ error: 'Failed to delete Pneumatic Tester calibration' });
  }
});

module.exports = router;
