const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Client = require('./models/Client');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function debugClientData() {
  try {
    console.log('=== COMPREHENSIVE CLIENT DATA DEBUG ===\n');
    
    // 1. Check if we have any invoices
    console.log('1. CHECKING INVOICES:');
    const invoices = await Invoice.find().populate('client');
    console.log(`   Found ${invoices.length} invoices`);
    
    if (invoices.length === 0) {
      console.log('   ❌ NO INVOICES FOUND - Need to sync from Xero first');
      return;
    }
    
    // 2. Check each invoice's client data
    console.log('\n2. CHECKING INVOICE CLIENT DATA:');
    invoices.forEach((invoice, index) => {
      console.log(`   Invoice ${index + 1}:`);
      console.log(`     ID: ${invoice._id}`);
      console.log(`     Invoice ID: ${invoice.invoiceID}`);
      console.log(`     Client field: ${invoice.client}`);
      console.log(`     Client ID: ${invoice.client?._id || 'NULL'}`);
      console.log(`     Client Name: ${invoice.client?.name || 'NULL'}`);
      console.log(`     Xero Contact ID: ${invoice.xeroContactId || 'NULL'}`);
      console.log(`     Status: ${invoice.status}`);
      console.log('');
    });
    
    // 3. Check if we have any clients
    console.log('3. CHECKING CLIENTS:');
    const clients = await Client.find();
    console.log(`   Found ${clients.length} clients`);
    
    clients.forEach((client, index) => {
      console.log(`   Client ${index + 1}:`);
      console.log(`     ID: ${client._id}`);
      console.log(`     Name: ${client.name}`);
      console.log(`     Email: ${client.invoiceEmail}`);
      console.log('');
    });
    
    // 4. Check for invoices without client data
    console.log('4. CHECKING INVOICES WITHOUT CLIENTS:');
    const invoicesWithoutClient = await Invoice.find({ client: { $exists: false } });
    console.log(`   Found ${invoicesWithoutClient.length} invoices without client field`);
    
    const invoicesWithNullClient = await Invoice.find({ client: null });
    console.log(`   Found ${invoicesWithNullClient.length} invoices with null client`);
    
    // 5. Test the API endpoint
    console.log('\n5. TESTING API ENDPOINT:');
    console.log('   Run this command to test the API:');
    console.log('   curl -X GET http://localhost:5000/api/invoices -H "Authorization: Bearer YOUR_TOKEN"');
    
    // 6. Check database schema
    console.log('\n6. DATABASE SCHEMA CHECK:');
    const sampleInvoice = await Invoice.findOne();
    if (sampleInvoice) {
      console.log('   Invoice schema fields:', Object.keys(sampleInvoice.toObject()));
      console.log('   Client field type:', typeof sampleInvoice.client);
      console.log('   Client field value:', sampleInvoice.client);
    }
    
    // 7. Test population
    console.log('\n7. TESTING POPULATION:');
    const populatedInvoice = await Invoice.findOne().populate('client');
    if (populatedInvoice) {
      console.log('   Populated invoice client:', populatedInvoice.client);
      console.log('   Populated client name:', populatedInvoice.client?.name);
    }
    
  } catch (error) {
    console.error('Error in debug:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugClientData(); 