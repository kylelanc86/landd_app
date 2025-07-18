const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const XeroService = require('../services/xeroService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateInvoiceClients() {
  try {
    console.log('Starting invoice client update process...');
    
    // Get all invoices without client data
    const invoicesWithoutClient = await Invoice.find({ 
      client: { $exists: false } 
    }).populate('client');
    
    console.log(`Found ${invoicesWithoutClient.length} invoices without client data`);
    
    if (invoicesWithoutClient.length === 0) {
      console.log('No invoices need updating');
      return;
    }
    
    // Check Xero connection
    try {
      const xeroStatus = await XeroService.checkStatus();
      if (!xeroStatus.connected) {
        console.log('Xero not connected, skipping client updates');
        return;
      }
    } catch (error) {
      console.log('Xero connection check failed:', error.message);
      return;
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const invoice of invoicesWithoutClient) {
      try {
        if (!invoice.xeroContactId) {
          console.log(`Invoice ${invoice.invoiceID} has no Xero contact ID, skipping`);
          continue;
        }
        
        console.log(`Processing invoice ${invoice.invoiceID} with Xero contact ID: ${invoice.xeroContactId}`);
        
        // Get contact details from Xero
        const xero = require('../config/xero');
        const contact = await xero.accountingApi.getContact(
          await xero.getTenantId(),
          invoice.xeroContactId
        );
        
        if (!contact?.body?.Contacts?.[0]) {
          console.log(`No contact found for Xero ID: ${invoice.xeroContactId}`);
          continue;
        }
        
        const xeroContact = contact.body.Contacts[0];
        console.log(`Found Xero contact: ${xeroContact.Name}`);
        
        // Find or create client
        let client = await Client.findOne({ 
          $or: [
            { name: xeroContact.Name },
            { contact1Email: xeroContact.EmailAddress }
          ]
        });
        
        if (!client) {
          console.log(`Creating new client for: ${xeroContact.Name}`);
          const clientData = {
            name: xeroContact.Name,
            invoiceEmail: xeroContact.EmailAddress || 'no-email@example.com',
            address: 'Address not provided',
            contact1Name: xeroContact.Name,
            contact1Number: xeroContact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber || 'No phone provided',
            contact1Email: xeroContact.EmailAddress || 'no-email@example.com'
          };
          
          client = await Client.create(clientData);
          console.log(`Created client with ID: ${client._id}`);
        } else {
          console.log(`Found existing client: ${client.name} (${client._id})`);
        }
        
        // Update invoice with client reference
        invoice.client = client._id;
        await invoice.save();
        
        console.log(`Updated invoice ${invoice.invoiceID} with client ${client.name}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`Error updating invoice ${invoice.invoiceID}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`Update complete. Updated: ${updatedCount}, Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error in updateInvoiceClients:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the update
updateInvoiceClients(); 