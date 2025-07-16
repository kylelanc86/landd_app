const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Chrome for local development...');

// Check if we're on Windows
const isWindows = process.platform === 'win32';

if (isWindows) {
  console.log('Detected Windows system');
  
  // Common Chrome paths on Windows
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  
  let chromeFound = false;
  
  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      console.log(`Chrome found at: ${chromePath}`);
      console.log(`Set environment variable: PUPPETEER_EXECUTABLE_PATH=${chromePath}`);
      chromeFound = true;
      break;
    }
  }
  
  if (!chromeFound) {
    console.log('Chrome not found in common locations.');
    console.log('Please install Google Chrome or set PUPPETEER_EXECUTABLE_PATH manually.');
    console.log('You can download Chrome from: https://www.google.com/chrome/');
  }
} else {
  console.log('Detected non-Windows system');
  console.log('Chrome should be available via package manager or system installation.');
  console.log('If you encounter issues, install Chrome and set PUPPETEER_EXECUTABLE_PATH.');
}

console.log('\nTo run the app with Chrome support:');
console.log('1. Install Google Chrome if not already installed');
console.log('2. Set environment variable: PUPPETEER_EXECUTABLE_PATH=<path-to-chrome>');
console.log('3. Restart your development server'); 