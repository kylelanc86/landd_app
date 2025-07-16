const express = require('express');
const path = require('path');
const app = express();

// Get the base path from environment variable or default to root
const BASE_PATH = process.env.BASE_PATH || '';

// Serve static files from the React app build directory
app.use(BASE_PATH, express.static(path.join(__dirname, 'build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server is running on port ${PORT}`);
  console.log(`Base path: ${BASE_PATH || '/'}`);
}); 