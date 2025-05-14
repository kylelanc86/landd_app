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
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['air_quality', 'water_quality', 'soil_analysis', 'other']
  },
  status: {
    type: String,
    enum: [
      'Assigned',
      'In progress',
      'Samples submitted',
      'Lab Analysis Complete',
      'Report sent for review',
      'Ready for invoicing',
      'Invoice sent',
      'Job complete',
      'On hold',
      'Quote sent',
      'Cancelled'
    ],
    default: 'Assigned'
  },
  address: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: Date,
  description: String,
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
      console.log('No existing projects, starting with LDX00001');
      return 'LDX00001';
    }

    // Get the highest project ID
    const highestProject = projects[0];
    if (!highestProject || !highestProject.projectID) {
      console.log('No valid project ID found, starting with LDX00001');
      return 'LDX00001';
    }

    const lastId = highestProject.projectID;
    console.log('Highest existing project ID:', lastId);
    
    // Extract the numeric part and increment
    const numericPart = parseInt(lastId.replace('LDX', ''));
    if (isNaN(numericPart)) {
      console.log('Invalid project ID format, starting with LDX00001');
      return 'LDX00001';
    }

    const nextNumericPart = numericPart + 1;
    
    // Format with leading zeros
    const newId = `LDX${String(nextNumericPart).padStart(5, '0')}`;
    console.log('Generated new project ID:', newId);
    
    return newId;
  } catch (error) {
    console.error('Error generating project ID:', error);
    // Return a default ID if there's an error
    return 'LDX00001';
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
    }
    next();
  } catch (error) {
    console.error('Error in pre-validate hook:', error);
    next(error);
  }
});

// Update the updatedAt timestamp after validation
projectSchema.pre('save', function(next) {
  console.log('Pre-save hook triggered');
  console.log('Document state before save:', this.toObject());
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Project', projectSchema); 