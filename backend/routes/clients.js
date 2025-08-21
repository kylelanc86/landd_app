const express = require('express');
const router = express.Router();
const Client = require('../models/Client');

// Get total count of clients (for debugging)
router.get('/count', async (req, res) => {
  try {
    const total = await Client.countDocuments({});
    res.json({ total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all clients with search and pagination
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 25 } = req.query;
    console.log('Backend received query params:', req.query);
    console.log('Backend parsed params:', { search, page, limit });
    const query = {};

    // Add search condition if search term is provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    console.log('Backend pagination:', { skip, limit: parseInt(limit) });

    // Get total count for pagination
    const total = await Client.countDocuments(query);

    // Execute query with pagination
    const clients = await Client.find(query)
      .select('name invoiceEmail contact1Name contact1Number address written_off paymentTerms')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log('Backend returning clients:', clients.length, 'out of', total);

    // Always return the same format with clients array and pagination metadata
    res.json({
      clients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create client
router.post('/', async (req, res) => {
  const client = new Client({
    name: req.body.name,
    invoiceEmail: req.body.invoiceEmail,
    address: req.body.address,
    contact1Name: req.body.contact1Name || "-",
    contact1Number: req.body.contact1Number || "-",
    contact1Email: req.body.contact1Email || "-",
    contact2Name: req.body.contact2Name || "-",
    contact2Number: req.body.contact2Number || "-",
    contact2Email: req.body.contact2Email || "-",
    paymentTerms: req.body.paymentTerms || "Standard (30 days)",
    written_off: req.body.written_off || false
  });

  try {
    const newClient = await client.save();
    res.status(201).json(newClient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update client
router.patch('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    Object.keys(req.body).forEach(key => {
      client[key] = req.body[key];
    });

    const updatedClient = await client.save();
    res.json(updatedClient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    await client.deleteOne();
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
