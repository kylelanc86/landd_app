/**
 * Rotate a normalized point (0–1) with the image, 90° clockwise (y-down coords).
 */
export function rotateNormalizedPoint90Cw(x, y) {
  return { x: y, y: 1 - x };
}

/** Add 90° clockwise to an arrow rotation (degrees) after the image is rotated the same way. */
export function rotateArrowDegrees90Cw(rotationDeg) {
  return (rotationDeg ?? 0) + 90;
}

/**
 * Rotate image data URL 90° clockwise via canvas. JPEG/WEBP use quality; PNG preserved as PNG.
 */
export function rotateDataUrl90Cw(dataUrl, jpegQuality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement("canvas");
        canvas.width = h;
        canvas.height = w;
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
        const isPng = /^data:image\/png/i.test(dataUrl);
        const out = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", jpegQuality);
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}
