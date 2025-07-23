const PDFShift = require('pdfshift');

class PDFShiftService {
  constructor() {
    this.client = PDFShift(process.env.PDFSHIFT_API_KEY);
  }

  /**
   * Generate PDF from HTML content
   * @param {string} htmlContent - The HTML content to convert
   * @param {Object} options - PDF generation options
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generatePDF(htmlContent, options = {}) {
    try {
      console.log('Starting PDFShift PDF generation...');
      
      console.log('PDFShift options:', {
        filename: options.filename,
        hasCustomCSS: !!options.css,
        hasWatermark: !!options.watermark,
        hasHeader: !!options.header,
        hasFooter: !!options.footer
      });

      // Use the prepare() method for advanced options
      let pdfRequest = this.client.prepare(htmlContent);
      
      // Add custom CSS if provided
      if (options.css) {
        pdfRequest = pdfRequest.css(options.css);
      }
      
      // Add header if provided
      if (options.header) {
        pdfRequest = pdfRequest.header(options.header);
      }
      
      // Add footer if provided
      if (options.footer) {
        pdfRequest = pdfRequest.footer(options.footer);
      }
      
      // Add watermark if provided
      if (options.watermark) {
        pdfRequest = pdfRequest.watermark(options.watermark);
      }

      const pdfBuffer = await pdfRequest.convert();
      
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