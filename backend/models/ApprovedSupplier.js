const mongoose = require('mongoose');

const SUPPLIER_TYPES = ['Equipment Sales/Hire', 'Consumables', 'Calibration'];

const approvedSupplierSchema = new mongoose.Schema({
  supplierType: {
    type: String,
    enum: SUPPLIER_TYPES,
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  contactName: {
    type: String,
    default: ''
  },
  contactNumber: {
    type: String,
    default: ''
  },
  contactEmail: {
    type: String,
    default: ''
  },
  accreditationRequired: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },
  accreditationCheckedDate: {
    type: Date,
    default: null
  },
  notesItemSpecs: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

approvedSupplierSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

approvedSupplierSchema.index({ companyName: 1 });
approvedSupplierSchema.index({ supplierType: 1 });

module.exports = mongoose.model('ApprovedSupplier', approvedSupplierSchema);
