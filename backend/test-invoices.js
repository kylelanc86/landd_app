const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testInvoices() {
  try {
    console.log('Testing invoice data...');
    
    // Get all invoices with client data populated
    const invoices = await Invoice.find()
      .populate('client', 'name')
      .limit(5);
    
    console.log(`Found ${invoices.length} invoices`);
    
    invoices.forEach((invoice, index) => {
      console.log(`\nInvoice ${index + 1}:`);
      console.log(`  ID: ${invoice._id}`);
      console.log(`  Invoice ID: ${invoice.invoiceID}`);
      console.log(`  Client: ${invoice.client ? invoice.client.name : 'NO CLIENT'}`);
      console.log(`  Client ID: ${invoice.client ? invoice.client._id : 'NO CLIENT ID'}`);
      console.log(`  Status: ${invoice.status}`);
      console.log(`  Amount: ${invoice.amount}`);
      console.log(`  Xero Contact ID: ${invoice.xeroContactId || 'NO XERO CONTACT'}`);
    });
    
  } catch (error) {
    console.error('Error testing invoices:', error);
  } finally {
    mongoose.connection.close();
  }
}

testInvoices(); 