const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function checkSoftDeletedInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== CHECKING SOFT DELETED INVOICES ===');
    
    // Get all invoices including deleted ones
    const allInvoices = await Invoice.find({});
    const activeInvoices = await Invoice.find({ isDeleted: { $ne: true } });
    const softDeletedInvoices = await Invoice.find({ isDeleted: true });
    
    console.log(`Total invoices in database: ${allInvoices.length}`);
    console.log(`Active invoices: ${activeInvoices.length}`);
    console.log(`Soft deleted invoices: ${softDeletedInvoices.length}`);
    
    if (softDeletedInvoices.length > 0) {
      console.log('\nSoft deleted invoices:');
      softDeletedInvoices.forEach(invoice => {
        console.log(`  - ${invoice.invoiceID} (Xero ID: ${invoice.xeroInvoiceId}, Status: ${invoice.status}, Reason: ${invoice.deleteReason})`);
      });
    }
    
    // Check for the specific invoices mentioned by user
    console.log('\n=== CHECKING SPECIFIC INVOICES ===');
    const specificInvoices = ['LDJ04107-5', 'LDJ04205'];
    
    for (const invoiceId of specificInvoices) {
      const invoice = await Invoice.findOne({ invoiceID: invoiceId });
      if (invoice) {
        console.log(`\n${invoiceId}:`);
        console.log(`  Found in database`);
        console.log(`  isDeleted: ${invoice.isDeleted}`);
        console.log(`  status: ${invoice.status}`);
        console.log(`  xeroStatus: ${invoice.xeroStatus}`);
        console.log(`  deleteReason: ${invoice.deleteReason}`);
      } else {
        console.log(`\n${invoiceId}: Not found in database at all`);
      }
    }
    
    // Check if there are any invoices with different statuses that might be missing
    console.log('\n=== STATUS BREAKDOWN ===');
    const statusCounts = {};
    allInvoices.forEach(invoice => {
      const status = invoice.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkSoftDeletedInvoices(); 