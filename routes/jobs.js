const express = require('express');
const router = express.Router();

// Get all jobs
router.get('/', async (req, res) => {
  try {
    res.json({ message: 'Get all jobs route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single job
router.get('/:id', async (req, res) => {
  try {
    res.json({ message: 'Get single job route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create job
router.post('/', async (req, res) => {
  try {
    res.json({ message: 'Create job route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update job
router.patch('/:id', async (req, res) => {
  try {
    res.json({ message: 'Update job route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete job
router.delete('/:id', async (req, res) => {
  try {
    res.json({ message: 'Delete job route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 