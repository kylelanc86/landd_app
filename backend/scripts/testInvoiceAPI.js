const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function testInvoiceAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== TESTING INVOICE API LOGIC ===');
    
    // Test 1: Direct MongoDB query without any filtering
    console.log('\n1. Direct MongoDB query (no filtering):');
    const allInvoices = await Invoice.find({});
    console.log('Total invoices in database:', allInvoices.length);
    
    // Test 2: Query with isDeleted filter
    console.log('\n2. Query with isDeleted filter:');
    const nonDeletedInvoices = await Invoice.find({ isDeleted: { $ne: true } });
    console.log('Non-deleted invoices:', nonDeletedInvoices.length);
    
    // Test 3: Query for explicitly non-deleted invoices
    console.log('\n3. Query for isDeleted: false:');
    const falseDeletedInvoices = await Invoice.find({ isDeleted: false });
    console.log('Invoices with isDeleted: false:', falseDeletedInvoices.length);
    
    // Test 4: Query for explicitly deleted invoices
    console.log('\n4. Query for isDeleted: true:');
    const trueDeletedInvoices = await Invoice.find({ isDeleted: true });
    console.log('Invoices with isDeleted: true:', trueDeletedInvoices.length);
    
    // Test 5: Query for invoices without isDeleted field
    console.log('\n5. Query for invoices without isDeleted field:');
    const noDeletedFieldInvoices = await Invoice.find({ isDeleted: { $exists: false } });
    console.log('Invoices without isDeleted field:', noDeletedFieldInvoices.length);
    
    // Test 6: Check what the middleware would do
    console.log('\n6. Simulating middleware query:');
    const middlewareQuery = await Invoice.find().where({ isDeleted: { $ne: true } });
    console.log('Middleware-style query result:', middlewareQuery.length);
    
    // Test 7: Check sample invoices
    console.log('\n7. Sample invoices (first 5):');
    const sampleInvoices = allInvoices.slice(0, 5);
    sampleInvoices.forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}:`, {
        id: invoice._id,
        invoiceID: invoice.invoiceID,
        isDeleted: invoice.isDeleted,
        status: invoice.status,
        xeroInvoiceId: invoice.xeroInvoiceId
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testInvoiceAPI(); 