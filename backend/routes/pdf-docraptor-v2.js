const express = require('express');
const router = express.Router();
const DocRaptorService = require('../services/docraptorService');
const fs = require('fs');
const path = require('path');
const { getTemplateByType, replacePlaceholders } = require('../services/templateService');
const { PDFDocument } = require('pdf-lib');
const auth = require('../middleware/auth');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');
const LeadRemovalJob = require('../models/LeadRemovalJob');
const LeadClearance = require('../models/clearanceTemplates/lead/LeadClearance');
const { formatDateSydney, formatClearanceDateSydney, todaySydney, SYDNEY_TZ } = require('../utils/dateUtils');
const { buildContentDispositionAttachment } = require('../utils/contentDisposition');

// Initialize DocRaptor service
const docRaptorService = new DocRaptorService();

// In-memory job store for async PDF generation (jobId -> job record)
// Job record: { statusId, status, downloadUrl?, error?, message?, createdAt, reportType, filename, mergePayload? }
const asyncPdfJobs = new Map();

// Remove completed/failed jobs older than 1 hour to prevent unbounded growth
const JOB_RETENTION_MS = 60 * 60 * 1000;

/** Base directory for generated lead clearance merged PDFs (main + appendices). Green-icon download streams from here. */
const LEAD_CLEARANCE_MERGED_PDF_DIR = path.join(__dirname, '..', 'generated-pdfs', 'lead-clearances');

/** Base directory for generated asbestos clearance merged PDFs (main + air reports + site plan). */
const ASBESTOS_CLEARANCE_MERGED_PDF_DIR = path.join(__dirname, '..', 'generated-pdfs', 'asbestos-clearances');

/** Persisted enclosure inspection certificate PDFs (one file per clearance). */
const ENCLOSURE_CERTIFICATE_PDF_DIR = path.join(__dirname, '..', 'generated-pdfs', 'enclosure-certificates');

/** Assessment report PDF retention (days) – matches DocRaptor; after this, report is no longer available. */
const ASSESSMENT_PDF_RETENTION_DAYS = 7;
const ASSESSMENT_PDF_RETENTION_MS = ASSESSMENT_PDF_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Grace period: PDFs written in the last 2 minutes are never considered expired (avoids race after regeneration). */
const ASSESSMENT_PDF_GRACE_MS = 2 * 60 * 1000;

function isAssessmentPdfExpired(pdfReadyAt) {
  if (!pdfReadyAt) return true;
  const readyAtMs = new Date(pdfReadyAt).getTime();
  if (Number.isNaN(readyAtMs)) return true;
  const ageMs = Date.now() - readyAtMs;
  if (ageMs < 0) return false; // future date, treat as valid
  if (ageMs < ASSESSMENT_PDF_GRACE_MS) return false; // just generated, never expire
  return ageMs > ASSESSMENT_PDF_RETENTION_MS;
}
function pruneOldJobs() {
  const now = Date.now();
  for (const [jobId, job] of asyncPdfJobs.entries()) {
    if ((job.status === 'completed' || job.status === 'failed') && (now - job.createdAt > JOB_RETENTION_MS)) {
      asyncPdfJobs.delete(jobId);
    }
  }
}

// Custom date formatting for CLEARANCE_DATE placeholder (Sydney timezone)
const formatClearanceDate = (dateString) => formatClearanceDateSydney(dateString);

// Format inspection time to ensure proper AM/PM display
const formatInspectionTime = (timeString) => {
  if (!timeString) return 'Unknown Time';
  
  const trimmedTime = timeString.trim();
  
  // If it already has AM/PM, return as-is (preserve the original format)
  if (trimmedTime.match(/\s*(AM|PM|am|pm)\s*$/i)) {
    return trimmedTime;
  }
  
  // If it's in 24-hour format (HH:MM), convert to 12-hour format with AM/PM
  const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    if (hours === 0) {
      hours = 12; // Midnight
    } else if (hours > 12) {
      hours = hours - 12; // Afternoon/evening
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }
  
  // If format doesn't match, return the original (might be invalid format)
  return trimmedTime;
};

// Performance monitoring removed

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Secondary headers support manual line breaks using "|" as a delimiter.
 * Each segment is HTML-escaped; delimiters become <br />.
 */
const formatSecondaryHeaderHtml = (value = "") => {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  const parts = raw.split("|");
  if (parts.length <= 1) return escapeHtml(raw);
  return parts.map((p) => escapeHtml(String(p).trim())).join("<br />");
};

/**
 * Enclosure certificate: use only bullet lines from friable legislativeRequirementsContent so
 * template intros/closings (e.g. "Friable Clearance Certificates should be written…",
 * "These regulations require…") are not shown—agreed intro + list only.
 * With legislationOnly, {LEGISLATION} templates yield only the placeholder (no clearance intro).
 */
function legislativeTemplateBulletsOnly(rawContent, { legislationOnly = false } = {}) {
  if (!rawContent || typeof rawContent !== "string") return "";
  const trimmed = rawContent.trim();
  if (/\{LEGISLATION\}|\[LEGISLATION\]/.test(trimmed)) {
    return legislationOnly ? "{LEGISLATION}" : trimmed;
  }
  const normalized = trimmed.replace(/\[BR\]/gi, "\n").replace(/\{BR\}/gi, "\n");
  const bulletLines = [];
  for (const line of normalized.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("[BULLET]")) {
      bulletLines.push(t.replace(/\s*\[BR\]\s*$/i, "").trim());
      continue;
    }
    if (/^[\u2022•]\s/.test(t)) {
      bulletLines.push(t.replace(/\s*\[BR\]\s*$/i, "").trim());
      continue;
    }
    if (/^[-–—]\s/.test(t) && t.length > 2) {
      bulletLines.push(t.replace(/\s*\[BR\]\s*$/i, "").trim());
    }
  }
  if (bulletLines.length === 0) return trimmed;
  return bulletLines.join("\n");
}

/** Strip friable/clearance legislative intro and closing paragraphs from processed HTML (enclosure PDFs only). */
function stripEnclosureLegislativeTemplateIntro(html) {
  if (!html || typeof html !== "string") return "";
  let result = html;
  const introPatterns = [
    /<div class="paragraph">\s*Friable Clearance Certificates should be written in general accordance with and with reference to:\s*<\/div>/gi,
    /<div class="paragraph">\s*Friable \(Non-Friable Conditions\) Clearance Certificates should be written in general accordance with and with reference to:\s*<\/div>/gi,
    /<div class="paragraph">\s*Non-?Friable Clearance Certificates should be written in general accordance with and with reference to:\s*<\/div>/gi,
    /<div class="paragraph">\s*The clearance inspection (?:was|is) conducted in accordance with the following legislative requirements:\s*<\/div>/gi,
    /Friable Clearance Certificates should be written in general accordance with and with reference to:\s*/gi,
    /Friable \(Non-Friable Conditions\) Clearance Certificates should be written in general accordance with and with reference to:\s*/gi,
    /Non-?Friable Clearance Certificates should be written in general accordance with and with reference to:\s*/gi,
    /The clearance inspection (?:was|is) conducted in accordance with the following legislative requirements:\s*/gi,
  ];
  for (const pattern of introPatterns) {
    result = result.replace(pattern, "");
  }
  result = result.replace(
    /\s*(?:<br\s*\/?>\s*)*<div class="paragraph">\s*These regulations require[\s\S]*$/i,
    "",
  );
  result = result.replace(/\s*These regulations require[\s\S]*$/i, "");
  return result.trim();
}

/**
 * Resolves template's selectedLegislation snapshot against current legislation from the DB,
 * so PDFs show the latest titles/text after legislation custom data fields are edited.
 * @param {Array} templateSelectedLegislation - Template's stored selectedLegislation array
 * @returns {Promise<Array>} Resolved list (current legislation where found, else stored snapshot)
 */
async function resolveSelectedLegislation(templateSelectedLegislation) {
  if (!templateSelectedLegislation || !Array.isArray(templateSelectedLegislation) || templateSelectedLegislation.length === 0) {
    return [];
  }
  const currentLegislation = await CustomDataFieldGroup.getFieldsByType('legislation');
  const idToCurrent = new Map(currentLegislation.map((item) => [String(item._id), item]));
  return templateSelectedLegislation.map((stored) => {
    const current = idToCurrent.get(String(stored._id));
    if (current) return current;
    return stored;
  });
}

/** HTML for a half line break in PDF (used in discussion/conclusions and job exclusions). */
const halfLineBreakHtml = '<span style="display:block; height:0.5em;"></span>';

/** Converts newline-separated text to justified paragraph HTML for PDF (Prince needs proper blocks for text-align: justify). */
const toJustifiedParagraphsHtml = (text) => {
  if (!text || !String(text).trim()) return '';
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(text)
    .split(/\n/)
    .map((p) => p.trim())
    .filter((p) => p)
    .map((p) => `<p style="text-align: justify; margin: 0 0 0.5em 0; word-break: normal; overflow-wrap: break-word;">${esc(p)}</p>`)
    .join('');
};

/** Converts 1–99 to words (e.g. 11 -> "Eleven"); returns String(n) for 0 or 100+. */
const numberToWords = (n) => {
  const num = Number(n);
  if (num <= 0 || num >= 100) return String(n);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num < 20) return ones[num];
  const t = Math.floor(num / 10);
  const o = num % 10;
  return tens[t] + (o ? '-' + ones[o] : '');
};

/** Format asbestos count for discussion/conclusions: "Eleven (11)" or "Analysis incomplete". */
const formatAsbestosCountForPdf = (asbestosCount, analysisComplete) => {
  if (asbestosCount > 0 && !analysisComplete) return '**Analysis incomplete**';
  return numberToWords(asbestosCount) + ' (' + asbestosCount + ')';
};

/**
 * Strip the asbestos count line from discussion text (for backwards compatibility with saved assessments).
 * Removes leading lines like "Two (2) asbestos items were identified..." or "No asbestos containing materials...".
 */
const stripAsbestosCountLineFromDiscussion = (text) => {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return '';
  // Match: "No asbestos containing materials were identified during the assessment conducted at ..." (full first line)
  const noAcmPattern = /^No asbestos containing materials were identified during the assessment conducted at [^\n]+(\s*\n)?/i;
  // Match: "X asbestos item(s) was/were identified during the assessment of ..." (full first line; X = "One (1)", "Two (2)", etc.)
  const withCountPattern = /^[^\n]*asbestos items? (?:were|was) identified during the assessment of [^\n]+(\s*\n)?/i;
  let result = trimmed
    .replace(noAcmPattern, '')
    .replace(withCountPattern, '');
  return result.replace(/^\s*\n+/, '').trim();
};

const normalizeColorForDisplay = (value) => {
  const color = String(value || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return color;
  }
  return "#FFFFFF";
};

/**
 * Generate complete HTML content for clearance report using DocRaptor-optimized templates
 */
// Generate conditional attachment text based on what attachments are present
const generateAttachmentText = (clearanceData) => {
  const hasPhotos = clearanceData.items && clearanceData.items.some(item => 
    item.photographs && item.photographs.some(photo => photo.includeInReport)
  );
  const hasSitePlan = clearanceData.sitePlan && clearanceData.sitePlanFile;
  const hasAirMonitoring = clearanceData.airMonitoring && (
    clearanceData.airMonitoringReport ||
    (clearanceData.airMonitoringReports && clearanceData.airMonitoringReports.length > 0)
  );

  // No photos, site plan, or air monitoring report
  if (!hasPhotos && !hasSitePlan && !hasAirMonitoring) {
    return ''; // No text
  }

  // No site plan or air monitoring report (only photos)
  if (!hasSitePlan && !hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A.';
  }

  // Site plan but no air monitoring report
  if (hasSitePlan && !hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A and a site plan is presented in Appendix B.';
  }

  // Site plan and air monitoring report attached
  if (hasSitePlan && hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A and a site plan is presented in Appendix B. The air monitoring report for these works is presented in Appendix C.';
  }

  // Only air monitoring report (no site plan)
  if (!hasSitePlan && hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A. The air monitoring report for these works is presented in Appendix B.';
  }

  return ''; // Fallback
};

const CLEARANCE_ATTACHMENT_PLACEHOLDERS = [
  '[ATTACHMENTS]',
  '{ATTACHMENTS}',
  '[APPENDIX_REFERENCES]',
  '{APPENDIX_REFERENCES}',
];

/** Remove attachment placeholders from raw template text (before replacePlaceholders). */
function stripClearanceAttachmentPlaceholdersFromRaw(raw) {
  if (!raw) return '';
  let result = raw;
  for (const placeholder of CLEARANCE_ATTACHMENT_PLACEHOLDERS) {
    const pattern = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(pattern, '');
  }
  return result;
}

/** Insert attachment text into processed HTML (after replacePlaceholders). */
function applyClearanceAttachmentPlaceholders(html, attachmentText) {
  if (!html) return '';
  const value = attachmentText || '';
  let result = html;
  for (const placeholder of CLEARANCE_ATTACHMENT_PLACEHOLDERS) {
    const pattern = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(pattern, value);
  }
  return result;
}

/**
 * Extract inner HTML of the first <body>...</body> from a full HTML document.
 */
function extractBodyContent(html) {
  if (!html || typeof html !== 'string') return '';
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1].trim() : html;
}

/**
 * Extract inner HTML of the first <style>...</style> from a full HTML document.
 */
function extractStyleContent(html) {
  if (!html || typeof html !== 'string') return '';
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1].trim() : '';
}

/** Flow body sections for clearance main content (inspection through limitations). */
function buildClearanceFlowBody(flowParts) {
  const {
    templateContent,
    inspectionDetailsContent,
    asbestosRemovalItemsHtml,
    inspectionExclusionsContent,
    clearanceCertificationContent,
    signOffContent,
    backgroundInformationContent,
    legislativeRequirementsContent,
    clearanceCertificateLimitationsTitle,
    clearanceCertificateLimitationsContent,
  } = flowParts;

  const inspectionTitle =
    templateContent?.standardSections?.inspectionDetailsTitle || 'INSPECTION DETAILS';
  const exclusionsTitle =
    templateContent?.standardSections?.inspectionExclusionsTitle || 'INSPECTION EXCLUSIONS';
  const certificationTitle =
    templateContent?.standardSections?.clearanceCertificationTitle || 'CLEARANCE CERTIFICATION';
  const backgroundTitle =
    templateContent?.standardSections?.backgroundInformationTitle || 'BACKGROUND INFORMATION';
  const legislativeTitle =
    templateContent?.standardSections?.legislativeRequirementsTitle || 'LEGISLATIVE REQUIREMENTS';

  return [
    `<div class="section-header">${escapeHtml(inspectionTitle)}</div>`,
    `<div class="section-body inspection-details-body">${inspectionDetailsContent}</div>`,
    asbestosRemovalItemsHtml,
    `<div class="section-header">${escapeHtml(exclusionsTitle)}</div>`,
    `<div class="section-body inspection-exclusions-body">${inspectionExclusionsContent}</div>`,
    `<div class="section-header">${escapeHtml(certificationTitle)}</div>`,
    `<div class="section-body">${clearanceCertificationContent}${signOffContent}</div>`,
    `<div class="page-break"></div>`,
    `<div class="section-header background-section-header">${escapeHtml(backgroundTitle)}</div>`,
    `<div class="section-body">${backgroundInformationContent}</div>`,
    `<div class="section-header">${escapeHtml(legislativeTitle)}</div>`,
    `<div class="section-body">${legislativeRequirementsContent}</div>`,
    `<div class="section-header">${escapeHtml(clearanceCertificateLimitationsTitle)}</div>`,
    `<div class="section-body">${clearanceCertificateLimitationsContent}</div>`,
  ].join('\n');
}

function buildClearanceMainFlowInnerHtml(flowSections, footerText, logoBase64) {
  const safeFooter = escapeHtml(footerText);
  return `
    <div id="pageHeader">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="header-line"></div>
    </div>
    <div id="pageFooter">
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content">
          <div class="footer-text">${safeFooter}</div>
          <div class="page-number"></div>
        </div>
      </div>
    </div>
    ${flowSections}
  `;
}

function buildClearanceFlowCss() {
  return `
    @page {
      size: A4;
      margin: 35mm 48px 24mm 48px;
      @top { content: element(pageHeader); }
      @bottom {
        content: element(pageFooter);
        vertical-align: bottom;
      }
    }
    #pageHeader { position: running(pageHeader); box-sizing: border-box; width: 100%; padding: 16px 0 0 0; }
    #pageHeader .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0; margin: 0; }
    #pageHeader .header-line { width: 100%; height: 1.5px; background: #16b12b; margin: 8px 0 0 0; border-radius: 0; display: block; }
    #pageFooter { position: running(pageFooter); box-sizing: border-box; width: 100%; padding: 0 0 16px 0; }
    #pageFooter .footer { width: 100%; margin: 0; text-align: justify; font-size: 0.75rem; color: #222; }
    #pageFooter .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin: 0 0 6px 0; border-radius: 0; display: block; }
    #pageFooter .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
    #pageFooter .footer-text { flex: 1; }
    #pageFooter .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
    #pageFooter .page-number::after { content: counter(page); }
    .logo { width: 243px; height: auto; display: block; margin: 0; }
    .company-details { text-align: right; font-size: 0.75rem; line-height: 1.5; margin-top: 8px; margin: 0; }
    .website { color: #16b12b; font-weight: 500; }
    .section-header { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin: 10px 0 10px 0; letter-spacing: 0.01em; color: #222; }
    .page-break + .section-header,
    .background-section-header { margin-top: 0; }
    .section-body { font-size: 0.8rem; line-height: 1.5; text-align: justify; margin-bottom: 18px; color: #222; }
    .section-body .paragraph { margin-bottom: 8px; }
    .section-body .bullet-list { margin: 0 0 8px 0; padding: 0 0 0 24px; list-style: none; font-size: 0.8rem; color: #222; }
    .section-body .bullet-list li { margin-bottom: 8px; position: relative; padding-left: 20px; line-height: 1.5; text-align: left; }
    .section-body .bullet-list li::before { content: "•"; position: absolute; left: 0; top: 0.25em; font-size: 1em; color: #222; line-height: 1; }
    .section-body.inspection-exclusions-body .paragraph { margin-bottom: 5px; }
    .section-body.inspection-details-body .paragraph { margin-bottom: 6px; }
    .table-container { margin: 6px 0 20px 0; width: 100%; }
    .table-title { font-size: 0.8rem; font-weight: 700; margin: 10px 0 10px 0; color: #222; }
    .clearance-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 10px 0; page-break-inside: auto; break-inside: auto; }
    .clearance-table thead { display: table-header-group; }
    .clearance-table tr { page-break-inside: avoid; break-inside: avoid; }
    .clearance-table th, .clearance-table td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
    .clearance-table th { background-color: #f5f5f5; font-weight: 700; }
    .clearance-table tr:nth-child(even) { background-color: #f9f9f9; }
    .signature-block { margin-top: 12px; font-size: 0.8rem; color: #222; line-height: 1.5; }
    .signature-block .paragraph { margin: 0 0 1px 0; line-height: 1.2; }
    .signature-block img { display: block; margin: 0 0 1px 0; max-width: 150px; max-height: 75px; }
    .page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }
  `;
}

function assembleClearanceSingleHTML({
  coverHtml,
  versionHtml,
  flowBody,
  appendixSegments,
  frontendUrl,
  logoBase64,
}) {
  const A4_HEIGHT = '297mm';
  const A4_WIDTH = '210mm';
  const A4_LANDSCAPE_HEIGHT = '210mm';
  const A4_LANDSCAPE_WIDTH = '297mm';

  const coverBody = extractBodyContent(coverHtml);
  const versionBody = extractBodyContent(versionHtml);
  let coverCss = extractStyleContent(coverHtml).replace(/@page\s*\{/g, '@page cover {');
  let versionCss = extractStyleContent(versionHtml).replace(/@page\s*\{/g, '@page version {');

  const flowCss = buildClearanceFlowCss().replace(/@page\s*\{/g, '@page main {');
  const mainCss = `${flowCss}\n.main-section-start { counter-reset: page 1; box-sizing: border-box; }\n`;

  const photoPageCss = getLeadPhotoPageStyles(frontendUrl).replace(/@page\s*\{/g, '@page appendix-photos {');
  const sitePlanLandscapeCss = `
    @page appendix-landscape { size: A4 landscape; margin: 0; }
    .site-plan-page { page: appendix-landscape; height: 100%; display: flex; flex-direction: column; min-height: 0; overflow: hidden; page-break-after: avoid; page-break-inside: avoid; box-sizing: border-box; }
    .site-plan-page .header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; font-family: "Gothic", Arial, sans-serif; box-sizing: border-box; }
    .site-plan-page .header-line, .site-plan-page .green-line { flex-shrink: 0; width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; display: block; }
    .site-plan-page .content { flex: 1; min-height: 0; overflow: hidden; padding: 5px 48px 10px 48px; display: flex; flex-direction: column; box-sizing: border-box; }
    .site-plan-page .footer { flex-shrink: 0; position: relative; left: 0; right: 0; bottom: 0; width: calc(100% - 96px); margin: 0 auto; padding: 0 0 16px 0; text-align: justify; font-size: 0.75rem; color: #222; font-family: "Gothic", Arial, sans-serif; box-sizing: border-box; }
    .site-plan-page .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin: 0 0 6px 0; border-radius: 0; display: block; }
    .site-plan-page .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
    .site-plan-page .footer-text { flex: 1; }
  `;

  const singleDocLayoutCss = `
    @page { size: A4; margin: 0; }
    body { font-family: "Gothic", Arial, sans-serif; color: #222; margin: 0; padding: 0; }
    .single-doc-cover, .single-doc-version, .single-doc-appendix { width: ${A4_WIDTH}; min-width: ${A4_WIDTH}; height: ${A4_HEIGHT}; min-height: ${A4_HEIGHT}; box-sizing: border-box; }
    .single-doc-cover .cover-page, .single-doc-cover .page, .single-doc-version .page, .single-doc-appendix .page { width: 100% !important; height: 100% !important; min-height: 100% !important; box-sizing: border-box; }
    .single-doc-section { page-break-before: always; break-before: page; }
    .single-doc-cover { page-break-before: avoid; }
    .single-doc-cover .cover-page .cover-content p.cover-meta .cover-meta-label { display: block; font-weight: 700; margin: 0 0 6px 0; }
    .single-doc-cover .cover-page .cover-content p.cover-meta .cover-meta-value { display: block; font-weight: 400; }
    .single-doc-photos-section .page {
      page: appendix-photos;
      width: ${A4_WIDTH};
      min-width: ${A4_WIDTH};
      height: ${A4_HEIGHT} !important;
      min-height: ${A4_HEIGHT} !important;
      max-height: none;
      box-sizing: border-box;
      position: relative;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
    }
    .single-doc-photos-section .page .header,
    .single-doc-photos-section .page .header-line { flex-shrink: 0; }
    .single-doc-photos-section .page .content {
      flex: 0 0 auto;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      align-items: stretch !important;
      align-content: flex-start !important;
      padding: 10px 48px 80px 48px !important;
    }
    .single-doc-photos-section .page .photo-container {
      flex: 0 0 auto;
      align-self: stretch;
    }
    .single-doc-photos-section .page .footer {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 16px !important;
      flex-shrink: 0;
      width: calc(100% - 96px);
      margin: 0 auto !important;
    }
    .single-doc-photos-section .page:last-child { page-break-after: avoid; break-after: avoid; }
    .single-doc-photos-section > .page-break { display: none; height: 0; margin: 0; padding: 0; }
    .single-doc-site-plan-section { width: ${A4_LANDSCAPE_WIDTH}; min-width: ${A4_LANDSCAPE_WIDTH}; height: ${A4_LANDSCAPE_HEIGHT}; min-height: ${A4_LANDSCAPE_HEIGHT}; box-sizing: border-box; }
    .single-doc-site-plan-section .site-plan-page { width: 100% !important; height: 100% !important; min-height: 100% !important; box-sizing: border-box; }
  `;

  const versionAppendixOverridesCss = `
    .single-doc-version .header, .single-doc-appendix .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; }
    .single-doc-version .header-line, .single-doc-version .green-line, .single-doc-appendix .header-line, .single-doc-appendix .green-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
    .single-doc-version .footer, .single-doc-appendix .footer { position: absolute; left: 48px; right: 48px; bottom: 0; width: calc(100% - 96px); margin: 0; padding-bottom: 16px; text-align: justify; font-size: 0.75rem; color: #222; box-sizing: border-box; }
    .single-doc-version .footer .footer-border-line, .single-doc-appendix .footer .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
    .single-doc-version .footer .footer-content, .single-doc-appendix .footer .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
    .single-doc-version .footer .footer-text, .single-doc-appendix .footer .footer-text { flex: 1; }
  `;

  let appendixCss = '';
  const bodyParts = [
    `<div class="single-doc-cover" style="page: cover">${coverBody}</div>`,
    `<div class="single-doc-version single-doc-section" style="page: version">${versionBody}</div>`,
    `<div class="single-doc-main single-doc-section" style="page: main"><div class="main-section-start">${flowBody}</div></div>`,
  ];

  for (const seg of appendixSegments || []) {
    if (seg.type === 'appendix-cover') {
      if (seg.css) appendixCss += seg.css.replace(/@page\s*\{/g, '@page appendix {');
      bodyParts.push(`<div class="single-doc-appendix single-doc-section" style="page: appendix">${seg.body}</div>`);
    } else if (seg.type === 'photos') {
      bodyParts.push(`<div class="single-doc-photos-section single-doc-section">${seg.body}</div>`);
    } else if (seg.type === 'site-plan') {
      bodyParts.push(`<div class="single-doc-site-plan-section single-doc-section" style="page: appendix-landscape">${seg.body}</div>`);
    }
  }

  const combinedCss = [
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }`,
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }`,
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }`,
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }`,
    '* { hyphens: none !important; -webkit-hyphens: none !important; -ms-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }',
    singleDocLayoutCss,
    '.page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }',
    coverCss,
    versionCss,
    mainCss,
    appendixCss,
    photoPageCss,
    sitePlanLandscapeCss,
    versionAppendixOverridesCss,
  ].filter(Boolean).join('\n');

  const bodyHtml = bodyParts.join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Asbestos Clearance Report</title>
  <style>${combinedCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

const generateClearanceHTMLV2 = async (clearanceData, pdfId = 'unknown') => {
  try {
    console.log("=== PDF GENERATION STARTED ===");
    console.log("ClearanceData received:", clearanceData);
    console.log("ClearanceData items:", clearanceData?.items);
    
    // Load DocRaptor-optimized templates
    const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosClearance');
    const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
    const versionControlTemplate = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');
    const appendixACoverTemplateWithUrl = fs.readFileSync(path.join(templateDir, 'AppendixACover.html'), 'utf8');
    // photographsTemplate no longer used - photos generated independently
    const photoItemTemplate = fs.readFileSync(path.join(templateDir, 'PhotoItem.html'), 'utf8');
    const photoPageTemplate = fs.readFileSync(path.join(templateDir, 'PhotoPage.html'), 'utf8');
    const appendixBCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixBCover.html'), 'utf8');
    const appendixCCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixCCover.html'), 'utf8');
    
    // Get frontend URL from environment variable (fallback to localhost for development)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Replace [FRONTEND_URL] placeholder in all templates with actual frontend URL
    const replaceFrontendUrl = (template) => template.replace(/\[FRONTEND_URL\]/g, frontendUrl);
    const coverTemplateWithUrl = replaceFrontendUrl(coverTemplate);
    const versionControlTemplateWithUrl = replaceFrontendUrl(versionControlTemplate);
    const appendixACoverTemplateWithUrlWithUrl = replaceFrontendUrl(appendixACoverTemplateWithUrl);
    const photoItemTemplateWithUrl = replaceFrontendUrl(photoItemTemplate);
    const photoPageTemplateWithUrl = replaceFrontendUrl(photoPageTemplate);
    const appendixBCoverTemplateWithUrl = replaceFrontendUrl(appendixBCoverTemplate);
    const appendixCCoverTemplateWithUrl = replaceFrontendUrl(appendixCCoverTemplate);
    
    // Load logo, background, and watermark images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    
    const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
    const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
    
    const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

    // Fetch template content from database
    let templateType;
    
    // If useComplexTemplate is true, use Complex template regardless of clearance type
    if (clearanceData.useComplexTemplate) {
      templateType = 'asbestosClearanceComplex';
    } else {
      // Auto-determine clearance type based on asbestos items if not explicitly set
      let clearanceType = clearanceData.clearanceType;
      
      if (!clearanceType && clearanceData.items && clearanceData.items.length > 0) {
        const hasFriable = clearanceData.items.some(item => item.asbestosType === 'Friable');
        const hasNonFriable = clearanceData.items.some(item => item.asbestosType === 'Non-friable');
        
        if (hasFriable && hasNonFriable) {
          clearanceType = 'Friable (Non-Friable Conditions)';
        } else if (hasFriable) {
          clearanceType = 'Friable';
        } else {
          clearanceType = 'Non-friable';
        }
      }
      
      // Map clearance type to template type
      if (clearanceType === 'Friable') {
        templateType = 'asbestosClearanceFriable';
      } else if (clearanceType === 'Friable (Non-Friable Conditions)') {
        templateType = 'asbestosClearanceFriableNonFriableConditions';
      } else if (clearanceType === 'Vehicle/Equipment') {
        templateType = 'asbestosClearanceVehicle';
      } else if (clearanceType === 'Non-friable') {
        templateType = 'asbestosClearanceNonFriable';
      } else {
        templateType = 'asbestosClearanceNonFriable'; // Default fallback
      }
    }
    
    const templateContent = await getTemplateByType(templateType);
    
    // Debug logging for template content
    
    // Special handling for Complex clearance type - bypass default template content
    if (clearanceData.useComplexTemplate || clearanceData.clearanceType === 'Complex') {
      // For Complex clearance, we'll use minimal template content and generate custom content
      const complexTemplateContent = {
        standardSections: {
          note: "This is a Complex Clearance Certificate that requires custom content generation.",
          customSections: [
            "Project-specific requirements",
            "Specialist methodology", 
            "Custom assessment criteria",
            "Project-specific conclusions",
            "Specialist recommendations"
          ]
        }
      };
      
      // Use the complex template content instead of the default
      templateContent = complexTemplateContent;
    }



    // Determine the site address/name for the cover page
    let siteAddress = clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site';
    // If Vehicle/Equipment clearance, use vehicle equipment description instead
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      siteAddress = clearanceData.vehicleEquipmentDescription;
    }

    // Determine footer text based on clearance type
    let footerText;
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      footerText = `Inspection Certificate: ${clearanceData.vehicleEquipmentDescription}`;
    } else {
      footerText = `Asbestos Removal Clearance Certificate: ${siteAddress}`;
    }

    // Determine the report title based on clearance type
    let reportTitle = 'ASBESTOS REMOVAL<br />CLEARANCE<br />CERTIFICATE';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      reportTitle = 'INSPECTION CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable') {
      reportTitle = 'FRIABLE ASBESTOS<br /> REMOVAL CLEARANCE<br /> CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Non-friable') {
      reportTitle = 'NON-FRIABLE ASBESTOS<br /> REMOVAL CLEARANCE<br /> CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      reportTitle = 'FRIABLE ASBESTOS<br /> REMOVAL CLEARANCE<br /> CERTIFICATE';
    }

    // Populate cover template with data
    const populatedCover = coverTemplateWithUrl
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[REPORT_TITLE\]/g, reportTitle)
      .replace(/\[SITE_ADDRESS\]/g, siteAddress)
      .replace(/\[SECONDARY_HEADER\]/g, formatSecondaryHeaderHtml(clearanceData.secondaryHeader || ''))
      .replace(/\[JOB_REFERENCE\]/g, clearanceData.projectId?.projectID || 'Unknown')
      .replace(/\[CLEARANCE_DATE\]/g, formatClearanceDate(clearanceData.clearanceDate))
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`)
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')


    // Get PDF generation date (current date in Sydney) - used for Issue Date in document details and Original Issue in revision history
    const pdfGenerationDate = todaySydney();
    
    // Generate revision history rows
    const generateRevisionHistory = (reportAuthoriserText) => {
      const revision = clearanceData.revision || 0;
      // Approved By should be the same as report authoriser
      const approvedBy = reportAuthoriserText;
      
      if (revision === 0) {
        // Original report - no revisions
        return `
          <tr>
            <td>Original Issue</td>
            <td>0</td>
            <td>${approvedBy}</td>
            <td>${pdfGenerationDate}</td>
          </tr>
        `;
      } else {
        // Revised report - show revision history with actual reasons
        let revisionRows = `
          <tr>
            <td>Original Issue</td>
            <td>0</td>
            <td>${approvedBy}</td>
            <td>${pdfGenerationDate}</td>
          </tr>
        `;
        
        // Use actual revision reasons if available
        if (clearanceData.revisionReasons && clearanceData.revisionReasons.length > 0) {
          clearanceData.revisionReasons.forEach((revisionData) => {
            const revisionDate = revisionData.revisedAt ? formatDateSydney(revisionData.revisedAt) : pdfGenerationDate;
            // Approved By should be the same as report authoriser
            const revisedByApprovedBy = approvedBy;
            
            revisionRows += `
              <tr>
                <td>${revisionData.reason}</td>
                <td>${revisionData.revisionNumber}</td>
                <td>${revisedByApprovedBy}</td>
                <td>${revisionDate}</td>
              </tr>
            `;
          });
        } else {
          // Fallback to generic revision text if no reasons stored
          for (let i = 1; i <= revision; i++) {
            revisionRows += `
              <tr>
                <td>Report Revision</td>
                <td>${i}</td>
                <td>${approvedBy}</td>
                <td>${pdfGenerationDate}</td>
              </tr>
            `;
          }
        }
        
        return revisionRows;
      }
    };

    // Determine filename for version control (use vehicle description for Vehicle/Equipment)
    let filenameSiteName = clearanceData.projectId?.name || 'Unknown';
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      filenameSiteName = clearanceData.vehicleEquipmentDescription;
    }
    
    // Determine version control title (simple format without <br> tags)
    let versionControlTitle = 'ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      versionControlTitle = 'INSPECTION CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable') {
      versionControlTitle = 'FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Non-friable') {
      versionControlTitle = 'NON-FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      versionControlTitle = 'FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    }
    
    // Determine filename for version control page (should match the actual filename)
    let reportTypeNameVC = 'Asbestos Clearance Report';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      reportTypeNameVC = 'Inspection Certificate';
    }
    
    // Determine clearance type prefix for filename (NF for Non-friable, F for Friable types)
    let clearanceTypePrefix = '';
    if (clearanceData.clearanceType === 'Non-friable') {
      clearanceTypePrefix = 'NF ';
    } else if (clearanceData.clearanceType === 'Friable' || clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      clearanceTypePrefix = 'F ';
    }
    // Vehicle/Equipment clearances don't get a prefix
    
    // Determine report authoriser text
    let reportAuthoriserText;
    if (clearanceData.reportApprovedBy) {
      // Report has been authorised - show the authoriser name
      reportAuthoriserText = clearanceData.reportApprovedBy;
    } else {
      // Report not yet authorised - show "Awaiting Authorisation" in red
      reportAuthoriserText = '<span style="color: red;">Awaiting Authorisation</span>';
    }
    
    // Populate version control template with data
    const populatedVersionControl = versionControlTemplateWithUrl
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[REPORT_TITLE\]/g, versionControlTitle)
      .replace(/\[SITE_ADDRESS\]/g, siteAddress)
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')
      .replace(/\[CLEARANCE_DATE\]/g, pdfGenerationDate) // Use PDF generation date for Issue Date in document details
      .replace(/\[LAA_NAME\]/g, clearanceData.createdBy?.firstName && clearanceData.createdBy?.lastName ? `${clearanceData.createdBy.firstName} ${clearanceData.createdBy.lastName}` : clearanceData.LAA || 'Unknown LAA')
      .replace(/\[REPORT_AUTHORISER\]/g, reportAuthoriserText)
      .replace(/\[FILENAME\]/g, `${clearanceData.projectId?.projectID || 'Unknown'}: ${clearanceTypePrefix}${reportTypeNameVC} - ${filenameSiteName} (${formatClearanceDate(clearanceData.clearanceDate)})${clearanceData.sequenceNumber ? ` - ${clearanceData.sequenceNumber}` : ''}`)
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, footerText)
      .replace(/<tr>\s*<td style="height: 32px"><\/td>\s*<td><\/td>\s*<td><\/td>\s*<td><\/td>\s*<\/tr>/g, generateRevisionHistory(reportAuthoriserText));

    // Generate clearance items table headers
    const generateClearanceItemsHeaders = () => {
      const items = clearanceData.items || [];
      
      // For Vehicle/Equipment clearances, only show 2 columns
      if (clearanceData.clearanceType === 'Vehicle/Equipment') {
        return '<th>Item Description</th><th style="width: 15%;">Photo No.</th>';
      }
      
      // If no items, show basic headers without Level/Floor
      if (items.length === 0) {
        return '<th>Item Description</th><th style="width: 18%;">Material Type</th><th style="width: 12%;">Asbestos Type</th><th style="width: 10%;">Photo No.</th>';
      }
      
      const hasLevelFloor = items.some(item => item.levelFloor && item.levelFloor.trim() !== '');
      
      if (hasLevelFloor) {
        return '<th>Level/Floor</th><th>Item Description</th><th style="width: 18%;">Material Type</th><th style="width: 12%;">Asbestos Type</th><th style="width: 10%;">Photo No.</th>';
      } else {
        return '<th>Item Description</th><th style="width: 18%;">Material Type</th><th style="width: 12%;">Asbestos Type</th><th style="width: 10%;">Photo No.</th>';
      }
    };

    // Generate clearance items table
    const generateClearanceItemsTable = () => {
      const items = clearanceData.items || [];
      
      if (items.length === 0) {
        const colspan = clearanceData.clearanceType === 'Vehicle/Equipment' ? 2 : (items.some(item => item.levelFloor && item.levelFloor.trim() !== '') ? 5 : 4);
        return `<tr><td colspan="${colspan}" style="text-align: center; font-style: italic;">No clearance items found</td></tr>`;
      }
      
      // First, collect all photos across all items to assign sequential numbers
      let globalPhotoCounter = 1;
      const itemsWithPhotoNumbers = items.map((item, index) => {
        const photos = item.photographs || [];
        const includedPhotos = photos.filter(p => p.includeInReport);
        
        const itemWithSequentialPhotos = {
          ...item,
          sequentialPhotoNumbers: []
        };
        
        if (includedPhotos.length > 0) {
          includedPhotos.forEach(() => {
            itemWithSequentialPhotos.sequentialPhotoNumbers.push(globalPhotoCounter);
            globalPhotoCounter++;
          });
        }
        
        return itemWithSequentialPhotos;
      });

      const tableRows = itemsWithPhotoNumbers.map((item, index) => {
        // For Vehicle/Equipment, show simplified table
        if (clearanceData.clearanceType === 'Vehicle/Equipment') {
          const itemDescription = item.materialDescription || 'No description';
          
          // Generate photo numbers text using sequential numbers
          let photoNumbersText = '-';
          if (item.sequentialPhotoNumbers.length > 0) {
            if (item.sequentialPhotoNumbers.length === 1) {
              photoNumbersText = item.sequentialPhotoNumbers[0].toString();
            } else {
              const firstNumber = item.sequentialPhotoNumbers[0];
              const lastNumber = item.sequentialPhotoNumbers[item.sequentialPhotoNumbers.length - 1];
              photoNumbersText = firstNumber === lastNumber ? firstNumber.toString() : `${firstNumber}-${lastNumber}`;
            }
          }
          
          return `<tr>
            <td>${itemDescription}</td>
            <td>${photoNumbersText}</td>
          </tr>`;
        }
        
        // Format asbestos type properly
        const formattedAsbestosType = item.asbestosType 
          ? item.asbestosType.charAt(0).toUpperCase() + item.asbestosType.slice(1).replace('-', '-')
          : 'Non-friable';
        
        // Get material type from the materialDescription field (e.g., fibre cement, vinyl tiles)
        const materialType = item.materialDescription || 'Unknown Material';
        
        // Combine room/area and location description into item description
        // roomArea: Kitchen, Bedroom, etc.
        // locationDescription: wall sheet, ceiling sheet, pipe insulation, etc.
        const roomArea = item.roomArea || 'Unknown Room/Area';
        const locationDescription = item.locationDescription || 'Unknown Location';
        const itemDescription = `${roomArea} - ${locationDescription}`;
        
        // Generate photo numbers text using sequential numbers
        let photoNumbersText = '-';
        if (item.sequentialPhotoNumbers.length > 0) {
          if (item.sequentialPhotoNumbers.length === 1) {
            photoNumbersText = item.sequentialPhotoNumbers[0].toString();
          } else {
            const firstNumber = item.sequentialPhotoNumbers[0];
            const lastNumber = item.sequentialPhotoNumbers[item.sequentialPhotoNumbers.length - 1];
            photoNumbersText = firstNumber === lastNumber ? firstNumber.toString() : `${firstNumber}-${lastNumber}`;
          }
        }
        
        // Only show Level/Floor column if at least one item has it
        const hasLevelFloor = items.some(item => item.levelFloor && item.levelFloor.trim() !== '');
        
        if (hasLevelFloor) {
          return `<tr>
            <td>${item.levelFloor || 'Not specified'}</td>
            <td>${itemDescription}</td>
            <td>${materialType}</td>
            <td>${formattedAsbestosType}</td>
            <td>${photoNumbersText}</td>
          </tr>`;
        } else {
          return `<tr>
            <td>${itemDescription}</td>
            <td>${materialType}</td>
            <td>${formattedAsbestosType}</td>
            <td>${photoNumbersText}</td>
          </tr>`;
        }
      }).join('');
      
      return tableRows;
    };

    // Generate photographs content for clearance reports using template approach
    const generateClearancePhotographsContent = () => {
      // Use actual clearance items if provided, otherwise use sample data
      const clearanceItems = clearanceData.items || clearanceData.clearanceItems || clearanceData.removalItems || clearanceData.asbestosItems || [];
      
      console.log("=== PDF GENERATION DEBUG ===");
      console.log("ClearanceData items:", clearanceData.items);
      console.log("ClearanceItems found:", clearanceItems);
      console.log("ClearanceItems length:", clearanceItems.length);
      
      // Collect all photos that should be included in the report
      const photosForReport = [];
      
      clearanceItems.forEach((item, index) => {
        // console.log(`Item ${index}:`, item);
        // console.log(`Item ${index} photographs array:`, item.photographs);
        
        // Add photographs that are marked for inclusion in report
        if (item.photographs && Array.isArray(item.photographs)) {
          console.log(`Item ${index} has ${item.photographs.length} photos in array`);
          item.photographs.forEach((photo, photoIndex) => {
            console.log(`Photo ${photoIndex} in item ${index}:`, photo);
            console.log(`Photo ${photoIndex} includeInReport:`, photo.includeInReport);
            if (photo.includeInReport) {
              console.log(`Adding photo ${photoIndex} from item ${index} to report`);
              
              // For Vehicle/Equipment, use materialDescription as the item description
              // For others, store both locationDescription and materialDescription for photo description formatting
              const itemDescription = clearanceData.clearanceType === 'Vehicle/Equipment' 
                ? item.materialDescription 
                : item.locationDescription;
              
              photosForReport.push({
                photoUrl: photo.data,
                levelFloor: item.levelFloor,
                roomArea: item.roomArea,
                materialDescription: itemDescription,
                locationDescription: item.locationDescription || item.materialDescription || 'Unknown Location',
                description: photo.description // Include stored description if available
              });
            }
          });
        }
      });
      
      console.log("Total photos for report:", photosForReport.length);
      console.log("Photos for report:", photosForReport);
      
      if (photosForReport.length === 0) {
        console.log("No photos found - returning placeholder");
        return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
      }
      
      // Generate pages with 2 photos each using template
      const pages = [];
      
      for (let i = 0; i < photosForReport.length; i += 2) {
        const pagePhotos = photosForReport.slice(i, i + 2);
        const photoItems = pagePhotos.map((photo, pageIndex) => {
          const photoNumber = i + pageIndex + 1;
          
          // Use stored description if available, otherwise generate default
          let photoLocation;
          if (photo.description) {
            // Use the stored custom description
            photoLocation = photo.description;
          } else {
            // Generate default description based on clearance type
            if (clearanceData.clearanceType === 'Vehicle/Equipment') {
              photoLocation = photo.materialDescription || 'Unknown Item';
            } else {
              const roomArea = (photo.roomArea || 'unknown room/area').toLowerCase();
              const materialDesc = (photo.locationDescription || photo.materialDescription || 'unknown material').toLowerCase();
              photoLocation = `Photograph after removal of ${materialDesc} to ${roomArea}`;
            }
          }
          
          // IMPORTANT: Replace the combined placeholder FIRST before individual placeholders
          // Otherwise the individual replacements happen first and the combined won't match
          let photoItem = photoItemTemplateWithUrl
            .replace(/\[PHOTO_URL\]/g, photo.photoUrl)
            .replace(/\[PHOTO_NUMBER\]/g, photoNumber.toString())
            .replace(/\[LEVEL_FLOOR\]/g, photo.levelFloor || 'Not specified')
            .replace(/\[LEVEL_FLOOR_DISPLAY\]/g, photo.levelFloor ? 'block' : 'none');
          
          // Replace the combined location placeholder
          photoItem = photoItem.replace(/\[ROOM_AREA\] - \[MATERIAL_DESCRIPTION\]/g, photoLocation);
          
          // Then replace individual placeholders (for backwards compatibility)
          photoItem = photoItem
            .replace(/\[ROOM_AREA\]/g, photo.roomArea || 'Unknown Room/Area')
            .replace(/\[MATERIAL_DESCRIPTION\]/g, photo.materialDescription || 'Unknown Location');
          
          return photoItem;
        }).join('');
        
        // Use the photo page template and replace all placeholders
        const page = photoPageTemplateWithUrl
          .replace(/\[PHOTO_ITEMS\]/g, photoItems)
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
          .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
          .replace(/\[FOOTER_TEXT\]/g, footerText);
        
        pages.push(page);
      }
      
      return pages.join('');
    };

    // Prepare template content placeholders first (async operations)
    // Use job's legislation snapshot (at creation time); fall back to resolved template for existing jobs without it
    const resolvedLegislation = await resolveSelectedLegislation(templateContent?.selectedLegislation);
    const selectedLegislation = (clearanceData.legislation && clearanceData.legislation.length > 0)
      ? clearanceData.legislation
      : resolvedLegislation;
    const templateData = {
      ...clearanceData,
      selectedLegislation
    };
    
    const attachmentText = generateAttachmentText(clearanceData);

    let inspectionDetailsRaw = templateContent
      ? stripClearanceAttachmentPlaceholdersFromRaw(templateContent.standardSections.inspectionDetailsContent)
      : '';
    if (attachmentText) {
      const trimmed = inspectionDetailsRaw.trimEnd();
      inspectionDetailsRaw = trimmed ? `${trimmed} ${attachmentText}` : attachmentText;
    }
    let inspectionDetailsContent = templateContent
      ? await replacePlaceholders(inspectionDetailsRaw, templateData)
      : 'Inspection details content not found';
    inspectionDetailsContent = applyClearanceAttachmentPlaceholders(inspectionDetailsContent, attachmentText);

    const inspectionExclusionsContent = templateContent
      ? await replacePlaceholders(
          stripClearanceAttachmentPlaceholdersFromRaw(templateContent.standardSections.inspectionExclusionsContent),
          templateData,
        )
      : 'Inspection exclusions content not found';

    const clearanceCertificationContent = templateContent
      ? await replacePlaceholders(
          stripClearanceAttachmentPlaceholdersFromRaw(templateContent.standardSections.clearanceCertificationContent),
          templateData,
        )
      : 'Clearance certification content not found';

    const signOffContentRaw = templateContent
      ? await replacePlaceholders(
          stripClearanceAttachmentPlaceholdersFromRaw(templateContent.standardSections.signOffContent),
          templateData,
        )
      : 'Sign-off content not found';
    const signOffContent = `<div class="signature-block">${signOffContentRaw}</div>`;

    const asbestosRemovalItemsHtml = `
        <div class="table-container">
          <div class="table-title">Table 1: Asbestos Removal Items</div>
          <table class="clearance-table">
            <thead>
              <tr>
                ${generateClearanceItemsHeaders()}
              </tr>
            </thead>
            <tbody>
              ${generateClearanceItemsTable()}
            </tbody>
          </table>
        </div>`;

    // Prepare background information template content placeholders (async operations)
    const backgroundInformationContent = templateContent ? await replacePlaceholders(templateContent.standardSections.backgroundInformationContent, templateData) : 'Background information content not found';
    const legislativeRequirementsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.legislativeRequirementsContent, templateData) : 'Legislative requirements content not found';
    
    // Handle limitations based on clearance type (like the old PDF route)
    let clearanceCertificateLimitationsContent;
    let clearanceCertificateLimitationsTitle;
    
    if (clearanceData.clearanceType === 'Friable') {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.friableClearanceCertificateLimitationsContent, templateData) : 'Friable clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.friableClearanceCertificateLimitationsTitle || 'Friable Clearance Certificate Limitations';
    } else if (clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.friableNonFriableConditionsCertificateLimitationsContent, templateData) : 'Friable (Non-Friable Conditions) clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.friableNonFriableConditionsCertificateLimitationsTitle || 'CLEARANCE CERTIFICATE LIMITATIONS';
    } else if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.vehicleCertificateLimitationsContent, templateData) : 'Vehicle/Equipment clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.vehicleCertificateLimitationsTitle || 'Vehicle/Equipment Inspection Limitations';
    } else {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.nonFriableClearanceCertificateLimitationsContent, templateData) : 'Non-friable clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.nonFriableClearanceCertificateLimitationsTitle || 'Non-Friable Clearance Certificate Limitations';
    }

    const flowSections = buildClearanceFlowBody({
      templateContent,
      inspectionDetailsContent,
      asbestosRemovalItemsHtml,
      inspectionExclusionsContent,
      clearanceCertificationContent,
      signOffContent,
      backgroundInformationContent,
      legislativeRequirementsContent,
      clearanceCertificateLimitationsTitle,
      clearanceCertificateLimitationsContent,
    });
    const flowInnerHtml = buildClearanceMainFlowInnerHtml(flowSections, footerText, logoBase64);

    const extractPageContent = (html) => {
      const pageMatch = html.match(/<div class="page">([\s\S]*?)<\/div>\s*<\/body>/);
      return pageMatch ? `<div class="page">${pageMatch[1]}</div>` : extractBodyContent(html);
    };

    const appendixSegments = [];

    const hasSitePlan = clearanceData.sitePlan && clearanceData.sitePlanFile;
    const hasAirMonitoring = clearanceData.airMonitoring;

    const clearanceItems = clearanceData.items || clearanceData.clearanceItems || clearanceData.removalItems || clearanceData.asbestosItems || [];
    const hasPhotographs = clearanceItems.some(item =>
      item.photographs && Array.isArray(item.photographs) && item.photographs.length > 0
    );

    if (hasPhotographs) {
      const populatedAppendixACover = appendixACoverTemplateWithUrl
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
        .replace(/\[FOOTER_TEXT\]/g, footerText);
      const photosSection = generateClearancePhotographsContent();
      appendixSegments.push({
        type: 'appendix-cover',
        body: extractBodyContent(populatedAppendixACover),
        css: extractStyleContent(populatedAppendixACover),
      });
      appendixSegments.push({ type: 'photos', body: photosSection });
    }

    if (hasSitePlan) {
      const populatedAppendixBCover = extractPageContent(
        appendixBCoverTemplateWithUrl
          .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
          .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
          .replace(/\[FOOTER_TEXT\]/g, footerText)
      );
      appendixSegments.push({
        type: 'appendix-cover',
        body: populatedAppendixBCover,
        css: extractStyleContent(appendixBCoverTemplateWithUrl),
      });

      const isSitePlanImage = clearanceData.sitePlanFile && (
        clearanceData.sitePlanFile.startsWith('/9j/') ||
        clearanceData.sitePlanFile.startsWith('iVBORw0KGgo') ||
        clearanceData.sitePlanFile.startsWith('data:image/')
      );

      if (isSitePlanImage) {
        const trimmedSitePlan = await trimSitePlanImage(clearanceData.sitePlanFile);
        const clearanceDataTrimmed = { ...clearanceData, sitePlanFile: trimmedSitePlan };
        const figureTitle = clearanceData.sitePlanFigureTitle || 'Asbestos Removal Site Plan';
        const sitePlanContentPage = generateSitePlanContentPage(
          clearanceDataTrimmed,
          'B',
          logoBase64,
          footerText,
          'sitePlanFile',
          'SITE PLAN',
          figureTitle
        );
        appendixSegments.push({ type: 'site-plan', body: sitePlanContentPage });
      }

      if (hasAirMonitoring) {
        const populatedAppendixCCover = extractPageContent(
          appendixCCoverTemplateWithUrl
            .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
            .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
            .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
            .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
            .replace(/\[FOOTER_TEXT\]/g, footerText)
        );
        appendixSegments.push({
          type: 'appendix-cover',
          body: populatedAppendixCCover,
          css: extractStyleContent(appendixCCoverTemplateWithUrl),
        });
      }
    } else if (hasAirMonitoring) {
      const populatedAppendixBCover = extractPageContent(
        appendixBCoverTemplateWithUrl
          .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
          .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
          .replace(/\[FOOTER_TEXT\]/g, footerText)
          .replace(/APPENDIX B/g, 'APPENDIX B')
          .replace(/SITE PLAN/g, 'AIR MONITORING REPORT')
      );
      appendixSegments.push({
        type: 'appendix-cover',
        body: populatedAppendixBCover,
        css: extractStyleContent(appendixBCoverTemplateWithUrl),
      });
    }

    const completeHTML = assembleClearanceSingleHTML({
      coverHtml: populatedCover,
      versionHtml: populatedVersionControl,
      flowBody: flowInnerHtml,
      appendixSegments,
      frontendUrl,
      logoBase64,
    });

    return completeHTML;
  } catch (error) {
    console.error('Error generating clearance HTML V2:', error);
    throw new Error(`Failed to generate clearance HTML V2: ${error.message}`);
  }
};

/**
 * Generate enclosure inspection certificate HTML using the asbestos clearance
 * templates/layout, with enclosure-specific main content and appendices.
 */
const generateEnclosureCertificateHTML = async (
  clearanceData,
  enclosureData = {},
  pdfId = "unknown",
) => {
  const templateDir = path.join(
    __dirname,
    "../templates/DocRaptor/AsbestosClearance",
  );
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const replaceFrontendUrl = (template) =>
    template.replace(/\[FRONTEND_URL\]/g, frontendUrl);

  const friableTemplate = await getTemplateByType("asbestosClearanceFriable");

  const coverTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "CoverPage.html"), "utf8"),
  );
  const versionControlTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "VersionControl.html"), "utf8"),
  );
  const inspectionDetailsTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "InspectionDetails.html"), "utf8"),
  );
  const appendixACoverTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "AppendixACover.html"), "utf8"),
  );
  const appendixBCoverTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "AppendixBCover.html"), "utf8"),
  );
  const photoItemTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "PhotoItem.html"), "utf8"),
  );
  const photoPageTemplate = replaceFrontendUrl(
    fs.readFileSync(path.join(templateDir, "PhotoPage.html"), "utf8"),
  );

  const logoPath = path.join(__dirname, "../assets/logo.png");
  const watermarkPath = path.join(__dirname, "../assets/logo_small hi-res.png");
  const backgroundPath = path.join(__dirname, "../assets/clearance_front - Copy.jpg");
  const logoBase64 = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath).toString("base64")
    : "";
  const watermarkBase64 = fs.existsSync(watermarkPath)
    ? fs.readFileSync(watermarkPath).toString("base64")
    : "";
  const backgroundBase64 = fs.existsSync(backgroundPath)
    ? fs.readFileSync(backgroundPath).toString("base64")
    : "";

  const siteAddress =
    clearanceData?.projectId?.name || clearanceData?.siteName || "Unknown Site";
  const projectReference =
    clearanceData?.projectId?.projectID ||
    clearanceData?.project?.projectID ||
    clearanceData?.projectId ||
    "Unknown";
  const footerText = `Enclosure Inspection Certificate: ${siteAddress}`;
  let clearanceDateForPlaceholders = clearanceData?.clearanceDate;
  let inspectionTimeForPlaceholders = clearanceData?.inspectionTime || "";
  const enclosureIso = clearanceData?.enclosureInspectionDateTime;
  if (enclosureIso) {
    const d = new Date(enclosureIso);
    if (!Number.isNaN(d.getTime())) {
      clearanceDateForPlaceholders = d;
      const parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: SYDNEY_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const hh = parts.find((p) => p.type === "hour")?.value || "00";
      const mm = parts.find((p) => p.type === "minute")?.value || "00";
      inspectionTimeForPlaceholders = `${hh}:${mm}`;
    }
  }
  const clearanceDateLabel = formatClearanceDate(clearanceDateForPlaceholders);
  const inspectionDateLabel = clearanceDateLabel;
  const issueDate = formatClearanceDate(new Date());
  const inspectedByTrimmed = (clearanceData?.enclosureInspectedBy || "").trim();
  const laaName = inspectedByTrimmed
    ? inspectedByTrimmed
    : clearanceData?.createdBy?.firstName && clearanceData?.createdBy?.lastName
      ? `${clearanceData.createdBy.firstName} ${clearanceData.createdBy.lastName}`
      : clearanceData?.LAA || "Unknown LAA";
  const enclosureDescription = (enclosureData?.description || "").trim();
  const enclosurePhotos = Array.isArray(enclosureData?.photos)
    ? enclosureData.photos.filter((p) => p && p.data)
    : [];

  const resolvedLegislation = await resolveSelectedLegislation(
    friableTemplate?.selectedLegislation,
  );
  const selectedLegislation =
    Array.isArray(clearanceData?.legislation) && clearanceData.legislation.length > 0
      ? clearanceData.legislation
      : resolvedLegislation;

  const enclosureTemplateData = {
    ...clearanceData,
    LAA: laaName,
    clearanceDate: clearanceDateForPlaceholders,
    inspectionTime: inspectionTimeForPlaceholders,
    selectedLegislation,
  };

  const enclosureIntroTemplate =
    "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual inspection and smoke test of the friable asbestos removal enclosure(s) located at {SITE_NAME} (herein referred to as 'the Site').\n\n" +
    `This enclosure was constructed by {ASBESTOS_REMOVALIST}.  {LAA_NAME} ({LAA_STATE} Licenced Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on ${inspectionDateLabel}.`;

  const introProcessed = await replacePlaceholders(
    enclosureIntroTemplate,
    enclosureTemplateData,
  );

  const legislativeRequirementsTitle =
    friableTemplate?.standardSections?.legislativeRequirementsTitle ||
    "LEGISLATIVE REQUIREMENTS";
  const rawLegislative =
    friableTemplate?.standardSections?.legislativeRequirementsContent || "";
  const legislativeFromFriableTemplate = rawLegislative
    ? stripEnclosureLegislativeTemplateIntro(
        await replacePlaceholders(
          legislativeTemplateBulletsOnly(rawLegislative, { legislationOnly: true }),
          enclosureTemplateData,
        ),
      )
    : "";
  const limitationsTitle = "LIMITATIONS";
  const limitationsBodyHtml = `<p class="paragraph">${escapeHtml(
    "This inspection certificate is specific to the time and date when the enclosure was inspected. It is the responsibility of the asbestos removal supervisor to re-inspect the enclosure periodically to ensure it remains fully sealed.",
  )}</p>`;

  const preSignoffSections = `
<div class="enclosure-pre-signoff">
  <div class="section-header">${escapeHtml(legislativeRequirementsTitle)}</div>
  <p class="paragraph enclosure-leg-intro">Asbestos enclosure inspections are conducted and reported in general accordance with and with reference to:</p>
  <div class="enclosure-leg-template">${legislativeFromFriableTemplate}</div>
  <div class="section-header">${escapeHtml(limitationsTitle)}</div>
  <div class="enclosure-lim-template">${limitationsBodyHtml}</div>
</div>`;

  const attachmentsTextParts = [];
  if (enclosurePhotos.length > 0) {
    attachmentsTextParts.push(
      "Enclosure inspection photographs are presented in Appendix A.",
    );
  }
  if (clearanceData?.sitePlanFile) {
    const sitePlanLetter = enclosurePhotos.length > 0 ? "B" : "A";
    attachmentsTextParts.push(
      `The enclosure plan is presented in Appendix ${sitePlanLetter}.`,
    );
  }
  const attachmentsText = attachmentsTextParts.join(" ");

  let enclosureCertificateApprovedBy;
  if (clearanceData?.enclosureCertificateApprovedBy) {
    enclosureCertificateApprovedBy = clearanceData.enclosureCertificateApprovedBy;
  } else {
    enclosureCertificateApprovedBy =
      '<span style="color: red;">Awaiting Authorisation</span>';
  }
  const enclosureSitePlanFigureTitle = (() => {
    const t = (clearanceData?.sitePlanFigureTitle || "").trim();
    if (!t || t === "Asbestos Removal Site Plan") {
      return "Asbestos Removal Enclosure Site Plan";
    }
    return t;
  })();

  let populatedCover = coverTemplate
    .replace(/\[REPORT_TYPE\]/g, "Enclosure Inspection")
    .replace(/\[REPORT_TITLE\]/g, "ENCLOSURE INSPECTION<br />CERTIFICATE")
    .replace(/\[SITE_ADDRESS\]/g, siteAddress)
    .replace(/\[SECONDARY_HEADER\]/g, "")
    .replace(/\[JOB_REFERENCE\]/g, projectReference)
    .replace(/\[CLEARANCE_DATE\]/g, clearanceDateLabel)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`)
    .replace(
      /\[CLIENT_NAME\]/g,
      clearanceData?.projectId?.client?.name ||
        clearanceData?.clientName ||
        "Unknown Client",
    );
  populatedCover = populatedCover.replace(
    /\s*<div class="secondary-header">\s*<\/div>\s*/,
    "\n        ",
  );

  const revisionRows = `
    <tr>
      <td>Original Issue</td>
      <td>0</td>
      <td>${enclosureCertificateApprovedBy}</td>
      <td>${issueDate}</td>
    </tr>
  `;
  const versionFilename = `${projectReference}: Enclosure Inspection Certificate - ${siteAddress} (${clearanceDateLabel})`;
  const populatedVersionControl = versionControlTemplate
    .replace(/\[REPORT_TYPE\]/g, "Enclosure Inspection")
    .replace(/\[REPORT_TITLE\]/g, "ENCLOSURE INSPECTION CERTIFICATE")
    .replace(/\[SITE_ADDRESS\]/g, siteAddress)
    .replace(
      /\[CLIENT_NAME\]/g,
      clearanceData?.projectId?.client?.name ||
        clearanceData?.clientName ||
        "Unknown Client",
    )
    .replace(/\[CLEARANCE_DATE\]/g, issueDate)
    .replace(/\[LAA_NAME\]/g, laaName)
    .replace(/\[REPORT_AUTHORISER\]/g, enclosureCertificateApprovedBy)
    .replace(/\[FILENAME\]/g, versionFilename)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
    .replace(/\[FOOTER_TEXT\]/g, footerText)
    .replace(
      /<tr>\s*<td style="height: 32px"><\/td>\s*<td><\/td>\s*<td><\/td>\s*<td><\/td>\s*<\/tr>/g,
      revisionRows,
    );

  const descriptionBody = enclosureDescription
    ? escapeHtml(enclosureDescription).replace(/\r?\n/g, "<br>")
    : "<em>No enclosure description provided.</em>";
  const inspectionDetailsContent = `<div class="enclosure-intro-desc"><p class="paragraph">${introProcessed}</p><p class="paragraph">${descriptionBody}</p></div>`;
  const inspectionExclusionsContent = "";
  const clearanceCertificationContent = `
    <p class="paragraph">The inspection identified no obvious penetrations or faults in the enclosure. A smoke test was undertaken using a portable smoke machine incorporating non-oil-based, non-toxic smoke fluids. Smoke was generated and dispersed throughout the enclosure with a focus on joins in the enclosure plastic including decontamination units and negative pressure units. Inspection of the enclosure during the smoke testing identified that no smoke was migrating through the enclosure barrier.  The enclosure has therefore been certified by the assessor as suitable for asbestos removal.</p>
  `;
  const signOffTemplateText =
    friableTemplate?.standardSections?.signOffContent ||
    "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}";
  let signOffProcessed = await replacePlaceholders(
    signOffTemplateText,
    enclosureTemplateData,
  );
  signOffProcessed = signOffProcessed.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*){2,}/gi, "<br>");
  const signOffContent = `<div class="signature-block">${signOffProcessed}</div>`;

  const populatedInspectionDetails = inspectionDetailsTemplate
    .replace(/\[REPORT_TYPE\]/g, "Enclosure Inspection")
    .replace(/\[SITE_ADDRESS\]/g, siteAddress)
    .replace(/\[CLEARANCE_DATE\]/g, clearanceDateLabel)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(
      /\[CLIENT_NAME\]/g,
      clearanceData?.projectId?.client?.name ||
        clearanceData?.clientName ||
        "Unknown Client",
    )
    .replace(/\[ASBESTOS_TYPE\]/g, "Friable")
    .replace(
      /\[ASBESTOS_REMOVALIST\]/g,
      clearanceData?.asbestosRemovalist || "Unknown Removalist",
    )
    .replace(/\[LAA_NAME\]/g, laaName)
    .replace(/\[LAA_LICENSE\]/g, "AA00031")
    .replace(/\[SIGNATURE_IMAGE\]/g, "")
    .replace(/\[ASBESTOS_REMOVAL_ITEMS_HTML\]/g, "")
    .replace(/\[INSPECTION_DETAILS_TITLE\]/g, "INSPECTION DETAILS")
    .replace(/\[INSPECTION_DETAILS_CONTENT\]/g, inspectionDetailsContent)
    .replace(/\[INSPECTION_EXCLUSIONS_TITLE\]/g, "")
    .replace(/\[INSPECTION_EXCLUSIONS_CONTENT\]/g, inspectionExclusionsContent)
    .replace(/\[CLEARANCE_CERTIFICATION_TITLE\]/g, "INSPECTION CERTIFICATION")
    .replace(/\[CLEARANCE_CERTIFICATION_CONTENT\]/g, clearanceCertificationContent)
    .replace(/\[PRE_SIGNOFF_SECTIONS\]/g, preSignoffSections)
    .replace(/\[INSPECTION_PAGE_VARIANT_CLASS\]/g, " enclosure-inspection-cert")
    .replace(/\[SIGN_OFF_CONTENT\]/g, signOffContent)
    .replace(/\[ATTACHMENTS\]/g, attachmentsText)
    .replace(/\[FOOTER_TEXT\]/g, footerText);

  const DEFAULT_ENCLOSURE_PHOTO_CAPTION =
    "Photograph of removal enclosure taken during inspection";

  let appendixContent = "";

  if (enclosurePhotos.length > 0) {
    const appendixACover = appendixACoverTemplate
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, footerText);

    const photoPages = [];
    for (let i = 0; i < enclosurePhotos.length; i += 2) {
      const pagePhotos = enclosurePhotos.slice(i, i + 2);
      const photoItems = pagePhotos
        .map((photo, index) => {
          const n = i + index + 1;
          const captionRaw = (photo.description || "").trim();
          const caption = escapeHtml(
            captionRaw || DEFAULT_ENCLOSURE_PHOTO_CAPTION,
          );
          return photoItemTemplate
            .replace(/\[PHOTO_URL\]/g, photo.data)
            .replace(/\[PHOTO_NUMBER\]/g, String(n))
            .replace(/\[LEVEL_FLOOR\]/g, "")
            .replace(/\[LEVEL_FLOOR_DISPLAY\]/g, "none")
            .replace(/\[ROOM_AREA\] - \[MATERIAL_DESCRIPTION\]/g, caption)
            .replace(/\[ROOM_AREA\]/g, "")
            .replace(/\[MATERIAL_DESCRIPTION\]/g, "");
        })
        .join("");
      const page = photoPageTemplate
        .replace(/\[PHOTO_ITEMS\]/g, photoItems)
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[FOOTER_TEXT\]/g, footerText);
      photoPages.push(page);
    }

    appendixContent += `${appendixACover}${photoPages.join('<div class="page-break"></div>')}`;
  }

  if (clearanceData?.sitePlanFile) {
    const sitePlanLetter = enclosurePhotos.length > 0 ? "B" : "A";
    const sitePlanCover = appendixBCoverTemplate
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, footerText)
      .replace(/APPENDIX B/g, `APPENDIX ${sitePlanLetter}`)
      .replace(/SITE PLAN/g, "ENCLOSURE PLAN");
    const trimmedSitePlan = await trimSitePlanImage(clearanceData.sitePlanFile);
    const sitePlanPage = generateSitePlanContentPage(
      { ...clearanceData, sitePlanFile: trimmedSitePlan },
      sitePlanLetter,
      logoBase64,
      footerText,
      "sitePlanFile",
      "ENCLOSURE PLAN",
      enclosureSitePlanFigureTitle,
    );

    appendixContent += `<div class="page-break"></div>${sitePlanCover}${sitePlanPage}`;
  }

  const completeHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Enclosure Inspection Certificate</title>
        <style>
          .page-break { page-break-before: always; height: 0; margin: 0; padding: 0; }
          .page.enclosure-inspection-cert .section-header:empty {
            display: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          .page.enclosure-inspection-cert .section-header.first-section {
            margin-bottom: 2px !important;
          }
          .page.enclosure-inspection-cert .content > div.section-header:not(.first-section):not(:empty) {
            margin-top: 10px !important;
            margin-bottom: 2px !important;
          }
          .page.enclosure-inspection-cert .enclosure-pre-signoff .section-header {
            margin-top: 16px !important;
            margin-bottom: 10px !important;
          }
          .page.enclosure-inspection-cert .enclosure-pre-signoff .section-header:first-child {
            margin-top: 14px !important;
          }
          .page.enclosure-inspection-cert .enclosure-pre-signoff .enclosure-leg-intro {
            margin-top: 0 !important;
            margin-bottom: 8px !important;
          }
          .page.enclosure-inspection-cert .enclosure-leg-template,
          .page.enclosure-inspection-cert .enclosure-lim-template {
            margin-top: 0 !important;
          }
          .page.enclosure-inspection-cert .enclosure-lim-template {
            margin-bottom: 4px !important;
          }
          .page.enclosure-inspection-cert .signature-block {
            margin-top: 2px !important;
            margin-bottom: 0 !important;
            line-height: 1.28;
            font-size: 0.76rem;
          }
          .page.enclosure-inspection-cert .signature-block .paragraph {
            margin-top: 0 !important;
            margin-bottom: 2px !important;
            line-height: 1.28;
            font-size: 0.76rem;
          }
          .page.enclosure-inspection-cert .signature-block .paragraph:last-child {
            margin-bottom: 0 !important;
          }
          /* Enclosure appendix: landscape site plan (matches clearance V2) */
          @page site-plan-landscape {
            size: A4 landscape;
          }
          .site-plan-page {
            page: site-plan-landscape;
            page-break-before: always;
            page-break-after: avoid !important;
            page-break-inside: avoid;
            position: relative;
            transform: rotate(0deg);
            width: 100vh !important;
            height: 100vw !important;
            box-sizing: border-box !important;
          }
          .site-plan-page + * {
            page-break-before: avoid !important;
          }
          .site-plan-page:last-child {
            page-break-after: avoid !important;
          }
          .site-plan-page .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            width: 100vh !important;
            box-sizing: border-box !important;
            padding: 16px 48px 0 48px !important;
            margin: 0;
          }
          .site-plan-page .green-line {
            width: calc(100vh - 96px) !important;
            height: 1.5px;
            background: #16b12b;
            margin: 8px auto 0 auto;
            border-radius: 0;
          }
          .site-plan-page .footer {
            width: calc(100vh - 96px) !important;
            box-sizing: border-box !important;
            position: absolute !important;
            left: 48px !important;
            right: auto !important;
            bottom: 16px !important;
            margin: 0 !important;
            text-align: justify;
            font-size: 0.75rem;
            color: #222;
          }
          .site-plan-page .logo {
            width: 243px;
            height: auto;
            display: block;
            background: #fff;
            margin: 0;
          }
          .site-plan-page .company-details {
            text-align: right;
            font-size: 0.75rem;
            color: #222;
            line-height: 1.5;
            margin: 0;
          }
          .site-plan-page .company-details .website {
            color: #16b12b;
            font-weight: 500;
          }
          .site-plan-page .footer-border-line {
            width: 100%;
            height: 1.5px;
            background: #16b12b;
            margin-bottom: 6px;
            border-radius: 0;
          }
          .site-plan-page .footer-content {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .site-plan-page .content {
            padding: 5px 48px 10px 48px !important;
            min-height: auto !important;
            height: auto !important;
            max-height: calc(100vh - 150px) !important;
            overflow: hidden !important;
          }
          .site-plan-container {
            box-shadow: none !important;
            padding: 0 !important;
            width: fit-content !important;
            max-width: 93.5% !important;
            box-sizing: border-box !important;
            margin: 12px 0 0 0 !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .site-plan-container img {
            border-radius: 0 !important;
            max-height: calc((100vw - 200px) * 0.99 * 1.1) !important;
            object-fit: contain !important;
            width: auto !important;
            height: auto !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 1.5px solid #999 !important;
            box-sizing: border-box !important;
            background: transparent !important;
          }
          .site-plan-legend-container {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        </style>
      </head>
      <body>
        ${populatedCover}
        <div class="page-break"></div>
        ${populatedVersionControl}
        <div class="page-break"></div>
        ${populatedInspectionDetails}
        ${appendixContent ? `<div class="page-break"></div>${appendixContent}` : ""}
      </body>
    </html>
  `;

  if (process.env.NODE_ENV === "development") {
    const htmlFilePath = path.join(__dirname, "..", "debug", `enclosure-${pdfId}.html`);
    fs.mkdirSync(path.dirname(htmlFilePath), { recursive: true });
    fs.writeFileSync(htmlFilePath, completeHTML);
  }

  return completeHTML;
};

// Sharp is optional: native bindings may be missing on some platforms (e.g. Windows). Resolved once at first use.
let sharpModule = undefined;
function getSharp() {
  if (sharpModule === undefined) {
    try {
      sharpModule = require('sharp');
    } catch (err) {
      sharpModule = null;
      console.warn('Sharp not available on this system; site plan images will not be trimmed.', err.message);
    }
  }
  return sharpModule;
}

/**
 * Trim whitespace from site plan image so only the drawn content is shown.
 * If Sharp is unavailable (e.g. missing native bindings on Windows), returns the original without warning.
 * @param {string} base64OrDataUrl - Base64 image data or data URL
 * @returns {Promise<string>} - Trimmed base64 (no data URL prefix)
 */
const trimSitePlanImage = async (base64OrDataUrl) => {
  if (!base64OrDataUrl || typeof base64OrDataUrl !== 'string') return base64OrDataUrl;
  let base64 = base64OrDataUrl;
  if (base64.startsWith('data:')) {
    const i = base64.indexOf(',');
    base64 = i >= 0 ? base64.slice(i + 1) : base64;
  }
  const sharp = getSharp();
  if (!sharp) return base64;
  try {
    const buf = Buffer.from(base64, 'base64');
    const trimmed = await sharp(buf).trim({ threshold: 10 }).toBuffer();
    return trimmed.toString('base64');
  } catch (err) {
    return base64;
  }
};

/**
 * Generate site plan content page HTML
 * @param {Object} data - Clearance data
 * @param {string} appendixLetter - Appendix letter (B, C, etc.)
 * @param {string} logoBase64 - Base64 encoded logo
 * @param {string} footerText - Footer text to display
 * @returns {string} - HTML for site plan content page
 */
const generateSitePlanContentPage = (
  data,
  appendixLetter = 'B',
  logoBase64,
  footerText = '',
  fileField = 'sitePlanFile',
  title = 'SITE PLAN',
  figureTitle = 'Asbestos Removal Site Plan',
  legendField = 'sitePlanLegend',
  legendTitleField = 'sitePlanLegendTitle',
  cropTopBottomPx = 0,
  figureNumber = 1
) => {
  const fileData = data[fileField];
  const legendEntries = Array.isArray(data[legendField])
    ? data[legendField]
        .filter((entry) => entry && entry.color)
        .map((entry) => ({
          color: entry.color,
          description: entry.description,
        }))
    : [];

  const legendHeading =
    (data[legendTitleField] && data[legendTitleField].trim()) || 'Key';

  if (!fileData) {
    const legendColumn =
      legendEntries.length > 0
        ? `
          <div class="site-plan-legend-container" style="flex: 0 0 280px; max-width: 280px; min-width: 260px; border: none; border-radius: 0; background-color: #ffffff; padding: 16px 14px; box-shadow: none;">
            <div style="font-weight: 600; font-size 13px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; color: #1f2937;">
              ${escapeHtml(legendHeading)}
            </div>
            ${legendEntries
              .map((entry) => {
                const description =
                  entry.description && entry.description.trim()
                    ? escapeHtml(entry.description.trim())
                    : '<span style="color:#9ca3af;">(-)</span>';
                const semanticMarkerLabel =
                  typeof entry.description === "string" &&
                  /lead\s*paint\s*\/\s*exceedance/i.test(entry.description)
                    ? "LD-XX"
                    : typeof entry.description === "string" &&
                        /lead-?\s*free\s*\/\s*non-?\s*exceedance/i.test(entry.description)
                      ? "LD-XX"
                      : "";
              return `
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; min-width:29px; max-width:29px; min-height:29px; max-height:29px; border-radius:4px; border:1px solid rgba(55,65,81,0.45); background:${normalizeColorForDisplay(entry.color)}; flex-shrink:0; box-sizing:border-box; color:#fff; font-size:8px; font-weight:700; letter-spacing:0.2px;">${semanticMarkerLabel}</span>
                  <span style="font-size:10px; color:#334155; line-height:1.4; flex:1; min-width:0; margin-left:16px; padding-right:12px; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">${description}</span>
                </div>
              `;
              })
              .join('')}
          </div>`
        : '';

    return `
      <div class="page site-plan-page">
        <div class="header">
          <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street<br />
            Mitchell ACT 2911<br />
            <span class="website">www.landd.com.au</span>
          </div>
        </div>
        <div class="green-line"></div>
        <div class="content">
          <div class="site-plan-layout" style="display: flex; flex-direction: row; justify-content: center; gap: 8px; align-items: flex-start; margin: 0; padding: 0; width: 100%;">
            <div class="site-plan-container" style="flex: 0 0 60%; max-width: 600px; padding: 32px; border: none; background-color: #f9fafb; border-radius: 0; box-sizing: border-box; color: #4b5563; text-align:center; box-shadow: none;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Site Plan Provided</div>
              <div style="font-size: 12px;">A site plan has not been uploaded or drawn for this clearance.</div>
            </div>
            ${legendColumn}
          </div>
        </div>
        <div class="footer">
          <div class="footer-border-line"></div>
          <div class="footer-content">
            <div class="footer-text">${escapeHtml(footerText || `Asbestos Assessment Report: ${data.projectId?.name || data.siteName || 'Unknown Site'}`)}</div>
          </div>
        </div>
      </div>
    `;
  }

  const isDataUrl = fileData.startsWith('data:');
  
  let fileType, imageSrc;
  
  if (isDataUrl) {
    // It's already a complete data URL
    imageSrc = fileData;
    fileType = 'image';
  } else {
    // It's base64 data without the data URL prefix
    fileType = fileData.startsWith('/9j/') ? 'image/jpeg' : 
               fileData.startsWith('iVBORw0KGgo') ? 'image/png' : 
               'application/pdf';
    imageSrc = `data:${fileType};base64,${fileData}`;
  }
  
  let content = '';
  
  const legendColumn =
    legendEntries.length > 0
        ? `
          <div class="site-plan-legend-container" style="flex: 0 0 280px; max-width: 280px; min-width: 260px; border: 3px; border-radius: 0; background-color: #ffffff; padding: 12px 14px; align-self: stretch; box-shadow: none;">
            <div style="font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; color: #1f2937;">
              ${escapeHtml(
                (data[legendTitleField] && data[legendTitleField].trim()) ||
                  "Key"
              )}
            </div>
            ${legendEntries
              .map((entry) => {
                const description =
                  entry.description && entry.description.trim()
                    ? escapeHtml(entry.description.trim())
                    : '<span style="color:#9ca3af;">(-)</span>';
                const semanticMarkerLabel =
                  typeof entry.description === "string" &&
                  /lead\s*paint\s*\/\s*exceedance/i.test(entry.description)
                    ? "LD-XX"
                    : typeof entry.description === "string" &&
                        /lead-?\s*free\s*\/\s*non-?\s*exceedance/i.test(entry.description)
                      ? "LD-XX"
                      : "";
                return `
                  <div style="display:flex; align-items:center; margin-bottom:8px;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; min-width:29px; max-width:29px; min-height:29px; max-height:29px; border-radius:4px; border:1px solid rgba(55,65,81,0.45); background:${normalizeColorForDisplay(entry.color)}; flex-shrink:0; box-sizing:border-box; color:#fff; font-size:8px; font-weight:700; letter-spacing:0.2px;">${semanticMarkerLabel}</span>
                    <span style="font-size:10px; color:#334155; margin-left:16px; line-height:1.4; flex:1; min-width:0; padding-right:12px; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">${description}</span>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : '';

  if (fileType.startsWith('image/') || isDataUrl) {
    const safeFigureTitle = escapeHtml(figureTitle || 'Site Plan');
    const cropPx = Math.max(0, Number(cropTopBottomPx) || 0);
    const imgTag = `<img src="${imageSrc}" 
                 alt="${escapeHtml(title)}" 
                 class="site-plan-image"
                 style="width: auto; height: auto; max-width: 100%; max-height: 96vh; object-fit: contain; display: block; border: 1.5px solid #999; margin: 0; padding: 0; box-sizing: border-box;" />`;
    content = `
      <div class="site-plan-layout" style="display: flex; flex-direction: row; justify-content: flex-start; gap: 10px; align-items: flex-start; margin: 0; padding: 0 8px 0 0; width: 100%;">
        <div class="site-plan-container" style="flex: 1 1 auto; width: auto; max-width: none; min-width: 0; padding: 0; margin: 12px 0 0 0; border: none; background: transparent; border-radius: 0; box-sizing: border-box; box-shadow: none;">
          <div class="site-plan-image-wrapper" style="flex: 0 0 auto; width: fit-content; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; background: transparent;">
            ${cropPx > 0 ? `<div class="site-plan-crop" style="width: 100%; height: calc(100% - ${2 * cropPx}px); overflow: hidden;"><img src="${imageSrc}" alt="${escapeHtml(title)}" class="site-plan-image site-plan-image-cropped" style="display: block; width: 100%; height: calc(100% + ${2 * cropPx}px); object-fit: contain; object-position: center; margin-top: -${cropPx}px;" /></div>` : imgTag}
          </div>
          <div class="site-plan-figure-caption" style="font-size: 14px; font-weight: 400; color: #1f2937; text-align: left; margin-top: 12px;">
            ${safeFigureTitle}
          </div>
        </div>
        ${legendColumn}
      </div>
    `;
  } else {
    content = `
      <div class="site-plan-layout" style="display: flex; flex-direction: row; justify-content: flex-start; gap: 10px; align-items: flex-start; margin: 0; padding: 0 8px 0 0; width: 100%;">
        <div class="site-plan-container" style="flex: 1 1 auto; max-width: none; min-width: 0; padding: 0; border: none; background-color: #ffffff; border-radius: 0; box-sizing: border-box; text-align:center; box-shadow: none;">
          <div class="appendix-title" style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text" style="font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">${title}</div>
          <div class="file-note" style="font-size: 12px; color: #4b5563;">Document attached</div>
        </div>
        ${legendColumn}
      </div>
    `;
  }

  return `
        <div class="page site-plan-page">
          <div class="header">
            <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
            <div class="company-details">
              Lancaster & Dickenson Consulting Pty Ltd<br />
              4/6 Dacre Street<br />
              Mitchell ACT 2911<br />
              <span class="website">www.landd.com.au</span>
            </div>
          </div>
          <div class="green-line"></div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <div class="footer-border-line"></div>
            <div class="footer-content">
              <div class="footer-text">${escapeHtml(footerText || `Asbestos Assessment Report: ${data.projectId?.name || data.siteName || 'Unknown Site'}`)}</div>
            </div>
          </div>
        </div>
      `;
};

/**
 * Merge two PDFs together
 * @param {Buffer} pdf1Buffer - First PDF buffer (clearance report)
 * @param {string|Buffer} pdf2Base64OrBuffer - Second PDF as base64 string or Buffer (air monitoring report, site plan, or generated appendix cover)
 * @returns {Promise<Buffer>} - Merged PDF as buffer
 */
const mergePDFs = async (pdf1Buffer, pdf2Base64OrBuffer) => {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Load the first PDF (clearance report or assessment report)
    const pdf1Doc = await PDFDocument.load(pdf1Buffer);
    const pdf1Pages = await mergedPdf.copyPages(pdf1Doc, pdf1Doc.getPageIndices());
    pdf1Pages.forEach((page) => mergedPdf.addPage(page));

    // Load the second PDF: accept Buffer or base64 string
    let pdf2Buffer;
    if (Buffer.isBuffer(pdf2Base64OrBuffer)) {
      pdf2Buffer = pdf2Base64OrBuffer;
    } else {
      const str = String(pdf2Base64OrBuffer);
      const cleanBase64 = str.startsWith('data:') ? str.split(',')[1] : str;
      pdf2Buffer = Buffer.from(cleanBase64, 'base64');
    }
    
    // Load the second PDF with specific options to preserve layout
    const pdf2Doc = await PDFDocument.load(pdf2Buffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    
    
    // Try to fix the coordinate system issue by using a different approach
    // Instead of trying to normalize dimensions, let's try to preserve the original layout
    try {
      const pdf2Pages = await mergedPdf.copyPages(pdf2Doc, pdf2Doc.getPageIndices());
      pdf2Pages.forEach((page, index) => {
        // Add the page directly without any modifications
        // This preserves the original coordinate system and layout exactly as generated
        mergedPdf.addPage(page);
      });
    } catch (copyError) {
      console.error('Error copying pages:', copyError.message);
      throw copyError;
    }
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error('Error in mergePDFs:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

/**
 * Generate Lead Clearance Report HTML (cover + inspection details + template sections).
 * Uses same assets and styling as asbestos clearance; content from leadClearance report template.
 */
const generateLeadClearanceHTML = async (clearanceData, pdfId = 'unknown') => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
  const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
  const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
  const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

  const siteAddress = clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site';
  const jobRef = clearanceData.projectId?.projectID || clearanceData.projectId || 'Unknown';
  const clearanceDateStr = formatClearanceDate(clearanceData.clearanceDate);
  const footerText = `Lead Removal Clearance Certificate: ${siteAddress}`;
  const reportAuthoriserText = clearanceData.reportApprovedBy
    ? clearanceData.reportApprovedBy
    : '<span style="color: red;">Awaiting Authorisation</span>';
  const consultant = clearanceData.consultant || 'Unknown';
  const leadAbatementContractor = clearanceData.leadAbatementContractor || 'Unknown';
  const inspectionTimeStr = formatInspectionTime(clearanceData.inspectionTime);
  const inspectionDateStr = clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown';
  const secondaryHeader = clearanceData.secondaryHeader || '';

  // Resolve jurisdiction for {LEGISLATION} filtering: prefer linked lead removal job, then clearance
  let jurisdiction = clearanceData.jurisdiction;
  const jobId = clearanceData.leadRemovalJobId?._id || clearanceData.leadRemovalJobId;
  if (jobId) {
    const job = await LeadRemovalJob.findById(jobId).select('jurisdiction').lean();
    if (job && job.jurisdiction) jurisdiction = job.jurisdiction;
  }
  if (!jurisdiction) jurisdiction = 'ACT';

  // Fetch lead clearance template and resolve section content with placeholders.
  // Legislation always comes from the template's related legislation (checkboxes), filtered by jurisdiction.
  const templateContent = await getTemplateByType('leadClearance');
  const resolvedLegislation = await resolveSelectedLegislation(templateContent?.selectedLegislation);
  const selectedLegislation = resolvedLegislation;
  const hasDustOrSoilSamples =
    (Array.isArray(clearanceData.sampling?.preWorksSamples) && clearanceData.sampling.preWorksSamples.length > 0) ||
    (Array.isArray(clearanceData.sampling?.validationSamples) && clearanceData.sampling.validationSamples.length > 0);
  const templateData = {
    ...clearanceData,
    jurisdiction,
    LAA: consultant,
    asbestosRemovalist: leadAbatementContractor,
    selectedLegislation,
    jobSpecificExclusions: clearanceData.jobSpecificExclusions || '',
    clientName: clearanceData.projectId?.client?.name || clearanceData.clientName,
    leadSampling: hasDustOrSoilSamples, // {LEAD_SAMPLING?} → " and sampling to assess for elevated lead dust" only when clearance has dust/soil samples
  };
  const sections = {
    inspectionDetailsContent: templateContent?.standardSections?.inspectionDetailsContent ?? '',
    clearanceCertificationContent: templateContent?.standardSections?.clearanceCertificationContent ?? '',
    backgroundContent: templateContent?.standardSections?.backgroundContent ?? '',
    regulatoryGuidanceContent: templateContent?.standardSections?.regulatoryGuidanceContent ?? '',
    assessmentMethodologyContent: templateContent?.standardSections?.assessmentMethodologyContent ?? '',
    assessmentCriteriaContent: templateContent?.standardSections?.assessmentCriteriaContent ?? '',
    statementOfLimitationsContent: templateContent?.standardSections?.statementOfLimitationsContent ?? '',
  };
  const sectionHtml = {};
  for (const [key, raw] of Object.entries(sections)) {
    sectionHtml[key] = raw ? await replacePlaceholders(raw, templateData) : '';
  }

  const items = clearanceData.items || [];
  const hasLevelFloor = items.some(item => item.levelFloor && String(item.levelFloor).trim() !== '');

  const thLevelFloor = hasLevelFloor ? '<th style="width: 12%;">Level/Floor</th>' : '';
  // Works Completed 30% narrower; freed width split equally between Room/Area and Location Description. Order: Room/Area, Location Description, Works Completed, Photo No.
  const tableHeaders = hasLevelFloor
    ? `<th style="width: 17%;">Room/Area</th><th style="width: 32%;">Location Description</th><th style="width: 32%;">Works Completed</th><th style="width: 7%;">Photo No.</th>`
    : `<th style="width: 19%;">Room/Area</th><th style="width: 38%;">Location Description</th><th style="width: 35%;">Works Completed</th><th style="width: 8%;">Photo No.</th>`;

  let globalPhotoCounter = 1;
  const itemsWithPhotoNumbers = items.map((item) => {
    const photos = (item.photographs || []).filter(p => p.includeInReport !== false);
    const nums = photos.length ? Array.from({ length: photos.length }, () => globalPhotoCounter++) : [];
    return { ...item, sequentialPhotoNumbers: nums };
  });

  const rows = itemsWithPhotoNumbers.map((item) => {
    const photoText = item.sequentialPhotoNumbers.length === 0 ? '-'
      : item.sequentialPhotoNumbers.length === 1 ? String(item.sequentialPhotoNumbers[0])
      : `${item.sequentialPhotoNumbers[0]}-${item.sequentialPhotoNumbers[item.sequentialPhotoNumbers.length - 1]}`;
    const levelTd = hasLevelFloor ? `<td>${escapeHtml(item.levelFloor || '')}</td>` : '';
    return `<tr>${levelTd}<td>${escapeHtml(item.roomArea || '')}</td><td>${escapeHtml(item.locationDescription || '')}</td><td>${escapeHtml(item.worksCompleted || '')}</td><td>${escapeHtml(photoText)}</td></tr>`;
  });
  const tableBody = rows.length > 0 ? rows.join('') : `<tr><td colspan="${hasLevelFloor ? 5 : 4}" style="text-align: center; font-style: italic;">No clearance items</td></tr>`;

  const jobExclusionsHtml = (clearanceData.jobSpecificExclusions && String(clearanceData.jobSpecificExclusions).trim())
    ? await replacePlaceholders(String(clearanceData.jobSpecificExclusions).trim(), templateData)
    : 'None specified.';

  const leadSignOffTemplate = 'Please do not hesitate to contact the undersigned should you have any queries regarding this report.<br /><br />For and on behalf of Lancaster and Dickenson Consulting.<br /><div class="sign-off-signature">[SIGNATURE_IMAGE]</div><span class="sign-off-name">[LAA_NAME]</span><span class="sign-off-company">Lancaster &amp; Dickenson Consulting</span>';
  const leadSignOffHtml = await replacePlaceholders(leadSignOffTemplate, templateData);

  const appendicesForText = getLeadClearanceAppendices(clearanceData);
  const attachmentTextLead = generateLeadAttachmentText(appendicesForText);

  // Version control page (same structure as asbestos clearance)
  const leadTemplateDir = path.join(__dirname, '../templates/DocRaptor/LeadClearance');
  const versionControlTemplate = fs.existsSync(path.join(leadTemplateDir, 'VersionControl.html'))
    ? fs.readFileSync(path.join(leadTemplateDir, 'VersionControl.html'), 'utf8')
    : fs.readFileSync(path.join(__dirname, '../templates/DocRaptor/AsbestosClearance/VersionControl.html'), 'utf8');
  const versionControlTemplateWithUrl = versionControlTemplate.replace(/\[FRONTEND_URL\]/g, frontendUrl);

  const pdfGenerationDate = formatDateSydney(new Date());
  const laaName = (clearanceData.createdBy?.firstName && clearanceData.createdBy?.lastName)
    ? `${clearanceData.createdBy.firstName} ${clearanceData.createdBy.lastName}`
    : consultant;
  const versionControlFilename = `${jobRef}_Lead Clearance Report - ${siteAddress} (${clearanceDateStr})${clearanceData.sequenceNumber ? ` - ${clearanceData.sequenceNumber}` : ''}`;

  const generateLeadRevisionHistory = () => {
    const revision = clearanceData.revision || 0;
    const approvedBy = reportAuthoriserText;
    if (revision === 0) {
      return `
          <tr>
            <td>Original Issue</td>
            <td>0</td>
            <td>${approvedBy}</td>
            <td>${pdfGenerationDate}</td>
          </tr>
        `;
    }
    let revisionRows = `
          <tr>
            <td>Original Issue</td>
            <td>0</td>
            <td>${approvedBy}</td>
            <td>${pdfGenerationDate}</td>
          </tr>
        `;
    if (clearanceData.revisionReasons && clearanceData.revisionReasons.length > 0) {
      clearanceData.revisionReasons.forEach((revisionData) => {
        const revisionDate = revisionData.revisedAt ? formatDateSydney(revisionData.revisedAt) : pdfGenerationDate;
        revisionRows += `
              <tr>
                <td>${escapeHtml(revisionData.reason || '')}</td>
                <td>${revisionData.revisionNumber}</td>
                <td>${approvedBy}</td>
                <td>${revisionDate}</td>
              </tr>
            `;
      });
    } else {
      for (let i = 1; i <= revision; i++) {
        revisionRows += `
              <tr>
                <td>Report Revision</td>
                <td>${i}</td>
                <td>${approvedBy}</td>
                <td>${pdfGenerationDate}</td>
              </tr>
            `;
      }
    }
    return revisionRows;
  };

  const populatedVersionControl = versionControlTemplateWithUrl
    .replace(/\[REPORT_TITLE\]/g, 'LEAD REMOVAL CLEARANCE CERTIFICATE')
    .replace(/\[SITE_ADDRESS\]/g, escapeHtml(siteAddress))
    .replace(/\[CLIENT_NAME\]/g, escapeHtml(clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client'))
    .replace(/\[CLEARANCE_DATE\]/g, pdfGenerationDate)
    .replace(/\[LAA_NAME\]/g, escapeHtml(laaName))
    .replace(/\[FILENAME\]/g, escapeHtml(versionControlFilename))
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
    .replace(/\[FOOTER_TEXT\]/g, escapeHtml(footerText))
    .replace(/<tr>\s*<td style="height: 32px"><\/td>\s*<td><\/td>\s*<td><\/td>\s*<td><\/td>\s*<\/tr>/g, generateLeadRevisionHistory());

  const mainReportPageCount = hasDustOrSoilSamples ? 3 : 2;

  const baseStyles = `
    /* DocRaptor-optimized CSS with Gothic fonts (match asbestos clearance certificates) */
    @font-face {
      font-family: "Gothic";
      src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype");
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: "Gothic";
      src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype");
      font-weight: bold;
      font-style: normal;
    }
    @font-face {
      font-family: "Gothic";
      src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype");
      font-weight: normal;
      font-style: italic;
    }
    @font-face {
      font-family: "Gothic";
      src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype");
      font-weight: bold;
      font-style: italic;
    }
    @page { size: A4; margin: 0; }
    * { hyphens: none !important; -webkit-hyphens: none !important; -ms-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
    body { margin: 0; padding: 0; font-family: "Gothic", Arial, sans-serif; background: #fff; hyphens: none; -webkit-hyphens: none; -ms-hyphens: none; }
    .page { width: 100%; min-height: 100vh; position: relative; background: #fff; margin: 0; padding: 0; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; }
    .logo { width: 243px; height: auto; display: block; }
    .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; }
    .header-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; }
    .content { padding: 10px 48px 24px 48px; }
    .section-header { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin: 20px 0 10px 0; color: #222; }
    .paragraph { font-size: 0.8rem; margin-bottom: 8px; color: #222; line-height: 1.5; text-align: justify; }
    .content .clearance-table-title { font-size: 0.8rem; font-weight: 700; margin: 10px 0 8px 0; color: #222; line-height: 1.5; }
    .content .job-exclusions { margin-top: 0; margin-bottom: 0; padding: 0; }
    .content .clearance-certification .job-exclusions .paragraph { margin: 0; }
    .clearance-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 10px 0; }
    .clearance-table th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: 700; color: #222; }
    .clearance-table td { border: 1px solid #ddd; padding: 8px; text-align: left; color: #222; vertical-align: top; }
    .footer { position: absolute; left: 0; right: 0; bottom: 16px; width: calc(100% - 96px); margin: 0 auto; font-size: 0.75rem; color: #222; }
    .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; }
    .cover-page { width: 100%; min-height: 100vh; position: relative; background: #fff; overflow: hidden; }
    .cover-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) contrast(1.1); z-index: 0; }
    .cover-white-shape { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
    .cover-content { position: absolute; left: 0; top: 0; z-index: 5; padding: 60px 40px 40px 24px; width: 50%; margin-top: 220px; box-sizing: border-box; }
    .cover-content h1 { font-size: 1.7rem; font-weight: 700; margin: 20px 0 10px 0; letter-spacing: 0.01em; line-height: 1.2; text-transform: uppercase; color: #222; }
    .cover-page .address { font-size: 1.65rem; margin-bottom: 32px; color: #222; line-height: 1.4; }
    .cover-page .secondary-header { font-size: 1.2rem; margin-bottom: 24px; color: #444; }
    .cover-page .cover-content p { font-size: 1.3rem; margin: 0 0 10px 0; color: #222; }
    .cover-company-details { font-size: 0.75rem; color: #222; line-height: 1.5; position: absolute; bottom: 150px; left: 24px; z-index: 6; width: calc(50% - 48px); }
    .cover-logo { position: absolute; right: 32px; bottom: 32px; width: 300px; background: rgba(255,255,255,0.95); padding: 5px; border-radius: 3px; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .sign-off-block { font-size: 0.8rem; color: #222; line-height: 1.5; }
    .sign-off-block .sign-off-signature { margin: 1px 0; line-height: 1; }
    .sign-off-block img { margin: 0; padding: 0; display: block; }
    .sign-off-block .sign-off-name { display: block; margin-top: 2px; line-height: 1.3; }
    .sign-off-block .sign-off-company { display: block; margin-top: 1px; line-height: 1.3; font-weight: 500; }
    .content ul, .content .paragraph ul { margin: 0 0 8px 0; padding-left: 24px; list-style-position: outside; }
    .content ul li, .content .paragraph ul li { margin-bottom: 6px; }
    .content ul li:last-child, .content .paragraph ul li:last-child { margin-bottom: 0; }
    .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-text { flex: 1; }
    .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
    .page-break { page-break-after: always; }
  `;

  const coverPage = `
    <div class="page cover-page">
      <img class="cover-bg" src="data:image/jpeg;base64,${backgroundBase64}" alt="" />
      <svg class="cover-white-shape" viewBox="0 0 595 842" fill="white" xmlns="http://www.w3.org/2000/svg"><polygon points="0,-10 60,-10 298,200 298,642 60,852 0,852" /></svg>
      <svg class="green-bracket" viewBox="0 0 595 842" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:4;">
        <polyline points="60,-10 298,200" stroke="#16b12b" stroke-width="6" fill="none" />
        <polyline points="298,198 298,646" stroke="#16b12b" stroke-width="6" fill="none" />
        <polyline points="300,642 60,852" stroke="#16b12b" stroke-width="6" fill="none" />
      </svg>
      <div class="cover-content">
        <h1>LEAD REMOVAL<br />CLEARANCE<br />CERTIFICATE</h1>
        <div class="address">${escapeHtml(siteAddress)}</div>
        ${secondaryHeader ? `<div class="secondary-header">${formatSecondaryHeaderHtml(secondaryHeader)}</div>` : ''}
        <p><b>Job Reference</b><br />${escapeHtml(jobRef)}</p>
        <p><b>Clearance Date</b><br />${clearanceDateStr}</p>
      </div>
      <div class="cover-company-details">
        Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street, Mitchell ACT 2911<br />enquiries@landd.com.au<br />(02) 6241 2779
      </div>
      <img class="cover-logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
    </div>`;

  const inspectionPage = `
    <div class="page">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span style="color:#16b12b;font-weight:500;">www.landd.com.au</span></div>
      </div>
      <div class="header-line"></div>
      <div class="content">
        <div class="section-header">INSPECTION DETAILS</div>
        ${sectionHtml.inspectionDetailsContent || attachmentTextLead ? `<div class="paragraph">${sectionHtml.inspectionDetailsContent || ''}${sectionHtml.inspectionDetailsContent && attachmentTextLead ? ' ' : ''}${attachmentTextLead ? escapeHtml(attachmentTextLead) : ''}</div>` : ''}
        <div class="clearance-table-title">Table 1: Lead Clearance Items</div>
        <table class="clearance-table">
          <thead><tr>${thLevelFloor}${tableHeaders}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
        <div class="section-header">CLEARANCE CERTIFICATION</div>
        <div class="clearance-certification">
        ${sectionHtml.clearanceCertificationContent ? `<div class="paragraph">${sectionHtml.clearanceCertificationContent}</div>` : `<p class="paragraph">This lead removal clearance certificate is issued on the basis of the inspection detailed above. Report authoriser: ${reportAuthoriserText}</p>`}
        ${jobExclusionsHtml && jobExclusionsHtml !== 'None specified.' ? `<div class="job-exclusions"><p class="paragraph">${jobExclusionsHtml}</p></div>` : ''}
        </div>
        <div class="sign-off-block">${leadSignOffHtml}</div>
      </div>
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content">
          <div class="footer-text">${escapeHtml(footerText)}</div>
          <div class="page-number">Page 1 of ${mainReportPageCount}</div>
        </div>
      </div>
    </div>`;

  const backgroundPage = `
    <div class="page">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span style="color:#16b12b;font-weight:500;">www.landd.com.au</span></div>
      </div>
      <div class="header-line"></div>
      <div class="content">
        <div class="section-header">BACKGROUND</div>
        ${sectionHtml.backgroundContent ? `<div class="paragraph">${sectionHtml.backgroundContent}</div>` : ''}
        <div class="section-header">REGULATORY GUIDANCE, REGULATIONS AND CODES OF PRACTICE</div>
        ${sectionHtml.regulatoryGuidanceContent ? `<div class="paragraph">${sectionHtml.regulatoryGuidanceContent}</div>` : ''}
        ${hasDustOrSoilSamples ? `
        <div class="section-header">ASSESSMENT METHODOLOGY</div>
        ${sectionHtml.assessmentMethodologyContent ? `<div class="paragraph">${sectionHtml.assessmentMethodologyContent}</div>` : ''}
        <div class="section-header">ASSESSMENT CRITERIA</div>
        ${sectionHtml.assessmentCriteriaContent ? `<div class="paragraph">${sectionHtml.assessmentCriteriaContent}</div>` : ''}
        ` : ''}
      </div>
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content">
          <div class="footer-text">${escapeHtml(footerText)}</div>
          <div class="page-number">Page 2 of ${mainReportPageCount}</div>
        </div>
      </div>
    </div>`;

  const statementOfLimitationsPage = `
    <div class="page">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span style="color:#16b12b;font-weight:500;">www.landd.com.au</span></div>
      </div>
      <div class="header-line"></div>
      <div class="content">
        <div class="section-header">STATEMENT OF LIMITATIONS</div>
        ${sectionHtml.statementOfLimitationsContent ? `<div class="paragraph">${sectionHtml.statementOfLimitationsContent}</div>` : ''}
      </div>
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content">
          <div class="footer-text">${escapeHtml(footerText)}</div>
          <div class="page-number">Page 3 of ${mainReportPageCount}</div>
        </div>
      </div>
    </div>`;

  // When no dust/soil sampling: drop the separate background page and put Statement of Limitations beneath Regulatory Guidance on one page
  const regulatoryAndLimitationsPage = `
    <div class="page">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span style="color:#16b12b;font-weight:500;">www.landd.com.au</span></div>
      </div>
      <div class="header-line"></div>
      <div class="content">
        <div class="section-header">BACKGROUND</div>
        ${sectionHtml.backgroundContent ? `<div class="paragraph">${sectionHtml.backgroundContent}</div>` : ''}
        <div class="section-header">REGULATORY GUIDANCE, REGULATIONS AND CODES OF PRACTICE</div>
        ${sectionHtml.regulatoryGuidanceContent ? `<div class="paragraph">${sectionHtml.regulatoryGuidanceContent}</div>` : ''}
        <div class="section-header">STATEMENT OF LIMITATIONS</div>
        ${sectionHtml.statementOfLimitationsContent ? `<div class="paragraph">${sectionHtml.statementOfLimitationsContent}</div>` : ''}
      </div>
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content">
          <div class="footer-text">${escapeHtml(footerText)}</div>
          <div class="page-number">Page 2 of 2</div>
        </div>
      </div>
    </div>`;

  const pagesAfterInspection = hasDustOrSoilSamples
    ? `${backgroundPage}${statementOfLimitationsPage}`
    : regulatoryAndLimitationsPage;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Lead Clearance Report</title><style>${baseStyles}</style></head><body>${coverPage}<div style="page-break-before: always; height: 0; margin: 0; padding: 0; overflow: hidden;"></div>${populatedVersionControl}${inspectionPage}${pagesAfterInspection}</body></html>`;
};

/**
 * Lead clearance appendix definitions in fixed order.
 * Only appendices with present content are included; letters A, B, C... assigned in this order.
 */
const LEAD_CLEARANCE_APPENDIX_DEFS = [
  { key: 'photographs', label: 'Photographs' },
  { key: 'sitePlan', label: 'Site Plan' },
  { key: 'preWorksSamples', label: 'Pre-works samples (soil/dust)' },
  { key: 'validationSamples', label: 'Validation samples (soil/dust)' },
  { key: 'airMonitoringReports', label: 'Air Monitoring Reports' },
];

/**
 * Conditional attachment text for lead clearance (inspection details and appendix references).
 * Uses the same appendix order as getLeadClearanceAppendices; only present appendices are mentioned.
 */
const generateLeadAttachmentText = (appendices) => {
  if (!appendices || appendices.length === 0) return '';
  const parts = appendices.map(({ letter, label }) => {
    if (label === 'Photographs') return `Photographs of the lead removal area are presented in Appendix ${letter}.`;
    if (label === 'Site Plan') return `A site plan is presented in Appendix ${letter}.`;
    if (label === 'Pre-works samples (soil/dust)') return `Pre-works samples (soil/dust) are presented in Appendix ${letter}.`;
    if (label === 'Validation samples (soil/dust)') return `Validation samples (soil/dust) are presented in Appendix ${letter}.`;
    if (label === 'Air Monitoring Reports') return `The air monitoring report(s) for these works are presented in Appendix ${letter}.`;
    return `${label} are presented in Appendix ${letter}.`;
  });
  return parts.join(' ');
};

/**
 * Returns ordered list of appendices present for a lead clearance.
 * Each item: { letter: 'A'|'B'|..., label: string, key: string }.
 */
const getLeadClearanceAppendices = (clearanceData) => {
  const hasPhotographs = clearanceData.items && clearanceData.items.some(item =>
    item.photographs && item.photographs.some(photo => photo.includeInReport !== false)
  );
  const hasSitePlan = !!clearanceData.sitePlanFile;
  const hasPreWorks = !!(clearanceData.sampling && Array.isArray(clearanceData.sampling.preWorksSamples) && clearanceData.sampling.preWorksSamples.length > 0);
  const hasValidation = !!(clearanceData.sampling && Array.isArray(clearanceData.sampling.validationSamples) && clearanceData.sampling.validationSamples.length > 0);
  const hasAirMonitoring = !!(clearanceData.leadMonitoringReports && clearanceData.leadMonitoringReports.length > 0);

  const present = [hasPhotographs, hasSitePlan, hasPreWorks, hasValidation, hasAirMonitoring];
  const letters = 'ABCDE';
  const appendices = [];
  LEAD_CLEARANCE_APPENDIX_DEFS.forEach((def, i) => {
    if (present[i]) {
      appendices.push({
        letter: letters[appendices.length],
        label: def.label,
        key: def.key,
      });
    }
  });
  return appendices;
};

/**
 * Generate HTML for lead clearance appendix cover pages (one page per appendix).
 * Uses same fonts and styling as lead clearance report; each page shows "APPENDIX X" and the label.
 */
const generateLeadAppendixCoverPagesHTML = (appendices, options) => {
  if (!appendices || appendices.length === 0) return '';
  const { logoBase64, watermarkBase64, footerText, frontendUrl } = options;
  const fontFaces = `
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }
  `;
  const pageStyles = `
    @page { size: A4; margin: 0; }
    * { hyphens: none !important; -webkit-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
    body { margin: 0; padding: 0; font-family: "Gothic", Arial, sans-serif; background: #fff; }
    .page { width: 100%; min-height: 100vh; position: relative; background: #fff; margin: 0; padding: 0; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; }
    .logo { width: 243px; height: auto; display: block; }
    .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; }
    .company-details .website { color: #16b12b; font-weight: 500; }
    .green-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 450px; height: auto; opacity: 0.1; z-index: 1; pointer-events: none; }
    .watermark img { width: 100%; height: auto; }
    .content { padding: 10px 48px 24px 48px; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 0; }
    .centered-text { font-size: 1.8rem; text-transform: uppercase; color: #222; text-align: center; letter-spacing: 0.02em; margin-top: 400px; }
    .appendix-title { font-weight: 700; color: #16b12b; }
    .footer { position: absolute; left: 0; right: 0; bottom: 16px; width: calc(100% - 96px); margin: 0 auto; font-size: 0.75rem; color: #222; }
    .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; }
  `;
  const pages = appendices.map(({ letter, label }) => `
    <div class="page">
      <div class="watermark">${watermarkBase64 ? `<img src="data:image/png;base64,${watermarkBase64}" alt="Watermark" />` : ''}</div>
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span class="website">www.landd.com.au</span></div>
      </div>
      <div class="green-line"></div>
      <div class="content">
        <div class="centered-text">
          <span class="appendix-title">APPENDIX ${letter}</span><br />
          <span>${escapeHtml(label)}</span>
        </div>
      </div>
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-text">${escapeHtml(footerText)}</div>
      </div>
    </div>
  `).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Lead Clearance Appendices</title><style>${fontFaces}${pageStyles}</style></head><body>${pages}</body></html>`;
};

/**
 * Ensure photo data is a valid data URL for img src.
 */
const toPhotoDataUrl = (data) => {
  if (!data || typeof data !== 'string') return '';
  const s = data.trim();
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('data:')) return s;
  return 'data:image/jpeg;base64,' + s;
};

/**
 * Generate HTML for lead clearance photographs appendix (same layout as asbestos: 2 photos per page).
 * Uses same page structure and CSS as asbestos PhotoPage/PhotoItem.
 */
const generateLeadClearancePhotographsHTML = (clearanceData, options) => {
  const { logoBase64, footerText, frontendUrl } = options;
  const items = clearanceData.items || [];
  const photosForReport = [];
  items.forEach((item) => {
    if (!item.photographs || !Array.isArray(item.photographs)) return;
    item.photographs.forEach((photo) => {
      if (photo.includeInReport === false) return;
      const dataUrl = toPhotoDataUrl(photo.data);
      if (!dataUrl) return;
      const locationText = photo.description || `${item.roomArea || 'Unknown'} - ${item.locationDescription || 'Unknown'}`;
      photosForReport.push({
        dataUrl,
        levelFloor: item.levelFloor || '',
        roomArea: item.roomArea || 'Unknown Room/Area',
        locationDescription: item.locationDescription || '',
        locationText,
      });
    });
  });

  if (photosForReport.length === 0) {
    const emptyPage = `
    <div class="page">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span class="website">www.landd.com.au</span></div>
      </div>
      <div class="header-line"></div>
      <div class="content"><div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div></div>
      <div class="footer"><div class="footer-border-line"></div><div class="footer-text">${escapeHtml(footerText)}</div></div>
    </div>`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Photographs</title><style>${getLeadPhotoPageStyles(frontendUrl)}</style></head><body>${emptyPage}</body></html>`;
  }

  const fontFaces = `
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
  `;
  const pageStyles = getLeadPhotoPageStyles(frontendUrl);
  const pages = [];
  for (let i = 0; i < photosForReport.length; i += 2) {
    const pagePhotos = photosForReport.slice(i, i + 2);
    const photoItems = pagePhotos.map((photo, pageIndex) => {
      const photoNumber = i + pageIndex + 1;
      const levelDisplay = photo.levelFloor ? 'block' : 'none';
      return `
    <div class="photo-container">
      <div class="photo">
        <img src="${photo.dataUrl}" alt="Photograph ${photoNumber}" />
      </div>
      <div class="photo-details">
        <div class="photo-number">Photograph ${photoNumber}</div>
        <div class="photo-level-floor" style="display: ${levelDisplay}">${escapeHtml(photo.levelFloor)}</div>
        <div class="photo-location">${escapeHtml(photo.locationText)}</div>
      </div>
    </div>`;
    }).join('');

    const pageHtml = `
    <div class="page">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />
        <div class="company-details">Lancaster &amp; Dickenson Consulting Pty Ltd<br />4/6 Dacre Street<br />Mitchell ACT 2911<br /><span class="website">www.landd.com.au</span></div>
      </div>
      <div class="header-line"></div>
      <div class="content">${photoItems}</div>
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content"><div class="footer-text">${escapeHtml(footerText)}</div></div>
      </div>
    </div>`;
    pages.push(pageHtml);
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Photographs</title><style>${fontFaces}${pageStyles}</style></head><body>${pages.join('')}</body></html>`;
};

function getLeadSitePlanPageStyles(frontendUrl) {
  const A4_LANDSCAPE_HEIGHT = '210mm';
  const A4_LANDSCAPE_WIDTH = '297mm';
  return `
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
    @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
    @page appendix-landscape { size: A4 landscape; margin: 0; }
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; hyphens: none !important; -webkit-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
    html, body { margin: 0; padding: 0; font-family: "Gothic", Arial, sans-serif; background: #fff; }
    .single-doc-site-plan-section {
      width: ${A4_LANDSCAPE_WIDTH};
      min-width: ${A4_LANDSCAPE_WIDTH};
      height: ${A4_LANDSCAPE_HEIGHT};
      min-height: ${A4_LANDSCAPE_HEIGHT};
      page: appendix-landscape;
      box-sizing: border-box;
    }
    .single-doc-site-plan-section .site-plan-page {
      page: appendix-landscape;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      page-break-after: avoid;
      page-break-inside: avoid;
      box-sizing: border-box;
    }
    .site-plan-page .header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; font-family: "Gothic", Arial, sans-serif; }
    .site-plan-page .green-line { flex-shrink: 0; width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
    .site-plan-page .content { flex: 1; min-height: 0; overflow: hidden; padding: 5px 48px 10px 48px; display: flex; flex-direction: column; }
    .site-plan-page .footer { flex-shrink: 0; position: relative; left: 0; right: 0; bottom: 0; width: 100%; padding: 0 48px 16px 48px; text-align: justify; font-size: 0.75rem; color: #222; font-family: "Gothic", Arial, sans-serif; }
    .logo { width: 243px; height: auto; display: block; background: #fff; margin: 0; }
    .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; margin-top: 8px; margin: 0; }
    .company-details .website { color: #16b12b; font-weight: 500; }
    .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
    .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-text { flex: 1; }
    .site-plan-layout { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: row; justify-content: flex-start; gap: 10px; align-items: flex-start; margin: 0; width: 100%; padding: 0 8px 0 0; }
    .site-plan-container { flex: 1 1 auto; width: auto; max-width: none; min-width: 0; overflow: hidden; display: flex; flex-direction: column; padding: 0; margin: 12px 0 0 0; border: none; background: transparent; border-radius: 0; box-shadow: none; }
    .site-plan-container .site-plan-image-wrapper { flex: 0 0 auto; width: fit-content; max-width: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .site-plan-container .site-plan-image { display: block; width: auto; height: auto; max-width: 100%; max-height: 72vh; object-fit: contain; border: 1.5px solid #999; box-sizing: border-box; margin: 0; padding: 0; background: transparent; }
    .site-plan-container .site-plan-figure-caption { flex-shrink: 0; font-size: 14px; font-weight: 400; color: #222; text-align: left; margin-top: 8px; font-family: "Gothic", Arial, sans-serif; }
    .site-plan-legend-container { flex: 0 0 280px; max-width: 280px; min-width: 260px; font-family: "Gothic", Arial, sans-serif; }
  `;
}

const isLeadClearanceSitePlanImage = (file) =>
  typeof file === 'string' &&
  (file.startsWith('/9j/') || file.startsWith('iVBORw0KGgo') || file.startsWith('data:image/'));

/**
 * Generate HTML for lead clearance site plan appendix content page (drawn/uploaded image site plans).
 */
const generateLeadClearanceSitePlanHTML = async (clearanceData, options) => {
  const { logoBase64, footerText, frontendUrl, appendixLetter } = options;
  const file = clearanceData.sitePlanFile;
  if (!file || !isLeadClearanceSitePlanImage(file)) return '';

  const trimmedSitePlan = await trimSitePlanImage(file);
  const trimmedData = { ...clearanceData, sitePlanFile: trimmedSitePlan };
  const figureTitle = clearanceData.sitePlanFigureTitle || 'Lead Clearance Site Plan';
  const pageContent = generateSitePlanContentPage(
    trimmedData,
    appendixLetter || 'B',
    logoBase64,
    footerText,
    'sitePlanFile',
    'SITE PLAN',
    figureTitle
  );

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Site Plan</title><style>${getLeadSitePlanPageStyles(frontendUrl)}</style></head><body><div class="single-doc-site-plan-section" style="page: appendix-landscape">${pageContent}</div></body></html>`;
};

function getLeadPhotoPageStyles(frontendUrl) {
  return `
  @page { size: A4; margin: 0; }
  * { hyphens: none !important; -webkit-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
  body { margin: 0; padding: 0; font-family: "Gothic", Arial, sans-serif; background: #fff; }
  .page { width: 100%; min-height: 100vh; position: relative; background: #fff; margin: 0; padding: 0; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; }
  .logo { width: 243px; height: auto; display: block; }
  .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; }
  .company-details .website { color: #16b12b; font-weight: 500; }
  .header-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; }
  .content { padding: 10px 48px 24px 48px; display: flex; flex-direction: column; align-items: stretch; }
  .photo { width: 100% !important; height: 375px !important; min-height: 375px !important; max-height: 375px !important; background: #f5f5f5; border: 2px solid #ddd; display: flex; align-items: center; justify-content: center; margin: 0 0 8px 0; padding: 0; overflow: hidden; box-sizing: border-box; flex-shrink: 0; }
  .photo img { width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; display: block !important; margin: 0; padding: 0; }
  .photo-placeholder { color: #666; font-style: italic; }
  .photo-container { display: flex; flex-direction: column; margin-bottom: 10px; margin-top: 10px; width: 100%; flex-shrink: 0; }
  .photo-container:first-child { margin-top: 10px; }
  .photo-details { font-size: 0.8rem; color: #222; line-height: 1.4; }
  .photo-number { font-weight: 700; color: #16b12b; margin-bottom: 4px; margin-top: 4px; }
  .photo-level-floor { font-weight: 500; margin-bottom: 2px; color: #666; }
  .photo-location { font-weight: 600; margin-bottom: 2px; color: #222; }
  .footer { position: absolute; left: 0; right: 0; bottom: 16px; width: calc(100% - 96px); margin: 0 auto; font-size: 0.75rem; color: #222; }
  .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; }
  .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-text { flex: 1; }
  .content > .photo-container { width: 100%; margin-left: 0; margin-right: 0; }
  .content > .photo-container:first-child { margin-top: 10px !important; }
  `;
}

/**
 * Generate Asbestos Clearance Report using DocRaptor V2 templates (async: starts job, returns jobId for polling)
 */
router.post('/generate-asbestos-clearance-v2', async (req, res) => {
  const pdfId = `clearance-v2-${Date.now()}`;

  try {
    const { clearanceData } = req.body;
    if (!clearanceData) {
      return res.status(400).json({ error: 'Clearance data is required' });
    }
    if (!clearanceData._id && !clearanceData.projectId) {
      return res.status(400).json({ error: 'Invalid clearance data' });
    }

    const htmlContent = await generateClearanceHTMLV2(clearanceData, pdfId);
    console.log(`[${pdfId}] HTML length: ${htmlContent.length} chars`);

    const projectId = clearanceData.projectId?.projectID || clearanceData.project?.projectID || clearanceData.projectId || 'Unknown';
    let siteName = clearanceData.projectId?.name || clearanceData.project?.name || clearanceData.siteName || 'Unknown';
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      siteName = clearanceData.vehicleEquipmentDescription;
    }
    const clearanceDate = clearanceData.clearanceDate ? formatDateSydney(clearanceData.clearanceDate) : 'Unknown';
    let reportTypeName = clearanceData.clearanceType === 'Vehicle/Equipment' ? 'Inspection Certificate' : 'Asbestos Clearance Report';
    let clearanceTypePrefix = '';
    if (clearanceData.clearanceType === 'Non-friable') clearanceTypePrefix = 'NF ';
    else if (clearanceData.clearanceType === 'Friable' || clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') clearanceTypePrefix = 'F ';
    const sequenceSuffix = clearanceData.sequenceNumber ? ` - ${clearanceData.sequenceNumber}` : '';
    const filename = `${projectId}_${clearanceTypePrefix}${reportTypeName} - ${siteName} (${clearanceDate})${sequenceSuffix}.pdf`;

    const airReports = (clearanceData.airMonitoringReports && clearanceData.airMonitoringReports.length > 0)
      ? [...clearanceData.airMonitoringReports].sort((a, b) => new Date(a.shiftDate || 0) - new Date(b.shiftDate || 0))
      : (clearanceData.airMonitoringReport ? [{ reportData: clearanceData.airMonitoringReport }] : []);
    const mergePayload = {
      airReports,
      sitePlan: clearanceData.sitePlan,
      sitePlanFile: clearanceData.sitePlanFile
    };

    const { status_id } = await docRaptorService.createAsyncDocument(htmlContent, {
      page_size: 'A4',
      prince_options: { page_margin: '0in', media: 'print', html_mode: 'quirks' }
    });

    const jobId = status_id;
    const clearanceId = clearanceData._id || null;
    asyncPdfJobs.set(jobId, {
      statusId: jobId,
      status: 'queued',
      downloadUrl: null,
      error: null,
      message: null,
      createdAt: Date.now(),
      reportType: 'asbestos-clearance',
      filename,
      mergePayload,
      clearanceId
    });
    pruneOldJobs();

    if (process.env.NODE_ENV === 'development') {
      const htmlFilePath = path.join(__dirname, '..', 'debug', `clearance-${pdfId}.html`);
      fs.mkdirSync(path.dirname(htmlFilePath), { recursive: true });
      fs.writeFileSync(htmlFilePath, htmlContent);
    }

    return res.status(201).json({ jobId });
  } catch (error) {
    console.error(`[${pdfId}] Error starting clearance V2 PDF:`, error);
    return res.status(500).json({
      error: 'Failed to start clearance V2 PDF',
      details: error.message
    });
  }
});

/**
 * Generate Enclosure Inspection Certificate (synchronous download).
 * Saves a copy under generated-pdfs/enclosure-certificates for later download when unchanged.
 */
router.post("/generate-enclosure-certificate", async (req, res) => {
  const pdfId = `enclosure-certificate-${Date.now()}`;
  try {
    const { clearanceData, enclosureData } = req.body || {};
    if (!clearanceData) {
      return res.status(400).json({ error: "Clearance data is required" });
    }
    const clearanceId = clearanceData._id;
    if (!clearanceId) {
      return res.status(400).json({ error: "clearanceData._id is required to retain the PDF" });
    }

    const htmlContent = await generateEnclosureCertificateHTML(
      clearanceData,
      enclosureData || {},
      pdfId,
    );
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent, {
      page_size: "A4",
      prince_options: { page_margin: "0.5in", media: "print", html_mode: "quirks" },
    });

    const projectId =
      clearanceData.projectId?.projectID ||
      clearanceData.project?.projectID ||
      clearanceData.projectId ||
      "Unknown";
    const siteName =
      clearanceData.projectId?.name || clearanceData.project?.name || "Unknown";
    const dateStr = clearanceData.clearanceDate
      ? formatClearanceDate(clearanceData.clearanceDate)
      : "Unknown";
    const filename = `${projectId}_Enclosure Inspection Certificate - ${siteName} (${dateStr}).pdf`;

    const mergedPdfPath = `enclosure-certificates/${clearanceId}.pdf`;
    try {
      fs.mkdirSync(ENCLOSURE_CERTIFICATE_PDF_DIR, { recursive: true });
      const fullPath = path.join(ENCLOSURE_CERTIFICATE_PDF_DIR, `${clearanceId}.pdf`);
      fs.writeFileSync(fullPath, pdfBuffer);
      await AsbestosClearance.findByIdAndUpdate(String(clearanceId), {
        enclosureCertificateMergedPdfPath: mergedPdfPath,
        enclosureCertificatePdfReadyAt: new Date(),
        enclosureCertificatePdfFilename: filename,
      });
    } catch (persistErr) {
      console.error(`[${pdfId}] Failed to persist enclosure certificate PDF:`, persistErr);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader('Content-Disposition', buildContentDispositionAttachment(filename));
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(`[${pdfId}] Failed to generate enclosure certificate:`, error);
    res.status(500).json({
      error: "Failed to generate enclosure certificate",
      details: error.message,
    });
  }
});

/**
 * Download a previously generated enclosure certificate (no DocRaptor call).
 */
router.get("/download-enclosure-certificate/:clearanceId", async (req, res) => {
  const { clearanceId } = req.params;
  try {
    const clearance = await AsbestosClearance.findById(clearanceId).lean();
    if (!clearance) {
      return res.status(404).json({ error: "Clearance not found" });
    }
    if (!clearance.enclosureCertificateMergedPdfPath) {
      return res.status(404).json({
        error: "No enclosure certificate PDF available",
        hint: "Generate the certificate first",
      });
    }
    const fullPath = path.join(__dirname, "..", "generated-pdfs", clearance.enclosureCertificateMergedPdfPath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        error: "No enclosure certificate PDF available",
        hint: "Generate the certificate first",
      });
    }
    const filename =
      clearance.enclosureCertificatePdfFilename ||
      `enclosure_certificate_${clearanceId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader('Content-Disposition', buildContentDispositionAttachment(filename));
    const stat = fs.statSync(fullPath);
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    console.error("Download enclosure certificate failed", clearanceId, error);
    return res.status(502).json({ error: "Download failed", details: error.message });
  }
});

/**
 * Get status of an async PDF job (poll this from the frontend)
 */
router.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = asyncPdfJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found', status: null });
  }

  // Assessment PDF jobs are updated by the backend task; no DocRaptor polling
  if (job.reportType === 'asbestos-assessment') {
    const payload = { status: job.status };
    if (job.message) payload.message = job.message;
    if (job.error) payload.error = job.error;
    if (job.status === 'completed') payload.ready = true;
    return res.json(payload);
  }

  if (job.status !== 'completed' && job.status !== 'failed') {
    try {
      const statusResponse = await docRaptorService.getStatus(job.statusId);
      job.status = statusResponse.status;
      job.message = statusResponse.message || null;
      job.downloadUrl = statusResponse.download_url || null;
      if (statusResponse.validation_errors) job.error = statusResponse.validation_errors;
      // Persist to clearance so any user can download without regenerating
      if (job.status === 'completed' && job.downloadUrl && job.clearanceId) {
        try {
          if (job.reportType === 'lead-clearance') {
            let mergedPdfPath = null;
            if (job.mergePayload) {
              try {
                const mainBuffer = await docRaptorService.fetchDocument(job.downloadUrl);
                const mergedBuffer = await mergeLeadClearanceAppendices(mainBuffer, job.mergePayload);
                fs.mkdirSync(LEAD_CLEARANCE_MERGED_PDF_DIR, { recursive: true });
                const fileName = `${job.clearanceId}.pdf`;
                const fullPath = path.join(LEAD_CLEARANCE_MERGED_PDF_DIR, fileName);
                fs.writeFileSync(fullPath, mergedBuffer);
                mergedPdfPath = `lead-clearances/${fileName}`;
              } catch (mergeErr) {
                console.error('Failed to merge/save lead clearance PDF for fast download:', mergeErr);
              }
            }
            await LeadClearance.findByIdAndUpdate(job.clearanceId, {
              pdfDownloadUrl: job.downloadUrl,
              pdfJobId: jobId,
              pdfReadyAt: new Date(),
              pdfFilename: job.filename || null,
              ...(mergedPdfPath && { mergedPdfPath })
            });
          } else if (job.reportType === 'asbestos-clearance') {
            await persistAsbestosClearancePdfFromJob(job);
          }
        } catch (updateErr) {
          console.error('Failed to persist clearance PDF URL:', updateErr);
        }
      }
    } catch (err) {
      console.error('DocRaptor status check failed:', err);
      return res.status(502).json({ error: 'Status check failed', details: err.message, status: job.status });
    }
  }

  // Job may already be completed in memory (subsequent polls); ensure DB has persisted PDF
  if (job.status === 'completed' && job.downloadUrl && job.clearanceId && job.reportType === 'asbestos-clearance') {
    try {
      await persistAsbestosClearancePdfFromJob(job);
    } catch (persistErr) {
      console.error('Failed to persist asbestos clearance PDF on status poll:', persistErr);
    }
  }

  const payload = { status: job.status };
  if (job.message) payload.message = job.message;
  if (job.error) payload.error = job.error;
  if (job.status === 'completed') payload.ready = true;
  return res.json(payload);
});

/**
 * Download completed PDF (proxy + optional merge). Call only when status is 'completed'.
 */
router.get('/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = asyncPdfJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (job.status !== 'completed' || !job.downloadUrl) {
    return res.status(400).json({ error: 'PDF not ready for download', status: job.status });
  }

  try {
    let pdfBuffer = await docRaptorService.fetchDocument(job.downloadUrl);
    if (job.reportType === 'asbestos-clearance' && job.mergePayload) {
      const { airReports, sitePlanFile } = job.mergePayload;
      for (const report of airReports || []) {
        const base64 = report.reportData || report;
        if (!base64) continue;
        try {
          pdfBuffer = await mergePDFs(pdfBuffer, base64);
        } catch (err) {
          console.error('Error merging air monitoring PDF:', err);
        }
      }
      if (sitePlanFile && !sitePlanFile.startsWith('/9j/') && !sitePlanFile.startsWith('iVBORw0KGgo') && !sitePlanFile.startsWith('data:image/')) {
        try {
          pdfBuffer = await mergePDFs(pdfBuffer, sitePlanFile);
        } catch (err) {
          console.error('Error merging site plan PDF:', err);
        }
      }
    } else if (job.reportType === 'lead-clearance' && job.mergePayload) {
      pdfBuffer = await mergeLeadClearanceAppendices(pdfBuffer, job.mergePayload);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      buildContentDispositionAttachment(job.filename || 'report.pdf')
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download failed for job', jobId, error);
    return res.status(502).json({ error: 'Download failed', details: error.message });
  }
});

/**
 * Merge asbestos clearance appendices (air reports + site plan) onto the main report PDF buffer.
 */
async function mergeAsbestosClearanceAppendices(pdfBuffer, payload) {
  const airReports = (payload.airReports && payload.airReports.length > 0)
    ? [...payload.airReports].sort((a, b) => new Date(a.shiftDate || 0) - new Date(b.shiftDate || 0))
    : (payload.airMonitoringReport ? [{ reportData: payload.airMonitoringReport }] : []);
  let result = pdfBuffer;
  for (const report of airReports) {
    const base64 = report.reportData || report;
    if (!base64) continue;
    try {
      result = await mergePDFs(result, base64);
    } catch (err) {
      console.error('Error merging air monitoring PDF:', err);
    }
  }
  if (payload.sitePlan && payload.sitePlanFile && !payload.sitePlanFile.startsWith('/9j/') && !payload.sitePlanFile.startsWith('iVBORw0KGgo') && !payload.sitePlanFile.startsWith('data:image/')) {
    try {
      result = await mergePDFs(result, payload.sitePlanFile);
    } catch (err) {
      console.error('Error merging site plan PDF:', err);
    }
  }
  return result;
}

function asbestosClearanceMergedFileExists(mergedPdfPath) {
  if (!mergedPdfPath) return false;
  const fullPath = path.join(__dirname, '..', 'generated-pdfs', mergedPdfPath);
  return fs.existsSync(fullPath);
}

/**
 * Persist asbestos clearance PDF URLs / merged file after async DocRaptor job completes.
 * Idempotent: skips when a merged file is already on disk.
 */
async function persistAsbestosClearancePdfFromJob(job) {
  if (job.reportType !== 'asbestos-clearance' || job.status !== 'completed' || !job.downloadUrl || !job.clearanceId) {
    return;
  }
  const existing = await AsbestosClearance.findById(job.clearanceId)
    .select('mergedPdfPath pdfDownloadUrl')
    .lean();
  if (existing?.mergedPdfPath && asbestosClearanceMergedFileExists(existing.mergedPdfPath)) {
    return;
  }

  let mergedPdfPath = null;
  const mergePayload = job.mergePayload || {};
  try {
    const mainBuffer = await docRaptorService.fetchDocument(job.downloadUrl);
    const mergedBuffer = await mergeAsbestosClearanceAppendices(mainBuffer, mergePayload);
    fs.mkdirSync(ASBESTOS_CLEARANCE_MERGED_PDF_DIR, { recursive: true });
    const fileName = `${job.clearanceId}.pdf`;
    const fullPath = path.join(ASBESTOS_CLEARANCE_MERGED_PDF_DIR, fileName);
    fs.writeFileSync(fullPath, mergedBuffer);
    mergedPdfPath = `asbestos-clearances/${fileName}`;
  } catch (mergeErr) {
    console.error('Failed to merge/save asbestos clearance PDF for fast download:', mergeErr);
  }

  await AsbestosClearance.findByIdAndUpdate(job.clearanceId, {
    pdfDownloadUrl: job.downloadUrl,
    pdfJobId: job.statusId,
    pdfReadyAt: new Date(),
    pdfFilename: job.filename || null,
    ...(mergedPdfPath && { mergedPdfPath }),
  });
}

/**
 * Resolve clearance PDF bytes: prefer on-disk merged file, else DocRaptor URL + merge.
 */
async function resolveAsbestosClearancePdfBuffer(clearance) {
  if (clearance.mergedPdfPath && asbestosClearanceMergedFileExists(clearance.mergedPdfPath)) {
    const fullPath = path.join(__dirname, '..', 'generated-pdfs', clearance.mergedPdfPath);
    return fs.readFileSync(fullPath);
  }
  if (!clearance.pdfDownloadUrl) {
    return null;
  }
  const airReports =
    clearance.airMonitoringReports && clearance.airMonitoringReports.length > 0
      ? [...clearance.airMonitoringReports].sort(
          (a, b) => new Date(a.shiftDate || 0) - new Date(b.shiftDate || 0),
        )
      : clearance.airMonitoringReport
        ? [{ reportData: clearance.airMonitoringReport }]
        : [];
  let pdfBuffer = await docRaptorService.fetchDocument(clearance.pdfDownloadUrl);
  pdfBuffer = await mergeAsbestosClearanceAppendices(pdfBuffer, {
    airReports,
    sitePlan: clearance.sitePlan,
    sitePlanFile: clearance.sitePlanFile,
    airMonitoringReport: clearance.airMonitoringReport,
  });
  try {
    fs.mkdirSync(ASBESTOS_CLEARANCE_MERGED_PDF_DIR, { recursive: true });
    const mergedPdfPath = `asbestos-clearances/${clearance._id}.pdf`;
    const fullPath = path.join(__dirname, '..', 'generated-pdfs', mergedPdfPath);
    fs.writeFileSync(fullPath, pdfBuffer);
    await AsbestosClearance.findByIdAndUpdate(clearance._id, { mergedPdfPath });
  } catch (saveErr) {
    console.warn('Could not cache merged asbestos clearance PDF for future downloads:', saveErr);
  }
  return pdfBuffer;
}

/**
 * Download asbestos clearance PDF by clearance ID.
 * When mergedPdfPath exists: streams pre-merged file from disk (fast, no fetch/merge).
 * Fallback: fetches main from pdfDownloadUrl and merges appendices.
 */
router.get('/download-by-clearance/:clearanceId', async (req, res) => {
  const { clearanceId } = req.params;
  try {
    const clearance = await AsbestosClearance.findById(clearanceId).lean();
    if (!clearance) {
      return res.status(404).json({ error: 'Clearance not found' });
    }
    const pdfBuffer = await resolveAsbestosClearancePdfBuffer(clearance);
    if (!pdfBuffer) {
      return res.status(404).json({
        error: 'No PDF available for this clearance',
        hint: 'Generate the PDF first using Generate PDF',
      });
    }
    const filename = clearance.pdfFilename || `clearance_${clearanceId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDispositionAttachment(filename));
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download by clearance failed', clearanceId, error);
    return res.status(502).json({ error: 'Download failed', details: error.message });
  }
});

/**
 * Merge lead clearance appendices (covers, photos, site plan, air reports) onto the main report PDF buffer.
 * Used by download/:jobId (lead-clearance) and download-by-lead-clearance/:clearanceId.
 */
async function mergeLeadClearanceAppendices(pdfBuffer, leadClearanceData) {
  let data = leadClearanceData;
  const clearanceId = leadClearanceData?._id;
  if (clearanceId) {
    try {
      const fresh = await LeadClearance.findById(clearanceId)
        .populate({
          path: 'projectId',
          select: 'projectID name client',
          populate: { path: 'client', select: 'name' },
        })
        .lean();
      if (fresh) {
        data = { ...data, ...fresh };
      }
    } catch (reloadErr) {
      console.warn('Could not reload lead clearance for appendix merge:', reloadErr.message);
    }
  }

  const appendices = getLeadClearanceAppendices(data);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
  const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
  const siteNameForFooter = data.projectId?.name || data.project?.name || data.siteName || 'Unknown';
  const appendixFooterText = `Lead Removal Clearance Certificate: ${siteNameForFooter}`;

  let finalPdfBuffer = pdfBuffer;
  for (const app of appendices) {
    const coverHtml = generateLeadAppendixCoverPagesHTML([app], {
      logoBase64,
      watermarkBase64,
      footerText: appendixFooterText,
      frontendUrl,
    });
    const coverPdf = await docRaptorService.generatePDF(coverHtml, {
      page_size: 'A4',
      prince_options: { page_margin: '0.5in', media: 'print', html_mode: 'quirks' },
    });
    finalPdfBuffer = await mergePDFs(finalPdfBuffer, coverPdf);

    if (app.key === 'photographs') {
      const photosHtml = generateLeadClearancePhotographsHTML(data, {
        logoBase64,
        footerText: appendixFooterText,
        frontendUrl,
      });
      const photosPdf = await docRaptorService.generatePDF(photosHtml, {
        page_size: 'A4',
        prince_options: { page_margin: '0.5in', media: 'print', html_mode: 'quirks' },
      });
      finalPdfBuffer = await mergePDFs(finalPdfBuffer, photosPdf);
    } else if (app.key === 'sitePlan' && data.sitePlanFile) {
      const file = data.sitePlanFile;
      if (isLeadClearanceSitePlanImage(file)) {
        try {
          const sitePlanHtml = await generateLeadClearanceSitePlanHTML(data, {
            logoBase64,
            footerText: appendixFooterText,
            frontendUrl,
            appendixLetter: app.letter,
          });
          if (sitePlanHtml) {
            const sitePlanPdf = await docRaptorService.generatePDF(sitePlanHtml, {
              page_size: 'A4 landscape',
              page_margin: '0in',
              prince_options: { page_margin: '0', media: 'print', html_mode: 'quirks' },
            });
            finalPdfBuffer = await mergePDFs(finalPdfBuffer, sitePlanPdf);
          }
        } catch (err) {
          console.error('Error generating lead clearance site plan PDF:', err);
        }
      } else {
        try {
          finalPdfBuffer = await mergePDFs(finalPdfBuffer, file);
        } catch (err) {
          console.error('Error merging lead clearance site plan PDF:', err);
        }
      }
    } else if (app.key === 'airMonitoringReports' && data.leadMonitoringReports && data.leadMonitoringReports.length > 0) {
      const leadReports = [...data.leadMonitoringReports].sort(
        (a, b) => new Date(a.shiftDate || 0) - new Date(b.shiftDate || 0)
      );
      for (const report of leadReports) {
        const base64 = report.reportData || report;
        if (!base64) continue;
        try {
          finalPdfBuffer = await mergePDFs(finalPdfBuffer, base64);
        } catch (err) {
          console.error('Error merging lead monitoring PDF:', err);
        }
      }
    }
  }
  return finalPdfBuffer;
}

/**
 * Generate Lead Clearance Report using DocRaptor (async: returns jobId for polling, like asbestos clearance).
 */
router.post('/generate-lead-clearance-v2', async (req, res) => {
  const pdfId = `lead-clearance-v2-${Date.now()}`;
  try {
    const { leadClearanceData } = req.body;
    if (!leadClearanceData) {
      return res.status(400).json({ error: 'Lead clearance data is required' });
    }
    if (!leadClearanceData._id && !leadClearanceData.projectId) {
      return res.status(400).json({ error: 'Invalid lead clearance data' });
    }

    const htmlContent = await generateLeadClearanceHTML(leadClearanceData, pdfId);

    const projectId = leadClearanceData.projectId?.projectID || leadClearanceData.project?.projectID || leadClearanceData.projectId || 'Unknown';
    const siteName = leadClearanceData.projectId?.name || leadClearanceData.project?.name || leadClearanceData.siteName || 'Unknown';
    const clearanceDate = leadClearanceData.clearanceDate ? new Date(leadClearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown';
    const sequenceSuffix = leadClearanceData.sequenceNumber ? ` - ${leadClearanceData.sequenceNumber}` : '';
    const filename = `${projectId}_Lead Clearance Report - ${siteName} (${clearanceDate})${sequenceSuffix}.pdf`;

    const { status_id } = await docRaptorService.createAsyncDocument(htmlContent, {
      page_size: 'A4',
      prince_options: { page_margin: '0.5in', media: 'print', html_mode: 'quirks' }
    });

    const jobId = status_id;
    const clearanceId = leadClearanceData._id || null;
    asyncPdfJobs.set(jobId, {
      statusId: jobId,
      status: 'queued',
      downloadUrl: null,
      error: null,
      message: null,
      createdAt: Date.now(),
      reportType: 'lead-clearance',
      filename,
      mergePayload: leadClearanceData,
      clearanceId
    });
    pruneOldJobs();

    return res.status(201).json({ jobId });
  } catch (error) {
    console.error(`[${pdfId}] Error starting lead clearance PDF:`, error);
    res.status(500).json({
      error: 'Failed to start lead clearance PDF',
      details: error.message,
    });
  }
});

/**
 * Download lead clearance PDF by clearance ID.
 * Green icon (download only): streams pre-merged file from disk when mergedPdfPath exists (no regeneration).
 * Fallback: fetches main report from pdfDownloadUrl and merges appendices (slower).
 */
router.get('/download-by-lead-clearance/:clearanceId', async (req, res) => {
  const { clearanceId } = req.params;
  try {
    const clearance = await LeadClearance.findById(clearanceId).lean();
    if (!clearance) {
      return res.status(404).json({ error: 'Clearance not found' });
    }
    if (!clearance.pdfDownloadUrl && !clearance.mergedPdfPath) {
      return res.status(404).json({
        error: 'No PDF available for this clearance',
        hint: 'Generate the PDF first using Generate PDF'
      });
    }
    const filename = clearance.pdfFilename || `lead_clearance_${clearanceId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDispositionAttachment(filename));

    if (clearance.mergedPdfPath) {
      const fullPath = path.join(__dirname, '..', 'generated-pdfs', clearance.mergedPdfPath);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        res.setHeader('Content-Length', stat.size);
        const readStream = fs.createReadStream(fullPath);
        return readStream.pipe(res);
      }
    }
    if (!clearance.pdfDownloadUrl) {
      return res.status(404).json({
        error: 'No PDF available for this clearance',
        hint: 'Generate the PDF first using Generate PDF'
      });
    }
    let pdfBuffer = await docRaptorService.fetchDocument(clearance.pdfDownloadUrl);
    pdfBuffer = await mergeLeadClearanceAppendices(pdfBuffer, clearance);
    try {
      fs.mkdirSync(LEAD_CLEARANCE_MERGED_PDF_DIR, { recursive: true });
      const fileName = `${clearanceId}.pdf`;
      const mergedPdfPath = `lead-clearances/${fileName}`;
      const fullPath = path.join(__dirname, '..', 'generated-pdfs', mergedPdfPath);
      fs.writeFileSync(fullPath, pdfBuffer);
      await LeadClearance.findByIdAndUpdate(clearanceId, { mergedPdfPath });
    } catch (saveErr) {
      console.warn('Could not cache merged lead clearance PDF for future downloads:', saveErr);
    }
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download by lead clearance failed', clearanceId, error);
    return res.status(502).json({ error: 'Download failed', details: error.message });
  }
});

/**
 * Test DocRaptor V2 with simple HTML
 */
router.post('/test-v2', async (req, res) => {
  try {
    
    const simpleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor V2 Test</title>
        <style>
          @page {
            size: A4;
            margin: 0.25in;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 20px;
          }
          h1 { color: blue; }
          .page {
            page-break-after: always;
            margin: 0;
            padding: 0;
          }
          .page:last-child {
            page-break-after: avoid;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>DocRaptor V2 Test - Page 1</h1>
          <p>This is a test PDF generated at ${new Date().toISOString()}</p>
          <p>If you can see this, DocRaptor V2 is working!</p>
        </div>
        <div class="page">
          <h1>DocRaptor V2 Test - Page 2</h1>
          <p>This is the second page to test page breaks.</p>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(simpleHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-v2.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('V2 test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'V2 test failed',
      details: error.message
    });
  }
});

/**
 * Test DocRaptor SVG scaling
 */
router.post('/test-svg-scaling', async (req, res) => {
  try {
    
    const svgTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor SVG Scaling Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100vh;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">SVG Scaling Test - Red dot should be at top-left corner</div>
          <svg class="test-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
            <!-- Test rectangle covering entire viewBox -->
            <rect x="0" y="0" width="595" height="842" fill="lightblue" stroke="blue" stroke-width="2"/>
            <!-- Test diagonal line from top-left to bottom-right -->
            <line x1="0" y1="0" x2="595" y2="842" stroke="red" stroke-width="5"/>
            <!-- Test horizontal line at y=200 -->
            <line x1="0" y1="200" x2="595" y2="200" stroke="green" stroke-width="3"/>
            <!-- Test vertical line at x=297.5 (center) -->
            <line x1="297.5" y1="0" x2="297.5" y2="842" stroke="purple" stroke-width="3"/>
            <!-- Test circle at center -->
            <circle cx="297.5" cy="421" r="50" fill="yellow" stroke="black" stroke-width="2"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(svgTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-scaling-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('SVG scaling test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SVG scaling test failed',
      details: error.message
    });
  }
});

/**
 * Test DocRaptor SVG viewBox and clipping
 */
router.post('/test-svg-viewbox', async (req, res) => {
  try {
    
    const viewBoxTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor SVG ViewBox Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100vh;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">ViewBox Test - Red line should extend to edges</div>
          <svg class="test-svg" viewBox="-50 -50 695 942" xmlns="http://www.w3.org/2000/svg">
            <!-- Background to show viewBox -->
            <rect x="-50" y="-50" width="695" height="942" fill="lightgray" stroke="blue" stroke-width="2"/>
            <!-- Test line that should extend to edges -->
            <line x1="-50" y1="-50" x2="645" y2="892" stroke="red" stroke-width="10"/>
            <!-- Test diagonal shape -->
            <polygon points="-50,-50 645,150 645,692 -50,892" fill="yellow" stroke="black" stroke-width="3"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(viewBoxTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-viewbox-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('SVG viewBox test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SVG viewBox test failed',
      details: error.message
    });
  }
});

/**
 * Test DocRaptor SVG coordinate mapping
 */
router.post('/test-svg-coordinates', async (req, res) => {
  try {
    
    const coordinateTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor SVG Coordinate Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 842px;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 10px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Coordinate Test - Red dots at y=0, y=200, y=642, y=842</div>
          <svg class="test-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
            <!-- Background rectangle -->
            <rect x="0" y="0" width="595" height="842" fill="lightgray" stroke="black" stroke-width="1"/>
            <!-- Test dots at key coordinates -->
            <circle cx="50" cy="0" r="5" fill="red"/> <!-- Top edge -->
            <circle cx="50" cy="200" r="5" fill="red"/> <!-- Middle top -->
            <circle cx="50" cy="642" r="5" fill="red"/> <!-- Middle bottom -->
            <circle cx="50" cy="842" r="5" fill="red"/> <!-- Bottom edge -->
            <!-- Test lines -->
            <line x1="0" y1="0" x2="595" y2="0" stroke="blue" stroke-width="2"/> <!-- Top edge -->
            <line x1="0" y1="200" x2="595" y2="200" stroke="green" stroke-width="2"/> <!-- Middle top -->
            <line x1="0" y1="642" x2="595" y2="642" stroke="green" stroke-width="2"/> <!-- Middle bottom -->
            <line x1="0" y1="842" x2="595" y2="842" stroke="blue" stroke-width="2"/> <!-- Bottom edge -->
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(coordinateTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-coordinate-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('SVG coordinate test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SVG coordinate test failed',
      details: error.message
    });
  }
});

/**
 * Test minimal cover page structure
 */
router.post('/test-cover-structure', async (req, res) => {
  try {
    
    const coverTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cover Page Structure Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 842px;
            position: relative;
            background: #fff;
            margin: 0;
            padding: 0;
          }
          .cover-white-shape {
            position: absolute;
            top: 0;
            left: 0;
            width: 50%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
            margin: 0;
            padding: 0;
          }
          .cover-left {
            width: 50%;
            position: relative;
            z-index: 3;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          .green-bracket {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 4;
            pointer-events: none;
            margin: 0;
            padding: 0;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 10px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Cover Structure Test - White shape should fill left half</div>
          <svg class="cover-white-shape" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
            <polygon points="0,0 595,200 595,642 0,842" fill="white"/>
          </svg>
          <div class="cover-left">
            <svg class="green-bracket" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
              <polyline points="0,0 595,200" stroke="#16b12b" stroke-width="12" fill="none"/>
              <polyline points="595,196 595,646" stroke="#16b12b" stroke-width="12" fill="none"/>
              <polyline points="595,642 0,842" stroke="#16b12b" stroke-width="12" fill="none"/>
            </svg>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(coverTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="cover-structure-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Cover structure test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Cover structure test failed',
      details: error.message
    });
  }
});

/**
 * Test different A4 dimensions
 */
router.post('/test-a4-dimensions-v2', async (req, res) => {
  try {
    
    const dimensionTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor A4 Dimension Test V2</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100%;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Testing different viewBox values</div>
          <svg class="test-svg" viewBox="0 0 794 1123" xmlns="http://www.w3.org/2000/svg">
            <!-- Test with 794x1123 (US Letter equivalent) -->
            <rect x="0" y="0" width="794" height="1123" fill="none" stroke="red" stroke-width="5"/>
            <circle cx="50" cy="50" r="20" fill="blue"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(dimensionTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="a4-dimension-test-v2.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('A4 dimension test V2 error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A4 dimension test V2 failed',
      details: error.message
    });
  }
});

/**
 * Test SVG without viewBox
 */
router.post('/test-svg-simple', async (req, res) => {
  try {
    
    const simpleTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Simple SVG Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100%;
            position: relative;
            background: #fff;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Simple SVG Test - No viewBox</div>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="red" stroke-width="5"/>
            <circle cx="50" cy="50" r="20" fill="blue"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(simpleTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-simple-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Simple SVG test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Simple SVG test failed',
      details: error.message
    });
  }
});

router.post('/generate-asbestos-assessment', auth, async (req, res) => {
  const pdfId = `assessment-${Date.now()}`;

  try {
    const { assessmentData } = req.body;
    if (!assessmentData) {
      throw new Error('Assessment data is required');
    }

    // Generate HTML content
    const html = await generateAssessmentHTML(assessmentData);

    // Generate PDF with DocRaptor
    let pdfBuffer = await docRaptorService.generatePDF(html);

    // Check if there are analysed items and note that fibre analysis report is available
    const analysedItems = assessmentData.items?.filter(item => item.analysisData?.isAnalysed) || [];

    // Handle PDF merging for fibre analysis report (same approach as clearance reports)
    let finalPdfBuffer = pdfBuffer;

    // If there's a fibre analysis report, merge it with the generated PDF
    if (assessmentData.fibreAnalysisReport) {
      try {
        const mergedPdf = await mergePDFs(finalPdfBuffer, assessmentData.fibreAnalysisReport);
        finalPdfBuffer = mergedPdf; // Update the final buffer
      } catch (error) {
        console.error(`[${pdfId}] Error merging fibre analysis PDFs:`, error);
      }
    }

    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', finalPdfBuffer.length);
    res.send(finalPdfBuffer);

  } catch (error) {
    console.error('Error generating assessment PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run assessment PDF v3 generation: one DocRaptor call (single HTML for cover, version, flow, appendices, site plan),
 * then merge pre-existing fibre analysis and site plan PDFs. Returns buffer and filename for sync or async use.
 */
/**
 * Count appendix + landscape pages at end of single-doc assessment PDF (for fibre merge split).
 */
function countAssessmentAppendixTailPages(assessmentData, isLeadAssessment, hasSitePlan, isSitePlanImage) {
  const isImg = (f) =>
    f &&
    typeof f === 'string' &&
    (f.startsWith('/9j/') || f.startsWith('iVBORw0KGgo') || f.startsWith('data:image/'));
  if (isLeadAssessment) {
    const entries = [];
    for (const p of assessmentData.leadSitePlanAppendices || []) {
      if (p && p.sitePlanFile) entries.push(p);
    }
    if (entries.length === 0) {
      if (!hasSitePlan || !assessmentData.sitePlanFile) return 0;
      return 1 + (isSitePlanImage ? 1 : 0);
    }
    let n = 0;
    for (const plan of entries) {
      n += 1;
      if (isImg(plan.sitePlanFile)) n += 1;
    }
    return n;
  }
  if (!hasSitePlan) return 0;
  return 1 + (isSitePlanImage ? 1 : 0);
}

async function runAssessmentPdfV3(assessmentData, isResidential) {
  const pdfId = `assessment-v3-${Date.now()}`;
  const isLeadAssessment = assessmentData.jobType === 'lead-assessment';
  const useResidentialLayout = isResidential === true && !isLeadAssessment;

  const assessmentId = assessmentData._id || assessmentData.id;
  const idStr = assessmentId ? String(assessmentId) : null;
  if (idStr) {
    try {
      const doc = await AsbestosAssessment.findById(idStr)
        .select('state fibreAnalysisReport sitePlan sitePlanFile sitePlanLegend sitePlanLegendTitle sitePlanFigureTitle leadSitePlanAppendices leadAssessmentPlanAppendices')
        .lean();
      if (doc) {
        if (doc.state != null) assessmentData.state = doc.state;
        if (doc.fibreAnalysisReport) {
          assessmentData.fibreAnalysisReport = doc.fibreAnalysisReport;
        }
        if (doc.sitePlan != null) assessmentData.sitePlan = doc.sitePlan;
        if (doc.sitePlanFile != null) assessmentData.sitePlanFile = doc.sitePlanFile;
        if (doc.sitePlanLegend != null) assessmentData.sitePlanLegend = doc.sitePlanLegend;
        if (doc.sitePlanLegendTitle != null) assessmentData.sitePlanLegendTitle = doc.sitePlanLegendTitle;
        if (doc.sitePlanFigureTitle != null) assessmentData.sitePlanFigureTitle = doc.sitePlanFigureTitle;
        if (doc.leadSitePlanAppendices != null) assessmentData.leadSitePlanAppendices = doc.leadSitePlanAppendices;
        if (doc.leadAssessmentPlanAppendices != null) assessmentData.leadAssessmentPlanAppendices = doc.leadAssessmentPlanAppendices;
      }
    } catch (err) {
      // Load fibre/site plan from DB failed; continue without
    }
  }

  // Single HTML document (cover, version, flow, appendix covers, site plan image) → one DocRaptor call
  const fullHtml = await generateAssessmentSingleHTMLV3(assessmentData, useResidentialLayout, isLeadAssessment);
  let merged = await docRaptorService.generatePDF(fullHtml);

  const hasFibreIdReport = !!assessmentData.fibreAnalysisReport;
  const hasSitePlan = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);
  const isSitePlanImage = hasSitePlan && (
    assessmentData.sitePlanFile.startsWith('/9j/') ||
    assessmentData.sitePlanFile.startsWith('iVBORw0KGgo') ||
    assessmentData.sitePlanFile.startsWith('data:image/')
  );
  const appendixTailPages = countAssessmentAppendixTailPages(
    assessmentData,
    isLeadAssessment,
    hasSitePlan,
    isSitePlanImage
  );

  // Place fibre ID report immediately after Appendix A cover (before Appendix B / site plan)
  if (assessmentData.fibreAnalysisReport) {
    try {
      if (hasFibreIdReport && appendixTailPages > 0) {
        // Main PDF has: ... Appendix A, then N appendix/plan pages. Split after Appendix A, insert fibre, then reattach rest.
        const part2PageCount = appendixTailPages;
        const srcDoc = await PDFDocument.load(merged);
        const totalPages = srcDoc.getPageIndices().length;
        const splitAt = totalPages - part2PageCount;
        const [part1, part2] = await splitPdfBuffer(merged, splitAt);
        const fibreBuffer = assessmentData.fibreAnalysisReport.startsWith('data:')
          ? Buffer.from(assessmentData.fibreAnalysisReport.split(',')[1], 'base64')
          : Buffer.from(assessmentData.fibreAnalysisReport, 'base64');
        const toMerge = part2 ? [part1, fibreBuffer, part2] : [part1, fibreBuffer];
        merged = await mergePdfBuffers(toMerge);
      } else {
        merged = await mergePDFs(merged, assessmentData.fibreAnalysisReport);
      }
    } catch (error) {
      console.error(`[${pdfId}] Error merging fibre analysis PDFs:`, error);
    }
  }
  if (hasSitePlan && assessmentData.sitePlanFile && !isSitePlanImage) {
    try {
      merged = await mergePDFs(merged, assessmentData.sitePlanFile);
    } catch (error) {
      console.error(`[${pdfId}] Error merging site plan PDF:`, error);
    }
  }

  const projectId = assessmentData.projectId?.projectID || 'Unknown';
  const siteName = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown';
  const dateStr = assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown';
  let filename;
  if (isLeadAssessment) {
    filename = `${projectId}_Lead_Assessment_Report - ${siteName} (${dateStr}).pdf`;
  } else if (useResidentialLayout) {
    filename = `${projectId}: Residential Asbestos Assessment Report - ${siteName} (${dateStr}).pdf`;
  } else {
    filename = `${projectId}: Asbestos Assessment Report - ${siteName} (${dateStr}).pdf`;
  }

  return { buffer: merged, filename };
}

// Experimental v3 asbestos assessment generator (sync): uses runAssessmentPdfV3 and streams result.
router.post('/generate-asbestos-assessment-v3', auth, async (req, res) => {
  try {
    const { assessmentData, isResidential } = req.body;
    if (!assessmentData) {
      throw new Error('Assessment data is required');
    }
    const result = await runAssessmentPdfV3(assessmentData, isResidential === true);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Content-Disposition', buildContentDispositionAttachment(result.filename));
    res.send(result.buffer);
  } catch (error) {
    console.error('Error generating assessment PDF (v3):', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Load full assessment by ID for PDF generation (same shape as GET /assessments/:id).
 */
async function loadAssessmentForPdf(assessmentId) {
  const doc = await AsbestosAssessment.findById(assessmentId)
    .populate({
      path: 'projectId',
      select: 'projectID name client',
      populate: { path: 'client', select: 'name contact1Name contact1Email address' }
    })
    .populate('assessorId')
    .populate('analyst', 'firstName lastName email')
    .populate('consultantId', 'firstName lastName email signature licences')
    .lean();
  if (!doc) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }
  return doc;
}

/**
 * Start async assessment PDF generation. Returns jobId for polling GET /status/:jobId.
 * Accepts assessmentId + isResidential; loads full assessment from DB to avoid large request body.
 * On completion the PDF is persisted on the assessment; use GET /download-by-assessment/:assessmentId to download.
 */
router.post('/start-asbestos-assessment-pdf', auth, async (req, res) => {
  let assessmentId;
  let jobId;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const idParam = body.assessmentId ?? body.assessmentData?._id ?? body.assessmentData?.id;
    if (!idParam) {
      return res.status(400).json({ error: 'Assessment ID is required (assessmentId or assessmentData._id)' });
    }
    assessmentId = String(idParam);
    const requestedResidential = body.isResidential === true;

    jobId = `assessment-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const job = {
      statusId: jobId,
      status: 'processing',
      assessmentId,
      isResidential: requestedResidential,
      reportType: 'asbestos-assessment',
      createdAt: Date.now(),
      filename: null,
      error: null,
      message: null
    };
    asyncPdfJobs.set(jobId, job);
    pruneOldJobs();

    // Defer: load assessment from DB then run PDF generation (avoids large request body and sync throws)
    setImmediate(() => {
      loadAssessmentForPdf(assessmentId)
        .then((assessmentData) => {
          const isLead = assessmentData.jobType === 'lead-assessment';
          const isResidential = body.isResidential === true && !isLead;
          return runAssessmentPdfV3(assessmentData, isResidential);
        })
        .then(async (result) => {
          try {
            const bufferSize = result.buffer && result.buffer.length ? result.buffer.length : 0;
            await AsbestosAssessment.findByIdAndUpdate(assessmentId, {
              pdfBuffer: result.buffer,
              pdfReadyAt: new Date(),
              pdfFilename: result.filename
            });
            console.log(`[assessment-pdf] Persisted PDF assessmentId=${assessmentId} sizeKB=${(bufferSize / 1024).toFixed(1)}`);
            const j = asyncPdfJobs.get(jobId);
            if (j) {
              j.status = 'completed';
              j.filename = result.filename;
            }
          } catch (updateErr) {
            console.error(`[assessment-pdf] Persist failed assessmentId=${assessmentId}`, updateErr.message);
            const j = asyncPdfJobs.get(jobId);
            if (j) {
              j.status = 'failed';
              j.error = updateErr.message;
            }
          }
        })
        .catch((err) => {
          console.error('Assessment PDF generation failed:', err);
          const j = asyncPdfJobs.get(jobId);
          if (j) {
            j.status = 'failed';
            j.error = err.message;
          }
        });
    });

    return res.status(201).json({ jobId });
  } catch (error) {
    console.error('Error starting assessment PDF:', error);
    return res.status(500).json({
      error: 'Failed to start assessment PDF',
      details: error.message
    });
  }
});

/**
 * Download assessment PDF by assessment ID (uses persisted pdfBuffer; no regeneration).
 * After ASSESSMENT_PDF_RETENTION_DAYS (7), the report is no longer served.
 * Query param freshJobId: when provided and the job is completed for this assessment, skip expiry check (for immediate download after regeneration).
 */
router.get('/download-by-assessment/:assessmentId', auth, async (req, res) => {
  const { assessmentId } = req.params;
  const freshJobId = req.query.freshJobId;
  let skipExpiryCheck = false;
  if (freshJobId) {
    const job = asyncPdfJobs.get(freshJobId);
    if (job && job.reportType === 'asbestos-assessment' && job.status === 'completed' && String(job.assessmentId) === String(assessmentId)) {
      skipExpiryCheck = true;
    }
  }
  try {
    // Query without .lean() so Mongoose properly hydrates Buffer; then get plain buffer for response
    const assessment = await AsbestosAssessment.findById(assessmentId).select('pdfBuffer pdfReadyAt pdfFilename');
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    // Retention: if PDF is past 7 days, return 410 Gone — unless we have a completed freshJobId or we're in development
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const readyAtMs = assessment.pdfReadyAt ? new Date(assessment.pdfReadyAt).getTime() : null;
    const ageMs = readyAtMs != null ? Date.now() - readyAtMs : null;
    const expired = readyAtMs != null && !Number.isNaN(readyAtMs) && isAssessmentPdfExpired(assessment.pdfReadyAt);
    const definitelyOverRetention = ageMs != null && !Number.isNaN(ageMs) && ageMs > ASSESSMENT_PDF_RETENTION_MS;
    console.log(`[download-by-assessment] assessmentId=${assessmentId} pdfReadyAt=${String(assessment.pdfReadyAt)} readyAtMs=${readyAtMs} ageMs=${ageMs} skipExpiry=${skipExpiryCheck} isDev=${isDev} expired=${expired} overRetention=${definitelyOverRetention}`);
    if (!skipExpiryCheck && !isDev && assessment.pdfReadyAt && expired && definitelyOverRetention) {
      return res.status(410).json({
        error: 'Report no longer available',
        hint: 'Retention period (7 days) has ended. Generate the PDF again if needed.',
      });
    }
    let buffer = assessment.pdfBuffer;
    if (!buffer) {
      return res.status(404).json({
        error: 'No PDF available for this assessment',
        hint: 'Generate the PDF first using Generate PDF'
      });
    }
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }
    const filename = assessment.pdfFilename || `assessment-${assessmentId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDispositionAttachment(filename));
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Download by assessment failed:', err);
    return res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

const generateAssessmentHTML = async (assessmentData) => {
  try {
    const isResidential = assessmentData.jobType === 'residential-asbestos';
    // Load DocRaptor-optimized templates
    const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
    const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
    const versionControlTemplate = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');
    const asbestosItem1Template = fs.readFileSync(path.join(templateDir, 'AsbestosItem1.html'), 'utf8');
    const asbestosSampleItemTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosSampleItem.html'), 'utf8');
    const asbestosDiscussionConclusionsTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosDiscussionConclusions.html'), 'utf8');
    const asbestosAdditionalSectionsTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosAdditionalSections.html'), 'utf8');
    const asbestosGlossaryTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosGlossary.html'), 'utf8');
    const appendixACoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixACover.html'), 'utf8');
    const appendixBCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixBCover.html'), 'utf8');
    
    // Get frontend URL from environment variable (fallback to localhost for development)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Replace [FRONTEND_URL] placeholder in all templates with actual frontend URL
    const replaceFrontendUrl = (template) => template.replace(/\[FRONTEND_URL\]/g, frontendUrl);
    const coverTemplateWithUrl = replaceFrontendUrl(coverTemplate);
    const versionControlTemplateWithUrl = replaceFrontendUrl(versionControlTemplate);
    const asbestosItem1TemplateWithUrl = replaceFrontendUrl(asbestosItem1Template);
    const asbestosSampleItemTemplateWithUrl = replaceFrontendUrl(asbestosSampleItemTemplate);
    const asbestosDiscussionConclusionsTemplateWithUrl = replaceFrontendUrl(asbestosDiscussionConclusionsTemplate);
    const asbestosAdditionalSectionsTemplateWithUrl = replaceFrontendUrl(asbestosAdditionalSectionsTemplate);
    const asbestosGlossaryTemplateWithUrl = replaceFrontendUrl(asbestosGlossaryTemplate);
    const appendixACoverTemplateWithUrl = replaceFrontendUrl(appendixACoverTemplate);
    const appendixBCoverTemplateWithUrl = replaceFrontendUrl(appendixBCoverTemplate);
    
    // Load logo and background images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

    const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
    const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
    
    // Different cover background per assessment type: asbestos (commercial) = ma.jpg, residential = res.jpg
    // Use backend assets (same as clearance) so images are available in deployed backend where frontend folder may not exist
    const assessmentCoverImage = isResidential ? 'res.jpg' : 'ma.jpg';
    const backgroundPath = path.join(__dirname, '../assets', assessmentCoverImage);
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

    // Use residential template when isResidential (has Background section and "Summary of Identified ACM")
    const templateType = isResidential ? 'residentialAsbestosAssessment' : 'asbestosAssessment';
    const templateContent = await getTemplateByType(templateType);
    const resolvedLegislation = await resolveSelectedLegislation(templateContent?.selectedLegislation);
    // Use job's legislation snapshot (at creation time); fall back to resolved template for existing jobs without it
    const selectedLegislation = (assessmentData.legislation && assessmentData.legislation.length > 0)
      ? assessmentData.legislation
      : resolvedLegislation;

    // Assessment cover/version control: match clearance structure (REPORT_TITLE, FOOTER_TEXT, etc.)
    const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
    const assessmentReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : 'ASBESTOS ASSESSMENT<br />REPORT';
    const assessmentClientName = assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client';
    const assessmentFooterText = isResidential ? `Residential Asbestos Assessment Report: ${assessmentSiteAddress}` : `Asbestos Assessment Report: ${assessmentSiteAddress}`;
    const reportAuthorName = assessmentData.LAA || (assessmentData.assessorId?.firstName && assessmentData.assessorId?.lastName
      ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : null) || 'Unknown Assessor';
    // Revision history: assessment report authorisation only (not Fibre ID approval)
    const isLeadAssessmentReport = assessmentData.jobType === 'lead-assessment';
    const awaitingAuthorisationHtml = '<span style="color:#d32f2f; font-weight:600;">Awaiting authorisation</span>';
    const reportApprovedBy = assessmentData.reportAuthorisedBy || (isLeadAssessmentReport ? awaitingAuthorisationHtml : 'Awaiting authorisation');
    const reportIssueDate = assessmentData.reportAuthorisedAt
      ? formatDateSydney(assessmentData.reportAuthorisedAt)
      : (isLeadAssessmentReport ? awaitingAuthorisationHtml : 'Awaiting authorisation');
    const documentIssueDate = todaySydney();

    const assessmentIntrusivenessLabel = assessmentData.intrusiveness === 'intrusive' || 'non-intrusive';
    // Populate cover template with data (REPORT_TITLE, SITE_ADDRESS, SECONDARY_HEADER, CLIENT_NAME, JOB_REFERENCE, ASSESSMENT_DATE, INTRUSIVENESS, no watermark/footer)
    const populatedCover = coverTemplateWithUrl
      .replace(/\[REPORT_TITLE\]/g, assessmentReportTitle)
      .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
      .replace(/\[SECONDARY_HEADER\]/g, assessmentData.secondaryHeader || '')
      .replace(/\[INTRUSIVENESS\]/g, assessmentIntrusivenessLabel)
      .replace(/\[CLIENT_NAME\]/g, assessmentClientName)
      .replace(/\[JOB_REFERENCE\]/g, assessmentData.projectId?.projectID || 'Unknown')
      .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`);

    // Populate version control template with data (like clearance: REPORT_TITLE, FOOTER_TEXT, document-details-table, WATERMARK_PATH)
    const versionControlReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : 'ASBESTOS ASSESSMENT REPORT';
    const versionControlFilename = isResidential
      ? `${assessmentData.projectId?.projectID || 'Unknown'}_Residential_Asbestos_Assessment_Report - ${assessmentData.projectId?.name || 'Unknown'} (${assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown'}).pdf`
      : `${assessmentData.projectId?.projectID || 'Unknown'}_Asbestos_Assessment_Report - ${assessmentData.projectId?.name || 'Unknown'} (${assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown'}).pdf`;
    const populatedVersionControl = versionControlTemplateWithUrl
      .replace(/\[REPORT_TITLE\]/g, versionControlReportTitle)
      .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
      .replace(/\[CLIENT_NAME\]/g, assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client')
      .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown')
      .replace(/\[DOCUMENT_ISSUE_DATE\]/g, documentIssueDate)
      .replace(/\[ASSESSOR_NAME\]/g, reportAuthorName)
      .replace(/\[FILENAME\]/g, versionControlFilename)
      .replace(/\[REPORT_APPROVED_BY\]/g, reportApprovedBy)
      .replace(/\[REPORT_ISSUE_DATE\]/g, reportIssueDate)
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText);

    // Generate first assessment register item for the main page
    const assessmentItems = assessmentData.items || [];
    const scopeBulletCount = assessmentItems.length;
    // Residential: first item always on next page. Asbestos: first item beneath SUMMARY if it will fit (move when 6+ items).
    const shouldMoveFirstItemToNewPage = isResidential || scopeBulletCount > 5;
    const firstSampleItem = assessmentItems.length > 0 ? assessmentItems[0] : null;
    const getCommentsValue = (item) => {
      if (hasNoAsbestosContent(item)) return 'No action required';
      let rec = (item.recommendationActions || '').trim();
      const cond = (item.condition || '').trim();
      const mat = (item.materialType || '').trim();
      if (!rec) return 'No comments';
      if (rec === cond) return 'No comments';
      if (mat && cond && rec === `${mat} ${cond}`) return 'No comments';
      // Deduplicate repeated recommendation text (handles "X\n\nX", "X  X", or "X X")
      let parts = rec.split(/\n\n+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length <= 1 && /^(.+)\s\1$/.test(rec.trim())) {
        parts = [rec.replace(/^(.+)\s\1$/, '$1').trim()];
      }
      const seen = new Set();
      const unique = parts.filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; });
      return unique.join('\n\n');
    };
    const isVisuallyAssessed = (ac) => {
      const s = (ac || '').trim();
      return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM' || s === 'Visually Assessed as Asbestos';
    };
    const isNonAsbestos = (ac) => {
      const s = (ac || '').trim();
      return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM';
    };
    const getSampleRefDisplay = (item, fallback) => {
      if (isVisuallyAssessed(item.asbestosContent)) return 'Visually assessed';
      const ref = item.sampleReference || fallback;
      const sampled = findSampledItemForRef(item.sampleReference);
      if (sampled && sampled !== item) return `Refer to sample ${ref}`;
      return ref;
    };
    const getLocationContent = (item) => {
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const parts = [];
      if (item.levelFloor && String(item.levelFloor).trim()) parts.push(esc(item.levelFloor));
      if (item.roomArea && String(item.roomArea).trim()) parts.push(esc(item.roomArea));
      parts.push(esc(item.locationDescription || 'Unknown Location'));
      return parts.join('<br/>');
    };
    // Assessment register: only show Chrysotile/Amosite/Crocidolite asbestos OR No Asbestos Detected (hide organic, SMF, etc.)
    // Derive asbestos content from analytical data (fibres array) when available - matches fibre ID report logic
    // For referred items (same sampleReference as another item), use the sampled item's asbestos content
    const findSampledItemForRef = (ref) => {
      const r = String(ref || '').trim();
      if (!r) return null;
      return assessmentItems.find((i) => (i.sampleReference || '').trim() === r) || null;
    };
    const getAsbestosContentRaw = (item) => {
      if (item.asbestosContent && String(item.asbestosContent).trim()) return item.asbestosContent;
      const ad = item.analysisData;
      if (!ad) {
        // Referred item: no analysisData on this item - use sampled item's content
        const sampled = findSampledItemForRef(item.sampleReference);
        if (sampled && sampled !== item) return getAsbestosContentRaw(sampled);
        return null;
      }
      // Extract asbestos types from fibres array (fibres where result includes 'Asbestos' or UMF)
      if (ad.fibres && Array.isArray(ad.fibres)) {
        const asbestosFromFibres = ad.fibres
          .filter((f) => {
            if (!f || !f.result) return false;
            const r = String(f.result).trim();
            if (!r || /^non[- ]?asbestos$/i.test(r)) return false;
            return /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(r) || /^umf$/i.test(r) || /^unidentified\s+mineral\s+fibre$/i.test(r);
          })
          .map((f) => {
            const r = String(f.result).trim();
            if (/^umf$/i.test(r)) return 'Unidentified Mineral Fibre (UMF)';
            return r;
          });
        if (asbestosFromFibres.length > 0) return [...new Set(asbestosFromFibres)].join(', ');
      }
      // Trace analysis takes priority in finalResult
      const hasTrace = ad.traceAsbestos === 'yes' && ad.traceCount && ad.traceAsbestosContent;
      if (hasTrace || (ad.finalResult && (/^no asbestos detected$/i.test(ad.finalResult) || ad.finalResult.includes('Trace')))) {
        return ad.finalResult;
      }
      if (ad.finalResult) return ad.finalResult;
      return null;
    };
    const isAsbestosType = (p) => /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(String(p).trim()) || /^umf$/i.test(String(p).trim()) || /^unidentified\s+mineral\s+fibre(\s*\(umf\))?$/i.test(String(p).trim());
    const getSampleRegisterAsbestosDisplay = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return 'No Asbestos Detected';
      if (s === 'Visually Assessed as Asbestos') return 'Visually Assessed as Asbestos';
      if (s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-asbestos' || s === 'Visually Assessed as Non-ACM') return 'Visually Assessed as Non-Asbestos';
      if (/^no asbestos detected$/i.test(s)) return 'No Asbestos Detected';
      // Parse comma-separated list (e.g. "Chrysotile Asbestos, Organic fibres") and extract only asbestos types
      const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
      const asbestosTypes = parts.filter(isAsbestosType);
      // Normalise to standard casing for known types
      const normalise = (t) => {
        const lower = t.toLowerCase();
        if (lower.includes('chrysotile')) return 'Chrysotile Asbestos';
        if (lower.includes('amosite')) return 'Amosite Asbestos';
        if (lower.includes('crocidolite')) return 'Crocidolite Asbestos';
        if (lower === 'umf' || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'))) return 'Unidentified Mineral Fibre (UMF)';
        return t;
      };
      const display = asbestosTypes.map(normalise).filter(Boolean);
      if (display.length > 0) return [...new Set(display)].join(', ');
      // Trace result (e.g. "Trace Chrysotile Asbestos detected")
      if (/trace.*detected/i.test(s)) return s;
      // UMF/Unidentified Mineral Fibre (e.g. "Unidentified Mineral Fibre detected" from trace 100+ visible)
      if (/unidentified\s+mineral\s+fibre|^umf(\s|$)/i.test(s)) return /trace/i.test(s) ? s : (/detected/i.test(s) ? 'Unidentified Mineral Fibre (UMF) detected' : 'Unidentified Mineral Fibre (UMF)');
      return 'No Asbestos Detected';
    };
    const getAsbestosContentHtml = (item) => {
      const sampled = findSampledItemForRef(item.sampleReference);
      const sourceItem = (sampled && sampled !== item) ? sampled : item;
      const raw = getAsbestosContentRaw(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || item.asbestosContent || 'Not tested';
      const displayText = getSampleRegisterAsbestosDisplay(raw);
      const isNonAsbestosDisplay = displayText === 'No Asbestos Detected' || displayText === 'Visually Assessed as Non-Asbestos';
      const cls = isNonAsbestosDisplay ? 'asbestos-content-non-asbestos' : 'asbestos-content-asbestos';
      const safe = displayText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="${cls}">${safe}</span>`;
    };
    const hasNoAsbestosContent = (item) => {
      const sampled = findSampledItemForRef(item.sampleReference);
      const sourceItem = (sampled && sampled !== item) ? sampled : item;
      const raw = getAsbestosContentRaw(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
      const display = getSampleRegisterAsbestosDisplay(raw);
      return display === 'No Asbestos Detected' || display === 'Visually Assessed as Non-Asbestos';
    };
    const getAsbestosTypeDisplay = (item) => {
      if (hasNoAsbestosContent(item)) return '-';
      const at = (item.asbestosType || '').toLowerCase();
      if (at === 'friable') return 'Friable';
      if (at === 'non-friable') return 'Non-friable';
      return item.asbestosType || '-';
    };
    const getConditionDisplay = (item) => hasNoAsbestosContent(item) ? '-' : (item.condition || 'Unknown');
    const getRiskDisplay = (item) => hasNoAsbestosContent(item) ? '-' : (item.risk || 'Unknown');
    const getItemNumber = (items, idx) => {
      const item = items[idx];
      if (!item) return '-';
      if (hasNoAsbestosContent(item)) return '-';
      const count = items.slice(0, idx + 1).filter((i) => !hasNoAsbestosContent(i)).length;
      return String(count);
    };
    // Arrow overlay for PDF: tip offset (viewBox 24x24, tip at 12,2, center 12,12)
    const DEFAULT_ARROW_ROTATION_PDF = -45;
    const getArrowTipOffsetPdf = (rotationDeg) => {
      const r = ((rotationDeg ?? DEFAULT_ARROW_ROTATION_PDF) * Math.PI) / 180;
      const tipX = (12 + 10 * Math.sin(r)) / 24;
      const tipY = (12 - 10 * Math.cos(r)) / 24;
      return { x: tipX, y: tipY };
    };
    const getPhotoArrowsForPdf = (photo) => {
      if (!photo) return [];
      if (photo.arrows && photo.arrows.length > 0) return photo.arrows;
      const leg = photo.arrow;
      if (leg && typeof leg === 'object' && (leg.x != null || leg.y != null)) return [leg];
      return [];
    };
    const buildArrowOverlaysHtml = (arrows) => {
      if (!arrows || arrows.length === 0) return '';
      const defaultColor = '#f44336';
      return arrows.map((arr) => {
        const rot = arr.rotation ?? DEFAULT_ARROW_ROTATION_PDF;
        const tipOff = getArrowTipOffsetPdf(rot);
        const color = (arr.color || defaultColor).replace(/"/g, '&quot;');
        const leftPct = ((arr.x ?? 0.5) * 100).toFixed(2);
        const topPct = ((arr.y ?? 0.5) * 100).toFixed(2);
        const tx = (-tipOff.x * 100).toFixed(2);
        const ty = (-tipOff.y * 100).toFixed(2);
        return `<div class="pdf-arrow-overlay" style="left:${leftPct}%;top:${topPct}%;transform:translate(${tx}%,${ty}%);"><div class="pdf-arrow-rotated" style="transform:rotate(${rot}deg);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="22" x2="12" y2="10" stroke="rgba(0,0,0,0.5)" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="22" x2="12" y2="10" stroke="${color}" stroke-width="2" stroke-linecap="round"/><path d="M12 2 L8 10 L16 10 Z" fill="rgba(0,0,0,0.4)" stroke="rgba(0,0,0,0.6)" stroke-width="1" stroke-linejoin="round"/><path d="M12 2 L8 10 L16 10 Z" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round"/></svg></div></div>`;
      }).join('');
    };
    // Multiple images per item: include all photos marked includeInReport with arrows; fallback to legacy single photograph
    const getIncludedPhotos = (item) => {
      const fromArray = (item.photographs || []).filter(p => p.includeInReport !== false && (p.data || '').trim());
      if (fromArray.length > 0) {
        return fromArray.map(p => ({ src: (p.data || '').trim(), arrows: getPhotoArrowsForPdf(p) }));
      }
      const legacy = (item.photograph || '').trim();
      if (legacy) return [{ src: legacy, arrows: getPhotoArrowsForPdf({ arrow: item.arrow }) }];
      return [{ src: null, arrows: [] }];
    };
    const getSamplePhotoCellHtml = (photoData) => {
      let src = photoData.src || '';
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && src.startsWith('/')) {
        src = frontendUrl + src;
      }
      if (src) {
        const safe = String(src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const arrowsHtml = buildArrowOverlaysHtml(photoData.arrows);
        return `<div class="sample-photo-cell-inner sample-photo-cell-inner-with-arrows"><img class="sample-photo" src="${safe}" alt="" />${arrowsHtml}</div>`;
      }
      return '<div class="sample-photo-cell-inner"><div class="sample-no-photo">No photograph available</div></div>';
    };
    const buildTableBlock = (block) => {
      const { item, itemIndex, photoData } = block;
      return asbestosSampleItemTemplateWithUrl
        .replace(/\[PHOTO_CELL\]/g, getSamplePhotoCellHtml(photoData))
        .replace(/\[ITEM_NUMBER\]/g, getItemNumber(assessmentItems, itemIndex))
        .replace(/\[SAMPLE_REFERENCE\]/g, getSampleRefDisplay(item, `Sample ${itemIndex + 1}`))
        .replace(/\[LOCATION_DESCRIPTION\]/g, getLocationContent(item))
        .replace(/\[MATERIAL_TYPE\]/g, item.materialType || 'Unknown Material')
        .replace(/\[ASBESTOS_CONTENT\]/g, getAsbestosContentHtml(item))
        .replace(/\[ASBESTOS_TYPE\]/g, getAsbestosTypeDisplay(item))
        .replace(/\[CONDITION\]/g, getConditionDisplay(item))
        .replace(/\[RISK\]/g, getRiskDisplay(item))
        .replace(/\[COMMENTS\]/g, getCommentsValue(item));
    };
    const tableBlocks = [];
    assessmentItems.forEach((item, itemIndex) => {
      const photos = getIncludedPhotos(item);
      photos.forEach(photoData => tableBlocks.push({ item, itemIndex, photoData }));
    });
    const firstSampleTable = tableBlocks.length > 0 ? buildTableBlock(tableBlocks[0]) : '';

    // Generate assessment register items as separate pages (one table per photo, 2 tables per page)
    let sampleRegisterPages = '';
    
    if (shouldMoveFirstItemToNewPage) {
      // For 6+ items: all table blocks on separate pages, 2 per page
      const blocksForPages = tableBlocks;
      const pages = [];
      for (let i = 0; i < blocksForPages.length; i += 2) {
        const pageBlocks = blocksForPages.slice(i, i + 2);
        const pageContent = pageBlocks.map(block => buildTableBlock(block)).join('<div style="margin-bottom: 20px;"></div>');
        const continuationHeader = i >= 2 && i % 2 === 0
          ? '<div class="section-header">Table 1: Assessment Register cont.</div>'
          : '';
        const pageNumber = 2 + pages.length;
        pages.push(`
          <div class="assessment-page">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="green-line"></div>
            <div class="content">
              ${continuationHeader}
              ${pageContent}
            </div>
            <div class="footer">
              <div class="footer-border-line"></div>
              <div class="footer-content">
                <div class="footer-text">${assessmentFooterText}</div>
                <div class="page-number">${pageNumber}</div>
              </div>
            </div>
          </div>
        `);
      }
      sampleRegisterPages = pages.join('<div class="page-break"></div>');
    } else {
      // For ≤5 items: first table block on page 1, remaining blocks 2 per page
      const remainingBlocks = tableBlocks.slice(1);
      const pages = [];
      for (let i = 0; i < remainingBlocks.length; i += 2) {
        const pageBlocks = remainingBlocks.slice(i, i + 2);
        const pageContent = pageBlocks.map(block => buildTableBlock(block)).join('<div style="margin-bottom: 20px;"></div>');
        const continuationHeader = '<div class="section-header">Table 1: Assessment Register cont.</div>';
        const pageNumber = 2 + pages.length;
        pages.push(`
          <div class="assessment-page">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="green-line"></div>
            <div class="content">
              ${continuationHeader}
              ${pageContent}
            </div>
            <div class="footer">
              <div class="footer-border-line"></div>
              <div class="footer-content">
                <div class="footer-text">${assessmentFooterText}</div>
                <div class="page-number">${pageNumber}</div>
              </div>
            </div>
          </div>
        `);
      }
      sampleRegisterPages = pages.join('<div class="page-break"></div>');
    }


    
    // Survey findings: use No Asbestos content when no asbestos items; otherwise use main survey findings content
    const hasAsbestosItems = assessmentItems.some((item) => !hasNoAsbestosContent(item));
    const surveyFindingsSource = hasAsbestosItems
      ? (templateContent?.standardSections?.surveyFindingsContent || 'Survey findings content not found')
      : (templateContent?.standardSections?.surveyFindingsContentNoSamples || "No asbestos-containing materials were identified during this assessment.");
    let surveyFindingsContentPopulated = surveyFindingsSource !== 'Survey findings content not found'
      ? await replacePlaceholders(surveyFindingsSource, { ...assessmentData, selectedLegislation })
      : surveyFindingsSource;
    const hasSitePlan = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);
    const hasFibreIdReport = !!assessmentData.fibreAnalysisReport;
    const sitePlanAppendix = hasFibreIdReport ? 'Appendix B' : 'Appendix A';
    if (hasSitePlan) {
      surveyFindingsContentPopulated += `\n\nA site plan illustrating the locations of asbestos-containing materials for this assessment is presented in ${sitePlanAppendix} of this report.`;
    }
    // Ensure newlines render in HTML (replacePlaceholders may not convert \n)
    surveyFindingsContentPopulated = surveyFindingsContentPopulated.replace(/\n/g, '<br />');

    // Background section (residential template only): before Introduction
    let backgroundSectionHtmlResolved = '';
    const backgroundContentRaw = templateContent?.standardSections?.backgroundContent;
    if (isResidential && backgroundContentRaw) {
      const bgTitle = templateContent?.standardSections?.backgroundTitle || 'BACKGROUND';
      const bgContent = await replacePlaceholders(backgroundContentRaw, { ...assessmentData, selectedLegislation });
      const bgContentHtml = String(bgContent || '').replace(/\n/g, '<br />');
      backgroundSectionHtmlResolved = `<div class="section-header first-section">${bgTitle}</div><div class="paragraph">${bgContentHtml}</div>`;
    }

    // Populate AsbestosItem1 template with dynamic content (footer matches VersionControl; page number 1)
    const populatedAsbestosItem1 = asbestosItem1TemplateWithUrl
      .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, '1')
      .replace(/\[BACKGROUND_SECTION\]/g, backgroundSectionHtmlResolved)
      .replace(/\[INTRODUCTION_TITLE\]/g, templateContent?.standardSections?.introductionTitle || 'INTRODUCTION')
      .replace(/\[INTRODUCTION_CONTENT\]/g, templateContent?.standardSections?.introductionContent ? await replacePlaceholders(templateContent.standardSections.introductionContent, { ...assessmentData, selectedLegislation }) : 'Introduction content not found')
      .replace(/\[SURVEY_FINDINGS_TITLE\]/g, templateContent?.standardSections?.surveyFindingsTitle || (isResidential ? 'SUMMARY OF IDENTIFIED ACM' : 'ASSESSMENT FINDINGS'))
      .replace(/\[SURVEY_FINDINGS_CONTENT\]/g, surveyFindingsContentPopulated)
      .replace(/\[SAMPLE_REGISTER_ITEMS\]/g, shouldMoveFirstItemToNewPage ? '' : firstSampleTable); // Conditionally include the first sample table

    // Populate Discussion and Conclusions template: asbestos items, then non-asbestos items
    // Use same effective asbestos display logic as sample tables (includes fibres array, referred items)
    const getEffectiveAsbestosDisplayForDiscussion = (item) => {
      const sampled = findSampledItemForRef(item.sampleReference);
      const sourceItem = (sampled && sampled !== item) ? sampled : item;
      const raw = getAsbestosContentRaw(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
      return getSampleRegisterAsbestosDisplay(raw);
    };
    const getDiscussionDisplay = (item) => getEffectiveAsbestosDisplayForDiscussion(item);
    const isAsbestosForDiscussion = (display) => display !== 'No Asbestos Detected' && display !== 'Visually Assessed as Non-Asbestos';
    const identifiedAsbestosItems = assessmentItems.filter(item => isAsbestosForDiscussion(getDiscussionDisplay(item)));
    const identifiedNonAsbestosItems = assessmentItems.filter(item => !isAsbestosForDiscussion(getDiscussionDisplay(item)));

    const discussionDisplayContentLabel = (item) => {
      const display = getEffectiveAsbestosDisplayForDiscussion(item);
      if (display === 'No Asbestos Detected') return 'No asbestos detected';
      return display;
    };

    const isUMFOnly = (item) => {
      const display = getEffectiveAsbestosDisplayForDiscussion(item);
      if (!display || display === 'No Asbestos Detected') return false;
      const lower = String(display).toLowerCase();
      const hasUMF = lower.includes('umf') || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'));
      const hasConfirmedAsbestos = lower.includes('chrysotile') || lower.includes('amosite') || lower.includes('crocidolite');
      return hasUMF && !hasConfirmedAsbestos;
    };

    const formatDiscussionListItem = (item) => {
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const roomArea = esc(item.roomArea || 'Not specified');
      const loc = esc(item.locationDescription || 'Unknown Location');
      const visuallyAssessed = isVisuallyAssessed(item.asbestosContent);
      const base = `${roomArea} - ${loc}`;
      const suffix = isUMFOnly(item) ? ' *' : '';
      return (visuallyAssessed ? `${base} (Visually assessed)` : base) + suffix;
    };
    const hasUMFOnlyItems = identifiedAsbestosItems.some(isUMFOnly);
    const umfFootnote = hasUMFOnlyItems
      ? '<div class="paragraph umf-footnote" style="font-style: italic; margin-top: 8px;"><em>* Item was found to contain Unidentified Mineral Fibre (UMF). Material should be considered to be asbestos unless further analysis can confirm otherwise.</em></div>'
      : '';
    const asbestosItemsSection = identifiedAsbestosItems.length > 0
      ? `<ul class="asbestos-list">${identifiedAsbestosItems.map(item => `<li>${formatDiscussionListItem(item)}</li>`).join('')}</ul>${umfFootnote}`
      : '<div class="paragraph">No asbestos items were identified during the assessment.</div>';

    const nonAsbestosItemsSection = identifiedNonAsbestosItems.length > 0
      ? `<ul class="non-asbestos-list">${identifiedNonAsbestosItems.map(item => `<li>${formatDiscussionListItem(item)}</li>`).join('')}</ul>`
      : '<div class="paragraph">No non-asbestos items were identified during the assessment.</div>';

    const asbestosCount = identifiedAsbestosItems.length;
    const siteName = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
    const hasSampledItemsRequiringAnalysis = assessmentItems.some((i) => (i.sampleReference || '').trim() && !isVisuallyAssessed(i.asbestosContent));
    const firstSampledPerRef = hasSampledItemsRequiringAnalysis
      ? assessmentItems.filter((item, index) => {
          if (!(item.sampleReference || '').trim() || isVisuallyAssessed(item.asbestosContent)) return false;
          const ref = item.sampleReference.trim();
          return index === assessmentItems.findIndex((i) => (i.sampleReference || '').trim() === ref);
        })
      : [];
    const analysisComplete = assessmentData.status === 'sample-analysis-complete' ||
      !hasSampledItemsRequiringAnalysis ||
      firstSampledPerRef.every((i) => i.analysisData?.isAnalysed === true);
    const asbestosCountDisplay = asbestosCount > 0 ? formatAsbestosCountForPdf(asbestosCount, analysisComplete) : String(asbestosCount);
    const acmRemovalSentence = 'ACM should be removed prior to the commencement of works which may damage or disturb the material.';
    const residentialCeilingSubfloorTextLegacy = 'The assessment of the ceiling void was limited to a visual inspection from the access hatch. A combination of insulation batts and loose-fill insulation was identified within the ceiling void, these materials were visually assessed as synthetic mineral fibres (SMF). No suspect ACM was identified during the assessment of the ceiling void however, it is common for ACM to be present within ceiling voids in the forms of debris and/or packers. It is recommended that persons accessing the ceiling void wear a minimum P2 respirator and coveralls.\n\nNo suspect ACM was identified during the assessment of the subfloor, it is common for ACM to be present within subfloors in the form of debris, packers, and/or formwork. It is recommended that persons accessing the crawl space wear a minimum P2 respirator and coveralls.';
    let defaultDiscussionText = '';
    if (asbestosCount > 0) {
      defaultDiscussionText = acmRemovalSentence;
      if (isResidential) defaultDiscussionText = residentialCeilingSubfloorTextLegacy + '\n\n' + defaultDiscussionText;
    } else if (isResidential) {
      defaultDiscussionText = residentialCeilingSubfloorTextLegacy;
    }
    let discussionConclusionsRaw = (assessmentData.discussionConclusions || '').trim() || defaultDiscussionText;
    const analysisIncompleteReplacement = formatAsbestosCountForPdf(asbestosCount, analysisComplete);
    discussionConclusionsRaw = discussionConclusionsRaw
      .replace(/\{ANALYSIS INCOMPLETE\}/g, analysisIncompleteReplacement)
      .replace(/\{ANALYSIS_INCOMPLETE\}/g, analysisIncompleteReplacement);
    discussionConclusionsRaw = stripAsbestosCountLineFromDiscussion(discussionConclusionsRaw);
    const discussionConclusionsHtml = toJustifiedParagraphsHtml(discussionConclusionsRaw);
    const asbestosCountLineLegacy = asbestosCount === 0
      ? `No asbestos containing materials were identified during the assessment conducted at ${siteName}.`
      : asbestosCount === 1
        ? `${asbestosCountDisplay} asbestos item was identified during the assessment of ${siteName}.`
        : `${asbestosCountDisplay} asbestos items were identified during the assessment of ${siteName}.`;

    // Page numbers: cover=1, version=2, item1=3, then assessment register pages, then discussion, then optional RCM page, then additional 1 & 2
    const sampleRegisterPageCount = shouldMoveFirstItemToNewPage
      ? Math.ceil((assessmentItems.length || 0) / 2)
      : Math.ceil(Math.max(0, (assessmentItems.length || 1) - 1) / 2);
    const discussionPageNum = 4 + sampleRegisterPageCount;

    const templateData = { ...assessmentData, identifiedAsbestosItems: asbestosItemsSection, selectedLegislation };
    const discussionSignOffContent = templateContent?.standardSections?.signOffContent
      ? await replacePlaceholders(templateContent.standardSections.signOffContent, templateData)
      : '';
    const discussionSignatureContent = templateContent?.standardSections?.signaturePlaceholder
      ? await replacePlaceholders(templateContent.standardSections.signaturePlaceholder, templateData)
      : '';

    const jobSpecificExclusionsRawTemplate = (assessmentData.jobSpecificExclusions || '').trim();
    const jobSpecificExclusionsHtmlTemplate = toJustifiedParagraphsHtml(jobSpecificExclusionsRawTemplate);

    const asbestosSummaryBlockLegacy = identifiedAsbestosItems.length > 0
      ? `<div class="paragraph">
          The following is a summary of asbestos materials identified during
          this assessment:
        </div>
        <div class="subsection-header-underline">Asbestos Items</div>
        ${asbestosItemsSection}`
      : '';

    const populatedDiscussionConclusions = asbestosDiscussionConclusionsTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ASBESTOS_COUNT_LINE\]/g, asbestosCountLineLegacy)
      .replace(/\[ASBESTOS_SUMMARY_BLOCK\]/g, asbestosSummaryBlockLegacy)
      .replace(/\[ASBESTOS_ITEMS_SECTION\]/g, asbestosItemsSection)
      .replace(/\[DISCUSSION_CONCLUSIONS_CONTENT\]/g, discussionConclusionsHtml)
      .replace(/\[SIGN_OFF_CONTENT\]/g, discussionSignOffContent)
      .replace(/\[SIGNATURE_IMAGE\]/g, discussionSignatureContent)
      .replace(/\[JOB_SPECIFIC_EXCLUSIONS\]/g, jobSpecificExclusionsHtmlTemplate)
      .replace(/\[LAA_NAME\]/g, assessmentData.assessorId?.firstName ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : 'Unknown Assessor')
      .replace(/\[LAA_LICENCE\]/g, 'AA00031') // Default license - will be looked up in replacePlaceholders
      .replace(/\[SITE_NAME\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(discussionPageNum))
      .replace(/\[DISCUSSION_TITLE\]/g, templateContent?.standardSections?.discussionTitle || 'DISCUSSION AND CONCLUSIONS')
      .replace(/\[DISCUSSION_CONTENT\]/g, templateContent?.standardSections?.discussionContent ? await replacePlaceholders(templateContent.standardSections.discussionContent, templateData) : 'Discussion and conclusions content not found');



    // Generate two pages of additional sections with proper content distribution
    // Order: Assessment Methodology, Recommended Control Measures (own page), Risk, Control Measures, Remediation, Legislation, Limitations
    const sections = [
      {
        title: templateContent?.standardSections?.assessmentMethodologyTitle || 'ASSESSMENT METHODOLOGY',
        content: templateContent?.standardSections?.assessmentMethodologyContent ? await replacePlaceholders(templateContent.standardSections.assessmentMethodologyContent, templateData) : ''
      },
      {
        title: templateContent?.standardSections?.recommendedControlMeasuresTitle || 'RECOMMENDED CONTROL MEASURES',
        content: isResidential && templateContent?.standardSections?.recommendedControlMeasuresContent ? await replacePlaceholders(templateContent.standardSections.recommendedControlMeasuresContent, templateData) : ''
      },
      {
        title: templateContent?.standardSections?.riskAssessmentTitle || 'RISK ASSESSMENT',
        content: templateContent?.standardSections?.riskAssessmentContent ? await replacePlaceholders(templateContent.standardSections.riskAssessmentContent, templateData) : 'Risk assessment content not found'
      },
      {
        title: templateContent?.standardSections?.controlMeasuresTitle || 'DETERMINING SUITABLE CONTROL MEASURES',
        content: templateContent?.standardSections?.controlMeasuresContent ? await replacePlaceholders(templateContent.standardSections.controlMeasuresContent, templateData) : 'Control measures content not found'
      },
      {
        title: templateContent?.standardSections?.remediationRequirementsTitle || 'REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM',
        content: templateContent?.standardSections?.remediationRequirementsContent ? await replacePlaceholders(templateContent.standardSections.remediationRequirementsContent, templateData) : 'Remediation requirements content not found'
      },
      {
        title: templateContent?.standardSections?.legislationTitle || 'LEGISLATION',
        content: templateContent?.standardSections?.legislationContent ? await replacePlaceholders(templateContent.standardSections.legislationContent, templateData) : 'Legislation content not found'
      },
      {
        title: templateContent?.standardSections?.assessmentLimitationsTitle || 'ASSESSMENT LIMITATIONS/CAVEATS',
        content: templateContent?.standardSections?.assessmentLimitationsContent ? await replacePlaceholders(templateContent.standardSections.assessmentLimitationsContent, templateData) : 'Assessment limitations content not found'
      }
    ];

    // Sign-off and signature are on the Discussion/Conclusions page, not in additional sections

    // Convert content to HTML format
    const convertContentToHtml = (content) => {
      const lines = content.split('\n');
      let html = '';
      let inBulletList = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('•')) {
          if (!inBulletList) {
            html += '<ul class="bullet-list">';
            inBulletList = true;
          }
          html += `<li>${line.substring(1).trim()}</li>`;
        } else if (line === '') {
          if (inBulletList) {
            html += '</ul>';
            inBulletList = false;
          }
          html += '<br />';
        } else {
          if (inBulletList) {
            html += '</ul>';
            inBulletList = false;
          }
          html += `<div class="paragraph">${line}</div>`;
        }
      }
      
      if (inBulletList) {
        html += '</ul>';
      }
      
      return html;
    };

    // Split remediation requirements content so the last paragraph is on page 2 with Legislation
    // Content may use <br> (from replacePlaceholders) or \n
    // sections[4] = Remediation (Assessment Methodology=0, Recommended Control Measures=1, Risk=2, Control Measures=3, Remediation=4, Legislation=5, Limitations=6)
    const remediationSection = sections[4];
    let remediationContentPage1 = remediationSection.content;
    let remediationContentPage2 = '';
    const followingCompletionText = 'Following Completion of Asbestos Removal Works';
    if (remediationSection.content.includes(followingCompletionText)) {
      const splitIndex = remediationSection.content.indexOf(followingCompletionText);
      remediationContentPage1 = remediationSection.content.substring(0, splitIndex).replace(/(<br>\s*)+$|\n+$/, '');
      remediationContentPage2 = remediationSection.content.substring(splitIndex);
    }

    // First additional page: Assessment Methodology (residential only), Risk Assessment, first part of Remediation
    const firstPageContent = [
      ...(isResidential ? [`<div class="section-header">${sections[0].title}</div>${convertContentToHtml(sections[0].content)}`] : []),
      `<div class="section-header">${sections[2].title}</div>${convertContentToHtml(sections[2].content)}`,
      `<div class="section-header">${remediationSection.title}</div>${convertContentToHtml(remediationContentPage1)}`
    ].join('');

    // Second additional page: remaining remediation content + Legislation + Limitations
    const secondPageContent = [
      ...(remediationContentPage2 ? [`<div class="section-header">${remediationSection.title}</div>${convertContentToHtml(remediationContentPage2)}`] : []),
      ...sections.slice(5).map(section =>
        `<div class="section-header">${section.title}</div>${convertContentToHtml(section.content)}`
      )
    ].join('');

    // Recommended Control Measures gets its own page after Discussion when it has content
    const hasRcmPage = !!(sections[1].content && String(sections[1].content).trim());
    const recommendedControlMeasuresPageNum = discussionPageNum + 1;
    const additionalSection1PageNum = discussionPageNum + (hasRcmPage ? 2 : 1);
    const additionalSection2PageNum = additionalSection1PageNum + 1;

    const rcmPageContent = `<div class="section-header">${sections[1].title}</div>${convertContentToHtml(sections[1].content)}`;
    const populatedRecommendedControlMeasures = hasRcmPage
      ? asbestosAdditionalSectionsTemplateWithUrl
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, rcmPageContent)
          .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
          .replace(/\[PAGE_NUMBER\]/g, String(recommendedControlMeasuresPageNum))
      : '';

    const populatedAdditionalSectionsPage1 = asbestosAdditionalSectionsTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, firstPageContent)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(additionalSection1PageNum));

    const populatedAdditionalSectionsPage2 = asbestosAdditionalSectionsTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, secondPageContent)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(additionalSection2PageNum));

    // Glossary page: fetch glossary custom data and build table (same header/footer as Discussion Conclusions, page number after additional sections)
    const glossaryPageNum = additionalSection2PageNum + 1;
    let glossaryTableRows = '';
    try {
      const glossaryItems = await CustomDataFieldGroup.getFieldsByType('glossary');
      const sorted = (glossaryItems || []).slice().sort((a, b) => {
        const nameA = (a.name || a.text || '').trim().toLowerCase();
        const nameB = (b.name || b.text || '').trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
      glossaryTableRows = sorted.map((item) => {
        const term = (item.name || item.text || '').trim();
        const definition = (item.text || '').trim();
        const termEscaped = term.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const definitionEscaped = definition.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
        return `<tr><td class="glossary-term">${termEscaped}</td><td class="glossary-definition">${definitionEscaped}</td></tr>`;
      }).join('');
    } catch (err) {
      console.warn(`[generateAssessmentHTML] Could not load glossary:`, err.message);
    }
    const populatedGlossaryPage = asbestosGlossaryTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[GLOSSARY_TABLE_ROWS\]/g, glossaryTableRows || '<tr><td colspan="2" class="glossary-definition">No glossary terms have been defined.</td></tr>')
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(glossaryPageNum));

    // Generate dynamic appendix content
    let appendixContent = '';

    // Add Certificate of Analysis cover page only when there are samples (fibre ID report attachment)
    if (assessmentData.fibreAnalysisReport) {
      const populatedAppendixACover = appendixACoverTemplateWithUrl
        .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

      appendixContent += `
          <!-- Appendix A Cover Page - Certificate of Analysis -->
          ${populatedAppendixACover}
      `;

      // Note: Analysis certificate content is now handled by merging the fibre analysis report PDF
      // No need to generate HTML content here
    }

    // Add site plan if it exists (Appendix A when no fibre ID report, Appendix B when fibre ID report exists)
    if (assessmentData.sitePlan && assessmentData.sitePlanFile) {
      const sitePlanAppendixLetterLegacy = assessmentData.fibreAnalysisReport ? 'B' : 'A';
      const populatedAppendixBCover = appendixBCoverTemplateWithUrl
        .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
        .replace(/\[APPENDIX_LETTER\]/g, sitePlanAppendixLetterLegacy);

      appendixContent += `
          <!-- Appendix ${sitePlanAppendixLetterLegacy} Cover Page (Site Plan) -->
          ${populatedAppendixBCover}
      `;

      // Add site plan content page if it's an image
      const isSitePlanImage = assessmentData.sitePlanFile && (
        assessmentData.sitePlanFile.startsWith('/9j/') || 
        assessmentData.sitePlanFile.startsWith('iVBORw0KGgo') ||
        assessmentData.sitePlanFile.startsWith('data:image/')
      );

      if (isSitePlanImage) {
        const trimmedSitePlan = await trimSitePlanImage(assessmentData.sitePlanFile);
        const assessmentDataTrimmed = { ...assessmentData, sitePlanFile: trimmedSitePlan };
        const sitePlanFigureTitle = assessmentData.sitePlanFigureTitle || 'Asbestos Survey Site Plan';
        const sitePlanContentPage = generateSitePlanContentPage(assessmentDataTrimmed, sitePlanAppendixLetterLegacy, logoBase64, assessmentFooterText, 'sitePlanFile', 'SITE PLAN', sitePlanFigureTitle, 'sitePlanLegend', 'sitePlanLegendTitle');
        appendixContent += `
            <!-- Appendix ${sitePlanAppendixLetterLegacy} Site Plan Content Page -->
            ${sitePlanContentPage}
        `;
      }
    }

    // Shared styles for assessment-page fragments (assessment register pages use same header/footer as AsbestosItem1)
    const assessmentPageSharedStyles = `
      .assessment-page { width: 100%; min-height: 100vh; position: relative; background: #fff; margin: 0; padding: 0; }
      .assessment-page .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; }
      .assessment-page .logo { width: 243px; height: auto; display: block; background: #fff; margin: 0; }
      .assessment-page .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; margin-top: 8px; margin: 0; }
      .assessment-page .company-details .website { color: #16b12b; font-weight: 500; }
      .assessment-page .green-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
      .assessment-page .content { padding: 10px 48px 24px 48px; flex: 1; display: flex; flex-direction: column; justify-content: flex-start; margin: 0; }
      .assessment-page .footer { position: absolute; left: 0; right: 0; bottom: 16px; width: calc(100% - 96px); margin: 0 auto; text-align: justify; font-size: 0.75rem; color: #222; }
      .assessment-page .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
      .assessment-page .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
      .assessment-page .footer-text { flex: 1; }
      .assessment-page .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
      .assessment-page .sample-register-header { font-size: 0.9rem; font-weight: 700; margin: 8px 0 12px 0; color: #222; }
      .assessment-page .sample-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; table-layout: fixed; font-size: 0.64rem; }
      .assessment-page .sample-table th, .assessment-page .sample-table td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
      .assessment-page .sample-table th { background: #f5f5f5; font-weight: 700; text-align: left; }
      /* Photo cell layout matches AsbestosItem1.html (table td border visible; no absolute fill over borders) */
      .assessment-page .sample-photo-cell {
        width: 71% !important;
        height: 340px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        text-align: center;
        vertical-align: middle;
        background: #fff;
        padding: 0 !important;
        margin: 0 !important;
      }
      .assessment-page .sample-photo-cell-inner {
        display: block;
        position: relative;
        width: 100%;
        height: 340px;
        overflow: hidden;
        box-sizing: border-box;
        padding: 0;
        margin: 0;
      }
      .assessment-page .pdf-arrow-overlay { position: absolute; width: 36px; height: 36px; pointer-events: none; z-index: 2; }
      .assessment-page .pdf-arrow-rotated { width: 36px; height: 36px; }
      .assessment-page .sample-photo-cell-inner .sample-photo {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        object-position: center !important;
        padding: 0 !important;
      }
      .assessment-page .sample-photo {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        padding: 0;
      }
      .assessment-page .sample-label { font-weight: 700; width: 12.5%; background: #f5f5f5; }
      .assessment-page .sample-ref-label { width: 13.75%; }
      .assessment-page .sample-ref-value { width: 11.25%; }
      .assessment-page .sample-value { width: 12.5%; }
      .assessment-page .sample-asbestos-content-cell { font-weight: bold; }
      .assessment-page .sample-risk-cell { line-height: 1; height: 1.2em; padding: 4px 8px; vertical-align: top; }
      .assessment-page .sample-location-content { height: 60px; vertical-align: top; padding: 8px; background: #fafafa; border: 1.5px solid #888; font-size: 0.64rem; line-height: 1.4; }
      .assessment-page .comments-row td { background: #eaeaea; font-size: 0.64rem; font-style: italic; width: 100%; line-height: 1.4; }
      .assessment-page .comments-cell-inner { min-height: 2.7rem; display: block; }
      .assessment-page .sample-no-photo { display: flex; align-items: center; justify-content: center; min-height: 340px; height: 100%; color: #666; font-style: italic; font-size: 0.64rem; }
      .assessment-page .asbestos-content-asbestos { color: #c62828; }
      .assessment-page .asbestos-content-non-asbestos { color: #2e7d32; }
      /* Site plan page styles (for appendix site plan when embedded in legacy assessment) */
      .site-plan-page { width: 100%; min-height: 100vh; position: relative; background: #fff; margin: 0; padding: 0; }
      .site-plan-page .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; }
      .site-plan-page .green-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
      .site-plan-page .content { padding: 5px 48px 10px 48px; flex: 1; display: flex; flex-direction: column; margin: 0; min-height: 0; overflow: hidden; }
      .site-plan-page .footer { position: relative; left: 0; right: 0; bottom: 0; width: 100%; padding: 0 48px 16px 48px; text-align: justify; font-size: 0.75rem; color: #222; }
      .site-plan-page .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
      .site-plan-page .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
      .site-plan-page .footer-text { flex: 1; }
      .site-plan-layout { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: row; justify-content: flex-start; gap: 10px; align-items: flex-start; margin: 0; width: 100%; padding: 0 8px 0 0; }
      .site-plan-container { flex: 1 1 auto; width: auto; max-width: none; min-width: 0; overflow: hidden; display: flex; flex-direction: column; padding: 0; margin: 12px 0 0 0; border: none; background: transparent; border-radius: 0; box-shadow: none; }
      .site-plan-legend-container { flex: 0 0 280px; max-width: 280px; min-width: 260px; }
    `;

    // Create complete HTML document
    const completeHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Asbestos Assessment Report</title>
        <style>
          /* Force page breaks between sections */
          .page-break {
            page-break-before: always;
            height: 0;
            margin: 0;
            padding: 0;
          }
          /* Shared styles for assessment register pages (match AsbestosItem1 / VersionControl header and footer; body 0.8rem) */
          ${assessmentPageSharedStyles}
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        ${populatedCover}
        <div class="page-break"></div>
        
        <!-- Version Control Page -->
        ${populatedVersionControl}
        <div class="page-break"></div>
        
        <!-- Asbestos Assessment Content Page -->
        ${populatedAsbestosItem1}
        <div class="page-break"></div>
        
        <!-- Assessment Register Pages -->
        ${sampleRegisterPages}
        <div class="page-break"></div>
        
        <!-- Discussion and Conclusions Page (force new page when odd number of table blocks) -->
        ${tableBlocks.length % 2 === 1 ? '<div style="page-break-before: always;">' : ''}${populatedDiscussionConclusions}${tableBlocks.length % 2 === 1 ? '</div>' : ''}
        <div class="page-break"></div>
        ${hasRcmPage ? `<!-- Recommended Control Measures Page -->\n        ${populatedRecommendedControlMeasures}\n        <div class="page-break"></div>\n        ` : ''}
        <!-- Additional Sections Page 1 -->
        ${populatedAdditionalSectionsPage1}
        <div class="page-break"></div>
        
        <!-- Additional Sections Page 2 -->
        ${populatedAdditionalSectionsPage2}
        <div class="page-break"></div>
        
        <!-- Glossary of Terms Page (before Appendix A) -->
        ${populatedGlossaryPage}
        <div class="page-break"></div>
        
        <!-- Appendix Section -->
        ${appendixContent}
      </body>
      </html>
    `;

    return completeHTML;
  } catch (error) {
    console.error('Error generating assessment HTML:', error);
    throw new Error(`Failed to generate assessment HTML: ${error.message}`);
  }
};

/**
 * V3 (experimental): Cover + Version Control only, using existing templates unchanged.
 * This keeps the legacy layout for the opening pages while we test flow pagination for the rest.
 */
const formatLeadAssessmentCoverTitleHtml = (reportHeadersTitle) => {
  const raw = (reportHeadersTitle || 'Lead Assessment Report').trim().toUpperCase();
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[words.length - 1] === 'REPORT') {
    return `${escapeHtml(words.slice(0, -1).join(' '))}<br />REPORT`;
  }
  return escapeHtml(raw);
};

const generateAssessmentCoverVersionHTMLV3 = async (assessmentData, isResidential = false, isLeadAssessment = false) => {
  // Load DocRaptor-optimized templates (existing)
  const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
  const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
  const versionControlTemplate = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const replaceFrontendUrl = (template) => template.replace(/\[FRONTEND_URL\]/g, frontendUrl);
  const coverTemplateWithUrl = replaceFrontendUrl(coverTemplate);
  const versionControlTemplateWithUrl = replaceFrontendUrl(versionControlTemplate);

  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

  const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
  const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';

  // Different cover background per assessment type: asbestos (commercial) = ma.jpg, residential = res.jpg; lead uses commercial-style cover
  const assessmentCoverImage = isResidential ? 'res.jpg' : 'ma.jpg';
  const backgroundPath = path.join(__dirname, '../assets', assessmentCoverImage);
  const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

  const templateType = isLeadAssessment ? 'leadAssessment' : (isResidential ? 'residentialAsbestosAssessment' : 'asbestosAssessment');
  const templateContent = await getTemplateByType(templateType);

  const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  const assessmentClientName = assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client';
  const consultantName = assessmentData.consultantId?.firstName && assessmentData.consultantId?.lastName
    ? `${assessmentData.consultantId.firstName} ${assessmentData.consultantId.lastName}`
    : null;
  const reportAuthorName = isLeadAssessment
    ? (consultantName || assessmentData.LAA || (assessmentData.assessorId?.firstName && assessmentData.assessorId?.lastName
      ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : null) || 'Unknown Consultant')
    : (assessmentData.LAA || (assessmentData.assessorId?.firstName && assessmentData.assessorId?.lastName
      ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : null) || 'Unknown Assessor');

  let assessmentReportTitle;
  let assessmentFooterText;
  let versionControlReportTitle;
  let versionControlFilename;
  if (isLeadAssessment) {
    const headerTitle = templateContent?.reportHeaders?.title || 'Lead Assessment Report';
    assessmentReportTitle = formatLeadAssessmentCoverTitleHtml(headerTitle);
    assessmentFooterText = `Lead Assessment Report: ${assessmentSiteAddress}`;
    versionControlReportTitle = headerTitle.trim().toUpperCase();
    versionControlFilename = `${assessmentData.projectId?.projectID || 'Unknown'}_Lead_Assessment_Report - ${assessmentSiteAddress} (${assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown'}).pdf`;
  } else {
    assessmentReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : 'ASBESTOS ASSESSMENT<br />REPORT';
    assessmentFooterText = isResidential ? `Residential Asbestos Assessment Report: ${assessmentSiteAddress}` : `Asbestos Assessment Report: ${assessmentSiteAddress}`;
    versionControlReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : (templateContent?.reportTitle || 'ASBESTOS ASSESSMENT REPORT');
    versionControlFilename = isResidential
      ? `${assessmentData.projectId?.projectID || 'Unknown'}_Residential_Asbestos_Assessment_Report - ${assessmentSiteAddress} (${assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown'}).pdf`
      : `${assessmentData.projectId?.projectID || 'Unknown'}_Asbestos_Assessment_Report - ${assessmentSiteAddress} (${assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown'}).pdf`;
  }

  // Revision history: assessment report authorisation only (not Fibre ID approval)
  const isLeadAssessmentReport = assessmentData.jobType === 'lead-assessment';
  const awaitingAuthorisationHtml = '<span style="color:#d32f2f; font-weight:600;">Awaiting authorisation</span>';
  const reportApprovedBy = assessmentData.reportAuthorisedBy || (isLeadAssessmentReport ? awaitingAuthorisationHtml : 'Awaiting authorisation');
  const reportIssueDate = assessmentData.reportAuthorisedAt
    ? formatDateSydney(assessmentData.reportAuthorisedAt)
    : (isLeadAssessmentReport ? awaitingAuthorisationHtml : 'Awaiting authorisation');
  const documentIssueDate = todaySydney();

  const assessmentIntrusivenessLabelV3 = assessmentData.intrusiveness === 'intrusive' ? 'intrusive' : 'non-intrusive';
  const populatedCover = coverTemplateWithUrl
    .replace(/\[REPORT_TITLE\]/g, assessmentReportTitle)
    .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
    .replace(/\[SECONDARY_HEADER\]/g, assessmentData.secondaryHeader || '')
    .replace(/\[INTRUSIVENESS\]/g, assessmentIntrusivenessLabelV3)
    .replace(/\[CLIENT_NAME\]/g, assessmentClientName)
    .replace(/\[JOB_REFERENCE\]/g, assessmentData.projectId?.projectID || 'Unknown')
    .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown')
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`);

  const populatedVersionControl = versionControlTemplateWithUrl
    .replace(/\[REPORT_TITLE\]/g, versionControlReportTitle)
    .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
    .replace(/\[CLIENT_NAME\]/g, assessmentData.projectId?.client?.name || assessmentClientName)
    .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? formatDateSydney(assessmentData.assessmentDate) : 'Unknown')
    .replace(/\[DOCUMENT_ISSUE_DATE\]/g, documentIssueDate)
    .replace(/\[ASSESSOR_NAME\]/g, reportAuthorName)
    .replace(/\[FILENAME\]/g, versionControlFilename)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
    .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
    .replace(/\[REPORT_APPROVED_BY\]/g, reportApprovedBy)
    .replace(/\[REPORT_ISSUE_DATE\]/g, reportIssueDate);

  return `${populatedCover}<div class="page-break"></div>${populatedVersionControl}`;
};

/**
 * Lead assessment PDF — executive summary tables (positive findings only). Mirrors frontend LeadAssessmentItems logic.
 */
function parseLeadPercentForLeadExec(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function getLeadPaintStatusForLeadExec(leadContent) {
  const pct = parseLeadPercentForLeadExec(leadContent);
  if (pct == null) return null;
  if (pct > 0.1) return { isLeadPaint: true };
  return { isLeadPaint: false };
}

function parseSoilAssessmentCriteriaThresholdForLeadExec(assessmentCriteria) {
  if (!assessmentCriteria) return null;
  const match = String(assessmentCriteria).match(/\(([\d.]+)\s*mg\/kg\)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getSoilExceedanceForLeadExec(leadContent, assessmentCriteria) {
  const contentValue = parseLeadPercentForLeadExec(leadContent);
  const threshold = parseSoilAssessmentCriteriaThresholdForLeadExec(assessmentCriteria);
  if (contentValue == null || threshold == null) return null;
  return { exceeds: contentValue >= threshold };
}

function getSampleAreaM2ForLeadExec(sampleArea) {
  if (sampleArea == null || sampleArea === '') return null;
  const s = String(sampleArea).toLowerCase().trim();
  if (s === 'small' || s.includes('0.01')) return 0.01;
  if (s === 'medium' || s.includes('0.0258')) return 0.0258;
  if (s === 'large' || s.includes('0.09')) return 0.09;
  const numeric = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function calculateDustLeadConcentrationMgM2ForLeadExec(leadContentUg, sampleArea) {
  const ug = parseLeadPercentForLeadExec(leadContentUg);
  const areaM2 = getSampleAreaM2ForLeadExec(sampleArea);
  if (ug == null || areaM2 == null || areaM2 <= 0) return null;
  return (ug / 1000) / areaM2;
}

function getDustExceedanceForLeadExec(locationRating, leadContentUg, sampleArea) {
  const concentration = calculateDustLeadConcentrationMgM2ForLeadExec(leadContentUg, sampleArea);
  if (concentration == null) return null;
  const rating = Number(locationRating);
  const thresholdByRating = { 1: 1.08, 2: 0.43, 3: 0.11 };
  const threshold = thresholdByRating[rating];
  if (threshold == null) return null;
  return { exceeds: concentration >= threshold };
}

function getRiskLevelLabelForLeadExec(product) {
  if (product == null || product < 7) return 'VERY LOW RISK';
  if (product <= 18) return 'LOW RISK';
  if (product <= 35) return 'MEDIUM RISK';
  return 'HIGH RISK';
}

function getItemRiskLabelForLeadExec(item) {
  const o = item.occupantRating;
  const l = item.locationRating;
  const u = item.roomUseRating;
  const c = item.conditionRating;
  if (o == null || o === '' || l == null || l === '' || u == null || u === '' || c == null || c === '') return null;
  const product = Number(o) * Number(l) * Number(u) * Number(c);
  return getRiskLevelLabelForLeadExec(product);
}

function getReferredRiskLabelForLeadExec(ref) {
  const o = ref.occupantRating;
  const l = ref.locationRating;
  const u = ref.roomUseRating;
  const c = ref.conditionRating;
  if (o === '' || o == null || l === '' || l == null || u === '' || u == null || c === '' || c == null) return null;
  const product = Number(o) * Number(l) * Number(u) * Number(c);
  return getRiskLevelLabelForLeadExec(product);
}

function formatRoomAreaCellForLeadExec(levelFloor, roomArea) {
  const floor = levelFloor != null ? String(levelFloor).trim() : '';
  const room = roomArea != null ? String(roomArea).trim() : '';
  if (floor && room) return `${floor}, ${room}`;
  if (floor) return floor;
  if (room) return room;
  return '—';
}

function formatLeadContentCellForLeadExec(item) {
  const lc = (item.leadContent || '').trim();
  const conc = (item.leadConcentration || '').trim();
  const fr = (item.analysisData?.finalResult || '').trim();
  const parts = [];
  if (lc) parts.push(lc);
  if (conc) parts.push(conc);
  if (parts.length) return parts.join(' / ');
  if (fr) return fr;
  return item.analysisData?.isAnalysed ? 'See certificate' : 'Pending analysis';
}

/** Append unit for executive summary when value is present and not a placeholder. */
function formatLeadContentWithUnitForExec(item, unit) {
  const base = formatLeadContentCellForLeadExec(item);
  if (!base || base === 'Pending analysis' || base === 'See certificate') return base;
  const s = base.trim();
  if (unit === '%') {
    if (/%\s*$/.test(s)) return s;
    return `${s}%`;
  }
  if (unit === 'μg') {
    if (/\b(μg|µg|ug)\b/i.test(s)) return s;
    return `${s} μg`;
  }
  if (unit === 'mg/kg') {
    if (/mg\s*\/\s*kg/i.test(s)) return s;
    return `${s} mg/kg`;
  }
  return s;
}

function riskDisplayForLeadExec(label) {
  if (!label) return '—';
  return String(label).replace(/\s+RISK$/i, '').trim() || '—';
}

function getRiskClassForLeadExec(label) {
  const normalized = String(label || '').toUpperCase().trim();
  if (normalized === 'HIGH RISK' || normalized === 'HIGH') return 'risk-high';
  if (normalized === 'MEDIUM RISK' || normalized === 'MEDIUM') return 'risk-medium';
  if (normalized === 'LOW RISK' || normalized === 'LOW') return 'risk-low';
  if (normalized === 'VERY LOW RISK' || normalized === 'VERY LOW') return 'risk-very-low';
  if (normalized === 'EXCEEDANCE') return 'risk-exceedance';
  if (normalized.includes('NO EXCEED') || normalized.includes('LEAD-FREE') || normalized === 'LEAD FREE') return 'risk-ok';
  return '';
}

function renderLeadExecCell(cell, extraClassName = '') {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
    const value = cell.value == null ? '' : String(cell.value);
    const className = [extraClassName, cell.className].filter(Boolean).join(' ').trim();
    return `<td${className ? ` class="${className}"` : ''}>${escapeHtml(value)}</td>`;
  }
  const value = cell == null ? '' : String(cell);
  return `<td${extraClassName ? ` class="${extraClassName}"` : ''}>${escapeHtml(value)}</td>`;
}

function buildLeadExecSummaryTable4Col(colHeaders, bodyRows) {
  const colClasses = ['exec-4c-1', 'exec-4c-2', 'exec-4c-3', 'exec-4c-4'];
  const th = colHeaders.map((h, idx) => `<th class="${colClasses[idx]}">${escapeHtml(h)}</th>`).join('');
  const trs = bodyRows.map((cells) =>
    `<tr>${cells.map((c, idx) => renderLeadExecCell(c, colClasses[idx])).join('')}</tr>`,
  ).join('');
  return `<table class="exec-summary-table exec-summary-table-4col">
<colgroup><col class="exec-4c-1" /><col class="exec-4c-2" /><col class="exec-4c-3" /><col class="exec-4c-4" /></colgroup>
<thead>
<tr>${th}</tr>
</thead>
<tbody>${trs}</tbody>
</table>`;
}

function buildLeadExecSummaryTable3Col(colHeaders, bodyRows) {
  const colClasses = ['exec-3c-1', 'exec-3c-2', 'exec-3c-3'];
  const th = colHeaders.map((h, idx) => `<th class="${colClasses[idx]}">${escapeHtml(h)}</th>`).join('');
  const trs = bodyRows.map((cells) =>
    `<tr>${cells.map((c, idx) => renderLeadExecCell(c, colClasses[idx])).join('')}</tr>`,
  ).join('');
  return `<table class="exec-summary-table exec-summary-table-3col">
<colgroup><col class="exec-3c-1" /><col class="exec-3c-2" /><col class="exec-3c-3" /></colgroup>
<thead>
<tr>${th}</tr>
</thead>
<tbody>${trs}</tbody>
</table>`;
}

/**
 * @returns {{ html: string, execTableCount: number }}
 */
function buildLeadAssessmentExecutiveSummaryBlock(assessmentData) {
  const items = assessmentData.items || [];
  const rawTypes = assessmentData.assessmentType;
  const assessmentTypes = Array.isArray(rawTypes) ? rawTypes.map((t) => String(t).toLowerCase()) : [];
  const typeIncludes = (key) => assessmentTypes.length === 0 || assessmentTypes.includes(key);

  const chunks = [];
  let tableNum = 1;

  const addPaintLikeBlock = (materialKey, tableTitle) => {
    if (!typeIncludes(materialKey)) return;
    const rows = [];
    items.forEach((item) => {
      if (String(item.materialType || '').toLowerCase() !== materialKey) return;
      const paintSt = getLeadPaintStatusForLeadExec(item.leadContent);
      const lc = formatLeadContentWithUnitForExec(item, '%');
      const rawRisk = getItemRiskLabelForLeadExec(item);
      const isLeadPaint = paintSt?.isLeadPaint === true;
      const isLeadFree = paintSt && paintSt.isLeadPaint === false;
      const riskCell = isLeadPaint
        ? { value: riskDisplayForLeadExec(rawRisk), className: getRiskClassForLeadExec(rawRisk) }
        : isLeadFree
          ? { value: '-', className: '' }
          : { value: '—', className: '' };
      rows.push([
        formatRoomAreaCellForLeadExec(item.levelFloor, item.roomArea),
        item.locationDescription || '—',
        lc,
        riskCell,
      ]);
      (item.referredLocations || []).forEach((ref) => {
        const rawReferredRisk = getReferredRiskLabelForLeadExec(ref);
        const rr = riskDisplayForLeadExec(rawReferredRisk);
        const refRiskCell = isLeadPaint
          ? { value: rr, className: getRiskClassForLeadExec(rawReferredRisk) }
          : isLeadFree
            ? { value: '-', className: '' }
            : { value: '—', className: '' };
        rows.push([
          formatRoomAreaCellForLeadExec(ref.levelFloor, ref.roomArea),
          ref.surfaceDescription || '—',
          lc,
          refRiskCell,
        ]);
      });
    });
    if (rows.length === 0) return;
    const n = tableNum;
    tableNum += 1;
    chunks.push(
      buildTableCaptionHtml(
        n,
        materialKey === 'paint' ? 'Summary of Findings of Lead Paint Assessment' : tableTitle,
      ),
    );
    chunks.push(
      buildLeadExecSummaryTable4Col(['Room/Area', 'Paint Location', 'Lead Content', 'Risk Rating'], rows),
    );
  };

  addPaintLikeBlock('paint', 'Lead Paint');
  addPaintLikeBlock('paint-xrf', 'Lead Paint (XRF)');

  if (typeIncludes('dust')) {
    const rows = [];
    items.forEach((item) => {
      if (String(item.materialType || '').toLowerCase() !== 'dust') return;
      const dustSt = getDustExceedanceForLeadExec(item.locationRating, item.leadContent, item.leadSampleArea);
      const statusText = String(item.status || '').toLowerCase();
      // "No exceedance" contains substring "exceedance" — exclude no-exceed statuses first
      const isStatusNoExceed = statusText.includes('no exceed');
      const isStatusExceedance =
        !isStatusNoExceed && (statusText.includes('exceedance') || statusText.includes('exceedence'));
      const exceeds = dustSt?.exceeds === true || isStatusExceedance;
      const noExceed = dustSt?.exceeds === false || isStatusNoExceed;
      const lc = formatLeadContentWithUnitForExec(item, 'μg');
      const rawRisk = getItemRiskLabelForLeadExec(item);
      const riskBand = riskDisplayForLeadExec(rawRisk);
      let riskCell;
      if (exceeds) {
        riskCell = {
          value: riskBand === '—' ? 'Exceedance' : riskBand,
          className: getRiskClassForLeadExec(riskBand === '—' ? 'EXCEEDANCE' : rawRisk) || 'risk-exceedance',
        };
      } else if (noExceed || dustSt != null) {
        riskCell = { value: '-', className: '' };
      } else {
        riskCell = { value: riskBand, className: getRiskClassForLeadExec(rawRisk) };
      }
      rows.push([
        formatRoomAreaCellForLeadExec(item.levelFloor, item.roomArea),
        item.locationDescription || '—',
        lc,
        riskCell,
      ]);
    });
    if (rows.length > 0) {
      const n = tableNum;
      tableNum += 1;
      chunks.push(buildTableCaptionHtml(n, 'Summary of Findings of Lead Dust Assessment'));
      chunks.push(
        buildLeadExecSummaryTable4Col(['Room/Area', 'Dust Location', 'Lead Content', 'Risk Rating'], rows),
      );
    }
  }

  if (typeIncludes('soil')) {
    const rows = [];
    items.forEach((item) => {
      if (String(item.materialType || '').toLowerCase() !== 'soil') return;
      const soilSt = getSoilExceedanceForLeadExec(item.leadContent, item.paintColour);
      const lc = formatLeadContentWithUnitForExec(item, 'mg/kg');
      let exceedCell;
      if (soilSt?.exceeds === true) {
        exceedCell = { value: 'Yes', className: 'risk-exceedance' };
      } else if (soilSt?.exceeds === false) {
        exceedCell = { value: '-', className: '' };
      } else {
        exceedCell = { value: '—', className: '' };
      }
      rows.push([item.locationDescription || '—', lc, exceedCell]);
    });
    if (rows.length > 0) {
      const n = tableNum;
      tableNum += 1;
      chunks.push(buildTableCaptionHtml(n, 'Summary of Findings of Lead in Soil Assessment'));
      chunks.push(
        buildLeadExecSummaryTable3Col(['Location', 'Lead Content', 'Exceedance of Criteria?'], rows),
      );
    }
  }

  const execTableCount = tableNum - 1;
  if (chunks.length === 0) {
    return {
      html: `<div class="section-header">EXECUTIVE SUMMARY</div>
<div class="section-body"><p>There are no assessment items to summarise for the selected assessment types.</p></div>`,
      execTableCount: 0,
    };
  }

  return {
    html: `<div class="section-header">EXECUTIVE SUMMARY</div>
<div class="section-body exec-summary-wrap">${chunks.join('')}</div>`,
    execTableCount,
  };
}

/** Rows from persisted `leadAssessmentScope` (same shape as LeadAssessmentItems scope modal after save). */
function getLeadScopeRowsForPdfType(storedScope, typeKey) {
  const isSoil = typeKey === 'soil';
  const arr = storedScope?.[typeKey];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      roomArea: isSoil ? '' : String(r?.roomArea ?? '').trim(),
      locations: String(r?.locations ?? '').trim(),
    }))
    .filter((r) => (isSoil ? r.locations : r.roomArea || r.locations));
}

function escapeHtmlWithBreaks(text) {
  return escapeHtml(text == null ? '' : String(text)).replace(/\r\n|\n|\r/g, '<br />');
}

function buildTableCaptionHtml(tableNumber, captionText) {
  return `<div class="scope-table-caption"><span class="caption-prefix">Table ${tableNumber}:</span> ${escapeHtml(captionText)}</div>`;
}

function buildLeadScopeBulletPaintDust(r) {
  const roomPart = String(r.roomArea ?? '').trim();
  const locPart = String(r.locations ?? '').trim();
  if (roomPart && locPart) {
    return `${escapeHtmlWithBreaks(roomPart)} - ${escapeHtmlWithBreaks(locPart)}`;
  }
  if (roomPart) return escapeHtmlWithBreaks(roomPart);
  if (locPart) return escapeHtmlWithBreaks(locPart);
  return escapeHtml('—');
}

function buildLeadScopeBulletSoil(r) {
  const locPart = String(r.locations ?? '').trim();
  return locPart ? escapeHtmlWithBreaks(locPart) : escapeHtml('—');
}

/**
 * Scoped items after introduction: subheaders per medium and bullet list (no tables; does not consume table numbers).
 * @returns {{ html: string, scopeTableCount: number }}
 */
function buildLeadAssessmentScopeTablesHtml(assessmentData) {
  const rawTypes = assessmentData.assessmentType;
  const assessmentTypes = Array.isArray(rawTypes) ? rawTypes.map((t) => String(t).toLowerCase()) : [];
  const typeIncludes = (key) => assessmentTypes.length === 0 || assessmentTypes.includes(key);
  const stored =
    assessmentData.leadAssessmentScope &&
    typeof assessmentData.leadAssessmentScope === 'object' &&
    !Array.isArray(assessmentData.leadAssessmentScope)
      ? assessmentData.leadAssessmentScope
      : {};

  const blocks = [];

  const paintLikeRows = [
    ...getLeadScopeRowsForPdfType(stored, 'paint'),
    ...getLeadScopeRowsForPdfType(stored, 'paint-xrf'),
  ];
  if ((typeIncludes('paint') || typeIncludes('paint-xrf')) && paintLikeRows.length > 0) {
    const lis = paintLikeRows.map((r) => `<li>${buildLeadScopeBulletPaintDust(r)}</li>`).join('');
    blocks.push(`<div class="section-subheader">Lead Paint</div><ul class="bullet-list">${lis}</ul>`);
  }

  if (typeIncludes('dust')) {
    const dustRows = getLeadScopeRowsForPdfType(stored, 'dust');
    if (dustRows.length > 0) {
      const lis = dustRows.map((r) => `<li>${buildLeadScopeBulletPaintDust(r)}</li>`).join('');
      blocks.push(`<div class="section-subheader">Lead Dust</div><ul class="bullet-list">${lis}</ul>`);
    }
  }

  if (typeIncludes('soil')) {
    const soilRows = getLeadScopeRowsForPdfType(stored, 'soil');
    if (soilRows.length > 0) {
      const lis = soilRows.map((r) => `<li>${buildLeadScopeBulletSoil(r)}</li>`).join('');
      blocks.push(`<div class="section-subheader">Lead in Soil</div><ul class="bullet-list">${lis}</ul>`);
    }
  }

  if (blocks.length === 0) {
    return { html: '', scopeTableCount: 0 };
  }
  return {
    html: `<div class="section-body scope-tables-wrap scope-items-list-wrap">${blocks.join('')}</div>`,
    scopeTableCount: 0,
  };
}

/** Normalised material kind for lead PDF sample register rows (paint includes XRF). */
function getLeadPdfMaterialKind(item) {
  const m = String(item.materialType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (m === 'soil') return 'soil';
  if (m === 'dust') return 'dust';
  if (m === 'paint' || m === 'paint-xrf') return 'paint';
  return 'paint';
}

/**
 * Lead sample register table: material-specific middle rows; compact single-row fields.
 */
function buildLeadSampleRegisterTableHtml({
  photoCellInnerHtml,
  itemNumber,
  sampleReferenceHtml,
  locationHtml,
  sampleTypeHtml,
  materialKind,
  paintColourHtml,
  sampleAreaDustHtml,
  assessmentCriteriaHtml,
  leadValueLabelHtml,
  leadResultHtml,
  leadResultClassName,
  riskOrExceedanceLabelHtml,
  riskOrExceedanceValueHtml,
  riskOrExceedanceClassName,
  commentsHtml,
}) {
  const rowspan = 9;
  let typeSpecificRows = '';
  if (materialKind === 'paint') {
    typeSpecificRows = `<tr>
    <td class="sample-label">Paint colour</td>
    <td class="sample-value">${paintColourHtml}</td>
  </tr>`;
  } else if (materialKind === 'dust') {
    typeSpecificRows = `<tr>
    <td class="sample-label">Sample area</td>
    <td class="sample-value">${sampleAreaDustHtml}</td>
  </tr>`;
  } else {
    typeSpecificRows = `<tr>
    <td class="sample-label">Assessment criteria</td>
    <td class="sample-value">${assessmentCriteriaHtml}</td>
  </tr>`;
  }

  const leadResultClassAttr = leadResultClassName ? ` ${leadResultClassName}` : '';
  const riskClassAttr = riskOrExceedanceClassName ? ` ${riskOrExceedanceClassName}` : '';
  return `<table class="sample-table lead-sample-table">
  <colgroup>
    <col style="width:71%" />
    <col style="width:13%" />
    <col style="width:16%" />
  </colgroup>
  <tr>
    <td class="sample-photo-cell lead-sample-photo-cell" rowspan="${rowspan}" style="width:71%">
      ${photoCellInnerHtml}
    </td>
    <td class="sample-label" style="width:13%">Item number</td>
    <td class="sample-value" style="width:16%">${itemNumber}</td>
  </tr>
  <tr>
    <td class="sample-label sample-ref-label" style="width:13%">Sample ref.</td>
    <td class="sample-value sample-ref-value" style="width:16%">${sampleReferenceHtml}</td>
  </tr>
  <tr>
    <td class="sample-label" colspan="2">Location and description</td>
  </tr>
  <tr>
    <td class="sample-location-content" colspan="2">${locationHtml}</td>
  </tr>
  <tr>
    <td class="sample-label">Material type</td>
    <td class="sample-value">${sampleTypeHtml}</td>
  </tr>
  ${typeSpecificRows}
  <tr>
    <td class="sample-label" colspan="2">${leadValueLabelHtml}</td>
  </tr>
  <tr>
    <td class="sample-value sample-asbestos-content-cell${leadResultClassAttr}" colspan="2">${leadResultHtml}</td>
  </tr>
  <tr>
    <td class="sample-label">${riskOrExceedanceLabelHtml}</td>
    <td class="sample-value${riskClassAttr}">${riskOrExceedanceValueHtml}</td>
  </tr>
  <tr class="comments-row">
    <td colspan="3" style="width: 100%">
      <div class="comments-cell-inner">
        <strong>Recommendation Actions/Comments:</strong><br />${commentsHtml}
      </div>
    </td>
  </tr>
</table>`;
}

/**
 * Lead assessment report body (flow): sections from ReportTemplate type leadAssessment + lead sample register.
 */
const generateLeadAssessmentFlowHTMLV3 = async (assessmentData) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const templateContent = await getTemplateByType('leadAssessment');
  const resolvedLegislation = await resolveSelectedLegislation(templateContent?.selectedLegislation);
  const selectedLegislation = (assessmentData.legislation && assessmentData.legislation.length > 0)
    ? assessmentData.legislation
    : resolvedLegislation;

  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

  const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  const assessmentFooterText = `Lead Assessment Report: ${assessmentSiteAddress}`;
  const assessmentJurisdiction = assessmentData.state === 'Commonwealth' ? 'ACT' : assessmentData.state;

  const scopeBullets = (assessmentData.assessmentScope || [])
    .map((t) => `<li>${escapeHtml(String(t))}</li>`)
    .join('');
  const assessmentScopeBullets = scopeBullets || '<li>No scope items specified</li>';

  const leadTemplateData = {
    ...assessmentData,
    jobType: 'lead-assessment',
    jurisdiction: assessmentJurisdiction,
    selectedLegislation,
    assessmentScopeBullets,
  };

  const nlToBr = async (raw) => {
    if (!raw) return '';
    const populated = await replacePlaceholders(String(raw), leadTemplateData);
    // Keep [BR] as one line break + half-line spacer in lead flow:
    // replacePlaceholders can wrap the HALF_BR span in a paragraph block, which adds a full extra line.
    return populated.replace(
      /<div class="paragraph">\s*(<span style="display:block; height:0\.5em;"><\/span>)\s*<\/div>/g,
      '$1',
    );
  };

  const ss = templateContent?.standardSections || {};
  const rawTypesForLeadFlow = assessmentData.assessmentType;
  const leadFlowAssessmentTypes = Array.isArray(rawTypesForLeadFlow)
    ? rawTypesForLeadFlow.map((t) => String(t).toLowerCase())
    : [];
  const leadFlowTypeIncludes = (key) =>
    leadFlowAssessmentTypes.length === 0 || leadFlowAssessmentTypes.includes(key);
  const hasLeadPaintType = leadFlowTypeIncludes('paint') || leadFlowTypeIncludes('paint-xrf');
  const hasLeadDustType = leadFlowTypeIncludes('dust');
  const hasLeadSoilType = leadFlowTypeIncludes('soil');
  const explicitLeadTypeCount = new Set(leadFlowAssessmentTypes).size;
  const showLeadTypeSubheaders = explicitLeadTypeCount !== 1;
  const executiveSummaryBlock = buildLeadAssessmentExecutiveSummaryBlock(assessmentData);
  const scopeTablesBlock = buildLeadAssessmentScopeTablesHtml(assessmentData);
  const sampleRegisterTableStartNumber =
    executiveSummaryBlock.execTableCount + scopeTablesBlock.scopeTableCount + 1;

  const introductionHtml = ss.introductionContent
    ? await nlToBr(ss.introductionContent)
    : '<p>Introduction content not found</p>';

  const assessmentItems = assessmentData.items || [];

  const getLocationContentLead = (item) => {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = [];
    if (item.levelFloor && String(item.levelFloor).trim()) parts.push(esc(item.levelFloor));
    if (item.roomArea && String(item.roomArea).trim()) parts.push(esc(item.roomArea));
    parts.push(esc(item.locationDescription || 'Unknown Location'));
    return parts.join('<br/>');
  };

  const getLeadResultHtml = (item) => {
    const lc = (item.leadContent || '').trim();
    const conc = (item.leadConcentration || '').trim();
    const fr = (item.analysisData?.finalResult || '').trim();
    const parts = [];
    if (lc) parts.push(lc);
    if (conc) parts.push(conc);
    if (parts.length) return escapeHtml(parts.join(' / '));
    if (fr) return escapeHtml(fr);
    return escapeHtml(item.analysisData?.isAnalysed ? 'See certificate' : 'Pending analysis');
  };
  const formatLeadSampleAreaForPdf = (rawArea) => {
    const raw = String(rawArea || '').trim();
    if (!raw) return '—';
    const s = raw.toLowerCase();
    if (s === 'small' || s.includes('small') || s.includes('0.01')) return '0.01 m2';
    if (s === 'medium' || s.includes('medium') || s.includes('0.0258')) return '0.0258 m2';
    if (s === 'large' || s.includes('large') || s.includes('0.09')) return '0.09 m2';
    if (/m\s*(2|²)/i.test(raw)) return raw.replace(/m\s*²/i, 'm2');
    if (/^\d+(\.\d+)?$/.test(raw)) return `${raw} m2`;
    return raw;
  };
  const formatLeadResultForSampleRegister = (item, unit) => {
    const base = (item.leadContent || '').trim() || (item.leadConcentration || '').trim() || (item.analysisData?.finalResult || '').trim();
    if (!base) return item.analysisData?.isAnalysed ? 'See certificate' : 'Pending analysis';
    if (base === 'Pending analysis' || base === 'See certificate') return base;
    const s = String(base).trim();
    if (unit === '%') {
      if (/%\s*$/.test(s)) return s;
      return `${s}%`;
    }
    if (unit === 'mg/cm2') {
      if (/mg\s*\/\s*cm2/i.test(s)) return s;
      return `${s} mg/cm2`;
    }
    if (unit === 'mg/kg') {
      if (/mg\s*\/\s*kg/i.test(s)) return s;
      return `${s} mg/kg`;
    }
    return s;
  };
  const sentenceCaseRisk = (raw) => {
    const s = String(raw || '').trim();
    if (!s || s === '—' || s === '-') return s || '—';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const DEFAULT_ARROW_ROTATION_PDF_LEAD = -45;
  const getArrowTipOffsetPdfLead = (rotationDeg) => {
    const r = ((rotationDeg ?? DEFAULT_ARROW_ROTATION_PDF_LEAD) * Math.PI) / 180;
    const tipX = (12 + 10 * Math.sin(r)) / 24;
    const tipY = (12 - 10 * Math.cos(r)) / 24;
    return { x: tipX, y: tipY };
  };
  const getPhotoArrowsForPdfLead = (photo) => {
    if (!photo) return [];
    if (photo.arrows && photo.arrows.length > 0) return photo.arrows;
    const leg = photo.arrow;
    if (leg && typeof leg === 'object' && (leg.x != null || leg.y != null)) return [leg];
    return [];
  };
  const buildArrowOverlaysHtmlLead = (arrows) => {
    if (!arrows || arrows.length === 0) return '';
    const defaultColor = '#f44336';
    return arrows.map((arr) => {
      const rot = arr.rotation ?? DEFAULT_ARROW_ROTATION_PDF_LEAD;
      const tipOff = getArrowTipOffsetPdfLead(rot);
      const color = (arr.color || defaultColor).replace(/"/g, '&quot;');
      const leftPct = ((arr.x ?? 0.5) * 100).toFixed(2);
      const topPct = ((arr.y ?? 0.5) * 100).toFixed(2);
      const tx = (-tipOff.x * 100).toFixed(2);
      const ty = (-tipOff.y * 100).toFixed(2);
      return `<div class="pdf-arrow-overlay" style="left:${leftPct}%;top:${topPct}%;transform:translate(${tx}%,${ty}%);"><div class="pdf-arrow-rotated" style="transform:rotate(${rot}deg);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="22" x2="12" y2="10" stroke="rgba(0,0,0,0.5)" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="22" x2="12" y2="10" stroke="${color}" stroke-width="2" stroke-linecap="round"/><path d="M12 2 L8 10 L16 10 Z" fill="rgba(0,0,0,0.4)" stroke="rgba(0,0,0,0.6)" stroke-width="1" stroke-linejoin="round"/><path d="M12 2 L8 10 L16 10 Z" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round"/></svg></div></div>`;
    }).join('');
  };

  const getIncludedPhotosLead = (item) => {
    const fromArray = (item.photographs || []).filter((p) => p.includeInReport !== false && (p.data || '').trim());
    if (fromArray.length > 0) {
      return fromArray.map((p) => ({ src: (p.data || '').trim(), arrows: getPhotoArrowsForPdfLead(p) }));
    }
    const legacy = (item.photograph || '').trim();
    if (legacy) return [{ src: legacy, arrows: getPhotoArrowsForPdfLead({ arrow: item.arrow }) }];
    return [{ src: null, arrows: [] }];
  };

  const getSamplePhotoCellHtmlLead = (photoData) => {
    let src = photoData.src || '';
    if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && src.startsWith('/')) {
      src = frontendUrl + src;
    }
    if (src) {
      const safe = String(src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const arrowsHtml = buildArrowOverlaysHtmlLead(photoData.arrows);
      return `<div class="sample-photo-cell-inner sample-photo-cell-inner-with-arrows"><img class="sample-photo" src="${safe}" alt="" />${arrowsHtml}</div>`;
    }
    return '<div class="sample-photo-cell-inner"><div class="sample-no-photo">No photograph available</div></div>';
  };

  const flowTableBlocks = [];
  assessmentItems.forEach((item, idx) => {
    getIncludedPhotosLead(item).forEach((photoData) => flowTableBlocks.push({ item, idx, photoData }));
  });

  const getCommentsLead = (item) => {
    const rec = (item.recommendationActions || '').trim();
    if (rec) return rec;
    const kind = getLeadPdfMaterialKind(item);
    const isPositive = isPositiveLeadRegisterItem(item, kind);
    return isPositive ? 'No comments' : 'No action required';
  };

  const isPositiveLeadRegisterItem = (item, kind) => {
    if (kind === 'soil') {
      const soilSt = getSoilExceedanceForLeadExec(item.leadContent, item.paintColour);
      return soilSt?.exceeds === true;
    }
    if (kind === 'paint') {
      const paintSt = getLeadPaintStatusForLeadExec(item.leadContent);
      return paintSt?.isLeadPaint === true;
    }
    const dustSt = getDustExceedanceForLeadExec(item.locationRating, item.leadContent, item.leadSampleArea);
    const statusText = String(item.status || '').toLowerCase();
    const isStatusNoExceed = statusText.includes('no exceed');
    const isStatusExceedance =
      !isStatusNoExceed && (statusText.includes('exceedance') || statusText.includes('exceedence'));
    const exceeds = dustSt?.exceeds === true || isStatusExceedance;
    return exceeds;
  };

  const buildLeadBlockHtml = (block, blockIndex, continuationTableHeaderHtml, itemNumberDisplay) => {
    const { item, idx, photoData } = block;
    const n = idx + 1;
    const mat = (item.materialType || '').trim();
    const matNorm = mat.toLowerCase();
    const capType = mat ? mat.charAt(0).toUpperCase() + mat.slice(1).toLowerCase() : 'Unknown';
    const kind = getLeadPdfMaterialKind(item);
    const riskOrExceedance = (() => {
      if (kind === 'soil') {
        const soilSt = getSoilExceedanceForLeadExec(item.leadContent, item.paintColour);
        const value = soilSt?.exceeds === true ? 'Yes' : (soilSt?.exceeds === false ? '-' : '—');
        const className = soilSt?.exceeds === true ? 'risk-exceedance' : (soilSt?.exceeds === false ? 'risk-ok' : '');
        return { label: 'Exceedance?', value, className };
      }
      if (kind === 'paint') {
        const paintSt = getLeadPaintStatusForLeadExec(item.leadContent);
        const rawRisk = getItemRiskLabelForLeadExec(item);
        const isLeadPaint = paintSt?.isLeadPaint === true;
        const isLeadFree = paintSt && paintSt.isLeadPaint === false;
        if (isLeadPaint) {
          const v = riskDisplayForLeadExec(rawRisk);
          return { label: 'Risk rating', value: sentenceCaseRisk(v), className: getRiskClassForLeadExec(rawRisk) };
        }
        if (isLeadFree) return { label: 'Risk rating', value: '-', className: '' };
        return { label: 'Risk rating', value: '—', className: '' };
      }
      const dustSt = getDustExceedanceForLeadExec(item.locationRating, item.leadContent, item.leadSampleArea);
      const statusText = String(item.status || '').toLowerCase();
      const isStatusNoExceed = statusText.includes('no exceed');
      const isStatusExceedance =
        !isStatusNoExceed && (statusText.includes('exceedance') || statusText.includes('exceedence'));
      const exceeds = dustSt?.exceeds === true || isStatusExceedance;
      const noExceed = dustSt?.exceeds === false || isStatusNoExceed;
      const rawRisk = getItemRiskLabelForLeadExec(item);
      const riskBand = riskDisplayForLeadExec(rawRisk);
      if (exceeds) {
        const display = riskBand === '—' ? 'Exceedance' : sentenceCaseRisk(riskBand);
        const className = getRiskClassForLeadExec(riskBand === '—' ? 'EXCEEDANCE' : rawRisk) || 'risk-exceedance';
        return { label: 'Risk rating', value: display, className };
      }
      if (noExceed || dustSt != null) return { label: 'Risk rating', value: '-', className: '' };
      return { label: 'Risk rating', value: sentenceCaseRisk(riskBand), className: getRiskClassForLeadExec(rawRisk) };
    })();
    const leadValueMeta = (() => {
      if (kind === 'soil') {
        const soilSt = getSoilExceedanceForLeadExec(item.leadContent, item.paintColour);
        return {
          label: 'Lead concentration',
          value: formatLeadResultForSampleRegister(item, 'mg/kg'),
        className: soilSt?.exceeds === true ? 'lead-value-positive' : (soilSt?.exceeds === false ? 'lead-value-negative' : ''),
        };
      }
      if (kind === 'dust') {
        const dustSt = getDustExceedanceForLeadExec(item.locationRating, item.leadContent, item.leadSampleArea);
        const statusText = String(item.status || '').toLowerCase();
        const isStatusNoExceed = statusText.includes('no exceed');
        const isStatusExceedance =
          !isStatusNoExceed && (statusText.includes('exceedance') || statusText.includes('exceedence'));
        const exceeds = dustSt?.exceeds === true || isStatusExceedance;
        const noExceed = dustSt?.exceeds === false || isStatusNoExceed;
        return {
          label: 'Lead concentration',
          value: formatLeadResultForSampleRegister(item, 'mg/cm2'),
          className: exceeds ? 'lead-value-positive' : ((noExceed || dustSt != null) ? 'lead-value-negative' : ''),
        };
      }
      const paintSt = getLeadPaintStatusForLeadExec(item.leadContent);
      const isLeadPaint = paintSt?.isLeadPaint === true;
      const isLeadFree = paintSt && paintSt.isLeadPaint === false;
      return {
        label: 'Lead content',
        value: formatLeadResultForSampleRegister(item, matNorm === 'paint-xrf' ? 'mg/cm2' : '%'),
        className: isLeadPaint ? 'lead-value-positive' : (isLeadFree ? 'lead-value-negative' : ''),
      };
    })();
    const sampleTable = buildLeadSampleRegisterTableHtml({
      photoCellInnerHtml: getSamplePhotoCellHtmlLead(photoData),
      itemNumber: itemNumberDisplay,
      sampleReferenceHtml: escapeHtml((item.sampleReference || `Sample ${n}`).trim() || `Sample ${n}`),
      locationHtml: getLocationContentLead(item),
      sampleTypeHtml: escapeHtml(capType),
      materialKind: kind,
      paintColourHtml: escapeHtml(kind === 'paint' ? (item.paintColour || '—') : ''),
      sampleAreaDustHtml: escapeHtml(kind === 'dust' ? formatLeadSampleAreaForPdf(item.leadSampleArea) : ''),
      assessmentCriteriaHtml: escapeHtml(kind === 'soil' ? (item.paintColour || '—') : ''),
      leadValueLabelHtml: escapeHtml(leadValueMeta.label),
      leadResultHtml: escapeHtml(leadValueMeta.value),
      leadResultClassName: leadValueMeta.className,
      riskOrExceedanceLabelHtml: escapeHtml(riskOrExceedance.label),
      riskOrExceedanceValueHtml: escapeHtml(riskOrExceedance.value),
      riskOrExceedanceClassName: riskOrExceedance.className,
      commentsHtml: escapeHtml(getCommentsLead(item)),
    });
    const continuationHeader = continuationTableHeaderHtml
      ? `<div class="page-break"></div>${continuationTableHeaderHtml}`
      : '';
    return `${continuationHeader}<div class="sample-block">${sampleTable}</div>`;
  };
  const findingsLeadPaintHtml = ss.assessmentFindingsLeadPaintContent ? await nlToBr(ss.assessmentFindingsLeadPaintContent) : '';
  const findingsLeadDustHtml = ss.assessmentFindingsLeadDustContent ? await nlToBr(ss.assessmentFindingsLeadDustContent) : '';
  const findingsLeadSoilHtml = ss.assessmentFindingsLeadSoilContent ? await nlToBr(ss.assessmentFindingsLeadSoilContent) : '';

  const paintBlocks = flowTableBlocks.filter(({ item }) => getLeadPdfMaterialKind(item) === 'paint');
  const dustBlocks = flowTableBlocks.filter(({ item }) => getLeadPdfMaterialKind(item) === 'dust');
  const soilBlocks = flowTableBlocks.filter(({ item }) => getLeadPdfMaterialKind(item) === 'soil');

  const sampleSectionDefs = [
    { key: 'paint', label: 'Lead Paint', blocks: paintBlocks, findingsHtml: findingsLeadPaintHtml },
    { key: 'dust', label: 'Lead Dust', blocks: dustBlocks, findingsHtml: findingsLeadDustHtml },
    { key: 'soil', label: 'Lead in Soil', blocks: soilBlocks, findingsHtml: findingsLeadSoilHtml },
  ].filter((s) => s.blocks.length > 0);

  const renderSampleBlocksForSection = (sectionDef, tableNumber) => {
    const numberPrefixByKey = { paint: 'LP', dust: 'LD', soil: 'LS' };
    const prefix = numberPrefixByKey[sectionDef.key] || '';
    let positiveCounter = 0;
    return sectionDef.blocks.map((block, blockIndex) => {
      const kind = getLeadPdfMaterialKind(block.item);
      const isPositive = isPositiveLeadRegisterItem(block.item, kind);
      const itemNumberDisplay = isPositive ? `${prefix}${++positiveCounter}` : '-';
      const continuationHeaderHtml = blockIndex >= 2 && blockIndex % 2 === 0
        ? `<div class="scope-table-caption lead-sample-register-caption"><span class="caption-prefix">Table ${tableNumber}:</span> Sample register - ${escapeHtml(sectionDef.label)} cont.</div>`
        : '';
      return buildLeadBlockHtml(block, blockIndex, continuationHeaderHtml, itemNumberDisplay);
    }).join('');
  };

  const sampleSectionsLeadHtml = sampleSectionDefs.length === 0
    ? '<div class="section-body">No items</div>'
    : sampleSectionDefs.map((sectionDef, sectionIndex) => {
      const tableNumber = sampleRegisterTableStartNumber + sectionIndex;
      return `
    <div class="page-break"></div>
    <div class="section-header">ASSESSMENT FINDINGS - ${escapeHtml(sectionDef.label)}</div>
    ${sectionDef.findingsHtml ? `<div class="section-body">${sectionDef.findingsHtml}</div>` : ''}
    <div class="scope-table-caption lead-sample-register-caption"><span class="caption-prefix">Table ${tableNumber}:</span> Sample register - ${escapeHtml(sectionDef.label)}</div>
    ${renderSampleBlocksForSection(sectionDef, tableNumber)}
  `;
    }).join('');
  const leadAssessmentPlanEntries = Array.isArray(assessmentData.leadAssessmentPlanAppendices)
    ? assessmentData.leadAssessmentPlanAppendices
        .filter((p) => p && typeof p.sitePlanFile === 'string' && p.sitePlanFile.trim())
    : [];
  const leadAssessmentPlansHtml = leadAssessmentPlanEntries.length > 0
    ? `
      <div class="lead-assessment-plans-wrap">
        ${leadAssessmentPlanEntries.map((plan, idx) => {
          let src = String(plan.sitePlanFile || '').trim();
          if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && src.startsWith('/')) {
            src = frontendUrl + src;
          }
          const safeSrc = src.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const figNum = idx + 1;
          const figTitle = (plan.sitePlanFigureTitle && plan.sitePlanFigureTitle.trim())
            ? escapeHtml(plan.sitePlanFigureTitle.trim())
            : 'Plan Illustrating Extent of Assessment';
          return `
            <div class="lead-assessment-plan-block">
              <div class="lead-assessment-plan-image-wrap">
                <img class="lead-assessment-plan-image" src="${safeSrc}" alt="Assessment plan ${figNum}" />
              </div>
              <div class="lead-assessment-plan-caption">
                <strong>Figure ${figNum}:</strong> ${figTitle}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';
  const criteriaLeadPaintHtml = ss.assessmentCriteriaLeadPaintContent ? await nlToBr(ss.assessmentCriteriaLeadPaintContent) : '';
  const criteriaLeadDustHtml = ss.assessmentCriteriaLeadDustContent ? await nlToBr(ss.assessmentCriteriaLeadDustContent) : '';
  const criteriaLeadSoilHtml = ss.assessmentCriteriaLeadSoilContent ? await nlToBr(ss.assessmentCriteriaLeadSoilContent) : '';
  const methodologyLeadPaintHtml = ss.assessmentMethodologyLeadPaintContent ? await nlToBr(ss.assessmentMethodologyLeadPaintContent) : '';
  const methodologyLeadDustHtml = ss.assessmentMethodologyLeadDustContent ? await nlToBr(ss.assessmentMethodologyLeadDustContent) : '';
  const methodologyLeadSoilHtml = ss.assessmentMethodologyLeadSoilContent ? await nlToBr(ss.assessmentMethodologyLeadSoilContent) : '';
  const riskAssessmentLeadPaintHtml = ss.riskAssessmentLeadPaintContent ? await nlToBr(ss.riskAssessmentLeadPaintContent) : '';
  const riskAssessmentLeadDustHtml = ss.riskAssessmentLeadDustContent ? await nlToBr(ss.riskAssessmentLeadDustContent) : '';
  const riskAssessmentLeadSoilHtml = ss.riskAssessmentLeadSoilContent ? await nlToBr(ss.riskAssessmentLeadSoilContent) : '';
  const statementOfLimitationsHtml = ss.statementOfLimitationsContent ? await nlToBr(ss.statementOfLimitationsContent) : '';
  const countToWords = (n) => {
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
    if (Number.isInteger(n) && n >= 0 && n < words.length) return words[n];
    return String(n);
  };
  const formatCountDisplay = (n) => `${countToWords(n)} (${n})`;
  const getLeadDiscussionStatus = (item, kind) => {
    if (kind === 'paint') {
      const paintSt = getLeadPaintStatusForLeadExec(item.leadContent);
      if (!paintSt) return null;
      return paintSt.isLeadPaint === true ? 'positive' : 'negative';
    }
    if (kind === 'soil') {
      const soilSt = getSoilExceedanceForLeadExec(item.leadContent, item.paintColour);
      if (!soilSt) return null;
      return soilSt.exceeds === true ? 'positive' : 'negative';
    }
    const dustSt = getDustExceedanceForLeadExec(item.locationRating, item.leadContent, item.leadSampleArea);
    const statusText = String(item.status || '').toLowerCase();
    const isStatusNoExceed = statusText.includes('no exceed');
    const isStatusExceedance =
      !isStatusNoExceed && (statusText.includes('exceedance') || statusText.includes('exceedence'));
    const exceeds = dustSt?.exceeds === true || isStatusExceedance;
    const noExceed = dustSt?.exceeds === false || isStatusNoExceed;
    if (exceeds) return 'positive';
    if (noExceed || dustSt != null) return 'negative';
    return null;
  };
  const buildLeadDiscussionSummaryHtml = (kind, customHtml) => {
    const rows = assessmentItems.filter((item) => getLeadPdfMaterialKind(item) === kind);
    const statuses = rows.map((item) => getLeadDiscussionStatus(item, kind)).filter(Boolean);
    const positiveCount = statuses.filter((s) => s === 'positive').length;
    const negativeCount = statuses.filter((s) => s === 'negative').length;
    const siteEscaped = escapeHtml(assessmentSiteAddress);
    const paragraphs = [];
    if (positiveCount > 0) {
      const countText = formatCountDisplay(positiveCount);
      if (kind === 'paint') {
        paragraphs.push(`<div class="paragraph">${countText} lead paint ${positiveCount === 1 ? 'item was' : 'items were'} identified during the assessment of ${siteEscaped}.</div>`);
      } else if (kind === 'dust') {
        paragraphs.push(`<div class="paragraph">${countText} lead dust ${positiveCount === 1 ? 'item was' : 'items were'} identified during the assessment of ${siteEscaped}.</div>`);
      } else {
        paragraphs.push(`<div class="paragraph">${countText} lead in soil ${positiveCount === 1 ? 'item was' : 'items were'} identified during the assessment of ${siteEscaped}.</div>`);
      }
    }
    if (customHtml) {
      paragraphs.push(`<div class="section-body discussion-conclusions-content" style="text-align: justify !important; width: 100%;">${customHtml}</div>`);
    }
    if (negativeCount > 0) {
      if (kind === 'paint') {
        paragraphs.push('<div class="paragraph">All other assessed lead paints were assessed to be lead-free.</div>');
      } else if (kind === 'dust') {
        paragraphs.push('<div class="paragraph">All other assessed lead dust samples were assessed to have no exceedance.</div>');
      } else {
        paragraphs.push('<div class="paragraph">All other assessed lead in soil samples were assessed to have no exceedance.</div>');
      }
    }
    if (paragraphs.length === 0) return '';
    return paragraphs.join('');
  };
  const discussionTemplateHtml = ss.discussionContent
    ? await nlToBr(ss.discussionContent)
    : '';
  const leadDiscussionByType = (assessmentData.leadDiscussionConclusionsByType && typeof assessmentData.leadDiscussionConclusionsByType === 'object')
    ? assessmentData.leadDiscussionConclusionsByType
    : {};
  const discussionTypeCustomPaintHtml = leadDiscussionByType.paint ? await nlToBr(leadDiscussionByType.paint) : '';
  const discussionTypeCustomDustHtml = leadDiscussionByType.dust ? await nlToBr(leadDiscussionByType.dust) : '';
  const discussionTypeCustomSoilHtml = leadDiscussionByType.soil ? await nlToBr(leadDiscussionByType.soil) : '';
  const discussionJobHtml = toJustifiedParagraphsHtml((assessmentData.discussionConclusions || '').trim());
  const inspectionExclusionsHtml = toJustifiedParagraphsHtml((assessmentData.jobSpecificExclusions || '').trim());

  const signOffHtml = ss.signOffContent ? await replacePlaceholders(ss.signOffContent, leadTemplateData) : '';
  const signatureHtml = ss.signaturePlaceholder ? await replacePlaceholders(ss.signaturePlaceholder, leadTemplateData) : '';
  const defaultLeadSignOffHtml = await replacePlaceholders(
    'Please do not hesitate to contact the undersigned should you have any queries regarding this report.\nFor and on behalf of Lancaster and Dickenson Consulting.\n[SIGNATURE_IMAGE]\n[CONSULTANT_NAME]\nLancaster & Dickenson Consulting',
    leadTemplateData,
  );
  const mergedSignOffHtml = `${signOffHtml || ''}${signatureHtml || ''}`.trim();
  const finalSignOffHtml = mergedSignOffHtml || defaultLeadSignOffHtml;
  const backgroundHtml = ss.backgroundContent ? await nlToBr(ss.backgroundContent) : '';
  const regulatoryGuidanceHtml = ss.regulatoryGuidanceContent ? await nlToBr(ss.regulatoryGuidanceContent) : '';
  const discussionSummaryBlocks = [
    hasLeadPaintType ? { label: 'Lead Paint', html: buildLeadDiscussionSummaryHtml('paint', discussionTypeCustomPaintHtml) } : null,
    hasLeadDustType ? { label: 'Lead Dust', html: buildLeadDiscussionSummaryHtml('dust', discussionTypeCustomDustHtml) } : null,
    hasLeadSoilType ? { label: 'Lead in Soil', html: buildLeadDiscussionSummaryHtml('soil', discussionTypeCustomSoilHtml) } : null,
  ].filter((b) => b && b.html);
  const discussionTypeSummariesHtml = discussionSummaryBlocks
    .map((b) => `${showLeadTypeSubheaders ? `<div class="section-subheader">${b.label}</div>` : ''}<div class="section-body">${b.html}</div>`)
    .join('');
  let leadCriteriaTableNumber = sampleRegisterTableStartNumber + sampleSectionDefs.length;
  let leadCriteriaFigureNumber = 1;
  const renderLeadCriteriaCaption = (title) => buildTableCaptionHtml(leadCriteriaTableNumber++, title);
  const renderLeadFigureCaption = (title) =>
    `<div class="scope-table-caption"><span class="caption-prefix">Figure ${leadCriteriaFigureNumber++}:</span> ${escapeHtml(title)}</div>`;
  const leadDustActionLevelAppendixHtml = (hasLeadDustType && criteriaLeadDustHtml)
    ? `<div class="lead-criteria-table-block">${renderLeadCriteriaCaption('Lead-dust Action Level Criteria')}
<table class="lead-dust-criteria-table">
  <colgroup><col style="width:20%" /><col style="width:60%" /><col style="width:20%" /></colgroup>
  <thead>
    <tr>
      <th>Criteria</th>
      <th>Surfaces</th>
      <th>Lead-dust Action Level</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="first-col">Criteria 1</td>
      <td>High contact surface (desk/door/window/playground equipment)</td>
      <td>&ge; 0.11 mg/m2</td>
    </tr>
    <tr>
      <td class="first-col">Criteria 2</td>
      <td>Low contact surface (e.g. floor/wall/soil)</td>
      <td>&ge; 0.43 mg/m2</td>
    </tr>
    <tr>
      <td class="first-col">Criteria 3</td>
      <td>High-level/inaccessible surface (e.g. ceiling/top of cupboard)</td>
      <td>&ge; 1.08 mg/m2</td>
    </tr>
  </tbody>
</table>
<div class="paragraph">Where action level criteria are exceeded, remedial actions are required to remedy the issue.</div></div>`
    : '';
  const riskAssessmentLeadPaintTablesHtml = (hasLeadPaintType && riskAssessmentLeadPaintHtml)
    ? `<div class="lead-criteria-table-block">${renderLeadFigureCaption('Lead Paint Risk Rating Calculation')}
<div class="lead-risk-calculation-figure">
  <div class="lead-risk-calculation-formula">RISK RATING = OCCUPANT TYPE x MATERIAL LOCATION x ROOM USE x MATERIAL CONDITION</div>
</div></div>
<div class="lead-criteria-table-block">${renderLeadCriteriaCaption('Occupant Type')}
<table class="lead-risk-criteria-table">
  <colgroup><col style="width:66%" /><col style="width:34%" /></colgroup>
  <tbody>
    <tr><td class="first-col">Adult</td><td>1</td></tr>
    <tr><td class="first-col">Adolescent (high school)</td><td>2</td></tr>
    <tr><td class="first-col">Child (preschool &amp; primary)</td><td>3</td></tr>
  </tbody>
</table></div>
<div class="lead-criteria-table-block">${renderLeadCriteriaCaption('Material Location')}
<table class="lead-risk-criteria-table">
  <colgroup><col style="width:66%" /><col style="width:34%" /></colgroup>
  <tbody>
    <tr><td class="first-col">High-level/inaccessible surface (e.g. ceiling/top of cupboard)</td><td>1</td></tr>
    <tr><td class="first-col">Low contact surface (e.g. floor/wall/soil)</td><td>2</td></tr>
    <tr><td class="first-col">High contact surface (desk/door/window/playground equipment)</td><td>3</td></tr>
  </tbody>
</table></div>
<div class="lead-criteria-table-block">${renderLeadCriteriaCaption('Room Use')}
<table class="lead-risk-criteria-table">
  <colgroup><col style="width:66%" /><col style="width:34%" /></colgroup>
  <tbody>
    <tr><td class="first-col">Occasional use (e.g. cleaners&rsquo; cupboard)</td><td>1</td></tr>
    <tr><td class="first-col">Daily, infrequent use (e.g. bathrooms)</td><td>2</td></tr>
    <tr><td class="first-col">Daily, heavy use (e.g. office, classroom)</td><td>3</td></tr>
  </tbody>
</table></div>
<div class="lead-criteria-table-block">${renderLeadCriteriaCaption('Material Condition')}
<table class="lead-risk-criteria-table">
  <colgroup><col style="width:66%" /><col style="width:34%" /></colgroup>
  <tbody>
    <tr><td class="first-col">Good/stable condition</td><td>1</td></tr>
    <tr><td class="first-col">Minor flaking</td><td>2</td></tr>
    <tr><td class="first-col">Severe flaking/ loose flakes</td><td>3</td></tr>
    <tr><td class="first-col">Lead dust</td><td>4</td></tr>
  </tbody>
</table></div>
<div class="lead-criteria-table-block">${renderLeadCriteriaCaption('Risk Matrix')}
<table class="lead-risk-criteria-table">
  <colgroup><col style="width:66%" /><col style="width:34%" /></colgroup>
  <tbody>
    <tr><td class="first-col">VERY LOW RISK (VL)</td><td class="second-col">&lt;7</td></tr>
    <tr><td class="first-col">LOW RISK (L)</td><td class="second-col">7-18</td></tr>
    <tr><td class="first-col">MEDIUM RISK (M)</td><td class="second-col">19-35</td></tr>
    <tr><td class="first-col">HIGH RISK (H)</td><td class="second-col">36+</td></tr>
  </tbody>
</table></div>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Lead Assessment Report (Flow)</title>
    <style>
      @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
      @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
      @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }
      @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }

      * { hyphens: none !important; -webkit-hyphens: none !important; -ms-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
      body { font-family: "Gothic", Arial, sans-serif; color: #222; margin: 0; }

      @page {
        size: A4;
        margin: 35mm 15mm 24mm 15mm;
        @top-left { content: element(pageHeader); }
        @bottom-left {
          content: element(pageFooter);
          vertical-align: bottom;
        }
      }

      #pageHeader { position: running(pageHeader); }
      #pageFooter { position: running(pageFooter); }

      .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0; margin: 0; }
      .logo { width: 243px; height: auto; display: block; margin: 0; }
      .company-details { text-align: right; font-size: 0.75rem; line-height: 1.5; margin-top: 8px; margin: 0; }
      .website { color: #16b12b; font-weight: 500; }
      .green-line { width: 100%; height: 1.5px; background: #16b12b; margin: 8px 0 0 0; border-radius: 0; }

      .footer { width: 100%; margin: 0; text-align: justify; font-size: 0.75rem; color: #222; padding-bottom: 16px; }
      .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
      .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
      .footer-text { flex: 1; }
      .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
      .page-number::after { content: counter(page); }

      .section-header { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin: 10px 0 10px 0; letter-spacing: 0.01em; }
      .section-subheader { font-size: 0.78rem; font-weight: 700; margin: 8px 0 6px 0; }
      .page-break + .section-header { margin-top: 0; }
      .section-body { font-size: 0.8rem; line-height: 1.5; text-align: justify; margin-bottom: 18px; }
      .section-body.discussion-conclusions-content,
      .section-body.discussion-conclusions-content p { word-break: normal !important; overflow-wrap: break-word !important; }
      .section-body.discussion-conclusions-content {
        text-align: justify !important;
        width: 100%;
        margin-top: 0;
        margin-bottom: 6px;
      }
      .section-body.discussion-conclusions-content.discussion-follow-on { margin-top: 8px; }
      .section-body.discussion-conclusions-content.job-specific-exclusions { margin-top: 2px; }
      .section-body.discussion-wrap { margin-bottom: 8px; }
      .section-body.discussion-signoff { margin-top: 0; margin-bottom: 0; line-height: 1.2; }
      .section-body.discussion-signoff img {
        display: block;
        margin: 0 0 1px 0;
        padding: 0;
      }
      .section-body.discussion-signoff br { display: block; line-height: 1.1; margin: 0; }
      .section-body.discussion-signoff p,
      .section-body.discussion-signoff .paragraph { margin: 0 0 1px 0; line-height: 1.2; }
      .section-body.discussion-signoff p:last-child,
      .section-body.discussion-signoff .paragraph:last-child { margin-bottom: 0; }
      .section-body br { line-height: 1.5; display: block; margin-bottom: 0.25em; }
      .section-body .paragraph { margin-bottom: 8px; }
      .section-body .bullet-list { margin: 0 0 8px 0; padding: 0 0 0 24px; list-style: none; font-size: 0.8rem; color: #222; }
      .section-body .bullet-list li { margin-bottom: 8px; position: relative; padding-left: 20px; line-height: 1.5; text-align: left; }
      .section-body .bullet-list li::before { content: "•"; position: absolute; left: 0; top: 0.25em; font-size: 1em; color: #222; line-height: 1; }
      .section-body .bullet-list li:last-child { margin-bottom: 0; }
      .sample-register-header { font-size: 0.8rem; font-weight: 700; margin: 14px 0 10px 0; }
      .sample-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 30px; }

      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
      th { background: #f5f5f5; font-weight: 700; text-align: left; }
      .sample-label { font-weight: 700; background: #f5f5f5; }
      .sample-asbestos-content-cell { font-weight: 700; }
      .comments-cell-inner { min-height: 2.7rem; display: block; }
      .sample-risk-cell { line-height: 1; height: 1.2em; padding: 4px 4px; vertical-align: top; }
      .sample-location-content { height: 60px; vertical-align: top; padding: 8px; background: #fafafa; border: 1.5px solid #888; font-size: 0.64rem; line-height: 1.4; }
      .lead-sample-table { table-layout: fixed; }
      /* Lead sample photos: same layout model as asbestos PDFs (fixed box + overflow hidden + object-fit; cell borders from table th,td only) */
      .lead-sample-table td.sample-photo-cell {
        width: 71% !important;
        height: 285px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        text-align: center;
        vertical-align: middle;
        background: #fff;
        padding: 0 !important;
        margin: 0 !important;
      }
      .lead-sample-table .sample-photo-cell-inner {
        display: block;
        position: relative;
        width: 100%;
        height: 285px;
        overflow: hidden;
        box-sizing: border-box;
        padding: 0;
        margin: 0;
      }
      .lead-sample-table .pdf-arrow-overlay { position: absolute; width: 36px; height: 36px; pointer-events: none; z-index: 2; }
      .lead-sample-table .pdf-arrow-rotated { width: 36px; height: 36px; }
      .lead-sample-table .sample-photo-cell-inner .sample-photo {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        object-position: center !important;
        padding: 0 !important;
      }
      .lead-sample-table .sample-photo {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        padding: 0;
      }
      .lead-sample-table .sample-no-photo {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 285px;
        height: 100%;
        color: #666;
        font-style: italic;
        font-size: 0.64rem;
      }

      .page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }
      .exec-summary-wrap { margin-bottom: 18px; }
      .exec-summary-wrap > .scope-table-caption:first-of-type { margin-top: 0; }
      .exec-summary-wrap .exec-summary-table { margin-bottom: 16px; table-layout: fixed; width: 100%; }
      .exec-summary-wrap .exec-summary-table thead tr:first-child th { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; }
      .exec-summary-table-4col .exec-4c-1 { width: 20%; }
      .exec-summary-table-4col .exec-4c-2 { width: 50%; }
      .exec-summary-table-4col .exec-4c-3 { width: 15%; }
      .exec-summary-table-4col .exec-4c-4 { width: 15%; }
      .exec-summary-table-3col .exec-3c-1 { width: 57.5%; }
      .exec-summary-table-3col .exec-3c-2 { width: 17.5%; }
      .exec-summary-table-3col .exec-3c-3 { width: 25%; }
      .exec-summary-wrap .risk-high { background: #ef5350; color: #fff; font-weight: 700; }
      .exec-summary-wrap .risk-medium { background: #fb8c00; color: #fff; font-weight: 700; }
      .exec-summary-wrap .risk-low { background: #ffeb3b; color: #222; font-weight: 700; }
      .exec-summary-wrap .risk-very-low { background: #66bb6a; color: #fff; font-weight: 700; }
      .exec-summary-wrap .risk-exceedance { background: #ef5350; color: #fff; font-weight: 700; }
      .lead-sample-table .lead-value-positive { color: #c62828; font-weight: 700; background: transparent; }
      .lead-sample-table .lead-value-negative { color: #2e7d32; font-weight: 700; background: transparent; }
      .lead-sample-table .risk-high { background: rgba(239, 83, 80, 0.3); color: #222; font-weight: 700; }
      .lead-sample-table .risk-medium { background: rgba(251, 140, 0, 0.3); color: #222; font-weight: 700; }
      .lead-sample-table .risk-low { background: rgba(255, 235, 59, 0.3); color: #222; font-weight: 700; }
      .lead-sample-table .risk-very-low { background: rgba(102, 187, 106, 0.3); color: #222; font-weight: 700; }
      .lead-sample-table .risk-exceedance { background: rgba(239, 83, 80, 0.3); color: #222; font-weight: 700; }
      .lead-sample-table .risk-ok { background: rgba(102, 187, 106, 0.3); color: #222; font-weight: 700; }
      .scope-tables-wrap { margin-bottom: 18px; }
      .scope-table-caption { margin-top: 14px; margin-bottom: 8px; font-size: 0.72rem; font-weight: 400; text-transform: none; letter-spacing: 0; }
      .scope-table-caption .caption-prefix { font-weight: 700; }
      .scope-tables-wrap .scope-table-caption:first-child { margin-top: 0; }
      .section-body + .lead-sample-register-caption { margin-top: 0; }
      .scope-items-list-wrap > .section-subheader:first-of-type { margin-top: 0; }
      .scope-items-list-wrap .bullet-list:last-child { margin-bottom: 0; }
      .scope-modal-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: fixed; }
      .scope-modal-table th { text-transform: none; font-size: 0.58rem; font-weight: 700; }
      .lead-criteria-table-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; }
      .lead-criteria-table-block .scope-table-caption { margin-top: 0; }
      .lead-risk-calculation-figure { border: 1.5px solid #888; padding: 12px 10px; margin: 0 0 2px 0; border-radius: 3px; background: #fff; }
      .lead-risk-calculation-formula { text-align: center; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.01em; }
      .lead-risk-criteria-table { width: 100%; border-collapse: collapse; margin: 10px 0 10px 0; table-layout: fixed; }
      .lead-risk-criteria-table td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
      .lead-risk-criteria-table td.first-col { background: #f5f5f5; font-weight: 700; }
      .lead-risk-criteria-table td.second-col { background: #f5f5f5; font-weight: 700; }
      .lead-dust-criteria-table { width: 100%; border-collapse: collapse; margin: 10px 0 10px 0; table-layout: fixed; }
      .lead-dust-criteria-table th,
      .lead-dust-criteria-table td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
      .lead-dust-criteria-table thead th { background: #f5f5f5; font-weight: 700; text-align: left; }
      .lead-dust-criteria-table tbody td.first-col { background: #f5f5f5; font-weight: 700; }
      .lead-assessment-plans-wrap { margin-top: 14px; }
      .lead-assessment-plan-block { break-inside: avoid; page-break-inside: avoid; margin: 0 0 16px 0; }
      .lead-assessment-plan-image-wrap { display: inline-block; border: 1px solid #999; background: #fff; padding: 0; line-height: 0; }
      .lead-assessment-plan-image { display: block; width: 85%; max-height: 70vh; object-fit: contain; margin: 0 auto; }
      .lead-assessment-plan-caption { margin-top: 8px; text-align: left; font-size: 0.72rem; }
    </style>
  </head>
  <body>
    <div id="pageHeader">
      <div class="header">
        <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="green-line"></div>
    </div>

    <div id="pageFooter">
      <div class="footer">
        <div class="footer-border-line"></div>
        <div class="footer-content">
          <div class="footer-text">${escapeHtml(assessmentFooterText)}</div>
          <div class="page-number"></div>
        </div>
      </div>
    </div>

    ${executiveSummaryBlock.html}
    <div class="page-break"></div>

    <div class="section-header">${escapeHtml(ss.introductionTitle || 'INTRODUCTION')}</div>
    <div class="section-body">${introductionHtml}</div>
    ${scopeTablesBlock.html}
    ${leadAssessmentPlansHtml}
    ${sampleSectionsLeadHtml}

    <div class="page-break"></div>
    <div class="section-header">${escapeHtml(ss.discussionTitle || 'DISCUSSION AND CONCLUSIONS')}</div>
    <div class="section-body discussion-wrap">
      ${discussionTypeSummariesHtml || ''}
      ${discussionTemplateHtml ? `<div>${discussionTemplateHtml}</div>` : ''}
      ${discussionJobHtml ? `<div class="section-body discussion-conclusions-content discussion-follow-on">${discussionJobHtml}</div>` : ''}
      ${inspectionExclusionsHtml ? `<div class="section-body discussion-conclusions-content job-specific-exclusions">${inspectionExclusionsHtml}</div>` : ''}
    </div>

    <div class="section-body discussion-signoff">
      ${finalSignOffHtml || ''}
    </div>

    <div class="page-break"></div>
    ${backgroundHtml ? `<div class="section-header">BACKGROUND</div><div class="section-body">${backgroundHtml}</div>` : ''}
    ${regulatoryGuidanceHtml ? `<div class="section-header">REGULATORY GUIDANCE, REGULATIONS AND CODES OF PRACTICE</div><div class="section-body">${regulatoryGuidanceHtml}</div>` : ''}
    ${(hasLeadPaintType && methodologyLeadPaintHtml) || (hasLeadDustType && methodologyLeadDustHtml) || (hasLeadSoilType && methodologyLeadSoilHtml)
      ? `<div class="section-header">ASSESSMENT METHODOLOGY</div>` : ''}
    ${hasLeadPaintType && methodologyLeadPaintHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead Paint</div>' : ''}<div class="section-body">${methodologyLeadPaintHtml}</div>` : ''}
    ${hasLeadDustType && methodologyLeadDustHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead Dust</div>' : ''}<div class="section-body">${methodologyLeadDustHtml}</div>` : ''}
    ${hasLeadSoilType && methodologyLeadSoilHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead In Soil</div>' : ''}<div class="section-body">${methodologyLeadSoilHtml}</div>` : ''}
    ${(hasLeadPaintType && criteriaLeadPaintHtml) || (hasLeadDustType && criteriaLeadDustHtml) || (hasLeadSoilType && criteriaLeadSoilHtml)
      ? `<div class="section-header">ASSESSMENT CRITERIA</div>` : ''}
    ${hasLeadPaintType && criteriaLeadPaintHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead Paint</div>' : ''}<div class="section-body">${criteriaLeadPaintHtml}</div>` : ''}
    ${hasLeadDustType && criteriaLeadDustHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead Dust</div>' : ''}<div class="section-body">${criteriaLeadDustHtml}${leadDustActionLevelAppendixHtml}</div>` : ''}
    ${hasLeadSoilType && criteriaLeadSoilHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead In Soil</div>' : ''}<div class="section-body">${criteriaLeadSoilHtml}</div>` : ''}
    ${(hasLeadPaintType && riskAssessmentLeadPaintHtml) || (hasLeadDustType && riskAssessmentLeadDustHtml) || (hasLeadSoilType && riskAssessmentLeadSoilHtml)
      ? `<div class="section-header">RISK ASSESSMENT</div>` : ''}
    ${hasLeadPaintType && riskAssessmentLeadPaintHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead Paint</div>' : ''}<div class="section-body">${riskAssessmentLeadPaintHtml}${riskAssessmentLeadPaintTablesHtml}</div>` : ''}
    ${hasLeadDustType && riskAssessmentLeadDustHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead Dust</div>' : ''}<div class="section-body">${riskAssessmentLeadDustHtml}</div>` : ''}
    ${hasLeadSoilType && riskAssessmentLeadSoilHtml ? `${showLeadTypeSubheaders ? '<div class="section-subheader">Lead In Soil</div>' : ''}<div class="section-body">${riskAssessmentLeadSoilHtml}</div>` : ''}
    ${statementOfLimitationsHtml ? `<div class="section-header">STATEMENT OF LIMITATIONS</div><div class="section-body">${statementOfLimitationsHtml}</div>` : ''}
  </body>
</html>`;
};

/**
 * V3 (experimental): Flow-based asbestos assessment body with running header/footer and auto pagination.
 * Keeps existing templates intact by not reusing the fixed-height "page" wrappers.
 */
const generateAssessmentFlowHTMLV3 = async (assessmentData, isResidential = false, isLeadAssessment = false) => {
  if (isLeadAssessment) {
    return generateLeadAssessmentFlowHTMLV3(assessmentData);
  }
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const templateType = isResidential ? 'residentialAsbestosAssessment' : 'asbestosAssessment';
  const templateContent = await getTemplateByType(templateType);
  const resolvedLegislation = await resolveSelectedLegislation(templateContent?.selectedLegislation);
  // Use job's legislation snapshot (at creation time); fall back to resolved template for existing jobs without it
  const selectedLegislation = (assessmentData.legislation && assessmentData.legislation.length > 0)
    ? assessmentData.legislation
    : resolvedLegislation;

  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

  const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  const assessmentFooterText = isResidential ? `Residential Asbestos Assessment Report: ${assessmentSiteAddress}` : `Asbestos Assessment Report: ${assessmentSiteAddress}`;
  const assessmentJurisdiction = assessmentData.state === 'Commonwealth' ? 'ACT' : assessmentData.state;

  // Helpers (reuse existing behavior)
  const assessmentItems = assessmentData.items || [];
  const getCommentsValue = (item) => {
    if (hasNoAsbestosContentFlow(item)) return 'No action required';
    let rec = (item.recommendationActions || '').trim();
    const cond = (item.condition || '').trim();
    const mat = (item.materialType || '').trim();
    if (!rec) return 'No comments';
    if (rec === cond) return 'No comments';
    if (mat && cond && rec === `${mat} ${cond}`) return 'No comments';
    // Deduplicate repeated recommendation text (handles "X\n\nX", "X  X", or "X X")
    let parts = rec.split(/\n\n+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1 && /^(.+)\s\1$/.test(rec.trim())) {
      parts = [rec.replace(/^(.+)\s\1$/, '$1').trim()];
    }
    const seen = new Set();
    const unique = parts.filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; });
    return unique.join('\n\n');
  };
  const isVisuallyAssessed = (ac) => {
    const s = (ac || '').trim();
    return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM' || s === 'Visually Assessed as Asbestos';
  };
  const isNonAsbestos = (ac) => {
    const s = (ac || '').trim();
    return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM';
  };
  const getSampleRefDisplay = (item, fallback) => {
    if (isVisuallyAssessed(item.asbestosContent)) return 'Visually assessed';
    const ref = item.sampleReference || fallback;
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    if (sampled && sampled !== item) return `Refer to sample ${ref}`;
    return ref;
  };
  const getLocationContent = (item) => {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = [];
    if (item.levelFloor && String(item.levelFloor).trim()) parts.push(esc(item.levelFloor));
    if (item.roomArea && String(item.roomArea).trim()) parts.push(esc(item.roomArea));
    parts.push(esc(item.locationDescription || 'Unknown Location'));
    return parts.join('<br/>');
  };
  // Assessment register: only show Chrysotile/Amosite/Crocidolite asbestos OR No Asbestos Detected (hide organic, SMF, etc.)
  // Derive asbestos content from analytical data (fibres array) when available - matches fibre ID report logic
  // For referred items (same sampleReference as another item), use the sampled item's asbestos content
  const findSampledItemForRefFlow = (ref) => {
    const r = String(ref || '').trim();
    if (!r) return null;
    return assessmentItems.find((i) => (i.sampleReference || '').trim() === r) || null;
  };
  const getAsbestosContentRawFlow = (item) => {
    if (item.asbestosContent && String(item.asbestosContent).trim()) return item.asbestosContent;
    const ad = item.analysisData;
    if (!ad) {
      const sampled = findSampledItemForRefFlow(item.sampleReference);
      if (sampled && sampled !== item) return getAsbestosContentRawFlow(sampled);
      return null;
    }
    if (ad.fibres && Array.isArray(ad.fibres)) {
      const asbestosFromFibres = ad.fibres
        .filter((f) => {
          if (!f || !f.result) return false;
          const r = String(f.result).trim();
          if (!r || /^non[- ]?asbestos$/i.test(r)) return false;
          return /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(r) || /^umf$/i.test(r) || /^unidentified\s+mineral\s+fibre$/i.test(r);
        })
        .map((f) => {
          const r = String(f.result).trim();
          if (/^umf$/i.test(r)) return 'Unidentified Mineral Fibre (UMF)';
          return r;
        });
      if (asbestosFromFibres.length > 0) return [...new Set(asbestosFromFibres)].join(', ');
    }
    const hasTrace = ad.traceAsbestos === 'yes' && ad.traceCount && ad.traceAsbestosContent;
    if (hasTrace || (ad.finalResult && (/^no asbestos detected$/i.test(ad.finalResult) || ad.finalResult.includes('Trace')))) {
      return ad.finalResult;
    }
    if (ad.finalResult) return ad.finalResult;
    return null;
  };
  const isAsbestosTypeFlow = (p) => /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(String(p).trim()) || /^umf$/i.test(String(p).trim()) || /^unidentified\s+mineral\s+fibre(\s*\(umf\))?$/i.test(String(p).trim());
  const getSampleRegisterAsbestosDisplayFlow = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return 'No Asbestos Detected';
    if (s === 'Visually Assessed as Asbestos') return 'Visually Assessed as Asbestos';
    if (s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-asbestos' || s === 'Visually Assessed as Non-ACM') return 'Visually Assessed as Non-Asbestos';
    if (/^no asbestos detected$/i.test(s)) return 'No Asbestos Detected';
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    const asbestosTypes = parts.filter(isAsbestosTypeFlow);
    const normaliseFlow = (t) => {
      const lower = t.toLowerCase();
      if (lower.includes('chrysotile')) return 'Chrysotile Asbestos';
      if (lower.includes('amosite')) return 'Amosite Asbestos';
      if (lower.includes('crocidolite')) return 'Crocidolite Asbestos';
      if (lower === 'umf' || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'))) return 'Unidentified Mineral Fibre (UMF)';
      return t;
    };
    const display = asbestosTypes.map(normaliseFlow).filter(Boolean);
    if (display.length > 0) return [...new Set(display)].join(', ');
    if (/trace.*detected/i.test(s)) return s;
    if (/unidentified\s+mineral\s+fibre|^umf(\s|$)/i.test(s)) return /trace/i.test(s) ? s : (/detected/i.test(s) ? 'Unidentified Mineral Fibre (UMF) detected' : 'Unidentified Mineral Fibre (UMF)');
    return 'No Asbestos Detected';
  };
  const getAsbestosContentHtmlFlow = (item) => {
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    const sourceItem = (sampled && sampled !== item) ? sampled : item;
    const raw = getAsbestosContentRawFlow(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || item.asbestosContent || 'Not tested';
    const displayText = getSampleRegisterAsbestosDisplayFlow(raw);
    const isNonAsbestosDisplayFlow = displayText === 'No Asbestos Detected' || displayText === 'Visually Assessed as Non-Asbestos';
    const cls = isNonAsbestosDisplayFlow ? 'asbestos-content-non-asbestos' : 'asbestos-content-asbestos';
    const safe = displayText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="${cls}">${safe}</span>`;
  };
  const hasNoAsbestosContentFlow = (item) => {
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    const sourceItem = (sampled && sampled !== item) ? sampled : item;
    const raw = getAsbestosContentRawFlow(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
    const display = getSampleRegisterAsbestosDisplayFlow(raw);
    return display === 'No Asbestos Detected' || display === 'Visually Assessed as Non-Asbestos';
  };
  const getAsbestosTypeDisplay = (item) => {
    if (hasNoAsbestosContentFlow(item)) return '-';
    const at = (item.asbestosType || '').toLowerCase();
    if (at === 'friable') return 'Friable';
    if (at === 'non-friable') return 'Non-friable';
    return item.asbestosType || '-';
  };
  const getConditionDisplay = (item) => hasNoAsbestosContentFlow(item) ? '-' : (item.condition || 'Unknown');
  const getRiskDisplay = (item) => hasNoAsbestosContentFlow(item) ? '-' : (item.risk || 'Unknown');
  const getItemNumberFlow = (items, idx) => {
    const item = items[idx];
    if (!item) return '-';
    if (hasNoAsbestosContentFlow(item)) return '-';
    const count = items.slice(0, idx + 1).filter((i) => !hasNoAsbestosContentFlow(i)).length;
    return String(count);
  };
  // Arrow overlay for PDF (flow): same helpers as non-flow
  const DEFAULT_ARROW_ROTATION_PDF_FLOW = -45;
  const getArrowTipOffsetPdfFlow = (rotationDeg) => {
    const r = ((rotationDeg ?? DEFAULT_ARROW_ROTATION_PDF_FLOW) * Math.PI) / 180;
    const tipX = (12 + 10 * Math.sin(r)) / 24;
    const tipY = (12 - 10 * Math.cos(r)) / 24;
    return { x: tipX, y: tipY };
  };
  const getPhotoArrowsForPdfFlow = (photo) => {
    if (!photo) return [];
    if (photo.arrows && photo.arrows.length > 0) return photo.arrows;
    const leg = photo.arrow;
    if (leg && typeof leg === 'object' && (leg.x != null || leg.y != null)) return [leg];
    return [];
  };
  const buildArrowOverlaysHtmlFlow = (arrows) => {
    if (!arrows || arrows.length === 0) return '';
    const defaultColor = '#f44336';
    return arrows.map((arr) => {
      const rot = arr.rotation ?? DEFAULT_ARROW_ROTATION_PDF_FLOW;
      const tipOff = getArrowTipOffsetPdfFlow(rot);
      const color = (arr.color || defaultColor).replace(/"/g, '&quot;');
      const leftPct = ((arr.x ?? 0.5) * 100).toFixed(2);
      const topPct = ((arr.y ?? 0.5) * 100).toFixed(2);
      const tx = (-tipOff.x * 100).toFixed(2);
      const ty = (-tipOff.y * 100).toFixed(2);
      return `<div class="pdf-arrow-overlay" style="left:${leftPct}%;top:${topPct}%;transform:translate(${tx}%,${ty}%);"><div class="pdf-arrow-rotated" style="transform:rotate(${rot}deg);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="22" x2="12" y2="10" stroke="rgba(0,0,0,0.5)" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="22" x2="12" y2="10" stroke="${color}" stroke-width="2" stroke-linecap="round"/><path d="M12 2 L8 10 L16 10 Z" fill="rgba(0,0,0,0.4)" stroke="rgba(0,0,0,0.6)" stroke-width="1" stroke-linejoin="round"/><path d="M12 2 L8 10 L16 10 Z" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round"/></svg></div></div>`;
    }).join('');
  };
  // Multiple images per item: one table per photo with identical item info and arrows
  const getIncludedPhotosFlow = (item) => {
    const fromArray = (item.photographs || []).filter(p => p.includeInReport !== false && (p.data || '').trim());
    if (fromArray.length > 0) {
      return fromArray.map(p => ({ src: (p.data || '').trim(), arrows: getPhotoArrowsForPdfFlow(p) }));
    }
    const legacy = (item.photograph || '').trim();
    if (legacy) return [{ src: legacy, arrows: getPhotoArrowsForPdfFlow({ arrow: item.arrow }) }];
    return [{ src: null, arrows: [] }];
  };
  const getSamplePhotoCellHtmlFlow = (photoData) => {
    let src = photoData.src || '';
    if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && src.startsWith('/')) {
      src = frontendUrl + src;
    }
    if (src) {
      const safe = String(src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const arrowsHtml = buildArrowOverlaysHtmlFlow(photoData.arrows);
      return `<div class="sample-photo-cell-inner sample-photo-cell-inner-with-arrows"><img class="sample-photo" src="${safe}" alt="" />${arrowsHtml}</div>`;
    }
    return '<div class="sample-photo-cell-inner"><div class="sample-no-photo">No photograph available</div></div>';
  };

  // Load sample table partial (snippet)
  const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
  const asbestosSampleItemTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosSampleItem.html'), 'utf8');
  const asbestosSampleItemTemplateWithUrl = asbestosSampleItemTemplate.replace(/\[FRONTEND_URL\]/g, frontendUrl);

  const flowTableBlocks = [];
  assessmentItems.forEach((item, idx) => {
    getIncludedPhotosFlow(item).forEach(photoData => flowTableBlocks.push({ item, idx, photoData }));
  });
  const buildBlockHtml = (block, blockIndex, addContinuationHeader) => {
    const { item, idx, photoData } = block;
    const n = idx + 1;
    const sampleTable = asbestosSampleItemTemplateWithUrl
      .replace(/\[PHOTO_CELL\]/g, getSamplePhotoCellHtmlFlow(photoData))
      .replace(/\[ITEM_NUMBER\]/g, getItemNumberFlow(assessmentItems, idx))
      .replace(/\[SAMPLE_REFERENCE\]/g, getSampleRefDisplay(item, `Sample ${n}`))
      .replace(/\[LOCATION_DESCRIPTION\]/g, getLocationContent(item))
      .replace(/\[MATERIAL_TYPE\]/g, item.materialType || 'Unknown Material')
      .replace(/\[ASBESTOS_CONTENT\]/g, getAsbestosContentHtmlFlow(item))
      .replace(/\[ASBESTOS_TYPE\]/g, getAsbestosTypeDisplay(item))
      .replace(/\[CONDITION\]/g, getConditionDisplay(item))
      .replace(/\[RISK\]/g, getRiskDisplay(item))
      .replace(/\[COMMENTS\]/g, getCommentsValue(item));
    const continuationHeader = addContinuationHeader
      ? '<div class="page-break"></div><div class="section-header">Table 1: Assessment Register cont.</div>'
      : '';
    return `${continuationHeader}<div class="sample-block">${sampleTable}</div>`;
  };
  // Residential: all items after a page break. Asbestos: first item beneath SUMMARY (if it fits), rest on following pages.
  const firstTableBlockHtml = !isResidential && flowTableBlocks.length > 0
    ? buildBlockHtml(flowTableBlocks[0], 0, false)
    : '';
  const remainingTableBlocks = isResidential ? flowTableBlocks : flowTableBlocks.slice(1);
  const sampleTablesHtml = remainingTableBlocks.map((block, blockIndex) => {
    const addContinuationHeader = blockIndex >= 2 && blockIndex % 2 === 0;
    return buildBlockHtml(block, isResidential ? blockIndex : blockIndex + 1, addContinuationHeader);
  }).join('');

  // Discussion & Conclusions: asbestos items, then non-asbestos items (build early so flowTemplateData can be used in replacePlaceholders)
  // Use same effective asbestos display logic as sample tables (includes fibres array, referred items)
  const getEffectiveAsbestosDisplayForDiscussionFlow = (item) => {
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    const sourceItem = (sampled && sampled !== item) ? sampled : item;
    const raw = getAsbestosContentRawFlow(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
    return getSampleRegisterAsbestosDisplayFlow(raw);
  };
  const getDiscussionDisplayFlow = (item) => getEffectiveAsbestosDisplayForDiscussionFlow(item);
  const isAsbestosForDiscussionFlow = (display) => display !== 'No Asbestos Detected' && display !== 'Visually Assessed as Non-Asbestos';
  const identifiedAsbestosItems = assessmentItems.filter(item => isAsbestosForDiscussionFlow(getDiscussionDisplayFlow(item)));
  const identifiedNonAsbestosItems = assessmentItems.filter(item => !isAsbestosForDiscussionFlow(getDiscussionDisplayFlow(item)));

  const discussionDisplayContentLabelFlow = (item) => {
    const display = getEffectiveAsbestosDisplayForDiscussionFlow(item);
    if (display === 'No Asbestos Detected') return 'No asbestos detected';
    return display;
  };

  const isUMFOnlyFlow = (item) => {
    const display = getEffectiveAsbestosDisplayForDiscussionFlow(item);
    if (!display || display === 'No Asbestos Detected') return false;
    const lower = String(display).toLowerCase();
    const hasUMF = lower.includes('umf') || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'));
    const hasConfirmedAsbestos = lower.includes('chrysotile') || lower.includes('amosite') || lower.includes('crocidolite');
    return hasUMF && !hasConfirmedAsbestos;
  };

  const formatDiscussionListItemFlow = (item) => {
    const roomArea = escapeHtml(item.roomArea || 'Not specified');
    const loc = escapeHtml(item.locationDescription || 'Unknown Location');
    const visuallyAssessed = isVisuallyAssessed(item.asbestosContent);
    const base = `${roomArea} - ${loc}`;
    const suffix = isUMFOnlyFlow(item) ? ' *' : '';
    return (visuallyAssessed ? `${base} (Visually assessed)` : base) + suffix;
  };
  const hasUMFOnlyItemsFlow = identifiedAsbestosItems.some(isUMFOnlyFlow);
  const umfFootnoteFlow = hasUMFOnlyItemsFlow
    ? '<p style="margin: 8px 0 0 0; font-style: italic; font-size: 0.8rem;"><em>* Item was found to contain Unidentified Mineral Fibre (UMF). Material should be considered to be asbestos unless further analysis can confirm otherwise.</em></p>'
    : '';
  const asbestosItemsSectionFlow = identifiedAsbestosItems.length > 0
    ? `<ul class="bullet-list" style="margin: 0 0 12px 0;">${identifiedAsbestosItems.map(item => `<li>${formatDiscussionListItemFlow(item)}</li>`).join('')}</ul>${umfFootnoteFlow}`
    : '<p style="margin: 0 0 12px 0;">No asbestos items were identified during the assessment.</p>';

  const nonAsbestosItemsSectionFlow = identifiedNonAsbestosItems.length > 0
    ? `<ul class="bullet-list" style="margin: 0 0 12px 0;">${identifiedNonAsbestosItems.map(item => `<li>${formatDiscussionListItemFlow(item)}</li>`).join('')}</ul>`
    : '<p style="margin: 0 0 12px 0;">No non-asbestos items were identified during the assessment.</p>';

  // Data for replacePlaceholders (includes identified asbestos list so {IDENTIFIED_ASBESTOS_ITEMS} resolves correctly)
  const flowTemplateData = { ...assessmentData, identifiedAsbestosItems: asbestosItemsSectionFlow, jurisdiction: assessmentJurisdiction, selectedLegislation };

  const introductionHtml = templateContent?.standardSections?.introductionContent
    ? await replacePlaceholders(templateContent.standardSections.introductionContent, flowTemplateData)
    : 'Introduction content not found';

  // Background section (residential only): before Introduction
  const backgroundContentRawFlow = templateContent?.standardSections?.backgroundContent;
  const backgroundHtml = (isResidential && backgroundContentRawFlow)
    ? String(await replacePlaceholders(backgroundContentRawFlow, flowTemplateData) || '').replace(/\n/g, '<br />')
    : '';

  // Survey findings: use No Asbestos content when no asbestos items; otherwise use main survey findings content
  const hasAsbestosItemsFlow = assessmentItems.some((item) => !hasNoAsbestosContentFlow(item));
  const surveyFindingsSourceFlow = hasAsbestosItemsFlow
    ? (templateContent?.standardSections?.surveyFindingsContent || 'Survey findings content not found')
    : (templateContent?.standardSections?.surveyFindingsContentNoSamples || "No asbestos-containing materials were identified during this assessment.");
  let surveyFindingsHtml = surveyFindingsSourceFlow !== 'Survey findings content not found'
    ? await replacePlaceholders(surveyFindingsSourceFlow, flowTemplateData)
    : surveyFindingsSourceFlow;
  const hasSitePlanFlow = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);
  const hasFibreIdReportFlow = !!assessmentData.fibreAnalysisReport;
  const sitePlanAppendixFlow = hasFibreIdReportFlow ? 'Appendix B' : 'Appendix A';
  if (hasSitePlanFlow) {
    surveyFindingsHtml += `<p style="margin-top: 12px;">A site plan for this assessment is presented in ${escapeHtml(sitePlanAppendixFlow)} of this report.</p>`;
  }

  const asbestosCountFlow = identifiedAsbestosItems.length;
  const hasSampledItemsRequiringAnalysisFlow = assessmentItems.some((i) => (i.sampleReference || '').trim() && !isVisuallyAssessed(i.asbestosContent));
  const firstSampledPerRefFlow = hasSampledItemsRequiringAnalysisFlow
    ? assessmentItems.filter((item, index) => {
        if (!(item.sampleReference || '').trim() || isVisuallyAssessed(item.asbestosContent)) return false;
        const ref = item.sampleReference.trim();
        return index === assessmentItems.findIndex((i) => (i.sampleReference || '').trim() === ref);
      })
    : [];
  const analysisCompleteFlow = assessmentData.status === 'sample-analysis-complete' ||
    !hasSampledItemsRequiringAnalysisFlow ||
    firstSampledPerRefFlow.every((i) => i.analysisData?.isAnalysed === true);
  const asbestosCountDisplayFlow = asbestosCountFlow > 0 ? formatAsbestosCountForPdf(asbestosCountFlow, analysisCompleteFlow) : String(asbestosCountFlow);
  const acmRemovalSentenceFlow = 'ACM should be removed prior to the commencement of works which may damage or disturb the material.';
  const residentialCeilingSubfloorText = 'The assessment of the ceiling void was limited to a visual inspection from the access hatch. A combination of insulation batts and loose-fill insulation was identified within the ceiling void, these materials were visually assessed as synthetic mineral fibres (SMF). No suspect ACM was identified during the assessment of the ceiling void however, it is common for ACM to be present within ceiling voids in the forms of debris and/or packers. It is recommended that persons accessing the ceiling void wear a minimum P2 respirator and coveralls.\n\nNo suspect ACM was identified during the assessment of the subfloor, it is common for ACM to be present within subfloors in the form of debris, packers, and/or formwork. It is recommended that persons accessing the crawl space wear a minimum P2 respirator and coveralls.';
  // Default discussion text (no asbestos count line - that is hard-coded in PDF layout)
  let defaultDiscussionTextFlow = '';
  if (asbestosCountFlow > 0) {
    defaultDiscussionTextFlow = acmRemovalSentenceFlow;
    if (isResidential) defaultDiscussionTextFlow = residentialCeilingSubfloorText + '\n\n' + defaultDiscussionTextFlow;
  } else if (isResidential) {
    defaultDiscussionTextFlow = residentialCeilingSubfloorText;
  }
  // Use saved discussion/conclusions when present; strip asbestos count line for backwards compatibility
  let discussionConclusionsRaw = (assessmentData.discussionConclusions || '').trim() || defaultDiscussionTextFlow;
  const analysisIncompleteReplacementFlow = formatAsbestosCountForPdf(asbestosCountFlow, analysisCompleteFlow);
  discussionConclusionsRaw = discussionConclusionsRaw
    .replace(/\{ANALYSIS INCOMPLETE\}/g, analysisIncompleteReplacementFlow)
    .replace(/\{ANALYSIS_INCOMPLETE\}/g, analysisIncompleteReplacementFlow);
  discussionConclusionsRaw = stripAsbestosCountLineFromDiscussion(discussionConclusionsRaw);
  const discussionConclusionsHtml = toJustifiedParagraphsHtml(discussionConclusionsRaw);

  // Hard-coded first line: asbestos count (always shown, not in discussion text box)
  const asbestosCountLineFlow = asbestosCountFlow === 0
    ? `No asbestos containing materials were identified during the assessment conducted at ${assessmentSiteAddress}.`
    : asbestosCountFlow === 1
      ? `${asbestosCountDisplayFlow} asbestos item was identified during the assessment of ${assessmentSiteAddress}.`
      : `${asbestosCountDisplayFlow} asbestos items were identified during the assessment of ${assessmentSiteAddress}.`;
  const asbestosCountLineHtml = `<p style="margin: 0 0 8px 0; text-align: justify;">${escapeHtml(asbestosCountLineFlow)}</p>`;

  const jobSpecificExclusionsRaw = (assessmentData.jobSpecificExclusions || '').trim();
  const inspectionExclusionsHtml = toJustifiedParagraphsHtml(jobSpecificExclusionsRaw);

  // Recommended Control Measures: only for residential asbestos assessment reports
  const recommendedControlMeasuresContentFlow = isResidential && templateContent?.standardSections?.recommendedControlMeasuresContent
    ? await replacePlaceholders(templateContent.standardSections.recommendedControlMeasuresContent, flowTemplateData)
    : '';
  const recommendedControlMeasuresHtml = isResidential
    ? `<div class="section-header">${escapeHtml(templateContent?.standardSections?.recommendedControlMeasuresTitle || 'RECOMMENDED CONTROL MEASURES')}</div><div class="section-body">${recommendedControlMeasuresContentFlow || ''}</div>`
    : '';

  const additionalSections = [
    ...(isResidential && templateContent?.standardSections?.assessmentMethodologyContent
      ? [{ title: templateContent?.standardSections?.assessmentMethodologyTitle || 'ASSESSMENT METHODOLOGY', content: await replacePlaceholders(templateContent.standardSections.assessmentMethodologyContent, flowTemplateData) }]
      : []),
    { title: templateContent?.standardSections?.riskAssessmentTitle || 'RISK ASSESSMENT', content: templateContent?.standardSections?.riskAssessmentContent ? await replacePlaceholders(templateContent.standardSections.riskAssessmentContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.controlMeasuresTitle || 'DETERMINING SUITABLE CONTROL MEASURES', content: templateContent?.standardSections?.controlMeasuresContent ? await replacePlaceholders(templateContent.standardSections.controlMeasuresContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.remediationRequirementsTitle || 'REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM', content: templateContent?.standardSections?.remediationRequirementsContent ? await replacePlaceholders(templateContent.standardSections.remediationRequirementsContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.legislationTitle || 'LEGISLATION', content: templateContent?.standardSections?.legislationContent ? await replacePlaceholders(templateContent.standardSections.legislationContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.assessmentLimitationsTitle || 'ASSESSMENT LIMITATIONS/CAVEATS', content: templateContent?.standardSections?.assessmentLimitationsContent ? await replacePlaceholders(templateContent.standardSections.assessmentLimitationsContent, flowTemplateData) : '' }
  ];

  const bodySectionsHtml = additionalSections.map((s) => {
    const sectionHtml = `<div class="section-header">${escapeHtml(s.title)}</div><div class="section-body">${s.content || ''}</div>`;
    // Page break after DETERMINING SUITABLE CONTROL MEASURES (index varies: 2 for residential, 1 for non-residential)
    const isControlMeasuresSection = (s.title || '').toUpperCase().includes('DETERMINING SUITABLE') && (s.title || '').toUpperCase().includes('CONTROL MEASURES');
    return isControlMeasuresSection ? `${sectionHtml}<div class="page-break"></div>` : sectionHtml;
  }).join('');

  const discussionSignOffContent = templateContent?.standardSections?.signOffContent
    ? await replacePlaceholders(templateContent.standardSections.signOffContent, flowTemplateData)
    : '';
  const discussionSignatureContent = templateContent?.standardSections?.signaturePlaceholder
    ? await replacePlaceholders(templateContent.standardSections.signaturePlaceholder, flowTemplateData)
    : '';

  // Appendix cover pages are generated as separate PDFs (no page number in footer) and merged after flow + fibre analysis

  // Glossary: last page of flow (before first attachment cover), same header/footer and page number
  let glossaryTableRows = '';
  try {
    const glossaryItems = await CustomDataFieldGroup.getFieldsByType('glossary');
    const sorted = (glossaryItems || []).slice().sort((a, b) => {
      const nameA = (a.name || a.text || '').trim().toLowerCase();
      const nameB = (b.name || b.text || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    glossaryTableRows = sorted.map((item) => {
      const term = (item.name || item.text || '').trim();
      const definition = (item.text || '').trim();
      const termEscaped = escapeHtml(term);
      const definitionEscaped = (definition || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
      return `<tr><td class="glossary-term">${termEscaped}</td><td class="glossary-definition">${definitionEscaped}</td></tr>`;
    }).join('');
  } catch (err) {
    console.warn('[generateAssessmentFlowHTMLV3] Could not load glossary:', err.message);
  }
  const glossarySectionHtml = `
        <div class="section-header">Glossary Of Terms Associated with Asbestos</div>
        <table class="glossary-table">
          <thead>
            <tr>
              <th class="glossary-term">Term</th>
              <th class="glossary-definition">Definition</th>
            </tr>
          </thead>
          <tbody>
            ${glossaryTableRows || '<tr><td colspan="2" class="glossary-definition">No glossary terms have been defined.</td></tr>'}
          </tbody>
        </table>`;

  // Flow HTML with running header/footer
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Asbestos Assessment Report (Flow)</title>
        <style>
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }

          * { hyphens: none !important; -webkit-hyphens: none !important; -ms-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
          body { font-family: "Gothic", Arial, sans-serif; color: #222; margin: 0; }

          /* Running header/footer for automatic pagination */
          @page {
            size: A4;
            /* Increase top margin to ensure body content never overlaps running header */
            margin: 35mm 15mm 24mm 15mm;
            @top-left { content: element(pageHeader); }
            @bottom-left {
              content: element(pageFooter);
              vertical-align: bottom;
            }
          }

          #pageHeader { position: running(pageHeader); }
          #pageFooter { position: running(pageFooter); }

          /* Match VersionControl look, but fit to the @page content box (full width inside margins) */
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0; margin: 0; }
          .logo { width: 243px; height: auto; display: block; margin: 0; }
          .company-details { text-align: right; font-size: 0.75rem; line-height: 1.5; margin-top: 8px; margin: 0; }
          .website { color: #16b12b; font-weight: 500; }
          .green-line { width: 100%; height: 1.5px; background: #16b12b; margin: 8px 0 0 0; border-radius: 0; }

          /* Match VersionControl footer formatting */
          .footer { width: 100%; margin: 0; text-align: justify; font-size: 0.75rem; color: #222; padding-bottom: 16px; }
          .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
          .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
          .footer-text { flex: 1; }
          .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
          .page-number::after { content: counter(page); }

          /* Section spacing – match AsbestosAdditionalSections / AsbestosItem1 */
          .section-header { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin: 10px 0 10px 0; letter-spacing: 0.01em; }
          .page-break + .section-header { margin-top: 0; } /* avoid starting too low at top of a new page */
          .section-body { font-size: 0.8rem; line-height: 1.5; text-align: justify; margin-bottom: 18px; }
          .section-body.discussion-conclusions-content,
          .section-body.discussion-conclusions-content p { word-break: normal !important; overflow-wrap: break-word !important; }
          .section-body.discussion-conclusions-content {
            text-align: justify !important;
            width: 100%;
            margin-top: 0;
            margin-bottom: 6px;
          }
          .section-body.discussion-conclusions-content.discussion-follow-on { margin-top: 8px; }
          .section-body.discussion-conclusions-content.job-specific-exclusions { margin-top: 2px; }
          .section-body.discussion-wrap { margin-bottom: 8px; }
          .section-body.discussion-signoff { margin-top: 0; margin-bottom: 0; line-height: 1.2; }
          .section-body.discussion-signoff img {
            display: block;
            margin: 0 0 1px 0;
            padding: 0;
          }
          .section-body.discussion-signoff br { display: block; line-height: 1.1; margin: 0; }
          .section-body.discussion-signoff p,
          .section-body.discussion-signoff .paragraph { margin: 0 0 1px 0; line-height: 1.2; }
          .section-body.discussion-signoff p:last-child,
          .section-body.discussion-signoff .paragraph:last-child { margin-bottom: 0; }
          .section-body br { line-height: 1.5; display: block; margin-bottom: 0.25em; }
          .section-body .paragraph { margin-bottom: 8px; }
          .section-body .bullet-list { margin: 0 0 8px 0; padding: 0 0 0 24px; list-style: none; font-size: 0.8rem; color: #222; }
          .section-body .bullet-list li { margin-bottom: 8px; position: relative; padding-left: 20px; line-height: 1.5; text-align: left; }
          .section-body .bullet-list li::before { content: "•"; position: absolute; left: 0; top: 0.25em; font-size: 1em; color: #222; line-height: 1; }
          ul { margin: 0 0 8px 0; padding: 0 0 0 24px; }
          li { margin-bottom: 8px; }

          .sample-register-header { font-size: 0.8rem; font-weight: 700; margin: 14px 0 10px 0; }
          .sample-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 30px; }

          /* Reuse the sample table styles from Item1 (lighter weight) */
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
          th { background: #f5f5f5; font-weight: 700; text-align: left; }
          /* Ensure assessment register "field headers" are bold */
          .sample-label { font-weight: 700; background: #f5f5f5; }
          .sample-asbestos-content-cell { font-weight: 700; }
          /* Recommendation Actions/Comments row fixed (3-line minimum height) */
          .comments-cell-inner { min-height: 2.7rem; display: block; }
          .sample-risk-cell { line-height: 1; height: 1.2em; padding: 4px 4px; vertical-align: top; }
          .sample-location-content { height: 60px; vertical-align: top; padding: 8px; background: #fafafa; border: 1.5px solid #888; font-size: 0.64rem; line-height: 1.4; }
          .sample-photo-cell {
            width: 71% !important;
            height: 340px !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            text-align: center;
            vertical-align: middle;
            background: #fff;
            padding: 0 !important;
            margin: 0 !important;
          }
          .sample-photo-cell-inner {
            display: block;
            position: relative;
            width: 100%;
            height: 340px;
            overflow: hidden;
            box-sizing: border-box;
            padding: 0;
            margin: 0;
          }
          .sample-photo-cell-inner .sample-photo {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            object-position: center !important;
            padding: 0 !important;
          }
          .pdf-arrow-overlay { position: absolute; width: 36px; height: 36px; pointer-events: none; z-index: 2; }
          .pdf-arrow-rotated { width: 36px; height: 36px; }
          .sample-photo {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center;
            padding: 0;
          }
          .sample-no-photo { display: flex; align-items: center; justify-content: center; min-height: 340px; height: 100%; color: #666; font-style: italic; font-size: 0.64rem; }
          .asbestos-content-asbestos { color: #c62828; font-weight: 700; }
          .asbestos-content-non-asbestos { color: #2e7d32; font-weight: 700; }

          /* Glossary page: 2-column table (same header/footer as other flow pages) */
          .glossary-table { width: 100%; border-collapse: collapse; font-size: 0.9em; color: #222; margin: 10px 0 0 0; }
          .glossary-table th, .glossary-table td { border: 1.5px solid #888; padding: 8px 12px; text-align: left; vertical-align: top; line-height: 1.5; font-size: 0.8em; }
          .glossary-table th { background: #f5f5f5; font-weight: 700; }
          .glossary-table .glossary-term { width: 28%; font-weight: 600; }
          .glossary-table .glossary-definition { width: 72%; }

          .page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="pageHeader">
          <div class="header">
            <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
            <div class="company-details">
              Lancaster & Dickenson Consulting Pty Ltd<br />
              4/6 Dacre Street<br />
              Mitchell ACT 2911<br />
              <span class="website">www.landd.com.au</span>
            </div>
          </div>
          <div class="green-line"></div>
        </div>

        <div id="pageFooter">
          <div class="footer">
            <div class="footer-border-line"></div>
            <div class="footer-content">
              <div class="footer-text">${escapeHtml(assessmentFooterText)}</div>
              <div class="page-number"></div>
            </div>
          </div>
        </div>

        ${backgroundHtml ? `<div class="section-header">${escapeHtml(templateContent?.standardSections?.backgroundTitle || 'BACKGROUND')}</div><div class="section-body">${backgroundHtml}</div>` : ''}
        <div class="section-header">${escapeHtml(templateContent?.standardSections?.introductionTitle || 'INTRODUCTION')}</div>
        <div class="section-body">${introductionHtml}</div>

        <div class="section-header">${escapeHtml(templateContent?.standardSections?.surveyFindingsTitle || (isResidential ? 'SUMMARY OF IDENTIFIED ACM' : 'ASSESSMENT FINDINGS'))}</div>
        <div class="section-body">${surveyFindingsHtml}</div>

        ${isResidential ? '<div class="page-break"></div>' : ''}
        ${(isResidential || firstTableBlockHtml || flowTableBlocks.length === 0) ? `<div class="section-header">Table 1: Assessment Register</div>` : ''}
        ${firstTableBlockHtml}
        ${!isResidential && remainingTableBlocks.length > 0 ? '<div class="page-break"></div><div class="section-header">Table 1: Assessment Register cont.</div>' : ''}
        ${sampleTablesHtml || (flowTableBlocks.length === 0 ? '<div class="section-body">No items</div>' : '')}

        ${(identifiedAsbestosItems.length > 0 || flowTableBlocks.length % 2 === 1) ? '<div class="page-break"></div>' : ''}
        <div class="section-header">${escapeHtml(templateContent?.standardSections?.discussionTitle || 'DISCUSSION AND CONCLUSIONS')}</div>
        <div class="section-body discussion-wrap">
          ${asbestosCountLineHtml}
          ${identifiedAsbestosItems.length > 0 ? `<p style="margin: 0; padding-bottom: 8px;">The following is a summary of asbestos materials identified during this assessment:</p>
          ${asbestosItemsSectionFlow}` : ''}
          ${discussionConclusionsHtml ? `<div class="section-body discussion-conclusions-content discussion-follow-on">${discussionConclusionsHtml}</div>` : ''}
          ${inspectionExclusionsHtml ? `<div class="section-body discussion-conclusions-content job-specific-exclusions">${inspectionExclusionsHtml}</div>` : ''}
        </div>

        ${recommendedControlMeasuresHtml}

        <div class="section-body discussion-signoff">
          ${discussionSignOffContent || ''}
          ${discussionSignatureContent || ''}
        </div>

        <div class="page-break"></div>
        ${bodySectionsHtml}

        <!-- Glossary of Terms (last page before first attachment cover; same header/footer and page number) -->
        <div class="page-break"></div>
        ${glossarySectionHtml}
      </body>
    </html>
  `;

  return html;
};

const mergePdfBuffers = async (buffers) => {
  const out = await PDFDocument.create();
  for (const b of buffers) {
    const src = await PDFDocument.load(b);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
};

/**
 * Split a PDF buffer into two buffers at a given page index (0-based).
 * @param {Buffer} buffer - Full PDF buffer
 * @param {number} splitAtPage - First page index that goes into the second part
 * @returns {Promise<[Buffer, Buffer|null]>} - [part1 (pages 0..splitAtPage-1), part2 (pages splitAtPage..end) or null if splitAtPage >= totalPages]
 */
const splitPdfBuffer = async (buffer, splitAtPage) => {
  const src = await PDFDocument.load(buffer);
  const indices = src.getPageIndices();
  const n = indices.length;
  if (splitAtPage >= n) return [buffer, null];
  if (splitAtPage <= 0) return [null, buffer];
  const doc1 = await PDFDocument.create();
  const doc2 = await PDFDocument.create();
  const pages1 = await doc1.copyPages(src, indices.slice(0, splitAtPage));
  pages1.forEach((p) => doc1.addPage(p));
  const pages2 = await doc2.copyPages(src, indices.slice(splitAtPage, n));
  pages2.forEach((p) => doc2.addPage(p));
  return [Buffer.from(await doc1.save()), Buffer.from(await doc2.save())];
};

/**
 * V3: Generate single-page Appendix A or B cover HTML (footer with no page number).
 * Uses existing DocRaptor templates so Appendix A and all pages after have no page number.
 * For site plan (type 'B'), appendixLetterOverride can be 'A' or 'B': use 'A' when there is no
 * certificate of analysis (fibre ID report), so site plan becomes Appendix A.
 */
const generateAppendixCoverHTMLV3 = (type, assessmentData, appendixLetterOverride, options = {}) => {
  const footerReportPrefix = options.footerReportPrefix || 'Asbestos Assessment Report';
  const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
  const templatePath = type === 'A' ? path.join(templateDir, 'AppendixACover.html') : path.join(templateDir, 'AppendixBCover.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
  const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
  const siteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  html = html.replace(/\[FRONTEND_URL\]/g, frontendUrl)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
    .replace(/\[SITE_ADDRESS\]/g, siteAddress)
    .replace(/Asbestos Assessment Report:/g, `${footerReportPrefix}:`);
  if (type === 'B' && appendixLetterOverride) {
    html = html.replace(/\[APPENDIX_LETTER\]/g, appendixLetterOverride);
  } else if (type === 'B') {
    html = html.replace(/\[APPENDIX_LETTER\]/g, 'B');
  }
  return html;
};

/**
 * V3: Build a single HTML document for the full assessment report (cover, version, flow, appendices, site plan).
 * Uses named @page (cover, version, main, appendix, appendix-landscape) so one DocRaptor call produces one PDF.
 * Preserves flow-based pagination and running header/footer in the main section; appendix pages have no page number.
 */
async function generateAssessmentSingleHTMLV3(assessmentData, isResidential, isLeadAssessment = false) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const hasFibreIdReport = !!assessmentData.fibreAnalysisReport;
  const hasSitePlan = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);
  const isSitePlanImage = hasSitePlan && (
    assessmentData.sitePlanFile.startsWith('/9j/') ||
    assessmentData.sitePlanFile.startsWith('iVBORw0KGgo') ||
    assessmentData.sitePlanFile.startsWith('data:image/')
  );
  const appendixFooterPrefix = isLeadAssessment ? 'Lead Assessment Report' : 'Asbestos Assessment Report';

  // 1. Cover + version (one string: cover full HTML + page-break + version full HTML)
  const coverVersionHtml = await generateAssessmentCoverVersionHTMLV3(assessmentData, isResidential, isLeadAssessment);
  const coverVersionParts = coverVersionHtml.split(/<div class="page-break"><\/div>/);
  const coverFull = coverVersionParts[0] || '';
  const versionFull = coverVersionParts[1] || '';
  const coverBody = extractBodyContent(coverFull);
  const versionBody = extractBodyContent(versionFull);
  let coverCss = extractStyleContent(coverFull).replace(/@page\s*\{/g, '@page cover {');
  let versionCss = extractStyleContent(versionFull).replace(/@page\s*\{/g, '@page version {');

  // 2. Flow (full document) – use @page main, reset page counter so first body page is 1, match footer to version/appendix
  const flowHtml = await generateAssessmentFlowHTMLV3(assessmentData, isResidential, isLeadAssessment);
  const flowBody = extractBodyContent(flowHtml);
  let flowCss = extractStyleContent(flowHtml).replace(/@page\s*\{/g, '@page main {');
  // Do not shrink @page main bottom margin: the running footer lives in the bottom margin box and is
  // taller than a few mm; a tiny bottom margin makes the body paginate into the footer region.
  flowCss += '\n.main-section-start { counter-reset: page 1; }\n';

  // 3. Appendix A cover (if fibre ID report)
  let appendixACss = '';
  let appendixABody = '';
  if (hasFibreIdReport) {
    const appendixAHtml = generateAppendixCoverHTMLV3('A', assessmentData, undefined, { footerReportPrefix: appendixFooterPrefix });
    appendixABody = extractBodyContent(appendixAHtml);
    appendixACss = extractStyleContent(appendixAHtml).replace(/@page\s*\{/g, '@page appendix {');
  }

  // 4. Appendix cover(s) + landscape plan page(s) — lead can have multiple site / assessment plans
  let appendixBCss = '';
  /** @type {{ coverBody: string, fragment: string, isImage: boolean }[]} */
  const appendixPlanSegments = [];
  let sitePlanCss = '';

  const assessmentFooterTextForPlan = isLeadAssessment
    ? `Lead Assessment Report: ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}`
    : (isResidential
      ? `Residential Asbestos Assessment Report: ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}`
      : `Asbestos Assessment Report: ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}`);

  const isPlanFileImageData = (f) => f && typeof f === 'string' && (
    f.startsWith('/9j/') ||
    f.startsWith('iVBORw0KGgo') ||
    f.startsWith('data:image/')
  );

  const sitePlanLandscapeCssBlock = `
        @page appendix-landscape { size: A4 landscape; margin: 0; }
        .site-plan-page { page: appendix-landscape; height: 100%; display: flex; flex-direction: column; min-height: 0; overflow: hidden; page-break-after: avoid; page-break-inside: avoid; }
        .site-plan-page .header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; font-family: "Gothic", Arial, sans-serif; }
        .site-plan-page .green-line { flex-shrink: 0; width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
        .site-plan-page .content { flex: 1; min-height: 0; overflow: hidden; padding: 5px 48px 10px 48px; display: flex; flex-direction: column; }
        .site-plan-page .footer { flex-shrink: 0; position: relative; left: 0; right: 0; bottom: 0; width: 100%; padding: 0 48px 16px 48px; text-align: justify; font-size: 0.75rem; color: #222; font-family: "Gothic", Arial, sans-serif; }
        .logo { width: 243px; height: auto; display: block; background: #fff; margin: 0; }
        .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; margin-top: 8px; margin: 0; }
        .company-details .website { color: #16b12b; font-weight: 500; }
        .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
        .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
        .footer-text { flex: 1; }
        .site-plan-layout { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: row; justify-content: flex-start; gap: 10px; align-items: flex-start; margin: 0; width: 100%; padding: 0 8px 0 0; }
        .site-plan-container { flex: 1 1 auto; width: auto; max-width: none; min-width: 0; overflow: hidden; display: flex; flex-direction: column; padding: 0; margin: 12px 0 0 0; border: none; background: transparent; border-radius: 0; box-shadow: none; }
        .site-plan-container .site-plan-image-wrapper { flex: 0 0 auto; width: fit-content; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .site-plan-container .site-plan-image { display: block; width: auto; height: auto; max-width: 100%; max-height: 96vh; object-fit: contain; border: 1.5px solid #999; box-sizing: border-box; margin: 0; padding: 0; background: transparent; }
        .site-plan-container .site-plan-figure-caption { flex-shrink: 0; font-size: 14px; font-weight: 400; color: #222; text-align: left; margin-top: 8px; font-family: "Gothic", Arial, sans-serif; }
        .site-plan-legend-container { flex: 0 0 280px; max-width: 280px; min-width: 260px; font-family: "Gothic", Arial, sans-serif; }
      `;

  if (isLeadAssessment) {
    const leadEntries = [];
    for (const p of assessmentData.leadSitePlanAppendices || []) {
      if (p && p.sitePlanFile) leadEntries.push({ kind: 'site', plan: p });
    }

    if (leadEntries.length === 0 && hasSitePlan && assessmentData.sitePlanFile) {
      const sitePlanAppendixLetter = hasFibreIdReport ? 'B' : 'A';
      const appendixBHtml = generateAppendixCoverHTMLV3('B', assessmentData, sitePlanAppendixLetter, { footerReportPrefix: appendixFooterPrefix });
      const coverBody = extractBodyContent(appendixBHtml);
      appendixBCss = extractStyleContent(appendixBHtml).replace(/@page\s*\{/g, '@page appendix {');
      let fragment = '';
      if (isSitePlanImage) {
        const trimmedSitePlan = await trimSitePlanImage(assessmentData.sitePlanFile);
        const assessmentDataTrimmed = { ...assessmentData, sitePlanFile: trimmedSitePlan };
        const sitePlanFigureTitle = assessmentData.sitePlanFigureTitle || 'Lead Survey Site Plan';
        fragment = generateSitePlanContentPage(
          assessmentDataTrimmed,
          sitePlanAppendixLetter,
          logoBase64,
          assessmentFooterTextForPlan,
          'sitePlanFile',
          'SITE PLAN',
          sitePlanFigureTitle,
          'sitePlanLegend',
          'sitePlanLegendTitle',
          0,
          1
        );
        sitePlanCss = sitePlanLandscapeCssBlock;
      }
      appendixPlanSegments.push({ coverBody, fragment, isImage: isSitePlanImage });
    } else {
      let letterIdx = hasFibreIdReport ? 1 : 0;
      let figureNum = 1;
      for (const { plan } of leadEntries) {
        const appendixLetter = String.fromCharCode(65 + letterIdx);
        letterIdx += 1;
        const appendixBHtml = generateAppendixCoverHTMLV3('B', assessmentData, appendixLetter, { footerReportPrefix: appendixFooterPrefix });
        const coverBody = extractBodyContent(appendixBHtml);
        if (!appendixBCss) {
          appendixBCss = extractStyleContent(appendixBHtml).replace(/@page\s*\{/g, '@page appendix {');
        }
        const fileData = plan.sitePlanFile;
        const img = isPlanFileImageData(fileData);
        let fragment = '';
        if (img) {
          const trimmedSitePlan = await trimSitePlanImage(fileData);
          const planMerged = {
            ...assessmentData,
            sitePlanFile: trimmedSitePlan,
            sitePlanLegend: Array.isArray(plan.sitePlanLegend) ? plan.sitePlanLegend : [],
            sitePlanLegendTitle: plan.sitePlanLegendTitle || 'Key',
            sitePlanFigureTitle: plan.sitePlanFigureTitle,
          };
          const figTitle = (plan.sitePlanFigureTitle && plan.sitePlanFigureTitle.trim())
            ? plan.sitePlanFigureTitle.trim()
            : 'Lead Assessment Site Plan';
          const pageTitle = 'SITE PLAN';
          fragment = generateSitePlanContentPage(
            planMerged,
            appendixLetter,
            logoBase64,
            assessmentFooterTextForPlan,
            'sitePlanFile',
            pageTitle,
            figTitle,
            'sitePlanLegend',
            'sitePlanLegendTitle',
            0,
            figureNum
          );
          figureNum += 1;
        }
        if (fragment) {
          sitePlanCss = sitePlanLandscapeCssBlock;
        }
        appendixPlanSegments.push({ coverBody, fragment, isImage: img });
      }
    }
  } else if (hasSitePlan) {
    const sitePlanAppendixLetter = hasFibreIdReport ? 'B' : 'A';
    const appendixBHtml = generateAppendixCoverHTMLV3('B', assessmentData, sitePlanAppendixLetter, { footerReportPrefix: appendixFooterPrefix });
    const coverBody = extractBodyContent(appendixBHtml);
    appendixBCss = extractStyleContent(appendixBHtml).replace(/@page\s*\{/g, '@page appendix {');
    let fragment = '';
    if (isSitePlanImage) {
      const trimmedSitePlan = await trimSitePlanImage(assessmentData.sitePlanFile);
      const assessmentDataTrimmed = { ...assessmentData, sitePlanFile: trimmedSitePlan };
      const sitePlanFigureTitle = assessmentData.sitePlanFigureTitle || 'Asbestos Survey Site Plan';
      fragment = generateSitePlanContentPage(
        assessmentDataTrimmed,
        sitePlanAppendixLetter,
        logoBase64,
        assessmentFooterTextForPlan,
        'sitePlanFile',
        'SITE PLAN',
        sitePlanFigureTitle,
        'sitePlanLegend',
        'sitePlanLegendTitle',
        0,
        1
      );
      sitePlanCss = sitePlanLandscapeCssBlock;
    }
    appendixPlanSegments.push({ coverBody, fragment, isImage: isSitePlanImage });
  }

  /* A4 portrait: 210mm x 297mm - use fixed size so percentage heights resolve (body has no height in single doc) */
  const A4_HEIGHT = '297mm';
  const A4_WIDTH = '210mm';
  /* A4 landscape: 297mm x 210mm - site plan page needs fixed size so content area does not collapse */
  const A4_LANDSCAPE_HEIGHT = '210mm';
  const A4_LANDSCAPE_WIDTH = '297mm';

  // Single-doc layout: avoid blank pages, full-page sections use fixed A4 height so cover/content render
  const singleDocLayoutCss = `
    @page { size: A4; margin: 0; }
    body { font-family: "Gothic", Arial, sans-serif; color: #222; margin: 0; padding: 0; }
    .single-doc-cover, .single-doc-version, .single-doc-appendix { width: ${A4_WIDTH}; min-width: ${A4_WIDTH}; height: ${A4_HEIGHT}; min-height: ${A4_HEIGHT}; box-sizing: border-box; }
    .single-doc-cover .cover-page, .single-doc-cover .page, .single-doc-version .page, .single-doc-appendix .page, .single-doc-appendix .appendix-a-page, .single-doc-appendix .appendix-b-page { width: 100% !important; height: 100% !important; min-height: 100% !important; box-sizing: border-box; }
    .single-doc-section { page-break-before: always; break-before: page; }
    .single-doc-cover { page-break-before: avoid; }
    .single-doc-site-plan-section { width: ${A4_LANDSCAPE_WIDTH}; min-width: ${A4_LANDSCAPE_WIDTH}; height: ${A4_LANDSCAPE_HEIGHT}; min-height: ${A4_LANDSCAPE_HEIGHT}; box-sizing: border-box; }
    .single-doc-site-plan-section .site-plan-page { width: 100% !important; height: 100% !important; min-height: 100% !important; box-sizing: border-box; }
  `;

  /* Version and appendix: same footer formatting as main (green line, layout, at bottom of page) */
  const versionAppendixOverridesCss = `
    .single-doc-version .header, .single-doc-appendix .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; }
    .single-doc-version .green-line, .single-doc-appendix .green-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
    .single-doc-version .footer, .single-doc-appendix .footer { position: absolute; left: 48px; right: 48px; bottom: 0; width: calc(100% - 96px); margin: 0; padding-bottom: 16px; text-align: justify; font-size: 0.75rem; color: #222; box-sizing: border-box; }
    .single-doc-version .footer .footer-border-line, .single-doc-appendix .footer .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
    .single-doc-version .footer .footer-content, .single-doc-appendix .footer .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
    .single-doc-version .footer .footer-text, .single-doc-appendix .footer .footer-text { flex: 1; }
  `;

  const combinedCss = [
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }`,
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }`,
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }`,
    `@font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }`,
    '* { hyphens: none !important; -webkit-hyphens: none !important; -ms-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }',
    singleDocLayoutCss,
    '.page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }',
    coverCss,
    versionCss,
    flowCss,
    appendixACss,
    appendixBCss,
    sitePlanCss,
    versionAppendixOverridesCss
  ].filter(Boolean).join('\n');

  const bodyParts = [
    `<div class="single-doc-cover" style="page: cover">${coverBody}</div>`,
    `<div class="single-doc-version single-doc-section" style="page: version">${versionBody}</div>`,
    `<div class="single-doc-main single-doc-section" style="page: main"><div class="main-section-start">${flowBody}</div></div>`
  ];
  if (hasFibreIdReport) {
    bodyParts.push(`<div class="single-doc-appendix single-doc-section" style="page: appendix">${appendixABody}</div>`);
  }
  for (const seg of appendixPlanSegments) {
    bodyParts.push(`<div class="single-doc-appendix single-doc-section" style="page: appendix">${seg.coverBody}</div>`);
    if (seg.isImage && seg.fragment) {
      bodyParts.push(`<div class="single-doc-site-plan-section single-doc-section" style="page: appendix-landscape">${seg.fragment}</div>`);
    }
  }

  const docTitle = isLeadAssessment ? 'Lead Assessment Report' : 'Asbestos Assessment Report';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>${combinedCss}</style>
</head>
<body>
${bodyParts.join('\n')}
</body>
</html>`;
}

const generateAssessmentPhotographsContent = (items) => {
  if (!items || items.length === 0) {
    return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
  }

  // Flatten: each item can have multiple photos (photographs array with includeInReport, or legacy photograph)
  const photoEntries = [];
  items.forEach((item) => {
    const fromArray = (item.photographs || []).filter(p => p.includeInReport !== false).map(p => (p.data || '').trim()).filter(Boolean);
    if (fromArray.length > 0) {
      fromArray.forEach(src => photoEntries.push({ src, item }));
    } else if (item.photograph && item.photograph.trim() !== '') {
      photoEntries.push({ src: item.photograph.trim(), item });
    }
  });

  if (photoEntries.length === 0) {
    return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
  }

  // Split photos into pages of 2 photos each
  const pages = [];
  for (let i = 0; i < photoEntries.length; i += 2) {
    const pageItems = photoEntries.slice(i, i + 2);
    const pageContent = pageItems.map((entry, index) => {
      const photoNumber = i + index + 1;
      const safe = String(entry.src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const loc = (entry.item.locationDescription || 'Unknown Location').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const mat = (entry.item.materialType || entry.item.materialDescription || 'Unknown Material').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="photo-container">
          <div class="photo">
            <img src="${safe}" alt="Assessment Photo ${photoNumber}" />
          </div>
          <div class="photo-details">
            <div class="photo-number">Photo ${photoNumber}</div>
            <div class="photo-location">${loc}</div>
            <div class="photo-materials">${mat}</div>
          </div>
        </div>
      `;
    }).join('');

    // Create a complete page with header and footer
    pages.push(`
      <div class="page photos-page">
        <div class="header">
          <img class="logo" src="[LOGO_PATH]" alt="Company Logo" />
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street<br />
            Mitchell ACT 2911<br />
            <span class="website">www.landd.com.au</span>
          </div>
        </div>
        <div class="green-line"></div>
        <div class="content" style="justify-content: flex-start; align-items: flex-start">
          <div class="title" style="margin-top: 8px">
            PHOTOGRAPHS
          </div>
          ${pageContent}
        </div>
        <div class="footer">
          <div class="footer-content">
            <div class="footer-line"></div>
            Asbestos Assessment Report: [SITE_ADDRESS]
          </div>
        </div>
      </div>
      ${i + 2 < photoEntries.length ? '<div class="page-break"></div>' : ''}
    `);
  }

  return pages.join('');
};



/**
 * Generate PDF from document definition
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const doc = req.body;
    if (!doc) {
      return res.status(400).json({ error: 'Document definition is required' });
    }

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Generated PDF</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .header {
            font-size: 22px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
          }
          .subheader {
            font-size: 16px;
            font-weight: bold;
            margin: 10px 0 5px 0;
          }
          .columns {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          .column {
            flex: 1;
          }
          .bold {
            font-weight: bold;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .table-header {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
            padding: 8px;
            border: 1px solid #ddd;
          }
          .table-cell {
            padding: 8px;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        ${doc.content.map(item => {
          if (item.text === '\\n') return '<br/>';
          if (item.style === 'header') return `<div class="header">${item.text}</div>`;
          if (item.style === 'subheader') return `<div class="subheader">${item.text}</div>`;
          if (item.table) {
            return `
              <table class="table">
                <thead>
                  <tr>
                    ${item.table.body[0].map(cell => `
                      <th class="table-header">
                        ${typeof cell === 'string' ? cell : cell.text}
                      </th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${item.table.body.slice(1).map(row => `
                    <tr>
                      ${row.map(cell => `
                        <td class="table-cell">
                          ${typeof cell === 'string' ? cell : cell.text}
                        </td>
                      `).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }
          if (item.columns) {
            return `
              <div class="columns">
                ${item.columns.map(col => {
                  if (col.table) {
                    return `
                      <div class="column" style="width: ${col.width === '*' ? '100%' : 'auto'}">
                        <table class="table">
                          <tbody>
                            ${col.table.body.map(row => `
                              <tr>
                                ${row.map(cell => `
                                  <td class="table-cell" style="text-align: ${cell.alignment || 'left'}">
                                    ${typeof cell === 'string' ? cell : (cell.bold ? `<strong>${cell.text}</strong>` : cell.text)}
                                  </td>
                                `).join('')}
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `;
                  }
                  return `
                    <div class="column" style="width: ${col.width === '*' ? '100%' : 'auto'}">
                      ${Array.isArray(col.text) ? col.text.map(t => 
                        typeof t === 'string' ? t : 
                        t.bold ? `<span class="bold">${t.text}</span>` : t.text
                      ).join('') : col.text}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }
          if (Array.isArray(item.text)) {
            return item.text.map(t => 
              typeof t === 'string' ? t : 
              t.bold ? `<span class="bold">${t.text}</span>` : t.text
            ).join('');
          }
          return item.text;
        }).join('')}
      </body>
      </html>
    `;

    // Generate PDF using DocRaptor
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent, {
      page_size: 'A4',
      prince_options: {
        media: 'print',
        html_mode: 'quirks'
      }
    });

    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router; 