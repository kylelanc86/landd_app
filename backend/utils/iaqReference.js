/**
 * IAQ report reference and sample ID helpers.
 * fullSampleID is stored as "{IAQ reference} - {AM suffix}" e.g. "IAQ Mar 2026 - 1 - AM1".
 */

function generateIAQReference(record, allRecords) {
  if (!record || !allRecords?.length) return '';

  const dateObj = new Date(record.monitoringDate);
  const month = dateObj.toLocaleString('en', { month: 'short' });
  const year = dateObj.getFullYear();
  const monthYear = `${month} ${year}`;

  const recordId = String(record._id || record.id);

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
      (r) => String(r._id || r.id) === recordId
    ) + 1;

  return `IAQ ${monthYear} - ${reportNumber}`;
}

function extractAMSampleSuffix(sampleId) {
  if (!sampleId) return '';
  const match = String(sampleId).match(/(AM\d+)$/i);
  if (match) return match[1].toUpperCase();
  return String(sampleId).trim();
}

function buildIAQFullSampleID(iaqReference, sampleNumber) {
  const suffix = extractAMSampleSuffix(sampleNumber);
  if (!suffix) return iaqReference || '';
  if (/^IAQ\s/i.test(suffix)) return suffix;
  if (!iaqReference) return suffix;
  return `${iaqReference} - ${suffix}`;
}

module.exports = {
  generateIAQReference,
  extractAMSampleSuffix,
  buildIAQFullSampleID,
};
