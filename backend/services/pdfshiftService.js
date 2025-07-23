const fetch = require('node-fetch');

class PDFShiftService {
  constructor() {
    this.apiKey = process.env.PDFSHIFT_API_KEY;
    this.apiUrl = 'https://api.pdfshift.io/v3/convert/pdf';
  }

  /**
   * Generate PDF from HTML content using PDFShift API
   * @param {string} htmlContent - The HTML content to convert
   * @param {Object} options - PDF generation options
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generatePDF(htmlContent, options = {}) {
    try {
      console.log('Starting PDFShift PDF generation...');
      
      if (!this.apiKey) {
        throw new Error('PDFSHIFT_API_KEY environment variable is not set');
      }

      const requestBody = {
        source: htmlContent,
        ...options
      };

      console.log('PDFShift options:', {
        hasCustomCSS: !!options.css,
        hasWatermark: !!options.watermark,
        hasHeader: !!options.header,
        hasFooter: !!options.footer
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDFShift API error:', response.status, errorText);
        throw new Error(`PDFShift API error: ${response.status} - ${errorText}`);
      }

      const pdfBuffer = await response.buffer();
      
      console.log('PDFShift PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return pdfBuffer;
      
    } catch (error) {
      console.error('PDFShift PDF generation failed:', error);
      throw new Error(`PDFShift PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF with custom CSS
   * @param {string} htmlContent - The HTML content
   * @param {string} cssContent - Custom CSS content
   * @param {Object} options - Additional options
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generatePDFWithCSS(htmlContent, cssContent, options = {}) {
    return this.generatePDF(htmlContent, {
      ...options,
      css: cssContent
    });
  }

  /**
   * Generate PDF with header and footer
   * @param {string} htmlContent - The HTML content
   * @param {Object} options - Options including header and footer
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generatePDFWithHeaderFooter(htmlContent, options = {}) {
    return this.generatePDF(htmlContent, {
      ...options,
      header: options.header,
      footer: options.footer
    });
  }

  /**
   * Test PDFShift connection
   * @returns {Promise<boolean>} - True if connection works
   */
  async testConnection() {
    try {
      const testHTML = '<html><body><h1>PDFShift Test</h1><p>This is a test PDF.</p></body></html>';
      const pdfBuffer = await this.generatePDF(testHTML);
      return pdfBuffer && pdfBuffer.length > 0;
    } catch (error) {
      console.error('PDFShift connection test failed:', error);
      return false;
    }
  }
}

module.exports = PDFShiftService; 