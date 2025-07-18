const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

async function checkInvoiceStatuses() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Get all invoices including deleted ones
    const invoices = await Invoice.findIncludingDeleted();
    
    console.log(`\n=== INVOICE STATUS REPORT ===`);
    console.log(`Total invoices in database: ${invoices.length}`);
    
    // Group by status
    const statusCounts = {};
    const paidInvoices = [];
    
    invoices.forEach(invoice => {
      const status = invoice.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (status === 'paid') {
        paidInvoices.push({
          id: invoice._id,
          invoiceID: invoice.invoiceID,
          xeroInvoiceId: invoice.xeroInvoiceId,
          xeroStatus: invoice.xeroStatus,
          date: invoice.date,
          isDeleted: invoice.isDeleted
        });
      }
    });
    
    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    if (paidInvoices.length > 0) {
      console.log(`\n⚠️  FOUND ${paidInvoices.length} PAID INVOICES:`);
      paidInvoices.forEach(invoice => {
        console.log(`  - ${invoice.invoiceID} (Xero ID: ${invoice.xeroInvoiceId}, Xero Status: ${invoice.xeroStatus}, Deleted: ${invoice.isDeleted})`);
      });
      
      console.log('\nThese paid invoices should not be in the database since we only sync unpaid invoices.');
      console.log('You may want to delete them or mark them as deleted.');
    } else {
      console.log('\n✅ No paid invoices found in database - this is correct!');
    }
    
    // Check for invoices with missing client data
    const invoicesWithoutClient = invoices.filter(inv => !inv.xeroClientName && !inv.isDeleted);
    if (invoicesWithoutClient.length > 0) {
      console.log(`\n⚠️  FOUND ${invoicesWithoutClient.length} INVOICES WITHOUT CLIENT DATA:`);
      invoicesWithoutClient.forEach(invoice => {
        console.log(`  - ${invoice.invoiceID} (Status: ${invoice.status}, Xero Status: ${invoice.xeroStatus})`);
      });
    } else {
      console.log('\n✅ All invoices have client data - this is good!');
    }
    
    console.log('\n=== END REPORT ===');
    
  } catch (error) {
    console.error('Error checking invoice statuses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
checkInvoiceStatuses(); 