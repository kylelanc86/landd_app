const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const SwmsCategory = require('../models/SwmsCategory');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const { getSwmsRiskRating, parseLevel } = require('../utils/swmsRiskMatrix');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normaliseWorkTypes = (workTypes) => {
  if (!Array.isArray(workTypes)) return [];
  const seen = new Set();
  const result = [];
  workTypes.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || text.length > 200) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result;
};

const toRisk = (risk) => {
  const probability = parseLevel(risk?.probability);
  const severity = parseLevel(risk?.severity);
  const calculated = probability && severity
    ? getSwmsRiskRating(probability, severity)
    : null;

  return {
    ...(probability ? { probability } : {}),
    ...(severity ? { severity } : {}),
    ...(calculated
      ? { score: calculated.score, rating: calculated.rating }
      : { rating: '' }),
  };
};

const normaliseItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      procedure: String(item?.procedure || item?.text || '').trim(),
      hazard: String(item?.hazard || '').trim(),
      riskBefore: toRisk(item?.riskBefore),
      control: String(item?.control || '').trim(),
      riskAfter: toRisk(item?.riskAfter),
      responsibility: String(item?.responsibility || '').trim(),
    }))
    .filter((item) => (
      item.procedure
      || item.hazard
      || item.control
      || item.responsibility
      || item.riskBefore.probability
      || item.riskBefore.severity
      || item.riskAfter.probability
      || item.riskAfter.severity
    ))
    .map((item, index) => ({
      ...item,
      itemNumber: index + 1,
    }));
};

const findActiveByName = (name, excludeId) => {
  const query = {
    isActive: true,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return SwmsCategory.findOne(query);
};

router.get('/', auth, async (req, res) => {
  try {
    const categories = await SwmsCategory.find({ isActive: true }).sort({ name: 1 });
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching SWMS categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SWMS categories',
    });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid SWMS category id',
      });
    }

    const category = await SwmsCategory.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'SWMS category not found',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error fetching SWMS category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SWMS category',
    });
  }
});

router.post('/', auth, checkPermission('admin.create'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const workTypes = normaliseWorkTypes(req.body.workTypes);
    const items = normaliseItems(req.body.items);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const existing = await findActiveByName(name);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A SWMS category with this name already exists',
      });
    }

    const category = await SwmsCategory.create({
      name,
      workTypes,
      items,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error creating SWMS category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating SWMS category',
    });
  }
});

router.put('/:id', auth, checkPermission('admin.update'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const workTypes = normaliseWorkTypes(req.body.workTypes);
    const items = normaliseItems(req.body.items);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const existing = await findActiveByName(name, req.params.id);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A SWMS category with this name already exists',
      });
    }

    const category = await SwmsCategory.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        name,
        workTypes,
        items,
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'SWMS category not found',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error updating SWMS category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating SWMS category',
    });
  }
});

router.delete('/:id', auth, checkPermission('admin.delete'), async (req, res) => {
  try {
    const category = await SwmsCategory.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        isActive: false,
        updatedBy: req.user._id,
      },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'SWMS category not found',
      });
    }

    res.json({
      success: true,
      message: 'SWMS category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SWMS category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting SWMS category',
    });
  }
});

module.exports = router;
