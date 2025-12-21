const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  invoiceEmail: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    required: false
  },
  contact1Name: {
    type: String,
    required: false
  },
  contact1Number: {
    type: String,
    required: false
  },
  contact1Email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  contact2Name: String,
  contact2Number: String,
  contact2Email: {
    type: String,
    trim: true,
    lowercase: true
  },
  paymentTerms: {
    type: String,
    enum: ['Standard (30 days)', 'Payment before Report (7 days)'],
    default: 'Standard (30 days)'
  },
  written_off: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
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

// Update the updatedAt timestamp before saving
clientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for performance
clientSchema.index({ name: 1 }); // Index for sorting and search
clientSchema.index({ isActive: 1 }); // Index for filtering active/inactive clients
clientSchema.index({ isActive: 1, name: 1 }); // Compound index for filtered searches and sorting

module.exports = mongoose.model('Client', clientSchema); 