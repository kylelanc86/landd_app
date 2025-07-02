const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Get the users collection
    const usersCollection = db.collection('users');
    
    // Find all users with laaLicences field
    const usersWithLaaLicences = await usersCollection.find({
      laaLicences: { $exists: true }
    }).toArray();
    
    console.log(`Found ${usersWithLaaLicences.length} users with laaLicences`);
    
    // Migrate each user's laaLicences to licences with licenceType
    for (const user of usersWithLaaLicences) {
      const migratedLicences = (user.laaLicences || []).map(licence => ({
        state: licence.state || '',
        licenceNumber: licence.licenceNumber || '',
        licenceType: 'LAA' // Default to LAA for existing licences
      }));
      
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: { licences: migratedLicences },
          $unset: { laaLicences: "" }
        }
      );
      
      console.log(`Migrated user ${user.email}: ${migratedLicences.length} licences`);
    }
    
    // Also ensure all users have the licences field
    const result = await usersCollection.updateMany(
      { licences: { $exists: false } },
      {
        $set: {
          licences: []
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users to have licences field`);
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the connection
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}); 