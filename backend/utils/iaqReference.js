/**
 * IAQ report reference and sample ID helpers.
 * fullSampleID is stored as "{IAQ reference} - {AM suffix}" e.g. "IAQ Mar 2026 - AM1".
 */

function generateIAQReference(record) {
  if (!record?.monitoringDate) return '';

  const dateObj = new Date(record.monitoringDate);
  const month = dateObj.toLocaleString('en', { month: 'short' });
  const year = dateObj.getFullYear();
  return `IAQ ${month} ${year}`;
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
