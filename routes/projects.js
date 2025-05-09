const express = require('express');
const router = express.Router();

// Get all projects
router.get('/', async (req, res) => {
  try {
    res.json({ message: 'Get all projects route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    res.json({ message: 'Get single project route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create project
router.post('/', async (req, res) => {
  try {
    res.json({ message: 'Create project route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update project
router.patch('/:id', async (req, res) => {
  try {
    res.json({ message: 'Update project route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    res.json({ message: 'Delete project route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 