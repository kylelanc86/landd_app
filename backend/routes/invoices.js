const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

// Get all invoices
router.get('/', async (req, res) => {
  try {
    console.log('Fetching all invoices from MongoDB...');
    const invoices = await Invoice.find()
      .populate({
        path: 'project',
        select: 'name'
      })
      .populate({
        path: 'client',
        select: 'name'
      });
    console.log('Raw MongoDB response:', JSON.stringify(invoices, null, 2));
    console.log('Number of invoices found:', invoices.length);
    
    // Log the response being sent
    console.log('Sending response to client...');
    res.json(invoices);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get one invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('project', 'name')
      .populate('client', 'name');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create invoice
router.post('/', async (req, res) => {
  const invoice = new Invoice({
    invoiceID: req.body.invoiceID,
    project: req.body.project,
    client: req.body.client,
    amount: req.body.amount,
    status: req.body.status,
    date: req.body.date,
    dueDate: req.body.dueDate,
    description: req.body.description
  });

  try {
    const newInvoice = await invoice.save();
    const populatedInvoice = await Invoice.findById(newInvoice._id)
      .populate('project', 'name')
      .populate('client', 'name');
    res.status(201).json(populatedInvoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update invoice
router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    Object.assign(invoice, {
      invoiceID: req.body.invoiceID,
      project: req.body.project,
      client: req.body.client,
      amount: req.body.amount,
      status: req.body.status,
      date: req.body.date,
      dueDate: req.body.dueDate,
      description: req.body.description
    });

    const updatedInvoice = await invoice.save();
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
      .populate('project', 'name')
      .populate('client', 'name');
    res.json(populatedInvoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    await invoice.remove();
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 