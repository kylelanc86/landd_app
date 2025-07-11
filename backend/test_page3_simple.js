const axios = require('axios');

async function testPage3Overflow() {
  console.log('Testing Page 3 overflow functionality via API...');
  
  try {
    // Test the existing test endpoint
    const response = await axios.get('http://localhost:5000/api/pdf/test-page3-split');
    
    console.log('✅ SUCCESS: Server is running and responding');
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
    if (response.data.pages && response.data.pages.length > 1) {
      console.log('✅ SUCCESS: Page 3 overflow detection is working');
      console.log(`   Generated ${response.data.pages.length} pages`);
    } else {
      console.log('ℹ️  INFO: Page 3 content fits on single page');
    }
    
  } catch (error) {
    console.error('❌ ERROR testing page 3 overflow:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 TIP: Make sure the server is running with: npm start');
    }
  }
}

testPage3Overflow(); 