const mongoose = require('mongoose');
require('dotenv').config();

async function fixIsDeletedDirect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== FIXING ISDELETED FIELD DIRECTLY ===');
    
    // Get the database and collection
    const db = mongoose.connection.db;
    const collection = db.collection('invoices');
    
    // Count before fix
    const totalBefore = await collection.countDocuments({});
    const deletedBefore = await collection.countDocuments({ isDeleted: true });
    const activeBefore = await collection.countDocuments({ isDeleted: false });
    
    console.log('Before fix:');
    console.log(`  Total invoices: ${totalBefore}`);
    console.log(`  Soft deleted: ${deletedBefore}`);
    console.log(`  Active: ${activeBefore}`);
    
    // Update all invoices to set isDeleted to false
    const updateResult = await collection.updateMany(
      {}, // Update all documents
      { 
        $set: { 
          isDeleted: false,
          deleteReason: undefined,
          deletedAt: undefined
        }
      }
    );
    
    console.log(`\nUpdate result:`, updateResult);
    
    // Count after fix
    const totalAfter = await collection.countDocuments({});
    const deletedAfter = await collection.countDocuments({ isDeleted: true });
    const activeAfter = await collection.countDocuments({ isDeleted: false });
    
    console.log('\nAfter fix:');
    console.log(`  Total invoices: ${totalAfter}`);
    console.log(`  Soft deleted: ${deletedAfter}`);
    console.log(`  Active: ${activeAfter}`);
    
    // Show sample documents
    const sampleDocs = await collection.find({}).limit(5).toArray();
    console.log('\n=== SAMPLE DOCUMENTS AFTER FIX ===');
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

fixIsDeletedDirect(); 