const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function debugClientData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== DEBUGGING CLIENT DATA ===');
    
    // Get all invoices including deleted ones
    const invoices = await Invoice.findIncludingDeleted();
    
    console.log(`Total invoices in database: ${invoices.length}`);
    
    // Check invoices with missing client data
    const invoicesWithoutClientName = invoices.filter(inv => !inv.xeroClientName);
    const invoicesWithClientName = invoices.filter(inv => inv.xeroClientName);
    
    console.log(`\nInvoices WITH xeroClientName: ${invoicesWithClientName.length}`);
    console.log(`Invoices WITHOUT xeroClientName: ${invoicesWithoutClientName.length}`);
    
    if (invoicesWithClientName.length > 0) {
      console.log('\nSample invoices WITH client name:');
      invoicesWithClientName.slice(0, 5).forEach(invoice => {
        console.log(`  - ${invoice.invoiceID}: "${invoice.xeroClientName}" (Xero ID: ${invoice.xeroInvoiceId})`);
      });
    }
    
    if (invoicesWithoutClientName.length > 0) {
      console.log('\nSample invoices WITHOUT client name:');
      invoicesWithoutClientName.slice(0, 10).forEach(invoice => {
        console.log(`  - ${invoice.invoiceID}: (Xero ID: ${invoice.xeroInvoiceId}, Status: ${invoice.status})`);
      });
    }
    
    // Check if there's a pattern - maybe only first 50 have client names
    console.log('\n=== CHECKING FIRST 50 vs REST ===');
    const first50 = invoices.slice(0, 50);
    const rest = invoices.slice(50);
    
    const first50WithClient = first50.filter(inv => inv.xeroClientName).length;
    const restWithClient = rest.filter(inv => inv.xeroClientName).length;
    
    console.log(`First 50 invoices with client name: ${first50WithClient}/50`);
    console.log(`Rest of invoices with client name: ${restWithClient}/${rest.length}`);
    
    // Check specific invoices mentioned by user
    console.log('\n=== CHECKING SPECIFIC INVOICES ===');
    const specificInvoices = ['LDJ04107-5', 'LDJ04205'];
    
    for (const invoiceId of specificInvoices) {
      const invoice = await Invoice.findOne({ invoiceID: invoiceId });
      if (invoice) {
        console.log(`\n${invoiceId}:`);
        console.log(`  xeroClientName: "${invoice.xeroClientName}"`);
        console.log(`  xeroContactId: "${invoice.xeroContactId}"`);
        console.log(`  xeroInvoiceId: "${invoice.xeroInvoiceId}"`);
        console.log(`  status: "${invoice.status}"`);
        console.log(`  isDeleted: ${invoice.isDeleted}`);
      } else {
        console.log(`\n${invoiceId}: Not found in database`);
      }
    }
    
    // Check if there are any invoices with xeroContactId but no xeroClientName
    const invoicesWithContactIdButNoName = invoices.filter(inv => 
      inv.xeroContactId && !inv.xeroClientName
    );
    
    console.log(`\nInvoices with xeroContactId but no xeroClientName: ${invoicesWithContactIdButNoName.length}`);
    
    if (invoicesWithContactIdButNoName.length > 0) {
      console.log('\nSample of these invoices:');
      invoicesWithContactIdButNoName.slice(0, 5).forEach(invoice => {
        console.log(`  - ${invoice.invoiceID}: Contact ID: ${invoice.xeroContactId}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

debugClientData(); 