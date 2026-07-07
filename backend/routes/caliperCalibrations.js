const express = require('express');
const router = express.Router();
const CaliperCalibration = require('../models/CaliperCalibration');
const {
  calculateEquipmentNextCalibration,
} = require('../utils/calculateEquipmentNextCalibration');

const EQUIPMENT_TYPE = 'Caliper';

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  caliperReference: calibration.caliperReference,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
  uncertaintyAt30mm: calibration.uncertaintyAt30mm ?? null,
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
    const { caliperReference } = req.query;
    const filter = {};
    if (caliperReference) {
      filter.caliperReference = { $regex: caliperReference, $options: 'i' };
    }

    const calibrations = await CaliperCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Caliper calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Caliper calibrations' });
  }
});

router.get('/equipment/:caliperReference', async (req, res) => {
  try {
    const calibrations = await CaliperCalibration.find({
      caliperReference: req.params.caliperReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Caliper calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Caliper calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await CaliperCalibration.findById(req.params.id).populate(
      'calibratedBy',
      'firstName lastName'
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Caliper calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Caliper calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Caliper calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      caliperReference,
      date,
      calibrationCompany,
      uncertaintyAt30mm,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !caliperReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyAt30mm === undefined ||
      uncertaintyAt30mm === null ||
      !calibratedBy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await CaliperCalibration.countDocuments();
      calibrationId = `CAL-${String(count + 1).padStart(4, '0')}`;
    }

    const calibration = new CaliperCalibration({
      calibrationId,
      caliperReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyAt30mm: Math.abs(parseFloat(uncertaintyAt30mm)),
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    });

    await calibration.save();

    res.status(201).json({
      message: 'Caliper calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Caliper calibration:', error);
    res.status(500).json({ error: 'Failed to create Caliper calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      caliperReference,
      date,
      calibrationCompany,
      uncertaintyAt30mm,
      certificates,
      notes,
    } = req.body;

    if (
      !caliperReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyAt30mm === undefined ||
      uncertaintyAt30mm === null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      caliperReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyAt30mm: Math.abs(parseFloat(uncertaintyAt30mm)),
      notes: notes || '',
      nextCalibration: await calculateEquipmentNextCalibration(date, EQUIPMENT_TYPE),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await CaliperCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Caliper calibration not found' });
    }

    res.json({
      message: 'Caliper calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Caliper calibration:', error);
    res.status(500).json({ error: 'Failed to update Caliper calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await CaliperCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'Caliper calibration not found' });
    }

    res.json({ message: 'Caliper calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Caliper calibration:', error);
    res.status(500).json({ error: 'Failed to delete Caliper calibration' });
  }
});

module.exports = router;
