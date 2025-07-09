const { replacePlaceholders } = require('../services/templateService');

async function testBulletPoints() {
  console.log('=== BULLET POINT TEST ===');
  
  // Test content with bullet points - using the exact format from database
  const testContent = `This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. The following items were noted:

Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.

The removal area does not pose a risk to health and safety from exposure to asbestos.`;

  console.log('Original content:');
  console.log('Content length:', testContent.length);
  console.log('Line breaks:', (testContent.match(/\n/g) || []).length);
  console.log('Double line breaks:', (testContent.match(/\n\n/g) || []).length);
  console.log(testContent);
  console.log('\n---\n');
  
  // Test with sample data
  const sampleData = {
    projectId: { name: 'Test Site' },
    clearanceType: 'Non-friable'
  };
  
  const result = await replacePlaceholders(testContent, sampleData);
  
  console.log('Processed content:');
  console.log(result);
  console.log('\n---\n');
  
  // Check if bullets were converted
  if (result.includes('<ul class="bullets">')) {
    console.log('✅ Bullet points were converted to HTML');
  } else {
    console.log('❌ Bullet points were NOT converted to HTML');
  }
  
  if (result.includes('<li>')) {
    console.log('✅ List items were created');
  } else {
    console.log('❌ List items were NOT created');
  }
  
  // Test with a simpler pattern
  console.log('\n=== SIMPLE PATTERN TEST ===');
  const simpleContent = `Some intro text. The following items were noted:

Item 1: Description of item 1.

Item 2: Description of item 2.`;
  
  const simpleResult = await replacePlaceholders(simpleContent, sampleData);
  console.log('Simple result:', simpleResult);
}

testBulletPoints().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 