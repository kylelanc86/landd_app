const mongoose = require('mongoose');
require('dotenv').config();

const XeroToken = require('./models/XeroToken');
const fetch = require('node-fetch');

async function debugInvoiceSync() {
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

    console.log('=== DEBUGGING INVOICE SYNC ===');
    console.log('Tenant ID:', token.tenantId);
    
    // Test 1: Get ALL invoices without any status filtering
    console.log('\n1. Testing ALL invoices (no status filter)...');
    const allInvoicesResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (allInvoicesResponse.ok) {
      const allInvoicesData = await allInvoicesResponse.json();
      console.log('✅ All invoices found:', allInvoicesData.Invoices?.length || 0);
      
      // Group by status
      const statusCounts = {};
      if (allInvoicesData.Invoices) {
        allInvoicesData.Invoices.forEach(invoice => {
          const status = invoice.Status || 'UNKNOWN';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
      }
      
      console.log('Status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    } else {
      console.log('❌ Failed to get all invoices:', allInvoicesResponse.status);
    }

    // Test 2: Get invoices with AUTHORISED status only
    console.log('\n2. Testing AUTHORISED invoices only...');
    const authorisedResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices?statuses=AUTHORISED', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (authorisedResponse.ok) {
      const authorisedData = await authorisedResponse.json();
      console.log('✅ AUTHORISED invoices found:', authorisedData.Invoices?.length || 0);
    } else {
      console.log('❌ Failed to get AUTHORISED invoices:', authorisedResponse.status);
    }

    // Test 3: Get invoices with SUBMITTED status only
    console.log('\n3. Testing SUBMITTED invoices only...');
    const submittedResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices?statuses=SUBMITTED', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (submittedResponse.ok) {
      const submittedData = await submittedResponse.json();
      console.log('✅ SUBMITTED invoices found:', submittedData.Invoices?.length || 0);
    } else {
      console.log('❌ Failed to get SUBMITTED invoices:', submittedResponse.status);
    }

    // Test 4: Get invoices with both AUTHORISED and SUBMITTED
    console.log('\n4. Testing AUTHORISED + SUBMITTED invoices...');
    const combinedResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices?statuses=AUTHORISED,SUBMITTED', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (combinedResponse.ok) {
      const combinedData = await combinedResponse.json();
      console.log('✅ AUTHORISED + SUBMITTED invoices found:', combinedData.Invoices?.length || 0);
      
      // Check document types
      const typeCounts = {};
      if (combinedData.Invoices) {
        combinedData.Invoices.forEach(invoice => {
          const type = invoice.Type || 'UNKNOWN';
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
      }
      
      console.log('Document type breakdown:');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
      
      // Show sample invoices
      if (combinedData.Invoices && combinedData.Invoices.length > 0) {
        console.log('\nSample invoices:');
        combinedData.Invoices.slice(0, 5).forEach((invoice, index) => {
          console.log(`  ${index + 1}. ${invoice.InvoiceNumber} - ${invoice.Contact?.Name} - ${invoice.Status} - ${invoice.Type} - $${invoice.Total}`);
        });
      }
    } else {
      console.log('❌ Failed to get combined invoices:', combinedResponse.status);
    }

    // Test 5: Check for pagination
    console.log('\n5. Testing with pagination (first 100)...');
    const paginatedResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices?statuses=AUTHORISED,SUBMITTED&page=1&pageSize=100', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Xero-tenant-id': token.tenantId,
        'Accept': 'application/json'
      }
    });

    if (paginatedResponse.ok) {
      const paginatedData = await paginatedResponse.json();
      console.log('✅ Paginated results (page 1, size 100):', paginatedData.Invoices?.length || 0);
      
      // Check if there are more pages
      const totalCount = paginatedData.Invoices?.length || 0;
      if (totalCount === 100) {
        console.log('⚠️  Likely more pages available (got exactly 100 results)');
      }
    } else {
      console.log('❌ Failed to get paginated invoices:', paginatedResponse.status);
    }

    console.log('\n=== END DEBUG ===');
    
  } catch (error) {
    console.error('Error debugging invoice sync:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugInvoiceSync(); 