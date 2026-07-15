const express = require('express');
const router = express.Router();
const MycometerCalibration = require('../models/MycometerCalibration');
const { MYCOMETER_EQUIPMENT_TYPES } = MycometerCalibration;
const {
  calculateEquipmentNextCalibration,
} = require('../utils/calculateEquipmentNextCalibration');

const mapCalibration = (calibration) => ({
  _id: calibration._id,
  calibrationId: calibration.calibrationId,
  mycometerReference: calibration.mycometerReference,
  equipmentType: calibration.equipmentType,
  date: calibration.date,
  calibrationCompany: calibration.calibrationCompany,
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
    const { mycometerReference, equipmentType } = req.query;
    const filter = {};
    if (mycometerReference) {
      filter.mycometerReference = { $regex: mycometerReference, $options: 'i' };
    }
    if (equipmentType) {
      filter.equipmentType = equipmentType;
    }

    const calibrations = await MycometerCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json(calibrations.map(mapCalibration));
  } catch (error) {
    console.error('Error fetching Mycometer calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch Mycometer calibrations' });
  }
});

router.get('/equipment/:mycometerReference', async (req, res) => {
  try {
    const calibrations = await MycometerCalibration.find({
      mycometerReference: req.params.mycometerReference,
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations.map(mapCalibration) });
  } catch (error) {
    console.error('Error fetching Mycometer calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch Mycometer calibrations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const calibration = await MycometerCalibration.findById(req.params.id).populate(
      'calibratedBy',
      'firstName lastName'
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Mycometer calibration not found' });
    }

    res.json(mapCalibration(calibration));
  } catch (error) {
    console.error('Error fetching Mycometer calibration:', error);
    res.status(500).json({ error: 'Failed to fetch Mycometer calibration' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      mycometerReference,
      equipmentType,
      date,
      calibrationCompany,
      certificates,
      notes,
      calibratedBy,
    } = req.body;

    if (
      !mycometerReference ||
      !equipmentType ||
      !date ||
      !calibrationCompany ||
      !calibratedBy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!MYCOMETER_EQUIPMENT_TYPES.includes(equipmentType)) {
      return res.status(400).json({ error: 'Invalid Mycometer equipment type' });
    }

    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await MycometerCalibration.countDocuments();
      calibrationId = `MYC-${String(count + 1).padStart(4, '0')}`;
    }

    const calibration = new MycometerCalibration({
      calibrationId,
      mycometerReference,
      equipmentType,
      date: new Date(date),
      calibrationCompany,
      certificates: certificates || [],
      notes: notes || '',
      calibratedBy,
    });

    await calibration.save();

    res.status(201).json({
      message: 'Mycometer calibration created successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error creating Mycometer calibration:', error);
    res.status(500).json({ error: 'Failed to create Mycometer calibration' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      mycometerReference,
      equipmentType,
      date,
      calibrationCompany,
      certificates,
      notes,
    } = req.body;

    if (
      !mycometerReference ||
      !equipmentType ||
      !date ||
      !calibrationCompany
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!MYCOMETER_EQUIPMENT_TYPES.includes(equipmentType)) {
      return res.status(400).json({ error: 'Invalid Mycometer equipment type' });
    }

    const updateData = {
      mycometerReference,
      equipmentType,
      date: new Date(date),
      calibrationCompany,
      notes: notes || '',
      nextCalibration: await calculateEquipmentNextCalibration(
        date,
        equipmentType
      ),
    };

    if (certificates !== undefined) {
      updateData.certificates = certificates;
    }

    const calibration = await MycometerCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Mycometer calibration not found' });
    }

    res.json({
      message: 'Mycometer calibration updated successfully',
      calibration,
    });
  } catch (error) {
    console.error('Error updating Mycometer calibration:', error);
    res.status(500).json({ error: 'Failed to update Mycometer calibration' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const calibration = await MycometerCalibration.findByIdAndDelete(
      req.params.id
    );

    if (!calibration) {
      return res.status(404).json({ error: 'Mycometer calibration not found' });
    }

    res.json({ message: 'Mycometer calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Mycometer calibration:', error);
    res.status(500).json({ error: 'Failed to delete Mycometer calibration' });
  }
});

module.exports = router;
