/**
 * Extract numeric suffix from air monitoring sample IDs (AM1, PROJECT-AM2, etc.).
 */
const extractAirMonitoringSampleNumber = (sample) => {
  const fromSampleNumber =
    typeof sample?.sampleNumber === 'string' ? sample.sampleNumber : '';
  const sampleNumberMatch = fromSampleNumber.match(/^AM(\d+)$/i);
  if (sampleNumberMatch) {
    return Number.parseInt(sampleNumberMatch[1], 10) || 0;
  }

  const fromFullSampleId =
    typeof sample?.fullSampleID === 'string' ? sample.fullSampleID : '';
  const fullSampleIdMatch = fromFullSampleId.match(/AM(\d+)$/i);
  if (fullSampleIdMatch) {
    return Number.parseInt(fullSampleIdMatch[1], 10) || 0;
  }

  return 0;
};

/** Sort samples in ascending AM order (AM1, AM2, AM10), matching the sample list UI. */
const sortSamplesByAirMonitoringNumber = (samples) =>
  [...samples].sort((a, b) => {
    const numDiff =
      extractAirMonitoringSampleNumber(a) - extractAirMonitoringSampleNumber(b);
    if (numDiff !== 0) return numDiff;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

module.exports = {
  extractAirMonitoringSampleNumber,
  sortSamplesByAirMonitoringNumber,
};
