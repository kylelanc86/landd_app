import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler to catch and suppress Google Maps IntersectionObserver errors
// These errors occur when Google Maps API tries to observe elements that aren't ready yet
// They don't break functionality, so we can safely suppress them
window.addEventListener('error', (event) => {
  // Check if this is a Google Maps IntersectionObserver error
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes('IntersectionObserver') &&
    event.error.message.includes('not of type \'Element\'')
  ) {
    // Suppress the error - it's a known issue with Google Maps API initialization
    event.preventDefault();
    console.warn('Suppressed Google Maps IntersectionObserver error:', event.error.message);
    return true;
  }
  // Let other errors propagate normally
  return false;
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Check if this is a Google Maps IntersectionObserver error
  if (
    event.reason &&
    event.reason.message &&
    event.reason.message.includes('IntersectionObserver') &&
    event.reason.message.includes('not of type \'Element\'')
  ) {
    // Suppress the error
    event.preventDefault();
    console.warn('Suppressed Google Maps IntersectionObserver promise rejection:', event.reason.message);
    return true;
  }
  // Let other rejections propagate normally
  return false;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 