const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  invoiceEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    required: true
  },
  contact1Name: {
    type: String,
    required: true
  },
  contact1Number: {
    type: String,
    required: true
  },
  contact1Email: {
    type: String,
    required: true,
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

module.exports = mongoose.model('Client', clientSchema); 