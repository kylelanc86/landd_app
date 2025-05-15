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
    const tokenSet = await xero.readTokenSet();
    const tenantId = xero.getTenantId();
    
    res.json({
      connected: !!(tokenSet && tokenSet.access_token),
      tenantId: tenantId
    });
  } catch (error) {
    console.error('Error getting Xero status:', error);
    res.status(500).json({ 
      error: 'Failed to get Xero status',
      message: error.message
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
router.get('/callback', auth, async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!xero.verifyState(state)) {
      return res.redirect('http://localhost:3000/invoices?xero_error=Invalid state parameter');
    }

    const tokenSet = await xero.apiCallback(code);
    await xero.setTokenSet(tokenSet);

    // Get and store the first tenant
    const tenants = await xero.updateTenants();
    if (tenants && tenants.length > 0) {
      xero.setTenantId(tenants[0].tenantId);
    }

    // Redirect back to the frontend with success status
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
    const tenantId = xero.getTenantId();
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
    const tokenPath = path.join(__dirname, '../tokens/xero-token.json');
    const tenantPath = path.join(__dirname, '../tokens/xero-tenant.json');
    
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    if (fs.existsSync(tenantPath)) {
      fs.unlinkSync(tenantPath);
    }
    
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
    const result = await XeroService.syncInvoicesFromXero();
    console.log('Sync completed successfully:', result);
    
    if (!result.success) {
      return res.status(500).json({
        error: 'Sync failed',
        message: result.message || 'Failed to sync invoices'
      });
    }
    
    res.json(result);
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
      message: error.message
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

module.exports = router; 