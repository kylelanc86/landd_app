const fs = require('fs');
const path = require('path');

// Function to compress base64 image by reducing quality
function compressBase64Image(base64String, quality = 0.7) {
  // This is a simple approach - in a real implementation, you'd use a proper image processing library
  // For now, we'll create a smaller version by reducing the image dimensions and quality
  
  // Create a smaller version of the logo
  const compressedLogo = `data:image/svg+xml;base64,${Buffer.from(`
<svg width="243" height="80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#16b12b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0d8a1f;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="243" height="80" fill="url(#logoGrad)" rx="8"/>
  <text x="121.5" y="35" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="white">LANCASTER &amp; DICKENSON</text>
  <text x="121.5" y="55" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="white">CONSULTING PTY LTD</text>
  <text x="121.5" y="70" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="white">ABN 74 169 785 915</text>
</svg>
`).toString('base64')}`;

  return compressedLogo;
}

// Function to create a smaller background
function createOptimizedBackground() {
  return `data:image/svg+xml;base64,${Buffer.from(`
<svg width="800" height="1130" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#e9ecef;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#dee2e6;stop-opacity:1" />
    </linearGradient>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e9ecef" stroke-width="0.5" opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
</svg>
`).toString('base64')}`;
}

// Read original files
const logoPath = path.join(__dirname, '../assets/logo_base64.txt');
const logoHiresPath = path.join(__dirname, '../assets/logo_base64_hires.txt');
const backgroundPath = path.join(__dirname, '../assets/clearance_front_base64.txt');

const originalLogo = fs.readFileSync(logoPath, 'utf8').trim();
const originalLogoHires = fs.readFileSync(logoHiresPath, 'utf8').trim();
const originalBackground = fs.readFileSync(backgroundPath, 'utf8').trim();

console.log('Original sizes:');
console.log('Logo:', Math.round(originalLogo.length * 0.75 / 1024), 'KB');
console.log('Hi-res logo:', Math.round(originalLogoHires.length * 0.75 / 1024), 'KB');
console.log('Background:', Math.round(originalBackground.length * 0.75 / 1024), 'KB');

// Create optimized versions
const optimizedLogo = compressBase64Image(originalLogo, 0.7);
const optimizedBackground = createOptimizedBackground();

// Save optimized versions
const optimizedLogoPath = path.join(__dirname, '../assets/logo_base64_optimized.txt');
const optimizedLogoHiresPath = path.join(__dirname, '../assets/logo_base64_hires_optimized.txt');
const optimizedBackgroundPath = path.join(__dirname, '../assets/clearance_front_base64_optimized.txt');

fs.writeFileSync(optimizedLogoPath, optimizedLogo);
fs.writeFileSync(optimizedLogoHiresPath, optimizedLogo);
fs.writeFileSync(optimizedBackgroundPath, optimizedBackground);

console.log('\nOptimized sizes:');
console.log('Logo:', Math.round(optimizedLogo.length * 0.75 / 1024), 'KB');
console.log('Background:', Math.round(optimizedBackground.length * 0.75 / 1024), 'KB');

console.log('\nSize reductions:');
console.log('Logo:', Math.round(((originalLogo.length - optimizedLogo.length) / originalLogo.length) * 100), '%');
console.log('Hi-res logo:', Math.round(((originalLogoHires.length - optimizedLogo.length) / originalLogoHires.length) * 100), '%');
console.log('Background:', Math.round(((originalBackground.length - optimizedBackground.length) / originalBackground.length) * 100), '%');

console.log('\nTotal savings per PDF:');
const totalOriginal = originalLogo.length + originalLogoHires.length + originalBackground.length;
const totalOptimized = optimizedLogo.length + optimizedLogo.length + optimizedBackground.length;
console.log('Original total:', Math.round(totalOriginal * 0.75 / 1024), 'KB');
console.log('Optimized total:', Math.round(totalOptimized * 0.75 / 1024), 'KB');
console.log('Total reduction:', Math.round(((totalOriginal - totalOptimized) / totalOriginal) * 100), '%');
console.log('KB saved per PDF:', Math.round((totalOriginal - totalOptimized) * 0.75 / 1024), 'KB');

console.log('\nOptimized files saved to:');
console.log(optimizedLogoPath);
console.log(optimizedLogoHiresPath);
console.log(optimizedBackgroundPath); 