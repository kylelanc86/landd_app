// Test utility for Google Maps API
export const testGoogleMapsApi = async () => {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key is missing');
    return false;
  }

  try {
    // Test the API key by making a simple request
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`
    );
    
    const data = await response.json();
    
    console.log('Google Maps API test response:', data);
    
    if (data.status === 'REQUEST_DENIED') {
      console.error('Google Maps API key is invalid or has restrictions:', data.error_message);
      console.error('Please check:');
      console.error('1. API key is correct');
      console.error('2. Places API is enabled');
      console.error('3. Billing is enabled');
      console.error('4. API restrictions allow Places API');
      console.error('5. Application restrictions allow your domain');
      return false;
    }
    
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.error('Google Maps API quota exceeded');
      return false;
    }
    
    if (data.status === 'OK') {
      console.log('Google Maps API key is working correctly.');
      return true;
    }
    
    console.error('Google Maps API returned unexpected status:', data.status);
    return false;
  } catch (error) {
    console.error('Error testing Google Maps API key:', error);
    return false;
  }
}; 