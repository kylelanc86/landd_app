const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkInvoices() {
  try {
    console.log('=== CHECKING INVOICE DATA ===\n');
    
    // Get all invoices
    const allInvoices = await Invoice.find();
    console.log(`Total invoices: ${allInvoices.length}`);
    
    // Check invoices with xeroContactId
    const invoicesWithContactId = await Invoice.find({ xeroContactId: { $exists: true, $ne: null } });
    console.log(`Invoices with xeroContactId: ${invoicesWithContactId.length}`);
    
    // Check invoices with null client
    const invoicesWithNullClient = await Invoice.find({ client: null });
    console.log(`Invoices with client: null: ${invoicesWithNullClient.length}`);
    
    // Check invoices without client field
    const invoicesWithoutClientField = await Invoice.find({ client: { $exists: false } });
    console.log(`Invoices without client field: ${invoicesWithoutClientField.length}`);
    
    // Show sample data
    if (invoicesWithContactId.length > 0) {
      console.log('\nSample invoice with xeroContactId:');
      const sample = invoicesWithContactId[0];
      console.log({
        _id: sample._id,
        invoiceID: sample.invoiceID,
        xeroContactId: sample.xeroContactId,
        client: sample.client,
        clientExists: sample.client !== undefined,
        clientIsNull: sample.client === null
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkInvoices(); 