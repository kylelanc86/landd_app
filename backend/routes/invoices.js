const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

// Get all invoices
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching all invoices from MongoDB...');
    const invoices = await Invoice.find()
      .populate({
        path: 'project',
        select: 'name projectID',
        populate: {
          path: 'client',
          select: 'name'
        }
      })
      .populate({
        path: 'client',
        select: 'name'
      });
    console.log('Raw MongoDB response:', JSON.stringify(invoices, null, 2));
    console.log('Number of invoices found:', invoices.length);
    
    // Log client data specifically
    invoices.forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}:`, {
        invoiceID: invoice.invoiceID,
        client: invoice.client,
        clientName: invoice.client?.name,
        clientId: invoice.client?._id
      });
    });
    
    // Log the response being sent
    console.log('Sending response to client...');
    res.json(invoices);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get one invoice
router.get('/:id', auth, async (req, res) => {
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
router.post('/', auth, async (req, res) => {
  console.log('Received invoice creation request with data:', req.body);
  
  try {
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

    console.log('Created invoice instance:', invoice.toObject());
    
    const newInvoice = await invoice.save();
    console.log('Invoice saved successfully:', newInvoice.toObject());
    
    const populatedInvoice = await Invoice.findById(newInvoice._id)
      .populate('project', 'name')
      .populate('client', 'name');
    res.status(201).json(populatedInvoice);
  } catch (err) {
    console.error('Error saving invoice:', err);
    if (err.errors) {
      console.error('Validation errors:', err.errors);
    }
    res.status(400).json({ 
      message: err.message,
      validationErrors: err.errors,
      details: 'Invoice creation failed'
    });
  }
});

// Update invoice
router.put('/:id', auth, async (req, res) => {
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

// Soft delete invoice (remove from app but keep in database)
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Soft delete - mark as deleted but don't remove from database
    invoice.isDeleted = true;
    invoice.deleteReason = req.body.reason || 'Removed from app';
    invoice.deletedAt = new Date();
    
    await invoice.save();
    res.json({ 
      message: 'Invoice removed from app (soft deleted)',
      invoiceId: invoice._id,
      deletedAt: invoice.deletedAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hard delete invoice (completely remove from database)
router.delete('/:id/hard', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Note: Xero invoices can be hard deleted from the app
    // They will remain in Xero but be removed from the app database
    console.log('Hard deleting invoice:', invoice.invoiceID, 'Xero ID:', invoice.xeroInvoiceId);
    
    // Use findByIdAndDelete instead of deprecated remove() method
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Invoice permanently deleted from database' });
  } catch (err) {
    console.error('Error hard deleting invoice:', err);
    res.status(500).json({ message: err.message });
  }
});

// Restore soft-deleted invoice
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneIncludingDeleted({ _id: req.params.id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (!invoice.isDeleted) {
      return res.status(400).json({ message: 'Invoice is not deleted' });
    }
    
    // Restore the invoice
    invoice.isDeleted = false;
    invoice.deleteReason = undefined;
    invoice.deletedAt = undefined;
    
    await invoice.save();
    
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('project', 'name')
      .populate('client', 'name');
      
    res.json({ 
      message: 'Invoice restored successfully',
      invoice: populatedInvoice
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all deleted invoices
router.get('/deleted/all', auth, async (req, res) => {
  try {
    const deletedInvoices = await Invoice.findIncludingDeleted({ isDeleted: true })
      .populate('project', 'name')
      .populate('client', 'name')
      .sort({ deletedAt: -1 });
    
    res.json(deletedInvoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get deleted invoice by ID
router.get('/deleted/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneIncludingDeleted({ 
      _id: req.params.id, 
      isDeleted: true 
    })
    .populate('project', 'name')
    .populate('client', 'name');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Deleted invoice not found' });
    }
    
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 