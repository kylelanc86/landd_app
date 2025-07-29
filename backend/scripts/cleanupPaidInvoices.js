const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function cleanupPaidInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== CLEANUP PAID INVOICES ===');
    
    // Find all paid invoices that are not already soft deleted
    const paidInvoices = await Invoice.find({
      status: 'paid',
      isDeleted: { $ne: true }
    });
    
    console.log(`Found ${paidInvoices.length} paid invoices to cleanup`);
    
    if (paidInvoices.length === 0) {
      console.log('✅ No paid invoices found to cleanup');
      return;
    }
    
    console.log('\nPaid invoices to be soft deleted:');
    paidInvoices.forEach(invoice => {
      console.log(`  - ${invoice.invoiceID} (Xero ID: ${invoice.xeroInvoiceId}, Xero Status: ${invoice.xeroStatus})`);
    });
    
    // Soft delete each paid invoice
    let successCount = 0;
    let errorCount = 0;
    
    for (const invoice of paidInvoices) {
      try {
        invoice.isDeleted = true;
        invoice.deleteReason = 'Cleanup: Invoice marked as paid in Xero';
        invoice.deletedAt = new Date();
        await invoice.save();
        
        successCount++;
        console.log(`✅ Soft deleted: ${invoice.invoiceID}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error soft deleting ${invoice.invoiceID}:`, error.message);
      }
    }
    
    console.log(`\n=== CLEANUP COMPLETED ===`);
    console.log(`Successfully soft deleted: ${successCount} invoices`);
    if (errorCount > 0) {
      console.log(`Errors: ${errorCount} invoices`);
    }
    
    // Show summary of remaining invoices
    const remainingInvoices = await Invoice.find({ isDeleted: { $ne: true } });
    console.log(`\nRemaining active invoices: ${remainingInvoices.length}`);
    
    const statusCounts = {};
    remainingInvoices.forEach(invoice => {
      const status = invoice.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('Status breakdown of remaining invoices:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
cleanupPaidInvoices(); 