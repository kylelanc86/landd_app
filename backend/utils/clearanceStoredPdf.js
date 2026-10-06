'use strict';

const fs = require('fs');
const path = require('path');

const GENERATED_PDF_DIR = path.join(__dirname, '..', 'generated-pdfs');

function mergedPdfFullPath(mergedPdfPath) {
  if (!mergedPdfPath || typeof mergedPdfPath !== 'string') return null;
  return path.join(GENERATED_PDF_DIR, mergedPdfPath);
}

function mergedPdfFileExists(mergedPdfPath) {
  const fullPath = mergedPdfFullPath(mergedPdfPath);
  return !!(fullPath && fs.existsSync(fullPath));
}

function removeClearancePdfFileIfExists(mergedPdfPath) {
  const fullPath = mergedPdfFullPath(mergedPdfPath);
  if (!fullPath) return;
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.warn('Could not delete clearance PDF file:', err.message);
  }
}

function isDocumentTooLarge(err) {
  const msg = String(err?.message || '');
  return err?.code === 10334 || err?.code === 17419 || /larger than|BSONObj size|document is larger/i.test(msg);
}

function stripPdfBuffer(_doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, 'pdfBuffer')) {
    delete ret.pdfBuffer;
  }
  return ret;
}

/**
 * List payloads: hasStoredPdf is true only when we hold the PDF (document buffer or a file on disk).
 * A DocRaptor link alone is not a stored copy. Does not write to the database.
 */
async function markClearanceStoredPdf(Model, clearances) {
  if (!Array.isArray(clearances) || clearances.length === 0) return clearances;
  const ids = clearances.map((c) => c && c._id).filter(Boolean);
  const stored = ids.length
    ? await Model.find({
        _id: { $in: ids },
        pdfBuffer: { $exists: true, $ne: null },
      })
        .select('_id')
        .lean()
    : [];
  const storedIds = new Set(stored.map((d) => String(d._id)));
  for (const clearance of clearances) {
    if (!clearance) continue;
    clearance.hasStoredPdf =
      storedIds.has(String(clearance._id)) || mergedPdfFileExists(clearance.mergedPdfPath);
  }
  return clearances;
}

async function clearanceHasPdfBuffer(Model, clearanceId) {
  if (!clearanceId) return false;
  const found = await Model.exists({
    _id: clearanceId,
    pdfBuffer: { $exists: true, $ne: null },
  });
  return !!found;
}

/**
 * Save the finished clearance PDF on the document, same as assessment pdfBuffer.
 * If that would exceed MongoDB's document limit, keep the file on disk instead.
 */
async function saveClearancePdfCopy({
  Model,
  clearanceId,
  buffer,
  filename,
  downloadUrl,
  jobId,
  relativeDir,
}) {
  const previous = await Model.findById(clearanceId).select('mergedPdfPath').lean();
  const meta = {
    pdfReadyAt: new Date(),
    pdfFilename: filename || null,
    pdfJobId: jobId || null,
    ...(downloadUrl ? { pdfDownloadUrl: downloadUrl } : {}),
  };

  try {
    await Model.findByIdAndUpdate(clearanceId, {
      ...meta,
      pdfBuffer: buffer,
      $unset: { mergedPdfPath: 1 },
    });
    if (previous?.mergedPdfPath) removeClearancePdfFileIfExists(previous.mergedPdfPath);
    return 'buffer';
  } catch (err) {
    if (!isDocumentTooLarge(err)) throw err;
    console.error(
      `Clearance PDF too large to store on ${clearanceId}; saving a file instead:`,
      err.message,
    );
    const dir = path.join(GENERATED_PDF_DIR, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    const mergedPdfPath = `${relativeDir}/${clearanceId}.pdf`;
    fs.writeFileSync(path.join(GENERATED_PDF_DIR, mergedPdfPath), buffer);
    await Model.findByIdAndUpdate(clearanceId, {
      ...meta,
      mergedPdfPath,
      $unset: { pdfBuffer: 1 },
    });
    return 'file';
  }
}

module.exports = {
  stripPdfBuffer,
  mergedPdfFileExists,
  mergedPdfFullPath,
  removeClearancePdfFileIfExists,
  clearanceHasPdfBuffer,
  markClearanceStoredPdf,
  saveClearancePdfCopy,
};
