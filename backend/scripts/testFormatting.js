const { replacePlaceholders } = require('../services/templateService');

async function testFormatting() {
  console.log('=== FORMATTING TEST ===');
  
  // Test content with multiple consecutive bullet points
  const testContent = `This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. The following items were noted:

[BULLET]Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.

[BULLET]The removal area does not pose a risk to health and safety from exposure to asbestos.

[BULLET]All visible asbestos debris has been removed from the area.

**Important Note:** This is bold text to highlight important information.

You can also use [BR] for explicit line breaks like this.`;

  console.log('Original content with formatting codes:');
  console.log(testContent);
  console.log('\n---\n');
  
  // Test with sample data
  const sampleData = {
    projectId: { name: 'Test Site' },
    clearanceType: 'Non-friable'
  };
  
  const result = await replacePlaceholders(testContent, sampleData);
  
  console.log('Processed content with HTML:');
  console.log(result);
  console.log('\n---\n');
  
  // Check if formatting was applied
  if (result.includes('<ul class="bullets">')) {
    console.log('✅ Bullet points were created');
  } else {
    console.log('❌ Bullet points were NOT created');
  }
  
  if (result.includes('<strong>')) {
    console.log('✅ Bold text was created');
  } else {
    console.log('❌ Bold text was NOT created');
  }
  
  // Count ul elements to see if they're grouped
  const ulCount = (result.match(/<ul class="bullets">/g) || []).length;
  const liCount = (result.match(/<li>/g) || []).length;
  console.log(`📊 Found ${ulCount} ul elements and ${liCount} li elements`);
  
  console.log('\n=== FORMATTING GUIDE ===');
  console.log('Use these codes in your template fields:');
  console.log('- [BULLET] at the start of a line to create a bullet point');
  console.log('- **text** to make text bold');
  console.log('- [BR] for explicit line breaks');
}

testFormatting().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 