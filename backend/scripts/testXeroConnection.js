const mongoose = require('mongoose');
require('dotenv').config();

const XeroToken = require('./models/XeroToken');
const fetch = require('node-fetch');

async function testXeroConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const token = await XeroToken.getToken();
    
    if (!token) {
      console.log('No Xero token found');
      return;
    }

    console.log('=== TESTING XERO API CONNECTION ===');
    console.log('Tenant ID:', token.tenantId);
    
    // Test 1: Get organization details
    console.log('\n1. Testing organization details...');
    const orgResponse = await fetch('https://api.xero.com/api.xro/2.0/Organisation', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      console.log('✅ Organization details:');
      console.log('  Name:', orgData.Organisations?.[0]?.Name);
      console.log('  Country:', orgData.Organisations?.[0]?.CountryCode);
      console.log('  Is Demo Company:', orgData.Organisations?.[0]?.IsDemoCompany);
    } else {
      console.log('❌ Failed to get organization details:', orgResponse.status);
    }

    // Test 2: Get invoices
    console.log('\n2. Testing invoice retrieval...');
    const invoiceResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices?statuses=AUTHORISED,SUBMITTED', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (invoiceResponse.ok) {
      const invoiceData = await invoiceResponse.json();
      console.log('✅ Invoice data:');
      console.log('  Total invoices found:', invoiceData.Invoices?.length || 0);
      
      if (invoiceData.Invoices && invoiceData.Invoices.length > 0) {
        console.log('  Sample invoices:');
        invoiceData.Invoices.slice(0, 3).forEach((invoice, index) => {
          console.log(`    ${index + 1}. ${invoice.InvoiceNumber} - ${invoice.Contact?.Name} - $${invoice.Total}`);
        });
      }
    } else {
      console.log('❌ Failed to get invoices:', invoiceResponse.status);
      const errorText = await invoiceResponse.text();
      console.log('Error details:', errorText);
    }

    // Test 3: Get contacts
    console.log('\n3. Testing contact retrieval...');
    const contactResponse = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      console.log('✅ Contact data:');
      console.log('  Total contacts found:', contactData.Contacts?.length || 0);
      
      if (contactData.Contacts && contactData.Contacts.length > 0) {
        console.log('  Sample contacts:');
        contactData.Contacts.slice(0, 3).forEach((contact, index) => {
          console.log(`    ${index + 1}. ${contact.Name} (${contact.ContactID})`);
        });
      }
    } else {
      console.log('❌ Failed to get contacts:', contactResponse.status);
    }

    console.log('\n=== END TEST ===');
    
  } catch (error) {
    console.error('Error testing Xero connection:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testXeroConnection(); 