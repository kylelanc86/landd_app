const mongoose = require('mongoose');
require('dotenv').config();

const xero = require('../config/xero');

async function testXeroAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== TESTING XERO API DIRECTLY ===');
    
    // Check if Xero client is properly initialized
    if (!xero.isInitialized()) {
      console.log('Xero client not initialized, attempting to initialize...');
      const tokenSet = await xero.readTokenSet();
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('No valid token set available');
      }
      await xero.setTokenSet(tokenSet);
      
      if (!xero.isInitialized()) {
        throw new Error('Failed to initialize Xero client');
      }
    }
    
    // Get the tenant ID
    const tenantId = await xero.getTenantId();
    if (!tenantId) {
      throw new Error('No tenant ID available');
    }
    console.log('Tenant ID retrieved:', tenantId);
    
    const tokenSet = await xero.readTokenSet();
    
    // Test 1: Get ALL invoices without any status filtering
    console.log('\n1. Testing ALL invoices (no status filter)...');
    const allInvoicesResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      headers: {
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Xero-tenant-id': tenantId,
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
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Xero-tenant-id': tenantId,
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
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    if (submittedResponse.ok) {
      const submittedData = await submittedResponse.json();
      console.log('✅ SUBMITTED invoices found:', submittedData.Invoices?.length || 0);
    } else {
      console.log('❌ Failed to get SUBMITTED invoices:', submittedResponse.status);
    }

    // Test 4: Get invoices with both AUTHORISED and SUBMITTED statuses
    console.log('\n4. Testing AUTHORISED + SUBMITTED invoices...');
    const combinedResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices?statuses=AUTHORISED,SUBMITTED', {
      headers: {
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });

    if (combinedResponse.ok) {
      const combinedData = await combinedResponse.json();
      console.log('✅ AUTHORISED + SUBMITTED invoices found:', combinedData.Invoices?.length || 0);
      
      // Check pagination
      if (combinedData.Invoices && combinedData.Invoices.length > 0) {
        console.log('\nTesting pagination...');
        let allCombinedInvoices = [];
        let page = 1;
        const pageSize = 100;
        let hasMorePages = true;
        
        while (hasMorePages) {
          const pageUrl = `https://api.xero.com/api.xro/2.0/Invoices?statuses=AUTHORISED,SUBMITTED&page=${page}&pageSize=${pageSize}`;
          console.log(`Fetching page ${page}...`);
          
          const pageResponse = await fetch(pageUrl, {
            headers: {
              'Authorization': `Bearer ${tokenSet.access_token}`,
              'Xero-tenant-id': tenantId,
              'Accept': 'application/json'
            }
          });
          
          if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            const pageInvoices = pageData.Invoices || [];
            console.log(`Page ${page} returned ${pageInvoices.length} invoices`);
            
            allCombinedInvoices = allCombinedInvoices.concat(pageInvoices);
            
            if (pageInvoices.length < pageSize) {
              hasMorePages = false;
              console.log(`Page ${page} returned fewer than ${pageSize} results, no more pages`);
            } else {
              page++;
            }
          } else {
            console.log(`❌ Failed to get page ${page}:`, pageResponse.status);
            hasMorePages = false;
          }
        }
        
        console.log(`Total invoices with pagination: ${allCombinedInvoices.length}`);
      }
    } else {
      console.log('❌ Failed to get combined invoices:', combinedResponse.status);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testXeroAPI(); 