const fs = require('fs');
const path = require('path');

// Import Jimp with proper error handling
let Jimp;
try {
  Jimp = require('jimp').Jimp;
} catch (error) {
  console.error('Failed to import Jimp:', error);
  Jimp = null;
}

/**
 * Compress base64 image by reducing quality and resolution to target size
 * @param {string} base64String - Original base64 image string
 * @param {number} targetSizeKB - Target size in KB (default 100KB)
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Promise<string>} - Compressed base64 string
 */
async function compressBase64Image(base64String, targetSizeKB = 100, maxWidth = 800, maxHeight = 600) {
  try {
    // Check if Jimp is available
    if (!Jimp) {
      console.log('Jimp not available, returning original image');
      return base64String;
    }

    // Extract the data part from base64 string
    const dataMatch = base64String.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataMatch) {
      console.log('Invalid base64 string format');
      return base64String;
    }

    const mimeType = dataMatch[1];
    const base64Data = dataMatch[2];

    // Only process image types
    if (!mimeType.startsWith('image/')) {
      console.log('Not an image, skipping compression');
      return base64String;
    }

    console.log('Original base64 length:', base64Data.length);
    console.log('Image type:', mimeType);
    console.log('Original image size (KB):', Math.round(base64Data.length * 0.75 / 1024));

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Load image with Jimp
    let image;
    try {
      image = await Jimp.read(imageBuffer);
    } catch (readError) {
      console.error('Error reading image with Jimp:', readError);
      return base64String;
    }
    
    // Debug: Check if image is a valid Jimp instance
    console.log('Type of image:', typeof image);
    console.log('Image bitmap:', image.bitmap);
    if (!image || !image.bitmap) {
      console.error('Jimp.read did not return a valid Jimp image instance:', image);
      return base64String;
    }
    
    // Get original dimensions from bitmap
    const originalWidth = image.bitmap.width;
    const originalHeight = image.bitmap.height;
    
    console.log('Original dimensions:', originalWidth, 'x', originalHeight);
    
    // Resize if needed
    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      // Ensure maxWidth and maxHeight are valid numbers
      const validMaxWidth = typeof maxWidth === 'number' && maxWidth > 0 ? maxWidth : 800;
      const validMaxHeight = typeof maxHeight === 'number' && maxHeight > 0 ? maxHeight : 600;
      
      try {
        image.scaleToFit(validMaxWidth, validMaxHeight);
        console.log('Resized to:', image.bitmap.width, 'x', image.bitmap.height);
      } catch (resizeError) {
        console.error('Error resizing image:', resizeError);
        // Continue without resizing
      }
    }

    // Always convert to JPEG for compression
    let quality = 90; // Start with high quality
    let compressedBuffer;
    let compressedBase64;
    let currentSizeKB;
    let tempImage = image;

    do {
      // Type check for Jimp image
      if (!tempImage || typeof tempImage.getBufferAsync !== 'function') {
        console.warn('tempImage is not a valid Jimp image. Skipping compression.');
        return base64String;
      }
      // Convert to JPEG buffer
      compressedBuffer = await tempImage.getBufferAsync(Jimp.MIME_JPEG);
      // Reload as Jimp image to apply quality
      tempImage = await Jimp.read(compressedBuffer);
      tempImage.quality(quality);
      compressedBuffer = await tempImage.getBufferAsync(Jimp.MIME_JPEG);
      compressedBase64 = compressedBuffer.toString('base64');
      currentSizeKB = Math.round(compressedBase64.length * 0.75 / 1024);
      console.log(`Quality ${quality}% -> ${currentSizeKB}KB`);
      quality -= 10;
      if (quality < 10) {
        console.log('Reached minimum quality (10%)');
        break;
      }
    } while (currentSizeKB > targetSizeKB);

    const compressedMimeType = 'image/jpeg';
    console.log('Final compressed base64 length:', compressedBase64.length);
    console.log('Final compressed image size (KB):', currentSizeKB);
    const reduction = Math.round(((base64Data.length - compressedBase64.length) / base64Data.length) * 100);
    console.log('Compression achieved:', reduction + '%');
    if (currentSizeKB > targetSizeKB) {
      console.log(`WARNING: Could not compress to ${targetSizeKB}KB, final size: ${currentSizeKB}KB`);
    } else {
      console.log(`SUCCESS: Compressed to ${currentSizeKB}KB (target: ${targetSizeKB}KB)`);
    }
    return `data:${compressedMimeType};base64,${compressedBase64}`;
  } catch (error) {
    console.error('Error compressing base64 image:', error);
    return base64String;
  }
}

/**
 * Compress all base64 images in HTML content
 * @param {string} htmlContent - HTML content with base64 images
 * @param {number} targetSizeKB - Target size in KB for each image (default 100KB)
 * @returns {Promise<string>} - HTML content with compressed images
 */
async function compressImagesInHTML(htmlContent, targetSizeKB = 100) {
  try {
    // Find all base64 image references
    const base64Regex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
    const matches = htmlContent.match(base64Regex);
    
    if (!matches) {
      console.log('No base64 images found in HTML');
      return htmlContent;
    }

    console.log('Found', matches.length, 'base64 images in HTML');
    console.log('Target size per image:', targetSizeKB + 'KB');
    
    let compressedHTML = htmlContent;
    
    // Compress each image
    for (let i = 0; i < matches.length; i++) {
      const originalImage = matches[i];
      console.log(`Compressing image ${i + 1}/${matches.length}...`);
      
      const compressedImage = await compressBase64Image(originalImage, targetSizeKB, 800, 600);
      
      // Replace in HTML
      compressedHTML = compressedHTML.replace(originalImage, compressedImage);
    }
    
    console.log('Image compression completed');
    return compressedHTML;
    
  } catch (error) {
    console.error('Error compressing images in HTML:', error);
    return htmlContent;
  }
}

/**
 * Create optimized base64 assets with reduced quality
 * @param {string} sourcePath - Path to original base64 file
 * @param {string} outputPath - Path to save compressed version
 * @param {number} quality - Compression quality (0.1 to 1.0)
 */
async function createOptimizedBase64Asset(sourcePath, outputPath, quality = 0.7) {
  try {
    console.log(`Creating optimized asset: ${sourcePath} -> ${outputPath}`);
    
    // Read original base64
    const originalBase64 = fs.readFileSync(sourcePath, 'utf8').trim();
    
    // Compress the image
    const compressedBase64 = await compressBase64Image(originalBase64, quality);
    
    // Write compressed version
    fs.writeFileSync(outputPath, compressedBase64);
    
    const originalSize = Math.round(originalBase64.length * 0.75 / 1024);
    const compressedSize = Math.round(compressedBase64.length * 0.75 / 1024);
    const reduction = Math.round(((originalSize - compressedSize) / originalSize) * 100);
    
    console.log(`Asset optimized: ${originalSize}KB -> ${compressedSize}KB (${reduction}% reduction)`);
    
  } catch (error) {
    console.error('Error creating optimized asset:', error);
  }
}

module.exports = {
  compressBase64Image,
  compressImagesInHTML,
  createOptimizedBase64Asset
}; 