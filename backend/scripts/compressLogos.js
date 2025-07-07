const fs = require('fs');
const path = require('path');

// Read the original logo images
const logoPath = path.join(__dirname, '../assets/logo_base64.txt');
const logoHiresPath = path.join(__dirname, '../assets/logo_base64_hires.txt');

const originalLogo = fs.readFileSync(logoPath, 'utf8').trim();
const originalLogoHires = fs.readFileSync(logoHiresPath, 'utf8').trim();

console.log('Original logo size:', Math.round(originalLogo.length * 0.75 / 1024), 'KB');
console.log('Original hi-res logo size:', Math.round(originalLogoHires.length * 0.75 / 1024), 'KB');

// Create a much smaller SVG logo
const compressedLogo = `data:image/svg+xml;base64,${Buffer.from(`
<svg width="243" height="80" xmlns="http://www.w3.org/2000/svg">
  <rect width="243" height="80" fill="#16b12b" rx="4"/>
  <text x="121.5" y="45" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">L&D CONSULTING</text>
  <text x="121.5" y="65" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="white">PTY LTD</text>
</svg>
`).toString('base64')}`;

// Save the compressed versions
const compressedLogoPath = path.join(__dirname, '../assets/logo_base64_compressed.txt');
const compressedLogoHiresPath = path.join(__dirname, '../assets/logo_base64_hires_compressed.txt');

fs.writeFileSync(compressedLogoPath, compressedLogo);
fs.writeFileSync(compressedLogoHiresPath, compressedLogo);

console.log('Compressed logo size:', Math.round(compressedLogo.length * 0.75 / 1024), 'KB');
console.log('Logo size reduction:', Math.round(((originalLogo.length - compressedLogo.length) / originalLogo.length) * 100), '%');
console.log('Hi-res logo size reduction:', Math.round(((originalLogoHires.length - compressedLogo.length) / originalLogoHires.length) * 100), '%');
console.log('Compressed logos saved to:', compressedLogoPath, 'and', compressedLogoHiresPath); 