const express = require('express');
const router = express.Router();
const InvoiceItem = require('../models/InvoiceItem');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all invoice items - allow all authenticated users to read
router.get('/', auth, async (req, res) => {
  try {
    const invoiceItems = await InvoiceItem.find({ isActive: true })
      .sort({ itemNo: 1 })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    
    res.json({
      success: true,
      data: invoiceItems
    });
  } catch (error) {
    console.error('Error fetching invoice items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice items',
      error: error.message
    });
  }
});

// Create a new invoice item
router.post('/', auth, checkPermission('admin.create'), async (req, res) => {
  try {
    const { itemNo, description, unitPrice, account, taxRate } = req.body;

    // Check if itemNo already exists
    const existingItem = await InvoiceItem.findOne({ itemNo, isActive: true });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item number already exists'
      });
    }

    const invoiceItem = new InvoiceItem({
      itemNo,
      description,
      unitPrice: parseFloat(unitPrice),
      account,
      taxRate,
      createdBy: req.user._id
    });

    const savedItem = await invoiceItem.save();
    const populatedItem = await InvoiceItem.findById(savedItem._id)
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      data: populatedItem
    });
  } catch (error) {
    console.error('Error creating invoice item:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating invoice item',
      error: error.message
    });
  }
});

// Update an invoice item
router.put('/:id', auth, checkPermission('admin.update'), async (req, res) => {
  try {
    const { itemNo, description, unitPrice, account, taxRate } = req.body;
    const { id } = req.params;

    // Check if itemNo already exists for a different item
    const existingItem = await InvoiceItem.findOne({ 
      itemNo, 
      isActive: true, 
      _id: { $ne: id } 
    });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item number already exists'
      });
    }

    const updatedItem = await InvoiceItem.findByIdAndUpdate(
      id,
      {
        itemNo,
        description,
        unitPrice: parseFloat(unitPrice),
        account,
        taxRate,
        updatedBy: req.user._id
      },
      { new: true }
    ).populate('createdBy', 'name')
     .populate('updatedBy', 'name');

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Invoice item not found'
      });
    }

    res.json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    console.error('Error updating invoice item:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice item',
      error: error.message
    });
  }
});

// Delete an invoice item (soft delete)
router.delete('/:id', auth, checkPermission('admin.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const deletedItem = await InvoiceItem.findByIdAndUpdate(
      id,
      { 
        isActive: false,
        updatedBy: req.user._id
      },
      { new: true }
    );

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: 'Invoice item not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice item:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting invoice item',
      error: error.message
    });
  }
});

// Get a single invoice item
router.get('/:id', auth, checkPermission('admin.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const invoiceItem = await InvoiceItem.findOne({ _id: id, isActive: true })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!invoiceItem) {
      return res.status(404).json({
        success: false,
        message: 'Invoice item not found'
      });
    }

    res.json({
      success: true,
      data: invoiceItem
    });
  } catch (error) {
    console.error('Error fetching invoice item:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice item',
      error: error.message
    });
  }
});

module.exports = router; 