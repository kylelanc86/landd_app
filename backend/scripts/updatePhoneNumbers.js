const mongoose = require('mongoose');
const dotenv = require('dotenv');

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

// Function to format phone number
function formatPhoneNumber(number) {
  // Convert to string
  number = String(number);
  // Remove any non-digit characters
  let cleaned = number.replace(/\D/g, '');
  
  // Add '0' if number starts with '4'
  if (cleaned.startsWith('4')) {
    cleaned = '0' + cleaned;
  }
  
  // Ensure number starts with '04'
  if (!cleaned.startsWith('04')) {
    console.log(`Warning: Number ${number} doesn't start with 04 after formatting`);
    return number; // Return original if we can't format it
  }
  
  // Format as 04xx xxx xxx
  return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
}

// Update phone numbers
async function updatePhoneNumbers() {
  try {
    const db = mongoose.connection.db;
    const clients = await db.collection('clients').find({}).toArray();
    console.log(`Found ${clients.length} clients to update`);

    for (const client of clients) {
      const updates = {};
      
      if (client.contact1Number && /\d/.test(client.contact1Number)) {
        updates.contact1Number = formatPhoneNumber(client.contact1Number);
      }
      
      if (client.contact2Number && /\d/.test(client.contact2Number)) {
        updates.contact2Number = formatPhoneNumber(client.contact2Number);
      }

      if (Object.keys(updates).length > 0) {
        await db.collection('clients').updateOne(
          { _id: client._id },
          { $set: updates }
        );
        console.log(`Updated client ${client._id}`);
      }
    }

    console.log('Phone number update completed');
  } catch (error) {
    console.error('Error updating phone numbers:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Wait for connection before running update
mongoose.connection.once('open', () => {
  console.log('MongoDB connection established');
  updatePhoneNumbers();
}); 