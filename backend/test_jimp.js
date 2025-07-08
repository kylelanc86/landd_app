const { Jimp } = require('jimp');

async function testJimp() {
  try {
    console.log('Testing Jimp import...');
    console.log('Jimp object:', typeof Jimp);
    console.log('Jimp.read function:', typeof Jimp.read);
    
    // Create a simple test image using Jimp.create
    const image = await Jimp.create(100, 100, 0xFF0000FF);
    console.log('Created test image successfully');
    
    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    console.log('Generated buffer successfully, size:', buffer.length);
    
    console.log('Jimp test completed successfully');
  } catch (error) {
    console.error('Jimp test failed:', error);
  }
}

testJimp(); 