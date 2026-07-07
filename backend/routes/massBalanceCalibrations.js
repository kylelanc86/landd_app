const express = require('express');
const router = express.Router();
const MassBalanceCalibration = require('../models/MassBalanceCalibration');
const {
  calculateEquipmentNextCalibration,
} = require('../utils/calculateEquipmentNextCalibration');

const EQUIPMENT_TYPE = 'Mass Balance';

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  massBalanceReference: calibration.massBalanceReference,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
  uncertaintyAt1000g: calibration.uncertaintyAt1000g ?? null,
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
    const { massBalanceReference } = req.query;
    const filter = {};
    if (massBalanceReference) {
      filter.massBalanceReference = { $regex: massBalanceReference, $options: 'i' };
    }

    const calibrations = await MassBalanceCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Mass Balance calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Mass Balance calibrations' });
  }
});

router.get('/equipment/:massBalanceReference', async (req, res) => {
  try {
    const calibrations = await MassBalanceCalibration.find({
      massBalanceReference: req.params.massBalanceReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Mass Balance calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Mass Balance calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await MassBalanceCalibration.findById(
      req.params.id
    ).populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ error: 'Mass Balance calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Mass Balance calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Mass Balance calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      massBalanceReference,
      date,
      calibrationCompany,
      uncertaintyAt1000g,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !massBalanceReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyAt1000g === undefined ||
      uncertaintyAt1000g === null ||
      !calibratedBy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await MassBalanceCalibration.countDocuments();
      calibrationId = `MAB-${String(count + 1).padStart(4, '0')}`;
    }

    const calibration = new MassBalanceCalibration({
      calibrationId,
      massBalanceReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyAt1000g: Math.abs(parseFloat(uncertaintyAt1000g)),
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    });

    await calibration.save();

    res.status(201).json({
      message: 'Mass Balance calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Mass Balance calibration:', error);
    res.status(500).json({ error: 'Failed to create Mass Balance calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      massBalanceReference,
      date,
      calibrationCompany,
      uncertaintyAt1000g,
      certificates,
      notes,
    } = req.body;

    if (
      !massBalanceReference ||
      !date ||
      !calibrationCompany ||
      uncertaintyAt1000g === undefined ||
      uncertaintyAt1000g === null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      massBalanceReference,
      date: new Date(date),
      calibrationCompany,
      uncertaintyAt1000g: Math.abs(parseFloat(uncertaintyAt1000g)),
      notes: notes || '',
      nextCalibration: await calculateEquipmentNextCalibration(date, EQUIPMENT_TYPE),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await MassBalanceCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Mass Balance calibration not found' });
    }

    res.json({
      message: 'Mass Balance calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Mass Balance calibration:', error);
    res.status(500).json({ error: 'Failed to update Mass Balance calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await MassBalanceCalibration.findByIdAndDelete(
      req.params.id
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Mass Balance calibration not found' });
    }

    res.json({ message: 'Mass Balance calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Mass Balance calibration:', error);
    res.status(500).json({ error: 'Failed to delete Mass Balance calibration' });
  }
});

module.exports = router;
