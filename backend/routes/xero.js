const express = require('express');
const router = express.Router();
const XeroService = require('../services/xeroService');
const auth = require('../middleware/auth');
const xero = require('../config/xero');
const path = require('path');
const fs = require('fs');

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
    console.log('Token set read result:', {
      exists: !!tokenSet,
      hasAccessToken: !!(tokenSet && tokenSet.access_token),
      hasRefreshToken: !!(tokenSet && tokenSet.refresh_token),
      expiresAt: tokenSet?.expires_at ? new Date(tokenSet.expires_at).toISOString() : null
    });
    
    const tenantId = await xero.getTenantId();
    console.log('Tenant ID:', tenantId);
    
    const connected = !!(tokenSet && tokenSet.access_token);
    console.log('Connection status:', connected);
    
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
    
    if (!xero.verifyState(state)) {
      console.error('State verification failed:', { received: state, expected: xero.currentState });
      return res.redirect('http://localhost:3000/invoices?xero_error=Invalid state parameter');
    }

    console.log('State verified, getting token set...');
    const tokenSet = await xero.apiCallback(code);
    console.log('Raw token set received:', JSON.stringify(tokenSet, null, 2));

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
    res.redirect('http://localhost:3000/invoices?xero_connected=true');
  } catch (error) {
    console.error('Error in Xero callback:', error);
    const errorMessage = encodeURIComponent(error.message || 'Failed to complete Xero authentication');
    res.redirect(`http://localhost:3000/invoices?xero_error=${errorMessage}`);
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
    const tenantId = await xero.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ 
        error: 'No tenant selected',
        message: 'Please select a Xero tenant first'
      });
    }

    const invoices = await xero.accountingApi.getInvoices(tenantId);
    res.json(invoices.body.invoices);
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
    const deleteResult = await XeroToken.deleteMany({});
    console.log('Deleted Xero tokens from MongoDB:', deleteResult);
    
    // Reset the Xero client state
    if (xero.tokenSet) {
      xero.tokenSet = null;
    }
    
    // Reset tenant ID
    if (typeof xero.setTenantId === 'function') {
      await xero.setTenantId(null);
    }
    
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
    console.log('Creating invoice in Xero:', req.body);
    
    const invoiceData = {
      Type: 'ACCREC',
      Contact: {
        ContactID: req.body.client // Assuming client ID is the Xero contact ID
      },
      LineItems: [{
        Description: req.body.description || 'Invoice line item',
        Quantity: 1,
        UnitAmount: req.body.amount,
        AccountCode: '200' // Default account code for sales
      }],
      Date: req.body.date,
      DueDate: req.body.dueDate,
      Reference: req.body.invoiceID,
      Status: 'DRAFT'
    };

    console.log('Formatted invoice data for Xero:', invoiceData);

    const response = await xero.accountingApi.createInvoices(
      await xero.getTenantId(),
      { Invoices: [invoiceData] }
    );

    console.log('Xero API response:', response);

    if (!response || !response.body || !response.body.Invoices || !response.body.Invoices[0]) {
      throw new Error('Invalid response from Xero API');
    }

    const createdInvoice = response.body.Invoices[0];
    console.log('Successfully created Xero invoice:', createdInvoice.InvoiceID);

    res.json(createdInvoice);
  } catch (error) {
    console.error('Error creating invoice in Xero:', error);
    res.status(500).json({ 
      error: 'Failed to create invoice in Xero',
      message: error.message,
      details: error.response?.body || error.stack
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