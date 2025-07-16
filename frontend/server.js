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

// Add some debugging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Host: ${req.headers.host}`);
  next();
});

// Check if build directory exists
const buildPath = path.join(__dirname, 'build');
console.log('Build directory path:', buildPath);
console.log('Build directory exists:', fs.existsSync(buildPath));

if (fs.existsSync(buildPath)) {
  console.log('Build directory contents:', fs.readdirSync(buildPath));
}

// Serve static files from the React app build directory
app.use(express.static(buildPath));

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
  console.log(`Test endpoint available at: http://localhost:${PORT}/api/test`);
}); 