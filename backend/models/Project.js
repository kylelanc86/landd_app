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
    enum: ['Asbestos & HAZMAT', 'Occupational Hygiene', 'Client Supplied', 'air_quality']
  },
  categories: [{
    type: String,
    enum: [
      'Asbestos Materials Assessment',
      'Asbestos & Lead Paint Assessment',
      'Lead Paint/Dust Assessment',
      'Air Monitoring and Clearance',
      'Clearance Certificate',
      'Commercial Asbestos Management Plan',
      'Hazardous Materials Management Plan',
      'Residential Asbestos Survey',
      'Silica Air Monitoring',
      'Mould/Moisture Assessment',
      'Other'
    ]
  }],
  status: {
    type: String,
    enum: [
      'In progress',
      'Report sent for review',
      'Ready for invoicing',
      'Invoice sent',
      'Job complete',
      'On hold',
      'Quote sent',
      'Cancelled'
    ],
    default: 'In progress'
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  reports_present: {
    type: Boolean,
    default: false
  }
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
async function generateNextProjectId() {
  try {
    console.log('Starting projectID generation...');
    
    // Find all projects and sort by projectID in descending order
    const projects = await mongoose.model('Project')
      .find({}, { projectID: 1, _id: 0 })  // Explicitly select projectID field
      .sort({ projectID: -1 });
    
    console.log('Found projects with projectIDs:', projects);
    
    if (projects.length === 0) {
      console.log('No existing projects, starting with LDJ00001');
      return 'LDJ00001';
    }

    // Get the highest project ID
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
  } catch (error) {
    console.error('Error generating project ID:', error);
    // Return a default ID if there's an error
    return 'LDJ00001';
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
      const newProjectId = await generateNextProjectId();
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