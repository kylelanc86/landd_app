const mongoose = require('mongoose');

const CustomDataFieldGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['asbestos_removalist', 'location_description', 'materials_description', 'room_area', 'legislation', 'project_status', 'recommendation'],
    index: true
  },
  fields: [{
    text: {
      type: String,
      required: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // For project statuses
    isActiveStatus: {
      type: Boolean,
      default: true
    },
    statusColor: {
      type: String,
      trim: true,
      default: '#1976d2'
    },
    // For legislation
    legislationTitle: {
      type: String,
      trim: true
    },
    jurisdiction: {
      type: String,
      trim: true
    },
    // For materials descriptions
    asbestosType: {
      type: String,
      trim: true,
      enum: ['Friable', 'Non-friable']
    },
    // For recommendations
    name: {
      type: String,
      trim: true
    },
    // Metadata
    order: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
CustomDataFieldGroupSchema.index({ type: 1, isActive: 1 });
CustomDataFieldGroupSchema.index({ 'fields.text': 1, type: 1 });

// Pre-save middleware to update updatedAt
CustomDataFieldGroupSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get project statuses
CustomDataFieldGroupSchema.statics.getProjectStatuses = async function() {
  try {
    const group = await this.findOne({ 
      type: 'project_status', 
      isActive: true 
    });
    
    if (!group) {
      return { activeStatuses: [], inactiveStatuses: [], statusColors: {} };
    }
    
    const activeStatuses = group.fields
      .filter(field => field.isActive && field.isActiveStatus)
      .sort((a, b) => a.order - b.order)
      .map(field => ({
        _id: field._id,
        text: field.text,
        isActive: field.isActive,
        isActiveStatus: field.isActiveStatus,
        statusColor: field.statusColor,
        order: field.order,
        createdBy: field.createdBy,
        createdAt: field.createdAt
      }));
    
    const inactiveStatuses = group.fields
      .filter(field => field.isActive && !field.isActiveStatus)
      .sort((a, b) => a.order - b.order)
      .map(field => ({
        _id: field._id,
        text: field.text,
        isActive: field.isActive,
        isActiveStatus: field.isActiveStatus,
        statusColor: field.statusColor,
        order: field.order,
        createdBy: field.createdBy,
        createdAt: field.createdAt
      }));
    
    return { activeStatuses, inactiveStatuses };
  } catch (error) {
    console.error('Error getting project statuses from group:', error);
    return { activeStatuses: [], inactiveStatuses: [], statusColors: {} };
  }
};

// Static method to get fields by type
CustomDataFieldGroupSchema.statics.getFieldsByType = async function(type) {
  try {
    const group = await this.findOne({ 
      type, 
      isActive: true 
    });
    
    if (!group) {
      return [];
    }
    
    return group.fields
      .filter(field => field.isActive)
      .sort((a, b) => a.order - b.order)
      .map(field => ({
        _id: field._id,
        text: field.text,
        isActive: field.isActive,
        isActiveStatus: field.isActiveStatus,
        statusColor: field.statusColor,
        legislationTitle: field.legislationTitle,
        jurisdiction: field.jurisdiction,
        asbestosType: field.asbestosType,
        name: field.name
      }));
  } catch (error) {
    console.error(`Error getting fields for type ${type}:`, error);
    return [];
  }
};

module.exports = mongoose.model('CustomDataFieldGroup', CustomDataFieldGroupSchema);
