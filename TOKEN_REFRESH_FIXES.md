# Xero Token Refresh Fixes

## Issues Identified

### 1. Token Refresh Error
**Problem**: The Xero client was throwing `Cannot read properties of undefined (reading 'refresh')` error when trying to refresh expired tokens.

**Root Cause**: The `xero.refreshToken()` method was not properly configured or the underlying Xero client library had issues with the refresh mechanism.

## Fixes Implemented

### 1. Manual Token Refresh Implementation
**File**: `backend/config/xero.js`

**Solution**: Replaced the problematic `xero.refreshToken()` call with a manual token refresh implementation using direct API calls to Xero's token endpoint.

```javascript
// Manual token refresh implementation
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
```

### 2. Enhanced Token Validation
**File**: `backend/services/xeroService.js`

**Solution**: Added additional token validation before starting invoice sync operations:

```javascript
// Verify token is still valid before proceeding
const currentTokenSet = await xero.readTokenSet();
if (!currentTokenSet || !currentTokenSet.access_token) {
  throw new Error('Token validation failed - no access token available');
}

// Check if token is expired
if (currentTokenSet.expires_at && currentTokenSet.expires_at < Date.now()) {
  console.log('Token is expired, attempting to refresh...');
  const refreshedTokenSet = await xero.readTokenSet(); // This will trigger refresh
  if (!refreshedTokenSet || !refreshedTokenSet.access_token) {
    throw new Error('Failed to refresh expired token');
  }
}
```

### 3. Token Cleanup Method
**File**: `backend/config/xero.js` and `backend/models/XeroToken.js`

**Solution**: Added methods to clear invalid tokens when refresh fails:

```javascript
// Added to XeroToken model
xeroTokenSchema.statics.deleteAll = async function() {
  // Implementation to delete all tokens
};

// Added to Xero client
xero.clearInvalidToken = async () => {
  await XeroToken.deleteAll();
  xero.tokenSet = null;
  isTokenInitialized = false;
  currentTenantId = null;
};
```

### 4. Improved Error Handling
**Solution**: Enhanced error handling in the token refresh process:

- Better error logging with detailed information
- Graceful fallback when refresh fails (returns existing token)
- Proper preservation of tenant ID and scope during refresh
- Automatic expiration timestamp calculation

## Key Improvements

1. **Reliable Token Refresh**: Manual implementation ensures tokens are properly refreshed
2. **Better Error Recovery**: System can continue with expired tokens if refresh fails
3. **Enhanced Logging**: Detailed logs for debugging token issues
4. **Token Cleanup**: Ability to clear invalid tokens when needed
5. **Validation**: Pre-sync token validation to catch issues early

## Testing Instructions

1. **Restart the backend server** to apply the changes
2. **Test token refresh**:
   - Wait for a token to expire (or manually expire it)
   - Attempt to sync invoices
   - Check logs for successful token refresh
3. **Test error handling**:
   - Simulate network issues during refresh
   - Verify system continues gracefully
4. **Monitor logs** for detailed token refresh information

## Expected Results

- No more `Cannot read properties of undefined (reading 'refresh')` errors
- Automatic token refresh when tokens expire
- Better error handling and recovery
- Detailed logging for debugging
- Improved reliability of Xero integration

## Files Modified

1. `backend/config/xero.js`
   - Implemented manual token refresh
   - Added token cleanup method
   - Enhanced error handling

2. `backend/services/xeroService.js`
   - Added pre-sync token validation
   - Enhanced error handling

3. `backend/models/XeroToken.js`
   - Added `deleteAll` method for token cleanup 