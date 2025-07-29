const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function checkSpecificInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const invoiceIds = ['LDJ04107-5', 'LDJ04205'];
    
    console.log('=== CHECKING SPECIFIC INVOICES ===');
    
    for (const invoiceId of invoiceIds) {
      console.log(`\n--- Checking ${invoiceId} ---`);
      
      const invoice = await Invoice.findOne({ invoiceID: invoiceId });
      
      if (!invoice) {
        console.log(`❌ Invoice ${invoiceId} not found in database`);
        continue;
      }

      console.log('✅ Invoice found in database');
      console.log('ID:', invoice._id);
      console.log('Invoice ID:', invoice.invoiceID);
      console.log('Status:', invoice.status);
      console.log('Xero Status:', invoice.xeroStatus);
      console.log('Xero Invoice ID:', invoice.xeroInvoiceId);
      console.log('Xero Client Name:', invoice.xeroClientName);
      console.log('Amount:', invoice.amount);
      console.log('Date:', invoice.date);
      console.log('Due Date:', invoice.dueDate);
      console.log('Is Deleted:', invoice.isDeleted);
      console.log('Delete Reason:', invoice.deleteReason);
      console.log('Created At:', invoice.createdAt);
      console.log('Updated At:', invoice.updatedAt);
      
      if (invoice.status === 'paid') {
        console.log('⚠️  This invoice is marked as PAID in our database');
        console.log('   It should be soft deleted since we only track unpaid invoices');
      } else if (invoice.xeroStatus === 'PAID') {
        console.log('⚠️  This invoice has PAID status in Xero');
        console.log('   It should be soft deleted since we only track unpaid invoices');
      } else {
        console.log('✅ Invoice appears to be unpaid - this is correct');
      }
    }
    
    console.log('\n=== SUMMARY ===');
    const allInvoices = await Invoice.find({ isDeleted: { $ne: true } });
    console.log(`Total active invoices: ${allInvoices.length}`);
    
    const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
    console.log(`Paid invoices still active: ${paidInvoices.length}`);
    
    if (paidInvoices.length > 0) {
      console.log('\nPaid invoices that should be cleaned up:');
      paidInvoices.forEach(inv => {
        console.log(`  - ${inv.invoiceID} (Xero Status: ${inv.xeroStatus})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkSpecificInvoices(); 