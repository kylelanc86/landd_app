const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const xero = require('./config/xero');
require('dotenv').config();

async function updateClientNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to cloud database');
    
    // Get invoices that have xeroContactId but no xeroClientName
    const invoicesToUpdate = await Invoice.find({
      xeroContactId: { $exists: true, $ne: null },
      $or: [
        { xeroClientName: { $exists: false } },
        { xeroClientName: null }
      ]
    });
    
    console.log(`Found ${invoicesToUpdate.length} invoices to update with client names`);
    
    if (invoicesToUpdate.length === 0) {
      console.log('No invoices need updating');
      return;
    }
    
    // Check Xero connection
    const tokenSet = await xero.readTokenSet();
    if (!tokenSet || !tokenSet.access_token) {
      console.error('No Xero connection found. Please connect to Xero first.');
      return;
    }
    
    console.log('Xero connection verified');
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const invoice of invoicesToUpdate) {
      try {
        console.log(`Processing invoice ${invoice.invoiceID} with contact ID: ${invoice.xeroContactId}`);
        
        // Get contact details from Xero
        const contact = await xero.accountingApi.getContact(
          await xero.getTenantId(),
          invoice.xeroContactId
        );
        
        if (contact?.body?.Contacts?.[0]) {
          const xeroContact = contact.body.Contacts[0];
          const clientName = xeroContact.Name;
          
          console.log(`Found client name: ${clientName}`);
          
          // Update the invoice with the client name
          await Invoice.findByIdAndUpdate(invoice._id, {
            xeroClientName: clientName
          });
          
          console.log(`Updated invoice ${invoice.invoiceID} with client name: ${clientName}`);
          updatedCount++;
        } else {
          console.log(`No contact found for ID: ${invoice.xeroContactId}`);
          errorCount++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error updating invoice ${invoice.invoiceID}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`Total invoices processed: ${invoicesToUpdate.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

updateClientNames(); 