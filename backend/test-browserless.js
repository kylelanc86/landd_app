const axios = require('axios');

// Test data for clearance report
const testClearanceData = {
  _id: 'test-clearance-123',
  projectId: {
    _id: 'test-project-123',
    name: 'Test Site - 123 Main Street',
    projectID: 'PRJ-2024-001',
    client: {
      _id: 'test-client-123',
      name: 'Test Client Pty Ltd'
    }
  },
  clearanceDate: '2024-01-15',
  inspectionTime: '14:30',
  clearanceType: 'Non-friable',
  LAA: 'John Smith',
  asbestosRemovalist: 'ABC Asbestos Removal',
  airMonitoring: false,
  sitePlan: false,
  clearanceItems: [
    {
      itemDescription: 'Vinyl floor tiles',
      locationDescription: 'Kitchen',
      materialDescription: 'Vinyl floor tiles with asbestos backing',
      asbestosType: 'non-friable',
      photograph: null,
      notes: 'Successfully removed and area cleaned'
    },
    {
      itemDescription: 'Vinyl floor tiles',
      locationDescription: 'Bathroom',
      materialDescription: 'Vinyl floor tiles with asbestos backing',
      asbestosType: 'non-friable',
      photograph: null,
      notes: 'Successfully removed and area cleaned'
    }
  ]
};

async function testBrowserlessPDF() {
  try {
    console.log('=== Testing Browserless PDF Generation ===');
    console.log('Test data:', JSON.stringify(testClearanceData, null, 2));
    
    const response = await axios.post('http://localhost:5000/api/pdf-browserless/generate-asbestos-clearance', {
      clearanceData: testClearanceData
    }, {
      responseType: 'arraybuffer',
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ PDF generated successfully!');
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('PDF size:', response.data.length, 'bytes');
    
    // Save the PDF for inspection
    const fs = require('fs');
    fs.writeFileSync('test-browserless-clearance.pdf', response.data);
    console.log('✅ PDF saved as test-browserless-clearance.pdf');
    
  } catch (error) {
    console.error('❌ Error testing browserless PDF generation:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data.toString());
    }
  }
}

// Run the test
testBrowserlessPDF(); 