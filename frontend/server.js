const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Check if build directory exists and log its contents
const buildPath = path.join(__dirname, 'build');
console.log('Build directory path:', buildPath);
console.log('Build directory exists:', fs.existsSync(buildPath));

if (fs.existsSync(buildPath)) {
  console.log('Build directory contents:', fs.readdirSync(buildPath));
  
  // Check if static directory exists
  const staticPath = path.join(buildPath, 'static');
  if (fs.existsSync(staticPath)) {
    console.log('Static directory contents:', fs.readdirSync(staticPath));
    
    const jsPath = path.join(staticPath, 'js');
    if (fs.existsSync(jsPath)) {
      console.log('JS directory contents:', fs.readdirSync(jsPath));
    }
  }
}

// Helper function to set proper headers with cache control
const setStaticHeaders = (res, filePath) => {
  if (filePath.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
    // Cache JS files for 1 year (they have hashes in filenames)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (filePath.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
    // Cache CSS files for 1 year (they have hashes in filenames)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (filePath.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json');
    // Cache JSON files for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.gif') || filePath.endsWith('.svg')) {
    // Cache images for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (filePath.endsWith('.html')) {
    // Don't cache HTML files - always fetch fresh
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // Default cache for other files
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
};

// Serve static files from the React app build directory with proper headers
app.use(express.static(buildPath, { setHeaders: setStaticHeaders }));

// Serve static files from various subdirectory paths to handle React Router issues
const subdirectories = ['/admin', '/records', '/projects', '/clients', '/air-monitoring', '/timesheets', '/surveys', '/clearances', '/reports', '/fibre-id', '/calibrations', '/equipment', '/users', '/profile', '/dashboard', '/invoices', '/calendar', '/laboratory', '/databases', '/asbestos-removal'];

subdirectories.forEach(subdir => {
  app.use(subdir, express.static(buildPath, { setHeaders: setStaticHeaders }));
});

// Add a test route to check if server is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Frontend server is working',
    timestamp: new Date().toISOString(),
    buildPath: buildPath,
    buildExists: fs.existsSync(buildPath)
  });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  console.log(`Serving index.html for route: ${req.url}`);
  const indexPath = path.join(buildPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).send('index.html not found');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server is running on port ${PORT}`);
  console.log(`Static files served from root path`);
  console.log(`Server ready to handle requests`);
}); 