const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Project = require('./models/Project');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Status mapping
const statusMapping = {
  'pending': 'Assigned',
  'in_progress': 'In progress',
  'completed': 'Job complete',
  'cancelled': 'Cancelled'
};

// Function to migrate the database
const migrateStatuses = async () => {
  try {
    console.log('Starting status migration...');
    
    // Get all projects
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects to update`);

    // Update each project
    for (const project of projects) {
      const oldStatus = project.status;
      const newStatus = statusMapping[oldStatus] || 'Assigned'; // Default to 'Assigned' if no mapping found
      
      if (oldStatus !== newStatus) {
        console.log(`Updating project ${project._id}: ${oldStatus} -> ${newStatus}`);
        project.status = newStatus;
        await project.save();
      }
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration
migrateStatuses(); 