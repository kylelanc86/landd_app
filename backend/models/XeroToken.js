const mongoose = require('mongoose');

// Define the schema with explicit field definitions
const xeroTokenSchema = new mongoose.Schema({
  access_token: {
    type: String,
    required: true,
    index: true
  },
  refresh_token: {
    type: String,
    required: true,
    index: true
  },
  expires_in: {
    type: Number,
    required: true
  },
  expires_at: {
    type: Number,
    required: true,
    index: true
  },
  token_type: {
    type: String,
    required: true,
    default: 'Bearer',
    enum: ['Bearer']
  },
  scope: {
    type: String,
    required: true
  },
  id_token: {
    type: String,
    sparse: true
  },
  session_state: {
    type: String,
    sparse: true
  },
  tenantId: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true,
  collection: 'xerotokens'
});

// Add indexes for better query performance
xeroTokenSchema.index({ createdAt: -1 });
xeroTokenSchema.index({ expires_at: 1 });

// Ensure only one token document exists
xeroTokenSchema.statics.getToken = async function() {
  try {
    if (!mongoose.connection.readyState) {
      console.error('MongoDB: Not connected to database');
      return null;
    }

    console.log('MongoDB: Attempting to get token...');
    console.log('MongoDB: Current database:', mongoose.connection.db.databaseName);
    console.log('MongoDB: Current collection:', this.collection.name);
    
    // List all documents in the collection
    const allDocs = await this.find({});
    console.log('MongoDB: All documents in collection:', allDocs.length);
    
    const token = await this.findOne().sort({ createdAt: -1 });
    console.log('MongoDB: Token query result:', token ? 'Found token' : 'No token found');
    
    if (token) {
      console.log('MongoDB: Token details:', {
        id: token._id,
        hasAccessToken: !!token.access_token,
        hasRefreshToken: !!token.refresh_token,
        expiresAt: token.expires_at ? new Date(token.expires_at).toISOString() : null,
        tokenType: token.token_type,
        scope: token.scope,
        tenantId: token.tenantId,
        createdAt: token.createdAt
      });
    }
    return token;
  } catch (error) {
    console.error('MongoDB: Error getting token:', error);
    throw error;
  }
};

xeroTokenSchema.statics.setToken = async function(tokenSet) {
  try {
    if (!mongoose.connection.readyState) {
      console.error('MongoDB: Not connected to database');
      throw new Error('Database not connected');
    }

    console.log('MongoDB: Starting setToken operation...');
    console.log('MongoDB: Current database:', mongoose.connection.db.databaseName);
    console.log('MongoDB: Current collection:', this.collection.name);
    console.log('MongoDB: Raw token set received:', JSON.stringify(tokenSet, null, 2));

    // Format the token data
    const tokenData = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      expires_in: tokenSet.expires_in,
      expires_at: tokenSet.expires_at || (Date.now() + (tokenSet.expires_in * 1000)),
      token_type: tokenSet.token_type || 'Bearer',
      scope: tokenSet.scope,
      id_token: tokenSet.id_token,
      session_state: tokenSet.session_state
    };

    console.log('MongoDB: Formatted token data:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      expiresAt: new Date(tokenData.expires_at).toISOString(),
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      hasIdToken: !!tokenData.id_token,
      hasSessionState: !!tokenData.session_state
    });

    // Remove all existing tokens
    console.log('MongoDB: Removing existing tokens...');
    const deleteResult = await this.deleteMany({});
    console.log('MongoDB: Delete result:', deleteResult);

    // Create new token
    console.log('MongoDB: Creating new token...');
    const token = new this(tokenData);
    
    // Validate before saving
    const validationError = token.validateSync();
    if (validationError) {
      console.error('MongoDB: Token validation failed:', validationError);
      throw validationError;
    }

    // Try to save with explicit error handling
    let savedToken;
    try {
      savedToken = await token.save();
      console.log('MongoDB: Save operation completed');
    } catch (saveError) {
      console.error('MongoDB: Error during save operation:', saveError);
      throw saveError;
    }

    if (!savedToken) {
      console.error('MongoDB: Save operation returned null');
      throw new Error('Failed to save token - save operation returned null');
    }

    console.log('MongoDB: Token saved successfully:', {
      id: savedToken._id,
      createdAt: savedToken.createdAt,
      expiresAt: new Date(savedToken.expires_at).toISOString()
    });

    // List all documents after save
    const allDocsAfterSave = await this.find({});
    console.log('MongoDB: All documents after save:', allDocsAfterSave.length);
    if (allDocsAfterSave.length > 0) {
      console.log('MongoDB: First document after save:', {
        id: allDocsAfterSave[0]._id,
        hasAccessToken: !!allDocsAfterSave[0].access_token,
        hasRefreshToken: !!allDocsAfterSave[0].refresh_token,
        createdAt: allDocsAfterSave[0].createdAt
      });
    } else {
      console.error('MongoDB: No documents found after save operation');
    }

    // Verify the save with explicit error handling
    let verifyToken;
    try {
      verifyToken = await this.findById(savedToken._id);
      console.log('MongoDB: Verification query completed');
    } catch (verifyError) {
      console.error('MongoDB: Error during verification query:', verifyError);
      throw verifyError;
    }

    if (!verifyToken) {
      console.error('MongoDB: Token verification failed - token not found after save');
      throw new Error('Token verification failed: Token not found after save');
    }

    console.log('MongoDB: Verification result:', {
      id: verifyToken._id,
      hasAccessToken: !!verifyToken.access_token,
      hasRefreshToken: !!verifyToken.refresh_token,
      expiresAt: verifyToken.expires_at ? new Date(verifyToken.expires_at).toISOString() : null,
      tokenType: verifyToken.token_type,
      scope: verifyToken.scope,
      createdAt: verifyToken.createdAt
    });

    return savedToken;
  } catch (error) {
    console.error('MongoDB: Error setting token:', error);
    throw error;
  }
};

// Create the model with explicit collection name
const XeroToken = mongoose.model('XeroToken', xeroTokenSchema, 'xerotokens');

module.exports = XeroToken; 