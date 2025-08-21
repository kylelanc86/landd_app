const mongoose = require('mongoose');
const MixedClearance = require('../models/clearanceTemplates/asbestos/MixedClearance');
const User = require('../models/User');

// Connect to MongoDB (adjust the connection string as needed)
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/air_monitoring', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const createMixedClearanceTemplate = async () => {
  try {
    // Check if template already exists
    const existingTemplate = await MixedClearance.findOne();
    if (existingTemplate) {
      console.log('Mixed clearance template already exists');
      console.log('Template ID:', existingTemplate._id);
      return existingTemplate;
    }

    // Find a system user or create a default ObjectId for createdBy
    let systemUser = await User.findOne({ role: 'admin' }).limit(1);
    let createdBy = systemUser ? systemUser._id : new mongoose.Types.ObjectId();

    // Create the template
    const template = new MixedClearance({
      createdBy,
      reportHeaders: {
        title: "MIXED ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
        subtitle: "Clearance Inspection Report"
      }
      // The standardSections will use the defaults from MixedContent.js
    });

    await template.save();
    console.log('Mixed clearance template created successfully');
    console.log('Template ID:', template._id);
    
    return template;
  } catch (error) {
    console.error('Error creating Mixed clearance template:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await createMixedClearanceTemplate();
    console.log('Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
};

main();
