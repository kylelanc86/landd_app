const axios = require('axios');

// Simple test data
const simpleTestData = {
  _id: 'simple-test-123',
  projectId: {
    name: 'Simple Test Site',
    projectID: 'TEST-001',
    client: {
      name: 'Test Client'
    }
  },
  clearanceDate: '2024-01-15',
  clearanceType: 'Non-friable',
  LAA: 'Test LAA',
  clearanceItems: [
    {
      itemDescription: 'Test Item',
      locationDescription: 'Test Location',
      materialDescription: 'Test Material',
      asbestosType: 'non-friable'
    }
  ]
};

async function testSimpleBrowserless() {
  try {
    console.log('=== Testing Simple Browserless PDF Generation ===');
    
    const response = await axios.post('http://localhost:5000/api/pdf-browserless-simple/generate-simple-clearance', {
      clearanceData: simpleTestData
    }, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });
    
    console.log('✅ Simple PDF generated successfully!');
    console.log('Response status:', response.status);
    console.log('PDF size:', response.data.length, 'bytes');
    
    // Save the PDF for inspection
    const fs = require('fs');
    fs.writeFileSync('test-simple-browserless.pdf', response.data);
    console.log('✅ PDF saved as test-simple-browserless.pdf');
    
  } catch (error) {
    console.error('❌ Error testing simple browserless PDF generation:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data.toString());
    }
  }
}

// Run the test
testSimpleBrowserless(); 