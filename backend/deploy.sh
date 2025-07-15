#!/bin/bash

# Deployment script for Render
set -e

echo "🚀 Starting deployment process..."

# Set environment variables for optimization
export NODE_ENV=production
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Clean up any existing node_modules
echo "🧹 Cleaning up existing node_modules..."
rm -rf node_modules package-lock.json

# Install dependencies with optimizations
echo "📦 Installing dependencies..."
npm ci --only=production --no-optional --no-audit --no-fund --cache .npm-cache

# Verify critical dependencies
echo "✅ Verifying critical dependencies..."
node -e "
const required = ['puppeteer', 'jimp', 'pdf-lib', 'express', 'mongoose'];
const missing = [];
required.forEach(dep => {
  try {
    require(dep);
    console.log('✓', dep);
  } catch (e) {
    missing.push(dep);
    console.log('✗', dep, '-', e.message);
  }
});
if (missing.length > 0) {
  console.error('Missing critical dependencies:', missing);
  process.exit(1);
}
"

# Test server startup
echo "🧪 Testing server startup..."
timeout 30s node -e "
const server = require('./server.js');
setTimeout(() => {
  console.log('Server started successfully');
  process.exit(0);
}, 5000);
" || {
  echo "❌ Server startup test failed"
  exit 1
}

echo "✅ Deployment preparation completed successfully!" 