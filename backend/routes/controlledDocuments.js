const express = require('express');
const router = express.Router();
const ControlledDocument = require('../models/ControlledDocument');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all controlled documents (excludes obsolete/deleted)
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const { type } = req.query;
    const query = { deletedAt: null };
    if (type) query.type = type;
    const documents = await ControlledDocument.find(query).sort({ documentRef: 1 });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get obsolete (deleted) controlled documents
router.get('/obsolete/list', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const documents = await ControlledDocument.find({ deletedAt: { $ne: null } })
      .select('-fileData')
      .sort({ deletedAt: -1 });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single controlled document
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const document = await ControlledDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Controlled document not found' });
    }
    res.json(document);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create controlled document
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    // Check for duplicate documentRef (case-insensitive, exclude obsolete)
    const existing = await ControlledDocument.findOne({
      documentRef: { $regex: new RegExp(`^${escapeRegex(req.body.documentRef)}$`, 'i') },
      deletedAt: null
    });
    if (existing) {
      return res.status(400).json({ message: 'This document reference already exists' });
    }

    const updatedBy = req.user?.firstName && req.user?.lastName
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.email || null;
    const document = new ControlledDocument({
      type: req.body.type,
      documentRef: req.body.documentRef,
      documentTitle: req.body.documentTitle,
      documentDescription: req.body.documentDescription,
      section: req.body.section,
      currentRevision: req.body.currentRevision ?? null,
      lastReviewDate: req.body.lastReviewDate || null,
      hardCopyLocations: Array.isArray(req.body.hardCopyLocations) ? req.body.hardCopyLocations : [],
      fileName: req.body.fileName || null,
      fileData: req.body.fileData || null,
      history: [{
        revision: req.body.currentRevision ?? 1,
        updatedAt: new Date(),
        updatedBy
      }]
    });

    const newDocument = await document.save();
    res.status(201).json(newDocument);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'This document reference already exists' });
    }
    res.status(400).json({ message: err.message });
  }
});

// Update controlled document
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const document = await ControlledDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Controlled document not found' });
    }

    // Check for duplicate documentRef if changing (excluding self and obsolete)
    if (req.body.documentRef && req.body.documentRef !== document.documentRef) {
      const existing = await ControlledDocument.findOne({
        documentRef: { $regex: new RegExp(`^${escapeRegex(req.body.documentRef)}$`, 'i') },
        _id: { $ne: req.params.id },
        deletedAt: null
      });
      if (existing) {
        return res.status(400).json({ message: 'This document reference already exists' });
      }
    }

    const updatableFields = [
      'type', 'documentRef', 'documentTitle', 'documentDescription',
      'section', 'currentRevision', 'lastReviewDate', 'hardCopyLocations',
      'fileName', 'fileData'
    ];
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        document[field] = req.body[field];
      }
    });

    // Append to history on any update
    const newRevision = req.body.currentRevision ?? document.currentRevision;
    const updatedBy = req.user?.firstName && req.user?.lastName
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.email || null;
    document.history = document.history || [];
    document.history.push({
      revision: newRevision != null ? newRevision : (document.history.length + 1),
      updatedAt: new Date(),
      updatedBy
    });

    const updatedDocument = await document.save();
    res.json(updatedDocument);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'This document reference already exists' });
    }
    res.status(400).json({ message: err.message });
  }
});

// Delete controlled document (soft delete - marks as obsolete)
router.delete('/:id', auth, checkPermission(['projects.delete']), async (req, res) => {
  try {
    const document = await ControlledDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Controlled document not found' });
    }
    if (document.deletedAt) {
      return res.status(400).json({ message: 'Document is already obsolete' });
    }
    const deletedBy = req.user?.firstName && req.user?.lastName
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.email || null;
    document.deletedAt = new Date();
    document.deletedBy = deletedBy;
    document.fileName = null;
    document.fileData = null;
    await document.save();
    res.json({ message: 'Controlled document marked as obsolete' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
