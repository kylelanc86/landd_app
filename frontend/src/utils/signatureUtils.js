/**
 * Utility functions for handling user signatures in reports
 */

/**
 * Get user signature by user ID
 * @param {string} userId - The user's ID
 * @param {Array} users - Array of users from the system
 * @returns {string|null} - The user's signature image data URL or null if not found
 */
export const getUserSignature = (userId, users) => {
  const user = users.find(u => u._id === userId);
  return user?.signature || null;
};

/**
 * Get user's licences by user ID
 * @param {string} userId - The user's ID
 * @param {Array} users - Array of users from the system
 * @returns {Array} - Array of licences for the user
 */
export const getUserLicences = (userId, users) => {
  const user = users.find(u => u._id === userId);
  return user?.licences || [];
};

/**
 * Format licences for display in reports
 * @param {Array} licences - Array of licences
 * @returns {string} - Formatted string of licences
 */
export const formatLicences = (licences) => {
  if (!licences || licences.length === 0) {
    return 'No licences';
  }
  
  return licences
    .map(licence => `${licence.state}: ${licence.licenceNumber} (${licence.licenceType})`)
    .join(', ');
};

/**
 * Insert signature into a PDF or report
 * @param {string} signatureDataUrl - The signature image as data URL
 * @param {Object} pdfDoc - The PDF document object
 * @param {number} x - X coordinate for signature placement
 * @param {number} y - Y coordinate for signature placement
 * @param {number} width - Width of the signature
 * @param {number} height - Height of the signature
 */
export const insertSignatureIntoPdf = (signatureDataUrl, pdfDoc, x, y, width, height) => {
  if (!signatureDataUrl) {
    console.warn('No signature provided for PDF insertion');
    return;
  }

  try {
    // Convert data URL to base64
    const base64Data = signatureDataUrl.split(',')[1];
    
    // Add image to PDF
    pdfDoc.image(base64Data, x, y, {
      width: width,
      height: height,
      fit: [width, height]
    });
  } catch (error) {
    console.error('Error inserting signature into PDF:', error);
  }
};

/**
 * Validate signature image
 * @param {File} file - The signature file to validate
 * @returns {Object} - Validation result with isValid boolean and error message
 */
export const validateSignatureFile = (file) => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Please select a valid image file (JPEG, PNG, or GIF)' };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be less than 5MB' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Compress signature image to reduce file size
 * @param {string} dataUrl - The signature image as data URL
 * @param {number} maxWidth - Maximum width for the compressed image
 * @param {number} maxHeight - Maximum height for the compressed image
 * @param {number} quality - Image quality (0-1)
 * @returns {Promise<string>} - Compressed image as data URL
 */
export const compressSignatureImage = (dataUrl, maxWidth = 300, maxHeight = 150, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = dataUrl;
  });
}; 