const mongoose = require('mongoose');
require('dotenv').config();

async function checkDirectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== CHECKING DATABASE DIRECTLY ===');
    
    // Get the database and collection
    const db = mongoose.connection.db;
    const collection = db.collection('invoices');
    
    // Count all documents
    const totalCount = await collection.countDocuments({});
    console.log('Total documents in invoices collection:', totalCount);
    
    // Count documents with isDeleted: false
    const activeCount = await collection.countDocuments({ isDeleted: false });
    console.log('Documents with isDeleted: false:', activeCount);
    
    // Count documents with isDeleted: true
    const deletedCount = await collection.countDocuments({ isDeleted: true });
    console.log('Documents with isDeleted: true:', deletedCount);
    
    // Count documents without isDeleted field
    const noDeletedFieldCount = await collection.countDocuments({ isDeleted: { $exists: false } });
    console.log('Documents without isDeleted field:', noDeletedFieldCount);
    
    // Get sample documents
    const sampleDocs = await collection.find({}).limit(5).toArray();
    console.log('\n=== SAMPLE DOCUMENTS ===');
    sampleDocs.forEach((doc, index) => {
      console.log(`Document ${index + 1}:`, {
        _id: doc._id,
        invoiceID: doc.invoiceID,
        isDeleted: doc.isDeleted,
        xeroInvoiceId: doc.xeroInvoiceId,
        xeroClientName: doc.xeroClientName
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkDirectDB(); 