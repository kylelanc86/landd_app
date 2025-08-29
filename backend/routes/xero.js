const express = require('express');
const router = express.Router();
const XeroService = require('../services/xeroService');
const auth = require('../middleware/auth');
const xero = require('../config/xero');
const path = require('path');
const fs = require('fs');
const Invoice = require('../models/Invoice');

// Middleware to check Xero connection
const checkXeroConnection = async (req, res, next) => {
  try {
    const tokenSet = await xero.readTokenSet();
    if (!tokenSet || !tokenSet.access_token) {
      return res.status(401).json({ 
        error: 'XERO_AUTH_REQUIRED',
        message: 'Please connect to Xero first',
        needsAuth: true,
        connected: false
      });
    }
    next();
  } catch (error) {
    console.error('Error checking Xero connection:', error);
    res.status(401).json({ 
      error: 'XERO_AUTH_REQUIRED',
      message: 'Please connect to Xero first',
      needsAuth: true,
      connected: false
    });
  }
};

// Get Xero connection status
router.get('/status', auth, async (req, res) => {
  try {
    console.log('Checking Xero connection status...');
    
    // Check if tokens directory exists
    const tokensDir = path.join(__dirname, '../tokens');
    console.log('Tokens directory path:', tokensDir);
    console.log('Tokens directory exists:', fs.existsSync(tokensDir));
    
    // List files in tokens directory if it exists
    if (fs.existsSync(tokensDir)) {
      const files = fs.readdirSync(tokensDir);
      console.log('Files in tokens directory:', files);
    }
    
    const tokenSet = await xero.readTokenSet();
    console.log('Status endpoint - Token set read result:', {
      exists: !!tokenSet,
      hasAccessToken: !!(tokenSet && tokenSet.access_token),
      hasRefreshToken: !!(tokenSet && tokenSet.refresh_token),
      expiresAt: tokenSet?.expires_at ? new Date(tokenSet.expires_at).toISOString() : null,
      tokenType: tokenSet?.token_type,
      scope: tokenSet?.scope
    });
    
    // Also check MongoDB directly for debugging
    try {
      const XeroToken = require('../models/XeroToken');
      const directToken = await XeroToken.getToken();
      console.log('Status endpoint - Direct MongoDB token check:', {
        exists: !!directToken,
        hasAccessToken: !!(directToken && directToken.access_token),
        hasRefreshToken: !!(directToken && directToken.refresh_token),
        expiresAt: directToken?.expires_at ? new Date(directToken.expires_at).toISOString() : null,
        tenantId: directToken?.tenantId
      });
    } catch (dbError) {
      console.error('Error checking MongoDB directly:', dbError);
    }
    
    const tenantId = await xero.getTenantId();
    console.log('Tenant ID:', tenantId);
    
    const connected = !!(tokenSet && tokenSet.access_token);
    console.log('Connection status:', connected);
    console.log('Status endpoint response:', {
      connected,
      hasToken: !!tokenSet,
      hasAccessToken: !!(tokenSet && tokenSet.access_token),
      hasTenantId: !!tenantId,
      tokenExpiry: tokenSet?.expires_at ? new Date(tokenSet.expires_at).toISOString() : null
    });
    
    res.json({
      connected,
      tenantId,
      details: {
        hasToken: !!tokenSet,
        hasAccessToken: !!(tokenSet && tokenSet.access_token),
        hasTenantId: !!tenantId,
        tokenExpiry: tokenSet?.expires_at ? new Date(tokenSet.expires_at).toISOString() : null
      }
    });
  } catch (error) {
    console.error('Error getting Xero status:', error);
    res.status(500).json({ 
      error: 'Failed to get Xero status',
      message: error.message,
      connected: false
    });
  }
});

// Get Xero authorization URL
router.get('/auth-url', auth, async (req, res) => {
  try {
    console.log('Generating Xero auth URL...');
    const state = xero.generateState();
    console.log('Generated state:', state);
    
    const authUrl = await xero.buildConsentUrl();
    console.log('Generated auth URL:', authUrl);
    
    if (!authUrl || typeof authUrl !== 'string') {
      throw new Error('Invalid auth URL received from Xero');
    }
    
    res.json({ 
      authUrl, 
      state,
      message: 'Successfully generated Xero authorization URL'
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate auth URL',
      message: error.message,
      details: error.stack
    });
  }
});

// Handle Xero callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Received callback with code and state:', { code: !!code, state });
    
    // Log environment variables for debugging (without exposing secrets)
    console.log('Xero configuration check:', {
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      hasRedirectUri: !!process.env.XERO_REDIRECT_URI,
      redirectUri: process.env.XERO_REDIRECT_URI
    });
    
    if (!code) {
      console.error('No authorization code received from Xero');
      return res.redirect('http://localhost:3000/invoices?xero_error=No authorization code received');
    }
    
    if (!state) {
      console.error('No state parameter received from Xero');
      return res.redirect('http://localhost:3000/invoices?xero_error=No state parameter received');
    }
    
    if (!xero.verifyState(state)) {
      console.error('State verification failed:', { received: state, expected: xero.currentState });
      return res.redirect('http://localhost:3000/invoices?xero_error=Invalid state parameter');
    }

    console.log('State verified, getting token set...');
    
    // Check if Xero client is properly initialized
    console.log('Xero client initialization check:', {
      isInitialized: xero.isInitialized(),
      hasTokenSet: !!xero.tokenSet,
      hasAccessToken: !!(xero.tokenSet && xero.tokenSet.access_token)
    });
    
    // Verify Xero client configuration
    console.log('Xero client state:', {
      isInitialized: xero.isInitialized(),
      hasClientId: !!xero.clientId,
      hasClientSecret: !!xero.clientSecret,
      hasRedirectUris: !!(xero.redirectUris && xero.redirectUris.length > 0)
    });
    
    let tokenSet;
    try {
      tokenSet = await xero.apiCallback(code);
      console.log('Raw token set received:', JSON.stringify(tokenSet, null, 2));
    } catch (apiError) {
      console.error('Error calling xero.apiCallback:', apiError);
      throw new Error(`Xero API callback failed: ${apiError.message}`);
    }

    if (!tokenSet) {
      throw new Error('No token set received from Xero');
    }

    // Ensure we have all required token properties
    if (!tokenSet.access_token) {
      console.error('Token set missing access_token:', tokenSet);
      throw new Error('Invalid token set: missing access_token');
    }

    if (!tokenSet.refresh_token) {
      console.error('Token set missing refresh_token:', tokenSet);
      throw new Error('Invalid token set: missing refresh_token');
    }

    // Add expiration timestamp if not present
    if (!tokenSet.expires_at && tokenSet.expires_in) {
      tokenSet.expires_at = Date.now() + (tokenSet.expires_in * 1000);
    }

    console.log('Setting token set...');
    try {
      await xero.setTokenSet(tokenSet);
      console.log('Token set saved successfully');
    } catch (saveError) {
      console.error('Error saving token set:', saveError);
      throw new Error('Failed to save token set: ' + saveError.message);
    }
    
    // Verify token was saved
    const savedToken = await xero.readTokenSet();
    console.log('Verification - saved token details:', {
      exists: !!savedToken,
      hasAccessToken: !!(savedToken && savedToken.access_token),
      hasRefreshToken: !!(savedToken && savedToken.refresh_token),
      expiresAt: savedToken?.expires_at ? new Date(savedToken.expires_at).toISOString() : null,
      tenantId: savedToken?.tenantId
    });
    
    if (!savedToken || !savedToken.access_token) {
      console.error('Failed to verify saved token:', savedToken);
      throw new Error('Failed to verify saved token');
    }
    console.log('Token set saved and verified successfully');

    // Get and store the first tenant
    console.log('Getting tenants...');
    const tenants = await xero.updateTenants();
    console.log('Received tenants:', tenants?.length || 0);
    
    if (tenants && tenants.length > 0) {
      console.log('Setting tenant ID:', tenants[0].tenantId);
      xero.setTenantId(tenants[0].tenantId);
      
      // Verify tenant ID was saved
      const savedTenantId = await xero.getTenantId();
      if (!savedTenantId) {
        throw new Error('Failed to verify saved tenant ID');
      }
      console.log('Tenant ID saved and verified successfully');
    } else {
      console.warn('No tenants found');
    }

    // Redirect back to the frontend with success status
    console.log('Redirecting to frontend with success status');
    console.log('Final callback result:', {
      hasToken: !!savedToken,
      hasAccessToken: !!(savedToken && savedToken.access_token),
      hasTenantId: !!savedTenantId,
      redirectUrl: 'http://localhost:3000/invoices?xero_connected=true'
    });
    res.redirect('http://localhost:3000/invoices?xero_connected=true');
  } catch (error) {
    console.error('Error in Xero callback:', error);
    const errorMessage = encodeURIComponent(error.message || 'Failed to complete Xero authentication');
    res.redirect(`http://localhost:3000/invoices?xero_error=${errorMessage}`);
  }
});

// Debug endpoint to check token storage directly
router.get('/debug-token', async (req, res) => {
  try {
    console.log('Debug token endpoint called');
    
    // Check MongoDB directly
    const XeroToken = require('../models/XeroToken');
    const directToken = await XeroToken.getToken();
    
    // Check Xero client state
    const clientState = {
      isInitialized: xero.isInitialized(),
      hasTokenSet: !!xero.tokenSet,
      hasAccessToken: !!(xero.tokenSet && xero.tokenSet.access_token),
      currentState: xero.currentState
    };
    
    // Check environment variables
    const envCheck = {
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      hasRedirectUri: !!process.env.XERO_REDIRECT_URI,
      redirectUri: process.env.XERO_REDIRECT_URI
    };
    
    res.json({
      mongodb: {
        exists: !!directToken,
        hasAccessToken: !!(directToken && directToken.access_token),
        hasRefreshToken: !!(directToken && directToken.refresh_token),
        expiresAt: directToken?.expires_at ? new Date(directToken.expires_at).toISOString() : null,
        tenantId: directToken?.tenantId
      },
      client: clientState,
      environment: envCheck
    });
  } catch (error) {
    console.error('Error in debug token endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Xero contacts
router.get('/contacts', auth, checkXeroConnection, async (req, res) => {
  try {
    const contacts = await XeroService.getContacts();
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching Xero contacts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Xero contacts',
      message: error.message
    });
  }
});

// Get Xero invoices
router.get('/invoices', auth, checkXeroConnection, async (req, res) => {
  try {
    const tokenSet = await xero.readTokenSet();
    const tenantId = await xero.getTenantId();
    
    if (!tokenSet || !tokenSet.access_token) {
      return res.status(401).json({ 
        error: 'No valid access token',
        message: 'Please reconnect to Xero'
      });
    }
    
    if (!tenantId) {
      return res.status(400).json({ 
        error: 'No tenant selected',
        message: 'Please select a Xero tenant first'
      });
    }

    // Use direct fetch approach like sync FROM Xero
    const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      headers: {
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API call failed:', errorText);
      throw new Error(`Xero API call failed: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (!responseData || !responseData.Invoices) {
      throw new Error('Invalid response from Xero API');
    }
    
    res.json(responseData.Invoices);
  } catch (error) {
    console.error('Error fetching Xero invoices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Xero invoices',
      message: error.message
    });
  }
});

// Disconnect from Xero
router.post('/disconnect', auth, async (req, res) => {
  try {
    console.log('=== DISCONNECT REQUEST RECEIVED ===');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Disconnecting from Xero...');
    
    // First, try to revoke the token with Xero if we have one
    try {
      const tokenSet = await xero.readTokenSet();
      if (tokenSet && tokenSet.access_token) {
        console.log('Revoking token with Xero...');
        
        // Call Xero's token revocation endpoint
        const revokeResponse = await fetch('https://identity.xero.com/connect/revocation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')}`
          },
          body: new URLSearchParams({
            token: tokenSet.access_token,
            token_type_hint: 'access_token'
          }).toString()
        });
        
        if (revokeResponse.ok) {
          console.log('Successfully revoked token with Xero');
        } else {
          console.log('Token revocation failed (this is normal if token was already expired):', revokeResponse.status);
        }
      }
    } catch (revokeError) {
      console.log('Error revoking token (this is normal if no token exists):', revokeError.message);
    }
    
    // Clear tokens from MongoDB
    const XeroToken = require('../models/XeroToken');
    console.log('Attempting to delete Xero tokens from MongoDB...');
    const deleteResult = await XeroToken.deleteMany({});
    console.log('Deleted Xero tokens from MongoDB:', deleteResult);
    console.log('Deleted count:', deleteResult.deletedCount);
    
    // Reset the Xero client state
    await xero.reset();
    
    console.log('=== DISCONNECT COMPLETED SUCCESSFULLY ===');
    console.log('Successfully disconnected from Xero');
    res.json({ 
      success: true,
      message: 'Successfully disconnected from Xero'
    });
  } catch (error) {
    console.error('Error disconnecting from Xero:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect from Xero',
      message: error.message
    });
  }
});

// Sync invoices from Xero
router.post('/sync-invoices', auth, checkXeroConnection, async (req, res) => {
  try {
    console.log('Starting invoice sync request...');
    const invoices = await XeroService.syncInvoicesFromXero();
    console.log('Sync completed successfully:', {
      count: invoices.length,
      firstInvoice: invoices[0] ? {
        id: invoices[0].InvoiceID,
        number: invoices[0].InvoiceNumber,
        status: invoices[0].Status
      } : null
    });
    
    res.json({
      success: true,
      message: `Successfully synced ${invoices.length} invoices`,
      invoices
    });
  } catch (error) {
    console.error('Error syncing invoices from Xero:', error);
    
    // Handle specific error cases
    if (error.message?.includes('connect first') || error.message?.includes('expired')) {
      return res.status(401).json({
        error: 'XERO_AUTH_REQUIRED',
        message: 'Please connect to Xero first'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to sync invoices from Xero',
      message: error.message,
      details: error.response?.body || error.stack
    });
  }
});

// Sync invoice with Xero
router.post('/invoices/:id/sync', auth, async (req, res) => {
  try {
    const invoice = await XeroService.syncInvoiceStatus(req.params.id);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create invoice in Xero
router.post('/create-invoice', auth, checkXeroConnection, async (req, res) => {
  try {
    console.log('Creating invoice in Xero:', JSON.stringify(req.body, null, 2));
    
    // Handle our draft invoice structure
    const invoice = req.body;
    
    // Validate required fields
    if (!invoice.invoiceID) {
      throw new Error('Invoice ID is required');
    }
    
    if (!invoice.amount || invoice.amount <= 0) {
      throw new Error('Invoice amount must be greater than 0');
    }
    
    if (!invoice.date) {
      throw new Error('Invoice date is required');
    }
    
    if (!invoice.dueDate) {
      throw new Error('Invoice due date is required');
    }
    
    // Ensure dates are in proper format
    const invoiceDate = new Date(invoice.date);
    const dueDate = new Date(invoice.dueDate);
    
    if (isNaN(invoiceDate.getTime())) {
      throw new Error('Invalid invoice date format');
    }
    
    if (isNaN(dueDate.getTime())) {
      throw new Error('Invalid due date format');
    }
    
    // First, we need to find or create a contact in Xero for the client
    let contactId = null;
    
    // Get client name from the project structure
    console.log('Invoice structure:', {
      hasXeroClientName: !!invoice.xeroClientName,
      xeroClientName: invoice.xeroClientName,
      hasProject: !!invoice.projectId,
      projectName: invoice.projectId?.name,
      hasClient: !!invoice.projectId?.client,
      clientName: invoice.projectId?.client?.name
    });
    
    const clientName = invoice.xeroClientName || (invoice.projectId?.client?.name);
    console.log('Client name for contact creation:', clientName);
    
    if (clientName) {
      try {
        // Get token for contact operations
        const contactTokenSet = await xero.readTokenSet();
        const contactTenantId = await xero.getTenantId();
        
        if (!contactTokenSet || !contactTokenSet.access_token) {
          throw new Error('No valid access token for contact operations');
        }
        
        // Try to find existing contact by name using direct fetch
        const contactsResponse = await fetch(`https://api.xero.com/api.xro/2.0/Contacts?where=Name="${encodeURIComponent(clientName)}"`, {
          headers: {
            'Authorization': `Bearer ${contactTokenSet.access_token}`,
            'Xero-tenant-id': contactTenantId,
            'Accept': 'application/json'
          }
        });
        
        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json();
          if (contactsData.Contacts && contactsData.Contacts.length > 0) {
            contactId = contactsData.Contacts[0].ContactID;
            console.log('Found existing contact:', contactId);
          } else {
            // Create new contact using direct fetch
            const newContact = {
              Name: clientName,
              ContactStatus: 'ACTIVE'
            };
            
            const createContactResponse = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${contactTokenSet.access_token}`,
                'Xero-tenant-id': contactTenantId,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ Contacts: [newContact] })
            });
            
            if (createContactResponse.ok) {
              const createContactData = await createContactResponse.json();
              if (createContactData.Contacts && createContactData.Contacts.length > 0) {
                contactId = createContactData.Contacts[0].ContactID;
                console.log('Created new contact:', contactId);
              }
            } else {
              console.error('Failed to create contact:', createContactResponse.status, createContactResponse.statusText);
            }
          }
        } else {
          console.error('Failed to search contacts:', contactsResponse.status, contactsResponse.statusText);
        }
      } catch (contactError) {
        console.error('Error handling contact:', contactError);
        // Continue with invoice creation even if contact creation fails
      }
    }
    
    // Use line items from the database if available, otherwise create a basic line item
    let lineItems = [];
    
    console.log('Invoice line items:', invoice.lineItems);
    
    if (invoice.lineItems && invoice.lineItems.length > 0) {
      // Convert our line items to Xero format
      lineItems = invoice.lineItems.map(item => {
        // Extract just the account number from the account field
        let accountCode = '200'; // Default account code for sales
        if (item.account) {
          // If account contains a number, extract it (e.g., "191 - Consulting Fees" -> "191")
          const accountMatch = item.account.match(/^(\d+)/);
          if (accountMatch) {
            accountCode = accountMatch[1];
          }
        }
        
        return {
          Description: item.description || 'Invoice item',
          Quantity: item.quantity || 1,
          UnitAmount: item.unitPrice || item.amount || 0,
          AccountCode: accountCode,
          TaxType: 'OUTPUT', // GST on income
          LineAmount: item.amount || (item.quantity * item.unitPrice) || 0
        };
      });
      console.log('Converted line items:', lineItems);
    } else {
      // Fallback to basic line item using the actual description
      lineItems = [{
        Description: invoice.description || `Invoice for ${invoice.projectId?.name || 'Project'}`,
        Quantity: 1,
        UnitAmount: invoice.amount,
        AccountCode: '200' // Default account code for sales
      }];
      console.log('Using fallback line item with description:', invoice.description);
    }
    
    console.log('Contact ID for invoice:', contactId);
    
    // Debug the invoice.invoiceID value
    console.log('Invoice ID value:', invoice.invoiceID);
    console.log('Invoice ID type:', typeof invoice.invoiceID);
    console.log('Invoice ID truthy:', !!invoice.invoiceID);
    
    // Debug the xeroReference value
    console.log('invoice.xeroReference value:', invoice.xeroReference);
    console.log('invoice.xeroReference type:', typeof invoice.xeroReference);
    console.log('invoice.xeroReference truthy:', !!invoice.xeroReference);
    
    const invoiceData = {
      Type: 'ACCREC',
      Contact: contactId ? { ContactID: contactId } : undefined,
      LineItems: lineItems,
      Date: invoiceDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      DueDate: dueDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      InvoiceNumber: invoice.invoiceID, // Use InvoiceNumber for custom invoice number
      Reference: invoice.xeroReference || '', // Use Reference for user's reference input
      Status: 'SUBMITTED' // Create directly as awaiting approval
    };
    
    // Remove undefined fields to prevent them from being included in JSON
    Object.keys(invoiceData).forEach(key => {
      if (invoiceData[key] === undefined) {
        delete invoiceData[key];
      }
    });
    
    // Ensure InvoiceNumber field is always included if invoiceID exists
    if (invoice.invoiceID) {
      invoiceData.InvoiceNumber = invoice.invoiceID;
    }
    
    console.log('Invoice data being sent to Xero:', JSON.stringify(invoiceData, null, 2));
    console.log('InvoiceNumber field present:', 'InvoiceNumber' in invoiceData);
    console.log('InvoiceNumber value:', invoiceData.InvoiceNumber);
    console.log('Reference field value:', invoiceData.Reference);

    console.log('Formatted invoice data for Xero:', invoiceData);

    // Get token and tenant ID for the API call (same approach as sync FROM Xero)
    const tokenSet = await xero.readTokenSet();
    const tenantId = await xero.getTenantId();
    
    if (!tokenSet || !tokenSet.access_token) {
      throw new Error('No valid access token available');
    }
    
    if (!tenantId) {
      throw new Error('No tenant ID available');
    }
    console.log('Tenant ID:', tenantId);

    // Use the same approach as sync FROM Xero - direct fetch with manual headers
    console.log('Making API call with tenant ID:', tenantId);
    console.log('Using direct fetch approach like sync FROM Xero');
    console.log('Token being used:', tokenSet.access_token ? `Bearer ${tokenSet.access_token.substring(0, 20)}...` : 'NO TOKEN');
    console.log('About to make direct fetch call...');
    
    const requestBody = JSON.stringify({ Invoices: [invoiceData] });
    console.log('Request body being sent:', requestBody);
    console.log('Request body length:', requestBody.length);
    
    const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Xero-tenant-id': tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: requestBody
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API call failed:', errorText);
      throw new Error(`Xero API call failed: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (!responseData || !responseData.Invoices || !responseData.Invoices[0]) {
      throw new Error('Invalid response from Xero API');
    }
    
    const createdInvoice = responseData.Invoices[0];
    console.log('Successfully created Xero invoice:', createdInvoice.InvoiceID);

    // Invoice created directly as SUBMITTED (awaiting approval) in Xero
    console.log('Invoice created as SUBMITTED in Xero with correct invoice number.');
    
    // Update the local invoice status in our database
    try {
      console.log('Attempting to update local invoice with ID:', invoice._id);
      console.log('Invoice object structure:', {
        hasId: !!invoice._id,
        idType: typeof invoice._id,
        idValue: invoice._id
      });
      
      const localInvoice = await Invoice.findById(invoice._id);
      console.log('Found local invoice:', !!localInvoice);
      
      if (localInvoice) {
        console.log('Current status:', localInvoice.status);
        localInvoice.status = 'awaiting_approval';
        localInvoice.xeroStatus = 'SUBMITTED';
        localInvoice.xeroInvoiceId = createdInvoice.InvoiceID; // Add the Xero invoice ID
        await localInvoice.save();
        console.log('Updated local invoice status to awaiting_approval and added Xero ID');
      } else {
        console.log('Local invoice not found with ID:', invoice._id);
      }
    } catch (dbError) {
      console.error('Error updating local invoice status:', dbError);
    }

    res.json(createdInvoice);
  } catch (error) {
    console.error('Error creating invoice in Xero:', error);
    console.error('Error stack:', error.stack);
    console.error('Error response body:', error.response?.body);
    res.status(500).json({ 
      error: 'Failed to create invoice in Xero',
      message: error.message,
      details: error.response?.body || error.stack
    });
  }
});

// Force token refresh
router.post('/refresh-token', auth, async (req, res) => {
  try {
    console.log('Forcing token refresh...');
    
    const tokenSet = await xero.readTokenSet();
    if (!tokenSet || !tokenSet.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    // Force refresh by calling readTokenSet again (which should trigger refresh)
    const refreshedToken = await xero.readTokenSet();
    
    if (!refreshedToken || !refreshedToken.access_token) {
      throw new Error('Token refresh failed');
    }
    
    console.log('Token refreshed successfully');
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      expiresAt: refreshedToken.expires_at ? new Date(refreshedToken.expires_at).toISOString() : null
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: error.message
    });
  }
});

// Cleanup paid invoices
router.post('/cleanup-paid-invoices', auth, async (req, res) => {
  try {
    console.log('Starting paid invoice cleanup request...');
    
    // Get all paid invoices that are not already soft deleted
    const paidInvoices = await Invoice.find({
      status: 'paid',
      isDeleted: { $ne: true }
    });
    
    console.log(`Found ${paidInvoices.length} paid invoices to cleanup`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const invoice of paidInvoices) {
      try {
        invoice.isDeleted = true;
        invoice.deleteReason = 'Manual cleanup: Invoice marked as paid in Xero';
        invoice.deletedAt = new Date();
        await invoice.save();
        
        successCount++;
        console.log(`Soft deleted invoice: ${invoice.invoiceID}`);
      } catch (error) {
        errorCount++;
        console.error(`Error soft deleting invoice ${invoice.invoiceID}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Successfully soft deleted ${successCount} paid invoices`,
      details: {
        totalFound: paidInvoices.length,
        successCount,
        errorCount
      }
    });
  } catch (error) {
    console.error('Error cleaning up paid invoices:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup paid invoices',
      message: error.message
    });
  }
});

module.exports = router; 