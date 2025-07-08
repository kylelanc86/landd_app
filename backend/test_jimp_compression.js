const { compressBase64Image } = require('./utils/imageCompressor');

// Sample base64 image (small red square)
const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function testCompression() {
  try {
    console.log('Testing Jimp image compression...');
    console.log('Original base64 length:', sampleBase64.length);
    
    const compressed = await compressBase64Image(sampleBase64, 50);
    
    console.log('Compression test completed');
    console.log('Original:', sampleBase64.substring(0, 50) + '...');
    console.log('Compressed:', compressed.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('Compression test failed:', error);
  }
}

testCompression(); 