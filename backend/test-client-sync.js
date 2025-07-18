const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
require('dotenv').config();

async function testClientSync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to cloud database');
    
    // Check current state
    const total = await Invoice.countDocuments();
    const withClientName = await Invoice.countDocuments({ xeroClientName: { $exists: true, $ne: null } });
    const withNullClient = await Invoice.countDocuments({ client: null });
    
    console.log('=== CURRENT STATE ===');
    console.log('Total invoices:', total);
    console.log('Invoices with xeroClientName:', withClientName);
    console.log('Invoices with null client:', withNullClient);
    
    if (withClientName > 0) {
      const sample = await Invoice.findOne({ xeroClientName: { $exists: true, $ne: null } });
      console.log('\nSample invoice with client name:');
      console.log('- ID:', sample._id);
      console.log('- Invoice ID:', sample.invoiceID);
      console.log('- Xero Client Name:', sample.xeroClientName);
      console.log('- Xero Contact ID:', sample.xeroContactId);
      console.log('- Client Object:', sample.client);
    }
    
    if (withNullClient > 0) {
      const sampleNull = await Invoice.findOne({ client: null });
      console.log('\nSample invoice with null client:');
      console.log('- ID:', sampleNull._id);
      console.log('- Invoice ID:', sampleNull.invoiceID);
      console.log('- Xero Client Name:', sampleNull.xeroClientName);
      console.log('- Xero Contact ID:', sampleNull.xeroContactId);
      console.log('- Client Object:', sampleNull.client);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testClientSync(); 