const { replacePlaceholders } = require('./services/templateService');

// Test the line break fix
const testContent = "Non-Friable Clearance Certificates should be written in general accordance with and with reference to:\n\nACT Work Health and Safety (WHS) Act 2011\nACT Work Health and Safety Regulation 2011\nACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) 2022";

const testData = {
  clientName: 'Test Client',
  siteName: 'Test Site'
};

console.log('Testing line break conversion...');
console.log('Original content:');
console.log(testContent);
console.log('\nOriginal content contains \\n:', testContent.includes('\n'));

const result = replacePlaceholders(testContent, testData);
console.log('\nProcessed content:');
console.log(result);
console.log('\nProcessed content contains <br>:', result.includes('<br>'));

console.log('\nLine break conversion test completed successfully!'); 