# Google Maps API Troubleshooting Guide

## Current Issues
- `ApiTargetBlockedMapError` - API key not authorized for Places API
- `REQUEST_DENIED` - API key restrictions blocking access
- Deprecation warnings for `AutocompleteService` and `PlacesService`

## Step-by-Step Fix

### 1. Google Cloud Console Configuration

#### API Key Settings:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your API key and click on it
4. Configure the following settings:

#### Application Restrictions:
- Set to **"HTTP referrers (web sites)"**
- Add these referrers:
  - `http://localhost:3000/*` (for development)
  - `https://yourdomain.com/*` (for production)

#### API Restrictions:
- Select **"Restrict key"**
- Enable these APIs:
  - ✅ **Places API**
  - ✅ **Geocoding API**
  - ✅ **Maps JavaScript API**

### 2. Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Places API**
   - **Geocoding API**
   - **Maps JavaScript API**

### 3. Enable Billing

1. Go to **Billing** in Google Cloud Console
2. Ensure billing is enabled for your project
3. **Places API requires billing to be enabled**

### 4. Environment Variable

Ensure your `.env` file has:
```
REACT_APP_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 5. Test the API Key

The enhanced error handling will now provide detailed console logs. Check the browser console for:
- API test results when the page loads
- Specific error messages for each API call
- Detailed status information

## Code Improvements Applied

### Enhanced Error Handling:
- Added detailed console logging for API responses
- Specific error messages for each status code
- Better debugging information

### Modal-Specific Fixes:
- Re-initialization of Google Maps services when modal opens
- Z-index fixes for autocomplete dropdown
- Proper DOM context handling

## Testing Steps

1. **Update Google Cloud Console settings** (steps 1-3 above)
2. **Restart your development server**
3. **Open browser console** and navigate to projects page
4. **Try the address search** in the "Add New Project" modal
5. **Check console logs** for detailed error information

## Expected Console Output

### If working correctly:
```
Google Maps API test response: {status: "OK", ...}
Google Maps API key is working correctly.
Google Maps services initialized successfully
```

### If there are issues:
```
REQUEST_DENIED: API key may be invalid or have restrictions
Check Google Cloud Console API key settings
```

## Common Issues and Solutions

### Issue: "API key is not authorized to use this service"
**Solution**: Enable the Places API in Google Cloud Console

### Issue: "REQUEST_DENIED" with billing error
**Solution**: Enable billing for your Google Cloud project

### Issue: "OVER_QUERY_LIMIT"
**Solution**: Check your API usage in Google Cloud Console

### Issue: Autocomplete dropdown not visible in modal
**Solution**: The z-index fixes should resolve this

## Deprecation Warnings

The warnings about `AutocompleteService` and `PlacesService` being deprecated are informational. The current implementation will continue to work until March 2025. Future migration to `AutocompleteSuggestion` and `Place` will be needed.

## Next Steps

1. Apply the Google Cloud Console settings
2. Test the functionality
3. If issues persist, check the enhanced console logs for specific error details
4. Report back with any new error messages 