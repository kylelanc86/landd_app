const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Generate Chain of Custody PDF for an asbestos assessment
 * @param {Object} assessment - The asbestos assessment object with populated project and assessor
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateChainOfCustodyPDF(assessment) {
  let browser;
  try {
    console.log('Generating Chain of Custody PDF for assessment:', assessment._id);
    
    // Load the HTML template
    const templatePath = path.join(__dirname, '../templates/AsbestosAssessment/ChainOfCustody.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Prepare data for template
    const data = {
      CLIENT_NAME: assessment.projectId?.client?.name || 'Unknown Client',
      CLIENT_CONTACT: assessment.projectId?.client?.contact || 'N/A',
      CLIENT_EMAIL: assessment.projectId?.client?.email || 'N/A',
      SITE_NAME: assessment.projectId?.name || 'Unknown Site',
      L&D_REFERENCE: assessment.projectId?.projectID || 'LDJOxxxx',
      SAMPLE_DATE: assessment.assessmentDate ? new Date(assessment.assessmentDate).toLocaleDateString('en-GB') : 'N/A',
      SAMPLER: assessment.assessorId ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : 'Unknown',
      NUMBER_OF_SAMPLES: assessment.items?.length || 0,
      RECEIVED_BY: 'L&D Laboratory',
      SIGNATURE: '',
      PRINT_DATE: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      SAMPLE_ROWS: generateSampleRows(assessment.items || [])
    };
    
    // Replace placeholders in template
    Object.keys(data).forEach(key => {
      const placeholder = `[${key}]`;
      htmlTemplate = htmlTemplate.replace(new RegExp(placeholder, 'g'), data[key]);
    });
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for it to load
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });
    
    console.log('Chain of Custody PDF generated successfully');
    return pdfBuffer;
    
  } catch (error) {
    console.error('Error generating Chain of Custody PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate sample rows for the Chain of Custody table
 * @param {Array} items - Array of assessment items
 * @returns {string} - HTML string for table rows
 */
function generateSampleRows(items) {
  if (!items || items.length === 0) {
    // Return empty rows if no items
    return Array(10).fill(`
      <tr>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `).join('');
  }
  
  // Generate rows for each item
  const rows = items.map((item, index) => {
    const sampleRef = item.sampleReference || `Sample ${index + 1}`;
    const sampleType = item.materialType || 'Unknown';
    
    return `
      <tr>
        <td>${sampleRef}</td>
        <td>${sampleType}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;
  });
  
  // Add empty rows to fill the table (minimum 10 rows)
  const minRows = 10;
  const additionalRows = Math.max(0, minRows - rows.length);
  
  for (let i = 0; i < additionalRows; i++) {
    rows.push(`
      <tr>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `);
  }
  
  return rows.join('');
}

module.exports = {
  generateChainOfCustodyPDF
}; 