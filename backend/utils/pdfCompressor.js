const { PDFDocument } = require('pdf-lib');

/**
 * Compress PDF buffer to reduce file size significantly
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed PDF buffer
 */
async function compressPDF(pdfBuffer, options = {}) {
  const {
    imageQuality = 0.5,        // Image compression quality (0.1 to 1.0)
    imageResolution = 150,     // Image resolution in DPI
    removeMetadata = true,     // Remove PDF metadata
    removeAnnotations = true,  // Remove annotations
    removeBookmarks = true,    // Remove bookmarks
    removeAttachments = true,  // Remove file attachments
    removeJavaScript = true,   // Remove JavaScript
    removeForms = true,        // Remove form fields
    removeEmbeddedFonts = false, // Keep fonts for readability
    aggressiveCompression = true // Use aggressive compression settings
  } = options;

  try {
    console.log('Starting PDF compression...');
    console.log('Original PDF size:', Math.round(pdfBuffer.length / 1024), 'KB');

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    // Remove metadata if requested
    if (removeMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());
    }

    // Get all pages
    const pages = pdfDoc.getPages();

    // Process each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      try {
        // Remove annotations if requested
        if (removeAnnotations) {
          const annotations = page.node.Annots();
          if (annotations) {
            page.node.delete('Annots');
          }
        }

        // Remove form fields if requested (handle safely)
        if (removeForms) {
          try {
            const formFields = page.node.AcroForm();
            if (formFields) {
              page.node.delete('AcroForm');
            }
          } catch (formError) {
            console.log('No form fields to remove on page', i + 1);
          }
        }
      } catch (pageError) {
        console.log('Error processing page', i + 1, ':', pageError.message);
      }
    }

    // Remove bookmarks if requested
    if (removeBookmarks) {
      try {
        const outline = pdfDoc.catalog.get(PDFDocument.Keywords.Outlines);
        if (outline) {
          pdfDoc.catalog.delete(PDFDocument.Keywords.Outlines);
        }
      } catch (error) {
        console.log('No bookmarks to remove');
      }
    }

    // Remove JavaScript if requested
    if (removeJavaScript) {
      try {
        const names = pdfDoc.catalog.get(PDFDocument.Keywords.Names);
        if (names) {
          const js = names.get(PDFDocument.Keywords.JavaScript);
          if (js) {
            names.delete(PDFDocument.Keywords.JavaScript);
          }
        }
      } catch (error) {
        console.log('No JavaScript to remove');
      }
    }

    // Remove file attachments if requested
    if (removeAttachments) {
      try {
        const names = pdfDoc.catalog.get(PDFDocument.Keywords.Names);
        if (names) {
          const embeddedFiles = names.get(PDFDocument.Keywords.EmbeddedFiles);
          if (embeddedFiles) {
            names.delete(PDFDocument.Keywords.EmbeddedFiles);
          }
        }
      } catch (error) {
        console.log('No file attachments to remove');
      }
    }

    // Save with compression settings
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 20,
      updateFieldAppearances: false,
      throwOnInvalidObject: false,
      imageQuality: imageQuality,
      imageResolution: imageResolution,
      embedFonts: !removeEmbeddedFonts,
      compress: true
    });

    const compressedBuffer = Buffer.from(compressedPdfBytes);
    
    console.log('Compressed PDF size:', Math.round(compressedBuffer.length / 1024), 'KB');
    console.log('Size reduction:', Math.round(((pdfBuffer.length - compressedBuffer.length) / pdfBuffer.length) * 100), '%');
    console.log('KB saved:', Math.round((pdfBuffer.length - compressedBuffer.length) / 1024), 'KB');

    return compressedBuffer;

  } catch (error) {
    console.error('Error compressing PDF:', error);
    return pdfBuffer;
  }
}

/**
 * Apply aggressive compression for maximum file size reduction
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @returns {Promise<Buffer>} - Heavily compressed PDF buffer
 */
async function aggressiveCompressPDF(pdfBuffer) {
  return compressPDF(pdfBuffer, {
    imageQuality: 0.2,           // Very low image quality for max compression
    imageResolution: 72,         // Low resolution (screen resolution)
    removeMetadata: true,
    removeAnnotations: true,
    removeBookmarks: true,
    removeAttachments: true,
    removeJavaScript: true,
    removeForms: true,
    removeEmbeddedFonts: false,  // Keep fonts for readability
    aggressiveCompression: true
  });
}

/**
 * Apply moderate compression for balance of size and quality
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @returns {Promise<Buffer>} - Moderately compressed PDF buffer
 */
async function moderateCompressPDF(pdfBuffer) {
  return compressPDF(pdfBuffer, {
    imageQuality: 0.6,           // Medium image quality
    imageResolution: 150,        // Medium resolution
    removeMetadata: true,
    removeAnnotations: true,
    removeBookmarks: true,
    removeAttachments: true,
    removeJavaScript: true,
    removeForms: true,
    removeEmbeddedFonts: false,
    aggressiveCompression: false
  });
}

/**
 * Ultra aggressive compression using multiple techniques
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @returns {Promise<Buffer>} - Ultra compressed PDF buffer
 */
async function ultraCompressPDF(pdfBuffer) {
  console.log('Applying ultra aggressive compression...');
  
  try {
    // First pass: aggressive compression
    let compressed = await aggressiveCompressPDF(pdfBuffer);
    
    // Second pass: try with even lower quality
    compressed = await compressPDF(compressed, {
      imageQuality: 0.1,           // Extremely low image quality
      imageResolution: 72,         // Screen resolution
      removeMetadata: true,
      removeAnnotations: true,
      removeBookmarks: true,
      removeAttachments: true,
      removeJavaScript: true,
      removeForms: true,
      removeEmbeddedFonts: false,
      aggressiveCompression: true
    });
    
    // Third pass: try with different save options
    const pdfDoc = await PDFDocument.load(compressed, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    
    const finalBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 10,          // Lower for more compression
      updateFieldAppearances: false,
      throwOnInvalidObject: false,
      imageQuality: 0.1,
      imageResolution: 72,
      embedFonts: true,
      compress: true,
      // Additional compression options
      deflateLevel: 9,             // Maximum deflate compression
      objectStreamMode: 'preserve' // Preserve object streams
    });
    
    const finalBuffer = Buffer.from(finalBytes);
    
    console.log('Ultra compressed PDF size:', Math.round(finalBuffer.length / 1024), 'KB');
    console.log('Total size reduction:', Math.round(((pdfBuffer.length - finalBuffer.length) / pdfBuffer.length) * 100), '%');
    console.log('Total KB saved:', Math.round((pdfBuffer.length - finalBuffer.length) / 1024), 'KB');
    
    return finalBuffer;
    
  } catch (error) {
    console.error('Error in ultra compression:', error);
    // Fall back to aggressive compression
    return aggressiveCompressPDF(pdfBuffer);
  }
}

module.exports = {
  compressPDF,
  aggressiveCompressPDF,
  moderateCompressPDF,
  ultraCompressPDF
}; 