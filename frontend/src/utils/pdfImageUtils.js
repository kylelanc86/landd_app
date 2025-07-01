// Utility functions for PDF image handling

export const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      // Set canvas size to reasonable dimensions to reduce file size
      const maxWidth = 800;
      const maxHeight = 600;
      
      let { width, height } = img;
      
      // Scale down large images
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress the image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Use JPEG format with compression for better file size
      const dataURL = canvas.toDataURL("image/jpeg", 0.8); // 80% quality
      resolve(dataURL);
    };
    img.onerror = (error) => {
      console.error(`Failed to load image: ${url}`, error);
      reject(error);
    };
    img.src = url;
  });
};

export const compressImageForPDF = async (imageUrl, maxWidth = 700, maxHeight = 400, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      let imgWidth = img.width;
      let imgHeight = img.height;
      
      // Scale down the image
      if (imgWidth > maxWidth || imgHeight > maxHeight) {
        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        imgWidth = imgWidth * ratio;
        imgHeight = imgHeight * ratio;
      }
      
      // Set canvas size and draw compressed image
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
      
      // Convert to compressed JPEG
      const compressedImage = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedImage);
    };
    
    img.onerror = reject;
    img.src = imageUrl;
  });
}; 