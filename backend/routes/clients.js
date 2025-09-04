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
    const { search, page = 1, limit = 25, showInactive = false } = req.query;
    console.log('Backend received query params:', req.query);
    console.log('Backend parsed params:', { search, page, limit, showInactive });
    const query = {};

    // Add search condition if search term is provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by active status unless showInactive is true
    if (showInactive !== 'true') {
      query.isActive = true;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    console.log('Backend pagination:', { skip, limit: parseInt(limit) });

    // Get total count for pagination
    const total = await Client.countDocuments(query);

    // Execute query with pagination
    const clients = await Client.find(query)
      .select('name invoiceEmail contact1Name contact1Number address written_off paymentTerms isActive createdAt updatedAt')
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
  try {
    // Validate required fields and set defaults for optional fields
    if (!req.body.name || req.body.name.trim() === '') {
      return res.status(400).json({ message: 'Client name is required' });
    }

    const client = new Client({
      name: req.body.name.trim(),
      invoiceEmail: req.body.invoiceEmail && req.body.invoiceEmail.trim() !== '' ? req.body.invoiceEmail.trim().toLowerCase() : '-',
      address: req.body.address && req.body.address.trim() !== '' ? req.body.address.trim() : '-',
      contact1Name: req.body.contact1Name && req.body.contact1Name.trim() !== '' ? req.body.contact1Name.trim() : '-',
      contact1Number: req.body.contact1Number && req.body.contact1Number.trim() !== '' ? req.body.contact1Number.trim() : '-',
      contact1Email: req.body.contact1Email && req.body.contact1Email.trim() !== '' ? req.body.contact1Email.trim().toLowerCase() : '-',
      contact2Name: req.body.contact2Name && req.body.contact2Name.trim() !== '' ? req.body.contact2Name.trim() : '-',
      contact2Number: req.body.contact2Number && req.body.contact2Number.trim() !== '' ? req.body.contact2Number.trim() : '-',
      contact2Email: req.body.contact2Email && req.body.contact2Email.trim() !== '' ? req.body.contact2Email.trim().toLowerCase() : '-',
      paymentTerms: req.body.paymentTerms || "Standard (30 days)",
      written_off: req.body.written_off || false
    });

    const newClient = await client.save();
    res.status(201).json(newClient);
  } catch (err) {
    console.error('Error creating client:', err);
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

    // Update fields with proper handling of empty values
    if (req.body.name !== undefined) {
      client.name = req.body.name.trim();
    }
    if (req.body.invoiceEmail !== undefined) {
      client.invoiceEmail = req.body.invoiceEmail && req.body.invoiceEmail.trim() !== '' ? req.body.invoiceEmail.trim().toLowerCase() : '-';
    }
    if (req.body.address !== undefined) {
      client.address = req.body.address && req.body.address.trim() !== '' ? req.body.address.trim() : '-';
    }
    if (req.body.contact1Name !== undefined) {
      client.contact1Name = req.body.contact1Name && req.body.contact1Name.trim() !== '' ? req.body.contact1Name.trim() : '-';
    }
    if (req.body.contact1Number !== undefined) {
      client.contact1Number = req.body.contact1Number && req.body.contact1Number.trim() !== '' ? req.body.contact1Number.trim() : '-';
    }
    if (req.body.contact1Email !== undefined) {
      client.contact1Email = req.body.contact1Email && req.body.contact1Email.trim() !== '' ? req.body.contact1Email.trim().toLowerCase() : '-';
    }
    if (req.body.contact2Name !== undefined) {
      client.contact2Name = req.body.contact2Name && req.body.contact2Name.trim() !== '' ? req.body.contact2Name.trim() : '-';
    }
    if (req.body.contact2Number !== undefined) {
      client.contact2Number = req.body.contact2Number && req.body.contact2Number.trim() !== '' ? req.body.contact2Number.trim() : '-';
    }
    if (req.body.contact2Email !== undefined) {
      client.contact2Email = req.body.contact2Email && req.body.contact2Email.trim() !== '' ? req.body.contact2Email.trim().toLowerCase() : '-';
    }
    if (req.body.paymentTerms !== undefined) {
      client.paymentTerms = req.body.paymentTerms;
    }
    if (req.body.written_off !== undefined) {
      client.written_off = req.body.written_off;
    }

    const updatedClient = await client.save();
    res.json(updatedClient);
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(400).json({ message: err.message });
  }
});

// Archive client (soft delete)
router.patch('/:id/archive', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.isActive = false;
    await client.save();
    res.json({ message: 'Client archived successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Restore client
router.patch('/:id/restore', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.isActive = true;
    await client.save();
    res.json({ message: 'Client restored successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete client (hard delete)
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
