const { SYDNEY_TZ } = require("./dateUtils");

function formatFilenameDate(dateValue) {
  if (!dateValue) return "[DRAFT]";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "[DRAFT]";

  // Use stable Sydney-local date tokens for filenames.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return "[DRAFT]";
  return `${year}${month}${day}`;
}

function buildSequenceSuffixOptionB(sequenceNumber) {
  const sequence = Number(sequenceNumber);
  if (!Number.isFinite(sequence) || sequence <= 1) return "";
  return ` - ${sequence - 1}`;
}

function buildRevisionSuffix(revision) {
  const rev = Number(revision);
  if (!Number.isFinite(rev) || rev <= 0) return "";
  return ` - rev${rev}`;
}

/** Strip .pdf and any trailing - revN so only the stable report reference remains. */
function toReportReference(filenameOrReference) {
  if (!filenameOrReference) return "";
  return String(filenameOrReference)
    .replace(/\.pdf$/i, "")
    .replace(/\s*-\s*rev\d+$/i, "")
    .trim();
}

function withRevisionAndExtension(reportReference, revision, includeExtension = true) {
  const base = toReportReference(reportReference);
  const withRev = `${base}${buildRevisionSuffix(revision)}`;
  return includeExtension ? `${withRev}.pdf` : withRev;
}

function getAsbestosClearancePrefix(clearanceType) {
  if (clearanceType === "Vehicle/Equipment") return "";
  if (clearanceType === "Non-friable") return "NF ";
  if (
    clearanceType === "Friable" ||
    clearanceType === "Friable (Non-Friable Conditions)"
  ) {
    return "Fr ";
  }
  return "";
}

function buildAsbestosClearanceFilename({
  projectId,
  clearanceType,
  siteName,
  reportIssueDate,
  sequenceNumber,
  revision,
  includeRevision = true,
  includeExtension = true,
}) {
  const safeProjectId = projectId || "Unknown";
  const safeSiteName = siteName || "Unknown";
  const dateToken = formatFilenameDate(reportIssueDate);
  const prefix = getAsbestosClearancePrefix(clearanceType);
  const reportTypeName =
    clearanceType === "Vehicle/Equipment"
      ? "Inspection Certificate"
      : "Asbestos Clearance Report";
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : "";
  const dateSegment =
    dateToken === "[DRAFT]" ? dateToken : `(${dateToken})`;
  const reportLabel = `${prefix}${reportTypeName}`;
  const baseName = `${safeProjectId}_${reportLabel} - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

function buildLeadClearanceFilename({
  projectId,
  siteName,
  reportIssueDate,
  sequenceNumber,
  revision,
  includeRevision = true,
  includeExtension = true,
}) {
  const safeProjectId = projectId || "Unknown";
  const safeSiteName = siteName || "Unknown";
  const dateToken = formatFilenameDate(reportIssueDate);
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : "";
  const dateSegment = dateToken === "[DRAFT]" ? dateToken : `(${dateToken})`;
  const baseName = `${safeProjectId}_Lead Clearance Report - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

function buildEnclosureCertificateFilename({
  projectId,
  siteName,
  reportIssueDate,
  sequenceNumber,
  revision,
  includeRevision = true,
  includeExtension = true,
}) {
  const safeProjectId = projectId || "Unknown";
  const safeSiteName = siteName || "Unknown";
  const dateToken = formatFilenameDate(reportIssueDate);
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : "";
  const dateSegment = dateToken === "[DRAFT]" ? dateToken : `(${dateToken})`;
  const baseName = `${safeProjectId}_Enclosure Inspection Certificate - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

function buildAsbestosAssessmentFilename({
  projectId,
  siteName,
  reportIssueDate,
  sequenceNumber,
  revision,
  isResidential = false,
  includeRevision = true,
  includeExtension = true,
}) {
  const safeProjectId = projectId || "Unknown";
  const safeSiteName = siteName || "Unknown";
  const dateToken = formatFilenameDate(reportIssueDate);
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : "";
  const dateSegment = dateToken === "[DRAFT]" ? dateToken : `(${dateToken})`;
  const reportTitle = isResidential
    ? "Res Asbestos Assessment Report"
    : "Asbestos Assessment Report";
  const baseName = `${safeProjectId}_${reportTitle} - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

/** L&D-generated Chain of Custody form filename (no authorisation/sequence/reference). */
function buildLDChainOfCustodyFilename({
  projectId,
  generationDate = new Date(),
  includeExtension = true,
}) {
  const safeProjectId = projectId || "Unknown";
  const dateToken = formatFilenameDate(generationDate);
  const datePart = dateToken === "[DRAFT]"
    ? formatFilenameDate(new Date())
    : dateToken;
  const baseName = `${safeProjectId}_L&D Chain of Custody - ${datePart}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
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
  const safeProjectId = projectId || "Unknown";
  const safeSiteName = siteName || "Unknown";
  const dateToken = formatFilenameDate(reportIssueDate);
  const sequenceSuffix = buildSequenceSuffixOptionB(sequenceNumber);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : "";
  const dateSegment = dateToken === "[DRAFT]" ? dateToken : `(${dateToken})`;
  const baseName = `${safeProjectId}_${reportTitle} - ${safeSiteName} ${dateSegment}${sequenceSuffix}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

function buildAsbestosAirMonitoringFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Asbestos Air Monitoring Report",
  });
}

function buildLeadAirMonitoringFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Lead Air Monitoring Report",
  });
}

function buildFibreCountFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Fibre Count Report",
    sequenceNumber: undefined,
  });
}

function buildFibreIDFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Fibre ID Report",
    sequenceNumber: undefined,
  });
}

function buildMycometerSurfaceFungiFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Mycometer Surface Fungi Report",
    sequenceNumber: undefined,
  });
}

function buildMycometerAirFungiFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Mycometer Air Fungi Report",
    sequenceNumber: undefined,
  });
}

function buildMycometerAirAllergenFilename(params) {
  return buildStandardProjectReportFilename({
    ...params,
    reportTitle: "Mycometer Air Allergen Report",
    sequenceNumber: undefined,
  });
}

/** Short month + year from monitoring date, e.g. Jan 2026 (Sydney). */
function formatIAQMonthYear(monitoringDate) {
  if (!monitoringDate) return "Unknown";
  const date = new Date(monitoringDate);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const month = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TZ,
    month: "short",
  }).format(date);
  const year = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TZ,
    year: "numeric",
  }).format(date);
  return `${month} ${year}`;
}

function buildIAQFilename({
  monitoringDate,
  reportIssueDate,
  revision,
  includeRevision = true,
  includeExtension = true,
}) {
  const monthYear = formatIAQMonthYear(monitoringDate);
  const dateToken = formatFilenameDate(reportIssueDate);
  const revisionSuffix = includeRevision ? buildRevisionSuffix(revision) : "";
  const dateSegment = dateToken === "[DRAFT]" ? dateToken : `(${dateToken})`;
  const baseName = `L&D IAQ Report - ${monthYear} ${dateSegment}${revisionSuffix}`;
  return includeExtension ? `${baseName}.pdf` : baseName;
}

module.exports = {
  formatFilenameDate,
  buildSequenceSuffixOptionB,
  buildRevisionSuffix,
  toReportReference,
  withRevisionAndExtension,
  getAsbestosClearancePrefix,
  buildAsbestosClearanceFilename,
  buildLeadClearanceFilename,
  buildEnclosureCertificateFilename,
  buildAsbestosAssessmentFilename,
  buildLDChainOfCustodyFilename,
  buildAsbestosAirMonitoringFilename,
  buildLeadAirMonitoringFilename,
  buildFibreCountFilename,
  buildFibreIDFilename,
  buildMycometerSurfaceFungiFilename,
  buildMycometerAirFungiFilename,
  buildMycometerAirAllergenFilename,
  formatIAQMonthYear,
  buildIAQFilename,
};
