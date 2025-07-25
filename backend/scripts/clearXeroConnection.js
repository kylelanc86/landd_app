const mongoose = require('mongoose');
require('dotenv').config();

const XeroToken = require('./models/XeroToken');

async function clearXeroConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== CLEARING XERO CONNECTION ===');
    
    // Delete all Xero tokens from the database
    const deleteResult = await XeroToken.deleteMany({});
    console.log('Deleted Xero tokens:', deleteResult.deletedCount);
    
    // Also clear any invoices that might have Xero data
    const Invoice = require('./models/Invoice');
    const updateResult = await Invoice.updateMany(
      { xeroInvoiceId: { $exists: true } },
      { 
        $unset: { 
          xeroInvoiceId: 1, 
          xeroContactId: 1, 
          xeroClientName: 1, 
          xeroReference: 1, 
          xeroStatus: 1, 
          lastSynced: 1 
        } 
      }
    );
    console.log('Cleared Xero data from invoices:', updateResult.modifiedCount);
    
    console.log('\n✅ Xero connection completely cleared!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Go to the invoices page in your app');
    console.log('3. Click "Connect to Xero"');
    console.log('4. Make sure to select your REAL company, not the demo company');
    console.log('5. After connecting, try syncing invoices again');
    
    console.log('\n=== END ===');
    
  } catch (error) {
    console.error('Error clearing Xero connection:', error);
  } finally {
    await mongoose.disconnect();
  }
}

clearXeroConnection(); 