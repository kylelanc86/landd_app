const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Client = require('./models/Client');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixClientData() {
  try {
    console.log('=== FIXING CLIENT DATA ===\n');
    
    // Get all invoices with xeroContactId but no client
    const invoices = await Invoice.find({ 
      xeroContactId: { $exists: true, $ne: null },
      $or: [
        { client: null },
        { client: { $exists: false } }
      ]
    });
    
    console.log(`Found ${invoices.length} invoices with xeroContactId but no client`);
    
    if (invoices.length === 0) {
      console.log('No invoices need client data fixing');
      return;
    }
    
    // Get unique contact IDs
    const uniqueContactIds = [...new Set(invoices.map(inv => inv.xeroContactId))];
    console.log(`Found ${uniqueContactIds.length} unique contact IDs`);
    
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
        const contact = await xero.accountingApi.getContact(tenantId, contactId);
        
        if (!contact?.body?.Contacts?.[0]) {
          console.log(`❌ No contact found for ID: ${contactId}`);
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
    console.error('Error in fixClientData:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixClientData(); 