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
    type: Date,
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
    required: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'xerotokens'
});

// Add indexes for better query performance
xeroTokenSchema.index({ createdAt: 1 });
xeroTokenSchema.index({ expires_at: 1 });
xeroTokenSchema.index({ tenantId: 1 });

// Ensure only one token document exists
xeroTokenSchema.statics.getToken = async function() {
  try {
    if (!mongoose.connection.readyState) {
      console.error('MongoDB: Not connected to database');
      return null;
    }

    const tokens = await this.find().sort({ createdAt: -1 }).limit(1);
    
    if (tokens.length > 0) {
      return tokens[0];
    }
    
    return null;
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

    // Format the token data
    const tokenData = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      expires_in: tokenSet.expires_in,
      expires_at: tokenSet.expires_at || new Date(Date.now() + (tokenSet.expires_in * 1000)),
      token_type: tokenSet.token_type || 'Bearer',
      scope: tokenSet.scope,
      id_token: tokenSet.id_token,
      session_state: tokenSet.session_state,
      tenantId: tokenSet.tenantId
    };

    // Remove all existing tokens
    const deleteResult = await this.deleteMany({});

    // Create new token
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
    } catch (saveError) {
      console.error('MongoDB: Error during save operation:', saveError);
      throw saveError;
    }

    if (!savedToken) {
      throw new Error('Failed to save token - save operation returned null');
    }

    return savedToken;
  } catch (error) {
    console.error('MongoDB: Error setting token:', error);
    throw error;
  }
};

xeroTokenSchema.statics.deleteAll = async function() {
  try {
    if (!mongoose.connection.readyState) {
      console.error('MongoDB: Not connected to database');
      throw new Error('Database not connected');
    }

    const deleteResult = await this.deleteMany({});
    return deleteResult;
  } catch (error) {
    console.error('MongoDB: Error deleting all tokens:', error);
    throw error;
  }
};

// Create the model with explicit collection name
const XeroToken = mongoose.model('XeroToken', xeroTokenSchema, 'xerotokens');

module.exports = XeroToken; 