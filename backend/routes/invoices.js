const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

// Get all invoices
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching all invoices from MongoDB...');
    const invoices = await Invoice.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 }) // Show newest invoices first
      .populate({
        path: 'projectId',
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
      .populate('projectId', 'name')
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
  console.log('Received invoice creation request with data:', JSON.stringify(req.body, null, 2));
  
  try {
    const invoice = new Invoice({
      invoiceID: req.body.invoiceID,
      projectId: req.body.projectId,
      client: req.body.client,
      amount: req.body.amount,
      status: req.body.status,
      date: req.body.date,
      dueDate: req.body.dueDate,
      description: req.body.description,
      lineItems: req.body.lineItems || [],
      xeroClientName: req.body.xeroClientName,
      xeroReference: req.body.xeroReference
    });

    console.log('Created invoice instance:', JSON.stringify(invoice.toObject(), null, 2));
    
    const newInvoice = await invoice.save();
    console.log('Invoice saved successfully:', JSON.stringify(newInvoice.toObject(), null, 2));
    
    const populatedInvoice = await Invoice.findById(newInvoice._id)
      .populate('projectId', 'name')
      .populate('client', 'name');
    res.status(201).json(populatedInvoice);
  } catch (err) {
    console.error('Error saving invoice:', err);
    // Log detailed validation errors
    if (err.errors) {
      console.error('Validation errors:', JSON.stringify(err.errors, null, 2));
    }
    
    // Check for specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Invoice validation failed',
        validationErrors: err.errors,
        details: Object.keys(err.errors).map(field => ({
          field,
          message: err.errors[field].message
        }))
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Duplicate invoice ID',
        details: 'An invoice with this ID already exists'
      });
    }
    
    res.status(400).json({ 
      message: err.message,
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
      projectId: req.body.projectId,
      client: req.body.client,
      amount: req.body.amount,
      status: req.body.status,
      date: req.body.date,
      dueDate: req.body.dueDate,
      description: req.body.description,
      lineItems: req.body.lineItems || invoice.lineItems,
      xeroClientName: req.body.xeroClientName,
      xeroReference: req.body.xeroReference
    });

    const updatedInvoice = await invoice.save();
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
      .populate('projectId', 'name')
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
      .populate('projectId', 'name')
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
      .populate('projectId', 'name')
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
    .populate('projectId', 'name')
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