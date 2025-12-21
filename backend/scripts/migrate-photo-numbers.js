const mongoose = require('mongoose');
const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function migratePhotoNumbers() {
  try {
    console.log('Starting photo number migration...');
    
    const clearances = await AsbestosClearance.find({});
    console.log(`Found ${clearances.length} clearances to process`);
    
    let totalPhotosUpdated = 0;
    
    for (const clearance of clearances) {
      let clearanceUpdated = false;
      
      for (const item of clearance.items) {
        if (item.photographs && item.photographs.length > 0) {
          for (let i = 0; i < item.photographs.length; i++) {
            const photo = item.photographs[i];
            if (!photo.photoNumber) {
              photo.photoNumber = i + 1;
              clearanceUpdated = true;
              totalPhotosUpdated++;
            }
          }
        }
      }
      
      if (clearanceUpdated) {
        await clearance.save();
        console.log(`Updated clearance ${clearance._id} with photo numbers`);
      }
    }
    
    console.log(`Migration completed! Updated ${totalPhotosUpdated} photos across ${clearances.length} clearances`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

migratePhotoNumbers();
