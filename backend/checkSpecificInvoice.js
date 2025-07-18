const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('./models/Invoice');

async function checkSpecificInvoice() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const invoice = await Invoice.findOne({ invoiceID: 'LDJ04694-1' });
    
    if (!invoice) {
      console.log('Invoice LDJ04694-1 not found');
      return;
    }

    console.log('=== INVOICE LDJ04694-1 DETAILS ===');
    console.log('ID:', invoice._id);
    console.log('Invoice ID:', invoice.invoiceID);
    console.log('Project ID:', invoice.projectID);
    console.log('Project ObjectId:', invoice.project);
    console.log('Status:', invoice.status);
    console.log('Xero Status:', invoice.xeroStatus);
    console.log('Client (ObjectId):', invoice.client);
    console.log('Xero Client Name:', invoice.xeroClientName);
    console.log('Amount:', invoice.amount);
    console.log('Date:', invoice.date);
    console.log('Due Date:', invoice.dueDate);
    console.log('Description:', invoice.description);
    console.log('Is Deleted:', invoice.isDeleted);
    console.log('Created At:', invoice.createdAt);
    console.log('Updated At:', invoice.updatedAt);
    
    // Check if it's a draft invoice
    if (invoice.status === 'draft') {
      console.log('\nThis is a DRAFT invoice created in the app');
      console.log('Client name should come from the selected project');
    } else if (invoice.xeroInvoiceId) {
      console.log('\nThis is a XERO invoice');
      console.log('Client name should come from Xero contact data');
    }
    
    console.log('\n=== END ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkSpecificInvoice(); 