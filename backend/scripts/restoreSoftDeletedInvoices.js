const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function restoreSoftDeletedInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== RESTORING SOFT DELETED INVOICES ===');
    
    // Get all soft deleted invoices
    const softDeletedInvoices = await Invoice.find({ isDeleted: true });
    
    console.log(`Found ${softDeletedInvoices.length} soft deleted invoices`);
    
    if (softDeletedInvoices.length === 0) {
      console.log('No soft deleted invoices to restore');
      return;
    }
    
    // Restore all soft deleted invoices
    let restoredCount = 0;
    
    for (const invoice of softDeletedInvoices) {
      try {
        invoice.isDeleted = false;
        invoice.deleteReason = undefined;
        invoice.deletedAt = undefined;
        await invoice.save();
        
        restoredCount++;
        console.log(`✅ Restored: ${invoice.invoiceID}`);
      } catch (error) {
        console.error(`❌ Error restoring ${invoice.invoiceID}:`, error.message);
      }
    }
    
    console.log(`\n=== RESTORATION COMPLETED ===`);
    console.log(`Successfully restored: ${restoredCount} invoices`);
    
    // Verify the restoration
    const activeInvoices = await Invoice.find({ isDeleted: { $ne: true } });
    const stillDeleted = await Invoice.find({ isDeleted: true });
    
    console.log(`\nActive invoices after restoration: ${activeInvoices.length}`);
    console.log(`Still soft deleted: ${stillDeleted.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

restoreSoftDeletedInvoices(); 