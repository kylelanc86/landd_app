const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function updateDatabase() {
  try {
    // Get the database instance
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Current collections:', collections.map(c => c.name));

    // Check if old jobs collection exists
    const oldJobsCollection = collections.find(c => c.name === 'jobs');
    if (oldJobsCollection) {
      console.log('Found old jobs collection');
      
      // Create new collection with updated schema
      await db.createCollection('air_monitoring_jobs');
      console.log('Created new air_monitoring_jobs collection');

      // Copy data from old collection to new collection with updated schema
      const oldJobs = await db.collection('jobs').find({}).toArray();
      const updatedJobs = oldJobs.map(job => ({
        name: job.name,
        project: job.project,
        status: job.status || 'pending',
        asbestosRemovalist: job.asbestosRemovalist,
        description: job.description,
        assignedTo: job.assignedTo,
        createdAt: job.createdAt || new Date(),
        updatedAt: job.updatedAt || new Date()
      }));

      if (updatedJobs.length > 0) {
        await db.collection('air_monitoring_jobs').insertMany(updatedJobs);
        console.log(`Migrated ${updatedJobs.length} jobs to new collection`);
      }

      // Drop old collection
      await db.collection('jobs').drop();
      console.log('Dropped old jobs collection');
    }

    // Verify the changes
    const updatedCollections = await db.listCollections().toArray();
    console.log('Updated collections:', updatedCollections.map(c => c.name));

    console.log('Database update completed successfully');
  } catch (error) {
    console.error('Error updating database:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the update
updateDatabase(); 