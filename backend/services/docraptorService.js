const fetch = require('node-fetch');

class DocRaptorService {
  constructor() {
    this.apiKey = process.env.DOCRAPTOR_API_KEY;
    this.apiUrl = 'https://docraptor.com/docs';
  }

  /**
   * Generate PDF from HTML content using DocRaptor API
   * @param {string} htmlContent - The HTML content to convert
   * @param {Object} options - PDF generation options
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generatePDF(htmlContent, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('DOCRAPTOR_API_KEY environment variable is not set');
      }

      // DocRaptor sync generation limit is 60s; allow 90s+ for upload/download on slow connections
      const { timeoutMs: optionsTimeout, ...docraptorOptions } = options;
      const envTimeout = parseInt(process.env.DOCRAPTOR_TIMEOUT_MS, 10);
      const timeoutMs = optionsTimeout != null ? optionsTimeout : (isNaN(envTimeout) ? 90000 : envTimeout);

      // Clean HTML content to remove only problematic file system references
      const cleanedHtml = htmlContent
        .replace(/file:\/\/[^\s"']+/g, '') // Remove file:// URLs
        .replace(/src="\/frontend\/public\/[^"]*"/g, 'src=""'); // Remove /frontend/public/ references only

      const requestBody = {
        document_content: cleanedHtml,
        document_type: 'pdf',
        test: process.env.NODE_ENV === 'development', // Use test mode in development
        // Security options to prevent text selection/copying
        security: {
          no_copy: true,        // Prevents text selection/copying
          no_print: false,      // Keeps printing enabled
          no_modify: false,     // Keep modifications enabled
          no_annotations: false // Keep annotations enabled
        },
        // Page formatting options for DocRaptor
        page_size: 'A4',
        page_margin: '0in', // NO DocRaptor margins - let CSS handle everything
        // Use CSS for page breaks instead of DocRaptor's built-in system
        css: `
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: "Gothic", Arial, sans-serif;
            width: 100%;
            height: 100%;
          }
          .page {
            page-break-after: always;
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            position: relative;
          }
          .page:last-child {
            page-break-after: avoid;
          }
        `,
        // Disable default headers/footers
        header_html: null,
        footer_html: null,
        // Ensure content fills the page properly
        javascript: false, // Disable JavaScript for better compatibility
        ...docraptorOptions
      };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DocRaptor API error:', response.status, errorText);
        throw new Error(`DocRaptor API error: ${response.status} - ${errorText}`);
      }

      const pdfBuffer = await response.buffer();

      console.log('DocRaptor PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return pdfBuffer;

      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error(`DocRaptor API request timed out after ${timeoutMs / 1000} seconds`);
          throw new Error(`DocRaptor API request timed out after ${timeoutMs / 1000} seconds. Please try again.`);
        }
        throw fetchError;
      }
      
    } catch (error) {
      console.error('DocRaptor PDF generation failed:', error);
      throw new Error(`DocRaptor PDF generation failed: ${error.message}`);
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
   * Test DocRaptor connection
   * @returns {Promise<boolean>} - True if connection works
   */
  async testConnection() {
    try {
      const testHTML = '<html><body><h1>DocRaptor Test</h1><p>This is a test PDF.</p></body></html>';
      const pdfBuffer = await this.generatePDF(testHTML);
      return pdfBuffer && pdfBuffer.length > 0;
    } catch (error) {
      console.error('DocRaptor connection test failed:', error);
      return false;
    }
  }
}

module.exports = DocRaptorService; 