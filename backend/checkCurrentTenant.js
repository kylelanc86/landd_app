const mongoose = require('mongoose');
require('dotenv').config();

const XeroToken = require('./models/XeroToken');

async function checkCurrentTenant() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const token = await XeroToken.getToken();
    
    if (!token) {
      console.log('No Xero token found in database');
      return;
    }

    console.log('=== CURRENT XERO CONNECTION INFO ===');
    console.log('Tenant ID:', token.tenantId);
    console.log('Access Token (first 20 chars):', token.access_token ? token.access_token.substring(0, 20) + '...' : 'None');
    console.log('Token Type:', token.token_type);
    console.log('Scope:', token.scope);
    console.log('Expires At:', token.expires_at ? new Date(token.expires_at).toISOString() : 'None');
    console.log('Created At:', token.createdAt);
    console.log('Updated At:', token.updatedAt);
    
    if (token.tenantId) {
      console.log('\n✅ Tenant ID is set:', token.tenantId);
      console.log('This should be your real company tenant ID, not the demo company.');
    } else {
      console.log('\n❌ No tenant ID found!');
      console.log('This might be why you\'re still seeing demo data.');
    }
    
    console.log('\n=== END ===');
    
  } catch (error) {
    console.error('Error checking tenant:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkCurrentTenant(); 