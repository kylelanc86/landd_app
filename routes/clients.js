const express = require('express');
const router = express.Router();

// Get all clients
router.get('/', async (req, res) => {
  try {
    res.json({ message: 'Get all clients route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    res.json({ message: 'Get single client route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create client
router.post('/', async (req, res) => {
  try {
    res.json({ message: 'Create client route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update client
router.patch('/:id', async (req, res) => {
  try {
    res.json({ message: 'Update client route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    res.json({ message: 'Delete client route' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 