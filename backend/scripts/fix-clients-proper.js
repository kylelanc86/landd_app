require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Client = require('./models/Client');

async function fixClientsProper() {
  try {
    console.log('=== FIXING CLIENTS WITH PROPER DB CONNECTION ===\n');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    
    // Connect using the same config as the backend
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Get all invoices
    const allInvoices = await Invoice.find();
    console.log(`Total invoices: ${allInvoices.length}`);
    
    // Get invoices with xeroContactId but no client
    const invoicesToFix = await Invoice.find({ 
      xeroContactId: { $exists: true, $ne: null },
      client: null 
    });
    
    console.log(`Invoices needing client fix: ${invoicesToFix.length}`);
    
    if (invoicesToFix.length === 0) {
      console.log('No invoices need fixing');
      return;
    }
    
    // Get unique contact IDs
    const uniqueContactIds = [...new Set(invoicesToFix.map(inv => inv.xeroContactId))];
    console.log(`Unique contact IDs: ${uniqueContactIds.length}`);
    
    // Check Xero connection
    const xero = require('./config/xero');
    const tokenSet = await xero.readTokenSet();
    if (!tokenSet || !tokenSet.access_token) {
      console.log('❌ No Xero token available');
      return;
    }
    
    const tenantId = await xero.getTenantId();
    if (!tenantId) {
      console.log('❌ No tenant ID available');
      return;
    }
    
    console.log('✅ Xero connection verified');
    
    let createdClients = 0;
    let updatedInvoices = 0;
    let errors = 0;
    
    // Process each unique contact ID
    for (const contactId of uniqueContactIds) {
      try {
        console.log(`\nProcessing contact ID: ${contactId}`);
        
        // Get contact details from Xero
        try {
          console.log(`Calling Xero API for contact: ${contactId}`);
          const contact = await xero.accountingApi.getContact(tenantId, contactId);
          console.log(`Xero API response:`, contact);
          
          if (!contact?.body?.Contacts?.[0]) {
            console.log(`❌ No contact found for ID: ${contactId}`);
            errors++;
            continue;
          }
        } catch (apiError) {
          console.error(`❌ Xero API error for contact ${contactId}:`, apiError);
          console.error(`Error details:`, {
            message: apiError.message,
            status: apiError.status,
            response: apiError.response
          });
          errors++;
          continue;
        }
        
        const xeroContact = contact.body.Contacts[0];
        console.log(`✅ Found contact: ${xeroContact.Name}`);
        
        // Check if client already exists
        let client = await Client.findOne({ 
          $or: [
            { name: xeroContact.Name },
            { contact1Email: xeroContact.EmailAddress }
          ]
        });
        
        if (!client) {
          // Create new client
          const clientData = {
            name: xeroContact.Name,
            invoiceEmail: xeroContact.EmailAddress || 'no-email@example.com',
            address: 'Address not provided',
            contact1Name: xeroContact.Name,
            contact1Number: xeroContact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber || 'No phone provided',
            contact1Email: xeroContact.EmailAddress || 'no-email@example.com'
          };
          
          console.log(`Creating client: ${clientData.name}`);
          client = await Client.create(clientData);
          createdClients++;
          console.log(`✅ Created client with ID: ${client._id}`);
        } else {
          console.log(`✅ Found existing client: ${client.name}`);
        }
        
        // Update all invoices with this contact ID
        const updateResult = await Invoice.updateMany(
          { xeroContactId: contactId, client: null },
          { client: client._id }
        );
        
        console.log(`✅ Updated ${updateResult.modifiedCount} invoices with client ${client.name}`);
        updatedInvoices += updateResult.modifiedCount;
        
      } catch (error) {
        console.error(`❌ Error processing contact ${contactId}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Created clients: ${createdClients}`);
    console.log(`Updated invoices: ${updatedInvoices}`);
    console.log(`Errors: ${errors}`);
    
    // Verify the fix
    const remainingInvoices = await Invoice.find({ client: null });
    console.log(`\nRemaining invoices without client: ${remainingInvoices.length}`);
    
  } catch (error) {
    console.error('Error in fixClientsProper:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixClientsProper(); 