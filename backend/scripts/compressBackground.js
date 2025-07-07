const fs = require('fs');
const path = require('path');

// Read the original background image
const originalPath = path.join(__dirname, '../assets/clearance_front_base64.txt');
const originalBase64 = fs.readFileSync(originalPath, 'utf8').trim();

console.log('Original background image size:', Math.round(originalBase64.length * 0.75 / 1024), 'KB');

// Create a much smaller placeholder background
// This will be a simple gradient or solid color instead of the large image
const compressedBackground = `data:image/svg+xml;base64,${Buffer.from(`
<svg width="800" height="1130" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e9ecef;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
</svg>
`).toString('base64')}`;

// Save the compressed version
const compressedPath = path.join(__dirname, '../assets/clearance_front_base64_compressed.txt');
fs.writeFileSync(compressedPath, compressedBackground);

console.log('Compressed background image size:', Math.round(compressedBackground.length * 0.75 / 1024), 'KB');
console.log('Size reduction:', Math.round(((originalBase64.length - compressedBackground.length) / originalBase64.length) * 100), '%');
console.log('Compressed background saved to:', compressedPath); 