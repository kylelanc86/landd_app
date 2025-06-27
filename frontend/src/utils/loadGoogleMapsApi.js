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
      script.onload = () => resolve(window.google);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return googleMapsScriptPromise;
} 