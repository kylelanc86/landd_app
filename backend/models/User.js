const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'employee'],
    default: 'employee'
  },
  permissions: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  licences: {
    type: [{
      state: {
        type: String,
        required: true,
        trim: true
      },
      licenceNumber: {
        type: String,
        required: true,
        trim: true
      },
      licenceType: {
        type: String,
        required: true,
        trim: true
      }
    }],
    default: []
  },
  signature: {
    type: String,
    trim: true
  },
  workingHours: {
    type: {
      monday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      },
      tuesday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      },
      wednesday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      },
      thursday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      },
      friday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      },
      saturday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      },
      sunday: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 0, min: 0, max: 24 }
      }
    },
    default: {
      monday: { enabled: false, hours: 0 },
      tuesday: { enabled: false, hours: 0 },
      wednesday: { enabled: false, hours: 0 },
      thursday: { enabled: false, hours: 0 },
      friday: { enabled: false, hours: 0 },
      saturday: { enabled: false, hours: 0 },
      sunday: { enabled: false, hours: 0 }
    }
  },
  labApprovals: {
    fibreCounting: { type: Boolean, default: false },
    fibreIdentification: { type: Boolean, default: false }
  },
  canSetJobComplete: {
    type: Boolean,
    default: false
  },
  labSignatory: {
    type: Boolean,
    default: false
  },
  notifications: {
    email: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    },
    systemUpdates: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String,
    required: false,
  },
  resetPasswordExpires: {
    type: Date,
    required: false,
  },
  setupPasswordToken: {
    type: String,
    required: false,
  },
  setupPasswordExpires: {
    type: Date,
    required: false,
  },
  passwordSet: {
    type: Boolean,
    default: false,
  },
  userPreferences: {
    columnVisibility: {
      projects: {
        type: Object,
        default: {
          projectID: true,
          name: true,
          client: true,
          status: true,
          department: true,
          users: true,
          createdAt: true,
          updatedAt: false,
        }
      },
      clients: {
        type: Object,
        default: {
          name: true,
          invoiceEmail: true,
          contact1Name: true,
          contact1Number: true,
          address: true,
          actions: true,
        }
      }
    },
    filters: {
      projects: {
        type: Object,
        default: {}
      },
      clients: {
        type: Object,
        default: {}
      }
    },
    dashboard: {
      widgetOrder: {
        type: [String],
        default: [
          "dailyTimesheet",
          "inProgress",
          "samplesSubmitted",
          "labComplete",
          "reportReview",
          "readyForInvoicing",
          "invoiceSent",
          "awaitingPayment",
        ]
      },
      visibleWidgets: {
        type: Object,
        default: {
          dailyTimesheet: true,
          inProgress: true,
          samplesSubmitted: true,
          labComplete: true,
          reportReview: true,
          readyForInvoicing: true,
          invoiceSent: true,
          awaitingPayment: true,
        }
      }
    }
  },
  chargeOutRate: {
    type: Number,
    required: false,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  try {
    return jwt.sign(
      { 
        id: this._id,
        email: this.email,
        role: this.role,
        permissions: this.permissions
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  } catch (error) {
    console.error('Token generation error:', error);
    throw error;
  }
};

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    throw error;
  }
};

// Create indexes
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User; 