const fetch = require('node-fetch');

class DocRaptorService {
  constructor() {
    this.apiKey = process.env.DOCRAPTOR_API_KEY;
    this.apiUrl = 'https://docraptor.com/docs';
    
    // Debug logging
    console.log('DocRaptor Service initialized:');
    console.log('- API Key exists:', !!this.apiKey);
    console.log('- API Key length:', this.apiKey ? this.apiKey.length : 0);
    console.log('- API Key preview:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'undefined');
    console.log('- API URL:', this.apiUrl);
  }

  /**
   * Generate PDF from HTML content using DocRaptor API
   * @param {string} htmlContent - The HTML content to convert
   * @param {Object} options - PDF generation options
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generatePDF(htmlContent, options = {}) {
    try {
      console.log('Starting DocRaptor PDF generation...');
      
      if (!this.apiKey) {
        throw new Error('DOCRAPTOR_API_KEY environment variable is not set');
      }

      // Clean HTML content to remove file system references
      const cleanedHtml = htmlContent
        .replace(/file:\/\/[^\s"']+/g, '') // Remove file:// URLs
        .replace(/src="\/frontend\/public\/[^"]*"/g, 'src=""') // Remove /frontend/public/ references
        .replace(/src="\/[^"]*\.(jpg|jpeg|png|gif|svg|bmp)"[^>]*>/g, 'src=""') // Remove absolute path image references
        .replace(/src="[^"]*\.(jpg|jpeg|png|gif|svg|bmp)"[^>]*>/g, (match) => {
          // Convert local file references to base64 or remove them
          if (match.includes('file://') || match.includes('C:\\') || match.includes('/frontend/') || match.includes('/public/')) {
            return match.replace(/src="[^"]*"/, 'src=""');
          }
          return match;
        });

      const requestBody = {
        document_content: cleanedHtml,
        document_type: 'pdf',
        test: process.env.NODE_ENV === 'development', // Use test mode in development
        // Page formatting options for DocRaptor
        page_size: 'A4',
        page_margin: '0.25in', // Small margin to prevent content from edge
        // Use CSS for page breaks instead of DocRaptor's built-in system
        css: `
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .page {
            page-break-after: always;
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
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
        ...options
      };

      console.log('DocRaptor options:', {
        documentType: requestBody.document_type,
        test: requestBody.test,
        hasCustomCSS: !!options.css,
        hasHeader: !!options.header,
        hasFooter: !!options.footer
      });

      console.log('Making DocRaptor API request:');
      console.log('- URL:', this.apiUrl);
      console.log('- API Key preview:', `${this.apiKey.substring(0, 10)}...`);
      console.log('- Request body size:', JSON.stringify(requestBody).length, 'characters');

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
          console.error('DocRaptor API request timed out after 30 seconds');
          throw new Error('DocRaptor API request timed out. Please try again.');
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