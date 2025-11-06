/**
 * Compress image to reduce file size while maintaining quality
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 1200)
 * @param {number} options.maxHeight - Maximum height (default: 1200)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.8)
 * @param {number} options.maxSizeKB - Maximum file size in KB (default: 500)
 * @returns {Promise<string>} - Compressed image as base64 data URL
 */
export const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 1000,
      maxHeight = 1000,
      quality = 0.75,
      maxSizeKB = 300
    } = options;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw and compress image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64 with quality setting
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      // If still too large, reduce quality further
      const sizeKB = (compressedDataUrl.length * 0.75) / 1024; // Approximate size
      
      if (sizeKB > maxSizeKB && quality > 0.4) {
        const newQuality = Math.max(0.4, quality * (maxSizeKB / sizeKB));
        compressedDataUrl = canvas.toDataURL('image/jpeg', newQuality);
      }

      console.log(`Image compressed: ${file.size / 1024}KB -> ${(compressedDataUrl.length * 0.75) / 1024}KB`);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Get file size in KB
 * @param {string} base64DataUrl - Base64 data URL
 * @returns {number} - File size in KB
 */
export const getBase64SizeKB = (base64DataUrl) => {
  return (base64DataUrl.length * 0.75) / 1024;
};

/**
 * Check if image needs compression
 * @param {File} file - The image file to check
 * @param {number} maxSizeKB - Maximum size in KB (default: 500)
 * @returns {boolean} - True if compression is needed
 */
export const needsCompression = (file, maxSizeKB = 500) => {
  return file.size / 1024 > maxSizeKB;
};

/**
 * Save a file to the device storage (full-size original)
 * Uses File System Access API if available, otherwise falls back to download
 * @param {File|Blob} file - The file to save
 * @param {string} filename - The filename to use
 * @returns {Promise<void>}
 */
export const saveFileToDevice = async (file, filename) => {
  try {
    // Try to use File System Access API (modern browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Image files',
              accept: {
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/png': ['.png'],
                'image/webp': ['.webp'],
              },
            },
          ],
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        return;
      } catch (error) {
        // User cancelled the save dialog, silently fail
        if (error.name === 'AbortError') {
          return;
        }
        // Otherwise fall through to download method
      }
    }

    // Fallback: Create download link
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error saving file to device:', error);
    throw error;
  }
}; 