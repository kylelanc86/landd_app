const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
require('dotenv').config();

async function checkCloudInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to cloud database');
    
    const total = await Invoice.countDocuments();
    const withContactId = await Invoice.countDocuments({ xeroContactId: { $exists: true, $ne: null } });
    const withNullClient = await Invoice.countDocuments({ client: null });
    
    console.log('=== CLOUD DATABASE INVOICE DATA ===');
    console.log('Total invoices:', total);
    console.log('Invoices with xeroContactId:', withContactId);
    console.log('Invoices with null client:', withNullClient);
    
    if (withContactId > 0) {
      const sample = await Invoice.findOne({ xeroContactId: { $exists: true, $ne: null } });
      console.log('\nSample invoice:');
      console.log('- ID:', sample._id);
      console.log('- Invoice ID:', sample.invoiceID);
      console.log('- Client:', sample.client);
      console.log('- Xero Contact ID:', sample.xeroContactId);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkCloudInvoices(); 