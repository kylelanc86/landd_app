const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectID: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  workOrder: {
    type: String,
    required: false,
    trim: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['Asbestos & HAZMAT', 'Occupational Hygiene', 'Client Supplied']
  },
  categories: [{
    type: String,
    enum: [
      'Asbestos Management Plan',
      'Air Monitoring and Clearance',
      'Asbestos Materials Assessment',
      'Asbestos & Lead Paint Assessment',
      'Clearance Certificate',
      'Client Supplied - Bulk ID',
      'Client Supplied - Soil/dust (AS4964)',
      'Client Supplied - WA Guidelines',
      'Client Supplied - Fibre Count',
      'Hazardous Materials Management Plan',
      'Intrusive Asbestos Assessment',
      'Intrusive Hazardous Materials Assessment',
      'Lead Dust Assessment',
      'Lead Paint Assessment',
      'Lead Paint/Dust Assessment',
      'Mould/Moisture Assessment',
      'Mould/Moisture Validation',
      'Residential Asbestos Assessment',
      'Silica Air Monitoring',
      'Other',
    ]
  }],
  status: {
    type: String,
    default: 'In progress',
    validate: {
      validator: async function(value) {
        if (!value) return true; // Allow empty values
        
        try {
          // Import the CustomDataFieldGroup model dynamically to avoid circular dependencies
          const CustomDataFieldGroup = mongoose.model('CustomDataFieldGroup');
          
          // Check if the status exists in the new grouped structure
          const group = await CustomDataFieldGroup.findOne({
            type: 'project_status',
            isActive: true
          });
          
          if (!group) {
            return false;
          }
          
          const statusExists = group.fields.some(field => 
            field.text === value && field.isActive
          );
          
          if (!statusExists) {
            return false;
          }
          
          return true;
        } catch (error) {
          // If validation fails due to database error, allow the value
          // This prevents validation from breaking if the database is unavailable
          return true;
        }
      },
      message: 'Status "{VALUE}" is not a valid project status. Please select from the available options.'
    }
  },
  address: {
    type: String,
    required: false
  },
  d_Date: {
    type: Date,
    required: false
  },
  notes: {
    type: String,
    required: false
  },
  projectContact: {
    name: {
      type: String,
      required: false,
      trim: true
    },
    number: {
      type: String,
      required: false,
      trim: true
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true
    }
  },
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  },
  reports_present: {
    type: Boolean,
    default: false
  },
  isLargeProject: {
    type: Boolean,
    default: false
  }
});

// Pre-save hook to validate status before saving
projectSchema.pre('save', async function(next) {
  // Only validate status if it's being modified
  if (this.isModified('status') && this.status) {
    try {
      const CustomDataFieldGroup = mongoose.model('CustomDataFieldGroup');
      const group = await CustomDataFieldGroup.findOne({
        type: 'project_status',
        isActive: true
      });
      
      if (!group) {
        const error = new Error(`No project status group found. Please contact an administrator.`);
        error.name = 'ValidationError';
        return next(error);
      }
      
      const statusExists = group.fields.some(field => 
        field.text === this.status && field.isActive
      );
      
      if (!statusExists) {
        const error = new Error(`Status "${this.status}" is not a valid project status. Please select from the available options.`);
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (error) {
      // Continue with save even if validation fails
    }
  }
  next();
});

// Post-save hook to update dashboard stats when status changes
projectSchema.post('save', async function(doc) {
  // Only update stats if status was modified
  if (this.isModified('status')) {
    try {
      const dashboardStatsService = require('../services/dashboardStatsService');
      // Get the old status from the previous version if it exists
      const oldStatus = this._originalStatus || null;
      await dashboardStatsService.updateStatsOnProjectStatusChange(oldStatus, doc.status);
    } catch (error) {
      console.error('Error updating dashboard stats after project save:', error);
      // Don't fail the save operation if stats update fails
    }
  }

  // Log status changes to audit trail
  if (this.isModified('status')) {
    try {
      const ProjectAuditService = require('../services/projectAuditService');
      const oldStatus = this._originalStatus || null;
      // Note: We don't have access to the user who made the change here
      // This will be handled in the routes where we have access to req.user
    } catch (error) {
      console.error('Error logging status change to audit trail:', error);
      // Don't fail the save operation if audit logging fails
    }
  }
});

// Pre-save hook to store the original status for comparison
projectSchema.pre('save', function(next) {
  // Store the original status before it gets modified
  if (this.isModified('status')) {
    this._originalStatus = this.status;
  }
  next();
});

// Essential compound indexes only
// 1. Main query pattern: status + department + date
projectSchema.index({ 
  status: 1, 
  department: 1, 
  createdAt: -1
});

// 2. Client projects with date sorting
projectSchema.index({ client: 1, createdAt: -1 });

// 3. User-assigned projects
projectSchema.index({ users: 1, createdAt: -1 });

// 4. User projects with status and projectID
projectSchema.index({ users: 1, status: 1, projectID: -1 });

// 5. Comprehensive index for complex queries (includes projectID and name)
projectSchema.index({ 
  status: 1, 
  department: 1, 
  createdAt: -1,
  name: 1,
  projectID: 1,
  workOrder: 1
});

// Function to generate the next project ID
async function generateNextProjectId(isLargeProject = false) {
  try {
    console.log('Starting projectID generation...');
    console.log('Is large project:', isLargeProject);
    
    if (isLargeProject) {
      // Generate HAZ project ID
      const hazProjects = await mongoose.model('Project')
        .find({ projectID: { $regex: '^HAZ' } }, { projectID: 1, _id: 0 })
        .sort({ projectID: -1 });
      
      console.log('Found HAZ projects:', hazProjects);
      
      if (hazProjects.length === 0) {
        console.log('No existing HAZ projects, starting with HAZ001');
        return 'HAZ001';
      }

      const highestHazProject = hazProjects[0];
      const lastHazId = highestHazProject.projectID;
      console.log('Highest existing HAZ project ID:', lastHazId);
      
      // Extract the numeric part and increment
      const numericPart = parseInt(lastHazId.replace('HAZ', ''));
      if (isNaN(numericPart)) {
        console.log('Invalid HAZ project ID format, starting with HAZ001');
        return 'HAZ001';
      }

      const nextNumber = numericPart + 1;
      const newHazId = `HAZ${String(nextNumber).padStart(3, '0')}`;
      console.log('Generated new HAZ project ID:', newHazId);
      
      return newHazId;
    } else {
      // Generate regular LDJ project ID
      const projects = await mongoose.model('Project')
        .find({ projectID: { $regex: '^LDJ' } }, { projectID: 1, _id: 0 })
        .sort({ projectID: -1 });
      
      console.log('Found LDJ projects:', projects);
      
      if (projects.length === 0) {
        console.log('No existing projects, starting with LDJ00001');
        return 'LDJ00001';
      }

      const highestProject = projects[0];
      if (!highestProject || !highestProject.projectID) {
        console.log('No valid project ID found, starting with LDJ00001');
        return 'LDJ00001';
      }

      const lastId = highestProject.projectID;
      console.log('Highest existing project ID:', lastId);
      
      // Extract the numeric part and increment
      const numericPart = parseInt(lastId.replace('LDJ', ''));
      if (isNaN(numericPart)) {
        console.log('Invalid project ID format, starting with LDJ00001');
        return 'LDJ00001';
      }

      const nextNumericPart = numericPart + 1;
      
      // Format with leading zeros to ensure 5 digits
      const newId = `LDJ${String(nextNumericPart).padStart(5, '0')}`;
      console.log('Generated new project ID:', newId);
      
      return newId;
    }
  } catch (error) {
    console.error('Error generating project ID:', error);
    // Return a default ID if there's an error
    return isLargeProject ? 'HAZ001' : 'LDJ00001';
  }
}

// Generate projectID before validation
projectSchema.pre('validate', async function(next) {
  try {
    console.log('Pre-validate hook triggered');
    console.log('Is new document:', this.isNew);
    console.log('Current document state:', this.toObject());
    
    if (this.isNew) {
      console.log('Generating project ID before validation');
      // Check if this is a large project based on the isLargeProject field
      const isLargeProject = this.isLargeProject === true;
      const newProjectId = await generateNextProjectId(isLargeProject);
      console.log('Setting projectID to:', newProjectId);
      this.projectID = newProjectId;
      console.log('Document after setting projectID:', this.toObject());
    } else if (!this.projectID) {
      console.error('Existing document missing projectID');
      throw new Error('Project ID is required for existing documents');
    }
    next();
  } catch (error) {
    console.error('Error in pre-validate hook:', error);
    // Add more context to the error
    const enhancedError = new Error(`Project validation failed: ${error.message}`);
    enhancedError.originalError = error;
    next(enhancedError);
  }
});

// Update the updatedAt timestamp after validation
projectSchema.pre('save', function(next) {
  console.log('Pre-save hook triggered');
  console.log('Document state before save:', this.toObject());
  this.updatedAt = Date.now();
  next();
});

// Add a method to handle user updates
projectSchema.methods.updateUsers = async function(userIds) {
  this.users = userIds;
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema); 