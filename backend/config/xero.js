const { XeroClient } = require('xero-node');
const dotenv = require('dotenv');
const XeroToken = require('../models/XeroToken');
const fetch = require('node-fetch');
const mongoose = require('mongoose');

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

// Add a flag to track token initialization
let isTokenInitialized = false;

// Create the Xero client
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
  ]
});

// Initialize the client with token
const initializeXeroClient = async () => {
  try {
    // Wait for MongoDB to be ready
    if (mongoose.connection.readyState !== 1) {
      console.log('Waiting for MongoDB connection...');
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
      });
    }

    const token = await XeroToken.getToken();
    if (token) {
      const tokenSet = token.toObject();
      
      // Ensure token has all required fields
      if (!tokenSet.access_token || !tokenSet.refresh_token) {
        console.error('Invalid token set from MongoDB:', {
          hasAccessToken: !!tokenSet.access_token,
          hasRefreshToken: !!tokenSet.refresh_token
        });
        return;
      }

      // Set the token in the Xero client
      xero.setTokenSet(tokenSet);

      // Verify the token was set correctly
      const verifyToken = xero.readTokenSet();
      if (!verifyToken || !verifyToken.access_token) {
        console.error('Failed to set token in Xero client');
        return;
      }

      console.log('Initialized Xero client with token from MongoDB:', {
        hasAccessToken: !!verifyToken.access_token,
        tokenType: verifyToken.token_type,
        scope: verifyToken.scope,
        tenantId: verifyToken.tenantId
      });
    } else {
      console.log('No token found in MongoDB');
    }
  } catch (error) {
    console.error('Error initializing Xero client token:', error);
  }
};

// Initialize when MongoDB is ready
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected, initializing Xero client...');
  initializeXeroClient();
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
    
    // If tenantId is null, we're clearing it
    if (tenantId === null) {
      console.log('Clearing tenant ID');
      // Update the token set in the Xero client
      if (xero.tokenSet) {
        xero.tokenSet.tenantId = null;
      }
      return;
    }
    
    // Store tenant ID in the token document
    const token = await XeroToken.getToken();
    if (token) {
      token.tenantId = tenantId;
      await token.save();
      console.log('Tenant ID saved to token document:', tenantId);
      
      // Update the token set in the Xero client
      if (xero.tokenSet) {
        xero.tokenSet.tenantId = tenantId;
      }
    } else {
      console.log('No token found to save tenant ID (this is normal when disconnecting)');
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
      } else {
        console.log('No tenant ID found in token');
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
    
    // If token is already initialized, return the current token set
    if (isTokenInitialized && xero.tokenSet) {
      console.log('Using existing token set');
      return xero.tokenSet;
    }
    
    const token = await XeroToken.getToken();
    
    if (token) {
      const tokenSet = token.toObject();
      console.log('Token set details:', {
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at).toISOString() : null,
        tokenType: tokenSet.token_type,
        scope: tokenSet.scope,
        tenantId: tokenSet.tenantId
      });
      
      // Check if token is expired or about to expire (within 5 minutes)
      if (tokenSet.expires_at < (Date.now() + 300000)) {
        console.log('Token is expired or about to expire, attempting refresh');
        try {
          // Implement manual token refresh since xero.refreshToken() is not working
          const refreshResponse = await fetch('https://identity.xero.com/connect/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: tokenSet.refresh_token,
              client_id: process.env.XERO_CLIENT_ID,
              client_secret: process.env.XERO_CLIENT_SECRET
            }).toString()
          });

          if (!refreshResponse.ok) {
            const errorText = await refreshResponse.text();
            console.error('Token refresh failed:', {
              status: refreshResponse.status,
              statusText: refreshResponse.statusText,
              error: errorText
            });
            throw new Error(`Token refresh failed: ${refreshResponse.status} ${refreshResponse.statusText}`);
          }

          const newTokenSet = await refreshResponse.json();
          console.log('Successfully refreshed token');
          
          // Add expiration timestamp if not present
          if (!newTokenSet.expires_at && newTokenSet.expires_in) {
            newTokenSet.expires_at = Date.now() + (newTokenSet.expires_in * 1000);
          }
          
          // Preserve tenant ID and other fields
          newTokenSet.tenantId = tokenSet.tenantId;
          newTokenSet.scope = tokenSet.scope;
          
          await xero.setTokenSet(newTokenSet);
          isTokenInitialized = true;
          return newTokenSet;
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          // Return the existing token even if expired - let the API call fail naturally
          return tokenSet;
        }
      }
      
      // Set the token in the Xero client
      await xero.setTokenSet(tokenSet);
      isTokenInitialized = true;
      console.log('Token set in Xero client from readTokenSet');
      
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
      scope: tokenSet?.scope,
      tenantId: tokenSet?.tenantId
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

    // If we have a tenant ID in the existing token, preserve it
    if (!tokenSet.tenantId) {
      console.log('No tenant ID in new token set, checking existing token...');
      const existingToken = await XeroToken.getToken();
      if (existingToken && existingToken.tenantId) {
        console.log('Using tenant ID from existing token:', existingToken.tenantId);
        tokenSet.tenantId = existingToken.tenantId;
      }
    }
    
    // Save token to MongoDB
    const savedToken = await XeroToken.setToken(tokenSet);
    console.log('Token saved to MongoDB successfully');
    
    // Set the token directly in the Xero client
    xero.tokenSet = tokenSet;
    isTokenInitialized = true;
    
    console.log('Token set in Xero client successfully');
    return true;
  } catch (error) {
    console.error('Error in setTokenSet:', error);
    throw error;
  }
};

// Add updateTenants method
xero.updateTenants = async () => {
  try {
    console.log('Starting updateTenants operation...');
    const tokenSet = await xero.readTokenSet();
    if (!tokenSet || !tokenSet.access_token) {
      throw new Error('No valid token set available');
    }
    
    console.log('Fetching tenants from Xero API...');
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${tokenSet.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get tenants:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to get tenants: ${response.status} ${response.statusText}`);
    }

    const tenants = await response.json();
    console.log('Retrieved tenants:', tenants?.length || 0);
    
    if (tenants && tenants.length > 0) {
      const firstTenant = tenants[0];
      console.log('Setting first tenant:', firstTenant);
      
      // Get the current token
      const currentToken = await XeroToken.getToken();
      if (!currentToken) {
        throw new Error('No token found to update tenant ID');
      }

      // Update the token with the tenant ID
      currentToken.tenantId = firstTenant.tenantId;
      await currentToken.save();
      
      // Update the token set
      tokenSet.tenantId = firstTenant.tenantId;
      await xero.setTokenSet(tokenSet);
      
      console.log('Tenant ID set successfully:', firstTenant.tenantId);
      
      // Verify the tenant ID was saved
      const verifiedToken = await XeroToken.getToken();
      console.log('Verified tenant ID:', verifiedToken.tenantId);
    } else {
      console.log('No tenants found');
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

// Add a method to check if the client is properly initialized
xero.isInitialized = () => {
  return !!xero.tokenSet && !!xero.tokenSet.access_token;
};

// Add a method to clear invalid tokens
xero.clearInvalidToken = async () => {
  try {
    console.log('Clearing invalid token...');
    await XeroToken.deleteAll();
    xero.tokenSet = null;
    isTokenInitialized = false;
    currentTenantId = null;
    console.log('Invalid token cleared successfully');
  } catch (error) {
    console.error('Error clearing invalid token:', error);
  }
};

// Ensure token is properly set before API calls
const originalAccountingApi = xero.accountingApi;
xero.accountingApi = new Proxy(originalAccountingApi, {
  get: function(target, prop) {
    const originalMethod = target[prop];
    if (typeof originalMethod === 'function') {
      return async function(...args) {
        // Ensure token is set in the Xero client before making API calls
        if (!xero.tokenSet || !xero.tokenSet.access_token) {
          const tokenSet = await xero.readTokenSet();
          if (!tokenSet || !tokenSet.access_token) {
            throw new Error('No valid token available');
          }
          // Set the token directly in the client
          xero.tokenSet = tokenSet;
          isTokenInitialized = true;
        }
        
        return originalMethod.apply(target, args);
      };
    }
    return originalMethod;
  }
});

module.exports = xero; 