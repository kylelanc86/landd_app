let googleMapsScriptPromise = null;

export default function loadGoogleMapsApi(apiKey) {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google);
  }
  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = () => {
        // Add a small delay to ensure the API is fully initialized
        // This helps prevent IntersectionObserver errors
        setTimeout(() => {
          try {
            // Verify the API is fully loaded
            if (window.google && window.google.maps) {
              resolve(window.google);
            } else {
              reject(new Error("Google Maps API failed to load properly"));
            }
          } catch (error) {
            // Catch any errors during API initialization
            console.warn("Error during Google Maps API initialization:", error);
            // Still resolve if window.google exists, as the API might still work
            if (window.google && window.google.maps) {
              resolve(window.google);
            } else {
              reject(error);
            }
          }
        }, 100);
      };
      script.onerror = (error) => {
        console.error("Failed to load Google Maps API script:", error);
        reject(new Error("Failed to load Google Maps API"));
      };
      
      // Add error handler for script loading errors
      script.addEventListener("error", (error) => {
        console.error("Google Maps API script error:", error);
        reject(new Error("Failed to load Google Maps API script"));
      });
      
      document.head.appendChild(script);
    });
  }
  return googleMapsScriptPromise;
} 