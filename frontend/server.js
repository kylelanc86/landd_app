const express = require('express');
const path = require('path');
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

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  console.log(`Serving index.html for route: ${req.url}`);
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server is running on port ${PORT}`);
  console.log(`Static files served from root path`);
  console.log(`Server ready to handle requests`);
}); 