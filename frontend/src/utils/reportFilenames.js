const SYDNEY_TZ = 'Australia/Sydney';

export function formatFilenameDate(dateValue) {
  if (!dateValue) return '[DRAFT]';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '[DRAFT]';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SYDNEY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '[DRAFT]';
  return `${year}${month}${day}`;
}

export function buildSequenceSuffixOptionB(sequenceNumber) {
  const sequence = Number(sequenceNumber);
  if (!Number.isFinite(sequence) || sequence <= 1) return '';
  return ` - ${sequence - 1}`;
}

export function buildRevisionSuffix(revision) {
  const rev = Number(revision);
  if (!Number.isFinite(rev) || rev <= 0) return '';
  return ` - rev${rev}`;
}

/** Strip .pdf and any trailing - revN so only the stable report reference remains. */
export function toReportReference(filenameOrReference) {
  if (!filenameOrReference) return '';
  return String(filenameOrReference)
    .replace(/\.pdf$/i, '')
    .replace(/\s*-\s*rev\d+$/i, '')
    .trim();
}

/** True when a frozen reference was built without project/site data (bug placeholder). */
export function isPlaceholderReportReference(filenameOrReference) {
  const ref = toReportReference(filenameOrReference);
  return !ref || /^Unknown_/i.test(ref);
}

export function withRevisionAndExtension(reportReference, revision, includeExtension = true) {
  const base = toReportReference(reportReference);
  const withRev = `${base}${buildRevisionSuffix(revision)}`;
  return includeExtension ? `${withRev}.pdf` : withRev;
}

function buildStandardProjectReportFilename({
  projectId,
  reportTitle,
  siteName,
  reportIssueDate,
  sequenceNumber,
  revision,
  includeRevision = true,
  includeExtension = true,
}) {
  const safeProjectId = projectId || 'Unknown';
  const safeSiteName = siteName || 'Unknown';
  const dateToken = formatFilenameDate(reportIssueDate);
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : '';
  const dateSegment = dateToken === '[DRAFT]' ? dateToken : `(${dateToken})`;
  const baseName = `${safeProjectId}_${reportTitle} - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

export function buildAsbestosAirMonitoringFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Asbestos Air Monitoring Report',
  });
}

export function buildLeadAirMonitoringFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Lead Air Monitoring Report',
  });
}

export function buildFibreCountFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Fibre Count Report',
    sequenceNumber: undefined,
  });
}

export function buildFibreIDFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Fibre ID Report',
    sequenceNumber: undefined,
  });
}

export function buildMycometerSurfaceFungiFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Mycometer Surface Fungi Report',
    sequenceNumber: undefined,
  });
}

export function buildMycometerAirFungiFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Mycometer Air Fungi Report',
    sequenceNumber: undefined,
  });
}

export function buildMycometerAirAllergenFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: 'Mycometer Air Allergen Report',
    sequenceNumber: undefined,
  });
}

/** Short month + year from monitoring date, e.g. Jan 2026 (Sydney). */
export function formatIAQMonthYear(monitoringDate) {
  if (!monitoringDate) return 'Unknown';
  const date = new Date(monitoringDate);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const month = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    month: 'short',
  }).format(date);
  const year = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    year: 'numeric',
  }).format(date);
  return `${month} ${year}`;
}

export function buildAsbestosAssessmentFilename({
  projectId,
  siteName,
  reportIssueDate,
  sequenceNumber,
  revision,
  isResidential = false,
  includeRevision = true,
  includeExtension = true,
}) {
  const safeProjectId = projectId || 'Unknown';
  const safeSiteName = siteName || 'Unknown';
  const dateToken = formatFilenameDate(reportIssueDate);
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : '';
  const dateSegment = dateToken === '[DRAFT]' ? dateToken : `(${dateToken})`;
  const reportTitle = isResidential
    ? 'Res Asbestos Assessment Report'
    : 'Asbestos Assessment Report';
  const baseName = `${safeProjectId}_${reportTitle} - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

export function buildIAQFilename({
  monitoringDate,
  reportIssueDate,
  revision,
  includeRevision = true,
  includeExtension = true,
}) {
  const monthYear = formatIAQMonthYear(monitoringDate);
  const dateToken = formatFilenameDate(reportIssueDate);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : '';
  const dateSegment = dateToken === '[DRAFT]' ? dateToken : `(${dateToken})`;
  const baseName = `L&D IAQ Report - ${monthYear} ${dateSegment}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}
