const express = require('express');
const router = express.Router();
const SieveCalibration = require('../models/SieveCalibration');

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  sieveReference: calibration.sieveReference,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
  certificates: calibration.certificates || [],
  notes: calibration.notes,
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
    const { sieveReference } = req.query;

    const filter = {};
    if (sieveReference) {
      filter.sieveReference = { $regex: sieveReference, $options: 'i' };
    }

    const calibrations = await SieveCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Sieve calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Sieve calibrations' });
  }
});

router.get('/equipment/:sieveReference', async (req, res) => {
  try {
    const calibrations = await SieveCalibration.find({
      sieveReference: req.params.sieveReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Sieve calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Sieve calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await SieveCalibration.findById(req.params.id).populate(
      'calibratedBy',
      'firstName lastName'
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Sieve calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Sieve calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Sieve calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      sieveReference,
      date,
      calibrationCompany,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (!sieveReference || !date || !calibrationCompany || !calibratedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await SieveCalibration.countDocuments();
      calibrationId = `SIV-${String(count + 1).padStart(4, '0')}`;
    }

    const calibrationData = {
      calibrationId,
      sieveReference,
      date: new Date(date),
      calibrationCompany,
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    };

    const calibration = new SieveCalibration(calibrationData);
    await calibration.save();

    res.status(201).json({
      message: 'Sieve calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Sieve calibration:', error);
    res.status(500).json({ error: 'Failed to create Sieve calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sieveReference, date, calibrationCompany, certificates, notes } =
      req.body;

    if (!sieveReference || !date || !calibrationCompany) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      sieveReference,
      date: new Date(date),
      calibrationCompany,
      notes: notes || '',
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await SieveCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Sieve calibration not found' });
    }

    res.json({
      message: 'Sieve calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Sieve calibration:', error);
    res.status(500).json({ error: 'Failed to update Sieve calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await SieveCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'Sieve calibration not found' });
    }

    res.json({ message: 'Sieve calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Sieve calibration:', error);
    res.status(500).json({ error: 'Failed to delete Sieve calibration' });
  }
});

module.exports = router;
