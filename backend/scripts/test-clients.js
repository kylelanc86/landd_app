const mongoose = require('mongoose');
const Client = require('./models/Client');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testClients() {
  try {
    console.log('Testing client data...');
    
    // Get all clients
    const clients = await Client.find().limit(10);
    
    console.log(`Found ${clients.length} clients`);
    
    clients.forEach((client, index) => {
      console.log(`\nClient ${index + 1}:`);
      console.log(`  ID: ${client._id}`);
      console.log(`  Name: ${client.name}`);
      console.log(`  Email: ${client.invoiceEmail}`);
      console.log(`  Contact: ${client.contact1Name}`);
    });
    
  } catch (error) {
    console.error('Error testing clients:', error);
  } finally {
    mongoose.connection.close();
  }
}

testClients(); 