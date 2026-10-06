/**
 * Strip heavy base64 blobs from clearance documents for list/detail API responses.
 * Metadata (photo counts, arrows, includeInReport, etc.) is preserved.
 */

function qTrue(v) {
  return v === "1" || v === "true";
}

function stripItemPhotographBlobs(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item || !Array.isArray(item.photographs)) continue;
    for (const p of item.photographs) {
      if (p && typeof p === "object") {
        delete p.data;
        delete p.fullResolutionData;
      }
    }
  }
}

function stripEnclosurePhotoBlobs(plain) {
  if (!plain || !Array.isArray(plain.enclosurePhotos)) return;
  for (const p of plain.enclosurePhotos) {
    if (p && typeof p === "object") delete p.data;
  }
}

function stripPlanFileBlobs(plain) {
  if (!plain || typeof plain !== "object") return;
  plain.sitePlanAppendixFileCount = Array.isArray(plain.sitePlanAppendices)
    ? plain.sitePlanAppendices.filter((p) => p && p.sitePlanFile).length
    : plain.sitePlanFile
      ? 1
      : 0;
  plain.hasSitePlanFile = !!(
    plain.sitePlanFile ||
    (Array.isArray(plain.sitePlanAppendices) &&
      plain.sitePlanAppendices.some((p) => p && p.sitePlanFile))
  );
  if (plain.sitePlanFile) delete plain.sitePlanFile;
  if (Array.isArray(plain.sitePlanAppendices)) {
    for (const p of plain.sitePlanAppendices) {
      if (p && typeof p === "object") delete p.sitePlanFile;
    }
  }
}

/**
 * @param {object} doc - mongoose doc or plain object
 * @param {{ omitPhotoData?: boolean, omitPlanFiles?: boolean, omitEnclosurePhotos?: boolean }} opts
 */
function applyClearanceOmitToPlain(doc, opts = {}) {
  if (!doc) return doc;
  const plain = typeof doc.toObject === "function" ? doc.toObject({ depopulate: false }) : doc;
  const {
    omitPhotoData = false,
    omitPlanFiles = false,
    omitEnclosurePhotos = false,
  } = opts;
  if (omitPhotoData) stripItemPhotographBlobs(plain.items);
  if (omitEnclosurePhotos) stripEnclosurePhotoBlobs(plain);
  if (omitPlanFiles) stripPlanFileBlobs(plain);
  return plain;
}

function parseClearanceOmitQuery(query = {}) {
  return {
    omitPhotoData: qTrue(query.omitPhotoData),
    omitPlanFiles: qTrue(query.omitPlanFiles),
    // Default enclosure photos omitted with item photos unless explicitly kept
    omitEnclosurePhotos:
      qTrue(query.omitEnclosurePhotos) ||
      (qTrue(query.omitPhotoData) && !qTrue(query.keepEnclosurePhotos)),
  };
}

module.exports = {
  qTrue,
  stripItemPhotographBlobs,
  applyClearanceOmitToPlain,
  parseClearanceOmitQuery,
};
