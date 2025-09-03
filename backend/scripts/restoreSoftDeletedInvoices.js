const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function restoreSoftDeletedInvoices() {
  try {
    console.log('Starting restoration of soft-deleted invoices...');
    
    // Find all soft-deleted invoices that have xeroInvoiceId (meaning they were synced from Xero)
    const softDeletedInvoices = await Invoice.find({
      isDeleted: true,
      xeroInvoiceId: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log(`Found ${softDeletedInvoices.length} soft-deleted invoices with xeroInvoiceId`);
    
    if (softDeletedInvoices.length === 0) {
      console.log('No soft-deleted invoices to restore.');
      return;
    }
    
    // Show some examples
    console.log('\nSample soft-deleted invoices:');
    softDeletedInvoices.slice(0, 10).forEach(invoice => {
      console.log(`- ${invoice.invoiceID}: ${invoice.status} (Xero ID: ${invoice.xeroInvoiceId})`);
    });
    
    // Restore all soft-deleted invoices
    const result = await Invoice.updateMany(
      {
        isDeleted: true,
        xeroInvoiceId: { $exists: true, $ne: null, $ne: '' }
      },
      {
        $unset: {
          isDeleted: 1,
          deleteReason: 1,
          deletedAt: 1
        }
      }
    );
    
    console.log(`\nRestoration completed:`);
    console.log(`- ${result.modifiedCount} invoices restored`);
    console.log(`- ${result.matchedCount} invoices matched the criteria`);
    
    // Verify the restoration
    const remainingSoftDeleted = await Invoice.countDocuments({
      isDeleted: true,
      xeroInvoiceId: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log(`\nRemaining soft-deleted invoices with xeroInvoiceId: ${remainingSoftDeleted}`);
    
    // Check total count now
    const totalCount = await Invoice.countDocuments({ isDeleted: { $ne: true } });
    console.log(`Total invoices in database (excluding deleted): ${totalCount}`);
    
  } catch (error) {
    console.error('Error restoring soft-deleted invoices:', error);
  } finally {
    mongoose.connection.close();
  }
}

restoreSoftDeletedInvoices();
