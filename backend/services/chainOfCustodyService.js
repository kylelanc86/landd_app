const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { formatDateSydney, nowSydneyDateTime } = require('../utils/dateUtils');

// Load the logo base64 data
const logoPath = path.join(__dirname, '../assets/logo_base64_optimized.txt');
let logoBase64 = '';
try {
  logoBase64 = fs.readFileSync(logoPath, 'utf8').trim();
} catch (error) {
  console.warn('Could not load logo base64 file:', error.message);
  logoBase64 = '';
}

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
    console.log('Template path:', templatePath);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    console.log('Template loaded successfully, size:', htmlTemplate.length);
    
    // Prepare data for template
    console.log('Assessment data received:', {
      projectId: assessment.projectId?._id,
      projectName: assessment.projectId?.name,
      clientName: assessment.projectId?.client?.name,
      clientContact: assessment.projectId?.client?.contact,
      clientEmail: assessment.projectId?.client?.email,
      projectID: assessment.projectId?.projectID,
      assessmentDate: assessment.assessmentDate,
      assessorName: assessment.assessorId ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : 'Unknown',
      itemsCount: assessment.items?.length || 0
    });
    
    const data = {
      CLIENT_NAME: assessment.projectId?.client?.name || 'Unknown Client',
      CLIENT_CONTACT: assessment.projectId?.client?.contact || 'N/A',
      CLIENT_EMAIL: assessment.projectId?.client?.email || 'N/A',
      SITE_NAME: assessment.projectId?.name || 'Unknown Site',
      LD_REFERENCE: assessment.projectId?.projectID || 'LDJOxxxx',
      SAMPLE_DATE: assessment.assessmentDate ? formatDateSydney(assessment.assessmentDate) : 'N/A',
      SAMPLER: assessment.assessorId ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : 'Unknown',
      NUMBER_OF_SAMPLES: assessment.items?.length || 0,
      RECEIVED_BY: 'L&D Laboratory',
      SIGNATURE: '',
      PRINT_DATE: nowSydneyDateTime(),
      SAMPLE_ROWS: generateSampleRows(assessment.items || []),
      LOGO_BASE64: logoBase64
    };
    
    console.log('Template data prepared:', data);
    
    // Replace placeholders in template
    console.log('Replacing placeholders with data:', data);
    Object.keys(data).forEach(key => {
      const placeholder = `[${key}]`;
      const value = data[key];
      console.log(`Replacing ${placeholder} with: ${value}`);
      
      // Use a more robust regex to avoid partial matches
      const regex = new RegExp(`\\[${key}\\]`, 'g');
      if (regex.test(htmlTemplate)) {
        htmlTemplate = htmlTemplate.replace(regex, value);
        console.log(`✓ Replaced ${placeholder}`);
      } else {
        console.log(`✗ Placeholder ${placeholder} not found in template`);
      }
    });
    
    console.log('Template processing completed');
    
    // Check for any remaining placeholders
    const remainingPlaceholders = htmlTemplate.match(/\[.*?\]/g);
    if (remainingPlaceholders) {
      console.log('Warning: Remaining placeholders found:', remainingPlaceholders);
    }
    
    // Launch browser
    console.log('Launching Puppeteer browser...');
    const launchOptions = {
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
      ]
    };
    
    // Add executable path if specified
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      console.log('Using custom Chrome path:', process.env.PUPPETEER_EXECUTABLE_PATH);
    } else {
      console.log('Using default Chrome path');
    }
    
    try {
      browser = await puppeteer.launch(launchOptions);
      console.log('Browser launched successfully');
    } catch (launchError) {
      console.error('Failed to launch browser with default options:', launchError.message);
      
      // Try with different options for Windows
      console.log('Trying alternative launch options...');
      const alternativeOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      };
      
      try {
        browser = await puppeteer.launch(alternativeOptions);
        console.log('Browser launched with alternative options');
      } catch (secondError) {
        console.error('Failed to launch browser with alternative options:', secondError.message);
        throw new Error(`Failed to launch Chrome browser. Please ensure Chrome is installed and accessible. Error: ${secondError.message}`);
      }
    }
    
    const page = await browser.newPage();
    console.log('Page created');
    
    // Set content and wait for it to load
    console.log('Setting page content...');
    console.log('HTML template preview (first 500 chars):', htmlTemplate.substring(0, 500));
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
    console.log('Page content set');
    
    // Wait a bit for any dynamic content to render
    await page.waitForTimeout(1000);
    
    // Generate PDF with more robust settings
    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false
    });
    
    console.log('PDF buffer generated, size:', pdfBuffer.length);
    
    // Validate the PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }
    
    // Check if it's a valid PDF (should start with %PDF)
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    if (pdfHeader !== '%PDF') {
      throw new Error(`Invalid PDF header: ${pdfHeader}`);
    }
    
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
      </tr>
    `);
  }
  
  return rows.join('');
}

module.exports = {
  generateChainOfCustodyPDF
}; 