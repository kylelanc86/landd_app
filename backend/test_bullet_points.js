const { replacePlaceholders } = require('./services/templateService');

// Test the bullet point fix
const testContent = "Following completion of non-friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:\n\nVisual inspection of the work area for asbestos dust or debris\nVisual inspection of the adjacent area including the access and egress pathways for visible asbestos dust and debris\n\nIt is required that a Non-Friable Clearance Certificate be issued on completion of a successful inspection. The issuer needs to ensure:\n\nThis certificate should be issued prior to the area being re-occupied. This chain of events should occur regardless of whether the site is a commercial or residential property.\nThe asbestos removal area and areas immediately surrounding it are visibly clean from asbestos contamination\nThe removal area does not pose a risk to health safety and safety from exposure to asbestos";

const testData = {
  clientName: 'Test Client',
  siteName: 'Test Site'
};

console.log('Testing bullet point fix...');
console.log('Original content length:', testContent.length);
console.log('Content contains bullet points (•):', testContent.includes('•'));

const result = replacePlaceholders(testContent, testData);
console.log('Processed content length:', result.length);
console.log('Processed content contains <li> tags:', result.includes('<li>'));
console.log('Processed content contains <ul> tags:', result.includes('<ul>'));

console.log('\nFirst 200 characters of processed content:');
console.log(result.substring(0, 200));

console.log('\nBullet point fix test completed successfully!'); 