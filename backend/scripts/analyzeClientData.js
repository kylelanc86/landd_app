const mongoose = require('mongoose');
require('dotenv').config();

async function analyzeClientData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== ANALYZING CLIENT DATA RELATIONSHIP ===');
    
    // Get the database and collection
    const db = mongoose.connection.db;
    const collection = db.collection('invoices');
    
    // Get all invoices
    const allInvoices = await collection.find({}).toArray();
    console.log('Total invoices:', allInvoices.length);
    
    // Analyze the relationship
    let invoicesWithXeroClientName = 0;
    let invoicesWithoutXeroClientName = 0;
    let invoicesWithXeroInvoiceId = 0;
    let invoicesWithoutXeroInvoiceId = 0;
    
    allInvoices.forEach((invoice, index) => {
      const hasXeroClientName = !!invoice.xeroClientName;
      const hasXeroInvoiceId = !!invoice.xeroInvoiceId;
      
      if (hasXeroClientName) invoicesWithXeroClientName++;
      else invoicesWithoutXeroClientName++;
      
      if (hasXeroInvoiceId) invoicesWithXeroInvoiceId++;
      else invoicesWithoutXeroInvoiceId++;
      
      // Log first 10 invoices for analysis
      if (index < 10) {
        console.log(`Invoice ${index + 1}:`, {
          invoiceID: invoice.invoiceID,
          xeroInvoiceId: invoice.xeroInvoiceId,
          xeroClientName: invoice.xeroClientName,
          hasXeroInvoiceId,
          hasXeroClientName
        });
      }
    });
    
    console.log('\n=== BREAKDOWN ===');
    console.log(`Invoices with xeroClientName: ${invoicesWithXeroClientName}`);
    console.log(`Invoices without xeroClientName: ${invoicesWithoutXeroClientName}`);
    console.log(`Invoices with xeroInvoiceId: ${invoicesWithXeroInvoiceId}`);
    console.log(`Invoices without xeroInvoiceId: ${invoicesWithoutXeroInvoiceId}`);
    
    // Check if invoices without xeroClientName are the ones that were soft deleted
    const invoicesWithoutClientName = allInvoices.filter(inv => !inv.xeroClientName);
    const invoicesWithClientName = allInvoices.filter(inv => inv.xeroClientName);
    
    console.log('\n=== CLIENT NAME ANALYSIS ===');
    console.log(`Invoices WITH client name: ${invoicesWithClientName.length}`);
    console.log(`Invoices WITHOUT client name: ${invoicesWithoutClientName.length}`);
    
    // Check if the invoices without client names are the ones that were originally soft deleted
    console.log('\n=== SAMPLE INVOICES WITHOUT CLIENT NAMES ===');
    invoicesWithoutClientName.slice(0, 5).forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}:`, {
        invoiceID: invoice.invoiceID,
        xeroInvoiceId: invoice.xeroInvoiceId,
        xeroClientName: invoice.xeroClientName,
        status: invoice.status
      });
    });
    
    console.log('\n=== SAMPLE INVOICES WITH CLIENT NAMES ===');
    invoicesWithClientName.slice(0, 5).forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}:`, {
        invoiceID: invoice.invoiceID,
        xeroInvoiceId: invoice.xeroInvoiceId,
        xeroClientName: invoice.xeroClientName,
        status: invoice.status
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

analyzeClientData(); 