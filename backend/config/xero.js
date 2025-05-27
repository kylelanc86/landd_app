const { XeroClient } = require('xero-node');
const dotenv = require('dotenv');
const XeroToken = require('../models/XeroToken');
const fetch = require('node-fetch');

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_REDIRECT_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Add tenant storage
let currentTenantId = null;

// Store state for verification
let currentState = null;

const xero = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUris: [process.env.XERO_REDIRECT_URI],
  scopes: [
    'offline_access',
    'accounting.transactions',
    'accounting.contacts',
    'accounting.settings',
    'accounting.reports.read'
  ],
  tokenSet: null
});

// Add state management methods
xero.generateState = () => {
  currentState = Math.random().toString(36).substring(7);
  return currentState;
};

xero.verifyState = (state) => {
  return state && currentState && state === currentState;
};

// Add tenant management methods
xero.setTenantId = async (tenantId) => {
  try {
    console.log('Setting tenant ID:', tenantId);
    currentTenantId = tenantId;
    // Store tenant ID in the token document
    const token = await XeroToken.getToken();
    if (token) {
      token.tenantId = tenantId;
      await token.save();
      console.log('Tenant ID saved to token document');
    }
  } catch (error) {
    console.error('Error setting tenant ID:', error);
    throw error;
  }
};

xero.getTenantId = async () => {
  try {
    if (!currentTenantId) {
      const token = await XeroToken.getToken();
      if (token && token.tenantId) {
        currentTenantId = token.tenantId;
        console.log('Retrieved tenant ID from token:', currentTenantId);
      }
    }
    return currentTenantId;
  } catch (error) {
    console.error('Error getting tenant ID:', error);
    return null;
  }
};

// Override buildConsentUrl to ensure proper URL construction
const originalBuildConsentUrl = xero.buildConsentUrl;
xero.buildConsentUrl = async function() {
  try {
    const state = this.generateState();
    const url = await originalBuildConsentUrl.call(this);
    console.log('Original Xero consent URL:', url);
    const finalUrl = `${url}&state=${state}`;
    console.log('Final Xero consent URL:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('Error building consent URL:', error);
    throw error;
  }
};

// Add token reading method
xero.readTokenSet = async () => {
  try {
    console.log('Starting readTokenSet operation...');
    const token = await XeroToken.getToken();
    
    if (token) {
      const tokenSet = token.toObject();
      console.log('Token set details:', {
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at).toISOString() : null
      });
      
      // Check if token is expired or about to expire (within 5 minutes)
      if (tokenSet.expires_at < (Date.now() + 300000)) {
        console.log('Token is expired or about to expire, attempting refresh');
        try {
          const newTokenSet = await xero.refreshToken();
          if (newTokenSet && newTokenSet.access_token) {
            console.log('Successfully refreshed token');
            await xero.setTokenSet(newTokenSet);
            return newTokenSet;
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          return null;
        }
      }
      
      return tokenSet;
    }
    
    console.log('No token found in MongoDB');
    return null;
  } catch (error) {
    console.error('Error in readTokenSet:', error);
    return null;
  }
};

// Add token setting method
xero.setTokenSet = async (tokenSet) => {
  try {
    console.log('Starting setTokenSet operation...');
    console.log('Token set to save:', {
      hasAccessToken: !!tokenSet?.access_token,
      hasRefreshToken: !!tokenSet?.refresh_token,
      expiresAt: tokenSet?.expires_at ? new Date(tokenSet.expires_at).toISOString() : null,
      tokenType: tokenSet?.token_type,
      scope: tokenSet?.scope
    });
    
    if (!tokenSet || !tokenSet.access_token) {
      console.error('Invalid token set provided:', tokenSet);
      throw new Error('Invalid token set provided');
    }
    
    // Add expiration timestamp if not present
    if (!tokenSet.expires_at && tokenSet.expires_in) {
      tokenSet.expires_at = Date.now() + (tokenSet.expires_in * 1000);
      console.log('Added expiration timestamp:', new Date(tokenSet.expires_at).toISOString());
    }

    // Ensure we have a refresh token
    if (!tokenSet.refresh_token) {
      console.log('No refresh token in new token set, attempting to get from existing token...');
      const existingToken = await XeroToken.getToken();
      if (existingToken && existingToken.refresh_token) {
        console.log('Using refresh token from existing token');
        tokenSet.refresh_token = existingToken.refresh_token;
      } else {
        console.error('No refresh token available');
        throw new Error('No refresh token available');
      }
    }
    
    // Save token to MongoDB
    const savedToken = await XeroToken.setToken(tokenSet);
    console.log('Token saved to MongoDB successfully');
    
    // Verify the saved token
    const verifiedToken = await XeroToken.getToken();
    if (!verifiedToken || !verifiedToken.access_token || !verifiedToken.refresh_token) {
      console.error('Failed to verify saved token:', verifiedToken);
      throw new Error('Failed to verify saved token');
    }
    
    console.log('Token verified successfully');
    return true;
  } catch (error) {
    console.error('Error in setTokenSet:', error);
    throw error;
  }
};

// Add updateTenants method
xero.updateTenants = async () => {
  try {
    const tokenSet = await xero.readTokenSet();
    if (!tokenSet || !tokenSet.access_token) {
      throw new Error('No valid token set available');
    }
    
    // Use the correct method to get tenants
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get tenants: ${response.status} ${response.statusText}`);
    }

    const tenants = await response.json();
    console.log('Retrieved tenants:', tenants?.length || 0);
    
    // Store the first tenant ID if available
    if (tenants && tenants.length > 0) {
      await xero.setTenantId(tenants[0].tenantId);
      console.log('Set tenant ID to:', tenants[0].tenantId);
    }
    
    return tenants;
  } catch (error) {
    console.error('Error updating tenants:', error);
    throw error;
  }
};

// Override apiCallback to add more logging and proper token handling
const originalApiCallback = xero.apiCallback;
xero.apiCallback = async function(code) {
  try {
    console.log('Calling Xero apiCallback with code:', code);
    
    // Get the token endpoint URL
    const tokenEndpoint = 'https://identity.xero.com/connect/token';
    console.log('Using token endpoint:', tokenEndpoint);
    
    // Prepare the token request
    const tokenRequest = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.XERO_REDIRECT_URI,
      client_id: process.env.XERO_CLIENT_ID,
      client_secret: process.env.XERO_CLIENT_SECRET
    };
    
    console.log('Sending token request to Xero...');
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenRequest).toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenSet = await response.json();
    console.log('Received token set from Xero:', JSON.stringify(tokenSet, null, 2));
    
    if (!tokenSet.access_token) {
      console.error('Token set missing access_token:', tokenSet);
      throw new Error('Invalid token set: missing access_token');
    }
    
    // Add expiration timestamp if not present
    if (!tokenSet.expires_at && tokenSet.expires_in) {
      tokenSet.expires_at = Date.now() + (tokenSet.expires_in * 1000);
    }
    
    // Save the token set
    await xero.setTokenSet(tokenSet);
    console.log('Token set saved successfully');
    
    return tokenSet;
  } catch (error) {
    console.error('Error in apiCallback:', error);
    throw error;
  }
};

module.exports = xero; 