const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function checkAllInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== CHECKING ALL INVOICES (INCLUDING SOFT DELETED) ===');
    
    // Get all invoices including soft deleted ones
    const allInvoices = await Invoice.findIncludingDeleted();
    console.log('Total invoices (including soft deleted):', allInvoices.length);
    
    // Get only active invoices
    const activeInvoices = await Invoice.find();
    console.log('Active invoices (not soft deleted):', activeInvoices.length);
    
    // Get only soft deleted invoices
    const softDeletedInvoices = await Invoice.find({ isDeleted: true });
    console.log('Soft deleted invoices:', softDeletedInvoices.length);
    
    // Check if there are invoices without isDeleted field
    const invoicesWithoutDeletedField = await Invoice.find({ isDeleted: { $exists: false } });
    console.log('Invoices without isDeleted field:', invoicesWithoutDeletedField.length);
    
    // Check invoices with isDeleted: false
    const explicitlyActiveInvoices = await Invoice.find({ isDeleted: false });
    console.log('Invoices with isDeleted: false:', explicitlyActiveInvoices.length);
    
    // Check invoices with isDeleted: true
    const explicitlyDeletedInvoices = await Invoice.find({ isDeleted: true });
    console.log('Invoices with isDeleted: true:', explicitlyDeletedInvoices.length);
    
    // Check invoices with isDeleted: null
    const nullDeletedInvoices = await Invoice.find({ isDeleted: null });
    console.log('Invoices with isDeleted: null:', nullDeletedInvoices.length);
    
    // Check invoices with isDeleted: undefined
    const undefinedDeletedInvoices = await Invoice.find({ isDeleted: undefined });
    console.log('Invoices with isDeleted: undefined:', undefinedDeletedInvoices.length);
    
    console.log('\n=== BREAKDOWN BY STATUS ===');
    const statusCounts = {};
    allInvoices.forEach(invoice => {
      const status = invoice.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\n=== SAMPLE INVOICES ===');
    const sampleInvoices = allInvoices.slice(0, 5);
    sampleInvoices.forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}:`, {
        id: invoice._id,
        invoiceID: invoice.invoiceID,
        status: invoice.status,
        isDeleted: invoice.isDeleted,
        xeroInvoiceId: invoice.xeroInvoiceId,
        xeroClientName: invoice.xeroClientName
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkAllInvoices(); 