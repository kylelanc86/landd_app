const { XeroClient } = require('xero-node');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_REDIRECT_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Create tokens directory if it doesn't exist
const tokensDir = path.join(__dirname, '../tokens');
if (!fs.existsSync(tokensDir)) {
  fs.mkdirSync(tokensDir);
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
  tokenSet: async () => {
    try {
      const tokenPath = path.join(tokensDir, 'xero-token.json');
      if (fs.existsSync(tokenPath)) {
        const tokenData = fs.readFileSync(tokenPath, 'utf8');
        const tokenSet = JSON.parse(tokenData);
        
        // Check if token is expired or about to expire (within 5 minutes)
        if (tokenSet && tokenSet.expires_at && tokenSet.expires_at < (Date.now() + 300000)) {
          try {
            const newTokenSet = await xero.refreshToken();
            if (newTokenSet && newTokenSet.access_token) {
              await xero.setTokenSet(newTokenSet);
              return newTokenSet;
            }
          } catch (refreshError) {
            // If refresh fails, return null to trigger reconnection
            return null;
          }
        }
        return tokenSet;
      }
      return null;
    } catch (error) {
      return null;
    }
  },
  setTokenSet: async (tokenSet) => {
    try {
      const tokenPath = path.join(tokensDir, 'xero-token.json');
      
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('Invalid token set provided');
      }
      
      // Add expiration timestamp if not present
      if (!tokenSet.expires_at && tokenSet.expires_in) {
        tokenSet.expires_at = Date.now() + (tokenSet.expires_in * 1000);
      }
      
      fs.writeFileSync(tokenPath, JSON.stringify(tokenSet, null, 2));
      return true;
    } catch (error) {
      throw error;
    }
  }
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
xero.setTenantId = (tenantId) => {
  currentTenantId = tenantId;
  const tenantPath = path.join(tokensDir, 'xero-tenant.json');
  fs.writeFileSync(tenantPath, JSON.stringify({ tenantId }, null, 2));
};

xero.getTenantId = () => {
  if (!currentTenantId) {
    try {
      const tenantPath = path.join(tokensDir, 'xero-tenant.json');
      if (fs.existsSync(tenantPath)) {
        const tenantData = JSON.parse(fs.readFileSync(tenantPath, 'utf8'));
        currentTenantId = tenantData.tenantId;
      }
    } catch (error) {
      return null;
    }
  }
  return currentTenantId;
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

console.log('Tokens directory:', tokensDir);

module.exports = xero; 