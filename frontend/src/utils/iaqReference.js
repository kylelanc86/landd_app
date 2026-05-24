/**
 * IAQ report reference and sample ID helpers.
 * fullSampleID is stored as "{IAQ reference} - {AM suffix}" e.g. "IAQ Mar 2026 - 1 - AM1".
 */

export function generateIAQReference(record, allRecords) {
  if (!record || !allRecords?.length) return '';

  const dateObj = new Date(record.monitoringDate);
  const month = dateObj.toLocaleString('default', { month: 'short' });
  const year = dateObj.getFullYear();
  const monthYear = `${month} ${year}`;

  const sameMonthYearRecords = allRecords
    .filter((r) => {
      const recordDate = new Date(r.monitoringDate);
      return (
        recordDate.getMonth() === dateObj.getMonth() &&
        recordDate.getFullYear() === dateObj.getFullYear()
      );
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const reportNumber =
    sameMonthYearRecords.findIndex(
      (r) => String(r._id || r.id) === String(record._id || record.id)
    ) + 1;

  return `IAQ ${monthYear} - ${reportNumber}`;
}

/** Extract AM suffix from a full or partial sample ID (e.g. "AM1"). */
export function extractAMSampleSuffix(sampleId) {
  if (!sampleId) return '';
  const match = String(sampleId).match(/(AM\d+)$/i);
  if (match) return match[1].toUpperCase();
  return String(sampleId).trim();
}

export function buildIAQFullSampleID(iaqReference, sampleNumber) {
  const suffix = extractAMSampleSuffix(sampleNumber);
  if (!suffix) return iaqReference || '';
  if (/^IAQ\s/i.test(suffix)) return suffix;
  if (!iaqReference) return suffix;
  return `${iaqReference} - ${suffix}`;
}

/** Display ID for UI/PDF; supports legacy records that only stored the AM suffix. */
/** Resolve analyst to a display name (handles User object, name string, or ObjectId). */
export function resolveAnalystName(analysedByField, activeCounters = []) {
  if (!analysedByField) return '';
  if (typeof analysedByField === 'object') {
    return `${analysedByField.firstName || ''} ${analysedByField.lastName || ''}`.trim();
  }
  const str = String(analysedByField).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    const user = activeCounters.find((u) => String(u._id) === str);
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }
  return str;
}

/** Resolve analyst name or id to a User id for sample updates. */
export function getAnalystUserId(analystNameOrId, activeCounters = []) {
  if (!analystNameOrId) return undefined;
  const str = String(analystNameOrId).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) return str;
  const user = activeCounters.find(
    (u) => `${u.firstName} ${u.lastName}`.trim() === str
  );
  return user?._id;
}

export function formatIAQSampleDisplay(fullSampleID, iaqReference, sampleNumber) {
  if (fullSampleID && /^IAQ\s/i.test(fullSampleID)) {
    return fullSampleID;
  }
  const suffix = extractAMSampleSuffix(fullSampleID || sampleNumber);
  if (iaqReference && suffix) {
    return buildIAQFullSampleID(iaqReference, suffix);
  }
  return fullSampleID || sampleNumber || '-';
}
