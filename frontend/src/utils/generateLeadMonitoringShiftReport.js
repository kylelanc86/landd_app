import pdfMake from "pdfmake/build/pdfmake";
import api, { shiftService, userService } from "../services/api";
import {
  buildLeadAirMonitoringFilename,
  toReportReference,
  withRevisionAndExtension,
} from "./reportFilenames";
import { FOOTER_CONTENT_WIDTH } from "./pdfFooter";

const LEAD_GREEN_RULE_WIDTH = 520;

const LEAD_FOOTER_PAGE_WIDTH = Math.round(FOOTER_CONTENT_WIDTH * 0.1);
const LEAD_FOOTER_TEXT_WIDTH = FOOTER_CONTENT_WIDTH - LEAD_FOOTER_PAGE_WIDTH;

function buildLeadMonitoringFooter({
  reportReference,
  revision,
  currentPage,
  mainPageCount,
  isMainReportPage,
}) {
  return {
    stack: [
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: LEAD_GREEN_RULE_WIDTH,
            y2: 0,
            lineWidth: 1.5,
            lineColor: "#16b12b",
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        width: FOOTER_CONTENT_WIDTH,
        table: {
          widths: [LEAD_FOOTER_TEXT_WIDTH, LEAD_FOOTER_PAGE_WIDTH],
          body: [
            [
              {
                stack: [
                  {
                    text: `Report Reference: ${reportReference}`,
                    fontSize: 8,
                  },
                  {
                    text: `Revision: ${revision ?? 0}`,
                    fontSize: 8,
                    margin: [0, 4, 0, 0],
                  },
                ],
              },
              {
                stack: isMainReportPage
                  ? [
                      {
                        text: `Page ${currentPage} of ${mainPageCount}`,
                        fontSize: 8,
                        alignment: "right",
                      },
                    ]
                  : [],
              },
            ],
          ],
        },
        layout: "noBorders",
      },
    ],
    margin: [40, 6, 40, 0],
  };
}

function formatDateLong(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).split(":").slice(0, 2).join(":");
}

function formatLeadConcentrationForDisplay(v) {
  if (v == null || v === "") return "-";
  const s = String(v).trim();
  const hasLessThan = s.startsWith("<");
  const numStr = hasLessThan ? s.slice(1).trim() : s;
  const n = parseFloat(numStr);
  if (isNaN(n)) return String(v);
  const formatted = n.toFixed(4);
  return hasLessThan ? `<${formatted}` : formatted;
}

function parseLeadConcentrationNumeric(v) {
  if (v == null || v === "") return NaN;
  const s = String(v).trim();
  const numStr = s.startsWith("<") ? s.slice(1).trim() : s;
  return parseFloat(numStr);
}

async function loadImageAsBase64(imagePath) {
  try {
    let response;
    if (imagePath.startsWith("/api/")) {
      const apiPath = imagePath.substring(4);
      response = await api.get(apiPath, { responseType: "blob" });
    } else {
      const baseUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : window.location.origin;
      const fullUrl = imagePath.startsWith("http")
        ? imagePath
        : `${baseUrl}${imagePath}`;
      response = await fetch(fullUrl);
    }
    const blob = response.data || (await response.blob());
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error loading image:", error);
    return null;
  }
}

function getSamplerName(shift) {
  const s = shift?.supervisor || shift?.defaultSampler;
  if (!s) return "N/A";
  if (typeof s === "object") {
    return [s.firstName, s.lastName].filter(Boolean).join(" ") || "N/A";
  }
  return String(s);
}

function sampleFinishesNextDay(sample) {
  const value = sample?.nextDay;
  return value === true || value === "on" || value === "true" || value === 1;
}

function dateParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleString("en-AU", { month: "long" }),
    monthIndex: d.getMonth(),
    year: d.getFullYear(),
  };
}

/** Two consecutive dates: "08 & 09 October 2026", or "31 October & 01 November 2026". */
function formatTwoDayRange(startDateStr) {
  if (!startDateStr) return "";
  const start = new Date(startDateStr);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const first = dateParts(start);
  const second = dateParts(end);
  if (!first || !second) return "";
  if (first.year === second.year && first.monthIndex === second.monthIndex) {
    return `${first.day} & ${second.day} ${first.month} ${first.year}`;
  }
  if (first.year === second.year) {
    return `${first.day} ${first.month} & ${second.day} ${second.month} ${first.year}`;
  }
  return `${first.day} ${first.month} ${first.year} & ${second.day} ${second.month} ${second.year}`;
}

function markerLetter(index) {
  return String.fromCharCode(65 + (index % 26));
}

function markerTypeLabel(type) {
  if (type === "equipment") return "Equipment";
  if (type === "access_point") return "Access point";
  return "Other";
}

function buildSitePlanLocationEntries(markers, samples) {
  return (Array.isArray(markers) ? markers : []).map((marker, index) => {
    const letter = markerLetter(index);
    if (marker?.type === "sampling_point") {
      const sampleNumber = marker.sampleNumber || marker.label || "";
      const sample = (samples || []).find(
        (item) =>
          (sampleNumber &&
            (item.sampleNumber === sampleNumber ||
              item.fullSampleID === sampleNumber)) ||
          (marker.label &&
            (item.sampleNumber === marker.label ||
              item.fullSampleID === marker.label)),
      );
      const location =
        sample?.location || marker.description || "Sampling location";
      const id = sample?.fullSampleID || sampleNumber || marker.label || "N/A";
      return { letter, text: `${location} - ${id}` };
    }
    const label = markerTypeLabel(marker?.type);
    const description = marker?.description
      ? `${label}: ${marker.description}`
      : label;
    return { letter, text: description };
  });
}

function sitePlanImageRequestPath(staticMapUrl) {
  if (!staticMapUrl || typeof staticMapUrl !== "string") return null;
  if (staticMapUrl.startsWith("/api/")) return staticMapUrl;
  if (staticMapUrl.includes("maps.googleapis.com/maps/api/staticmap")) {
    return `/api/air-monitoring-shifts/proxy-static-map?url=${encodeURIComponent(staticMapUrl)}&crop=true`;
  }
  return staticMapUrl;
}

function isImageDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image");
}

async function loadLeadSitePlan(shift, sitePlanData) {
  if (sitePlanData?.sitePlan && sitePlanData?.sitePlanData) return sitePlanData;
  if (!shift?._id) return null;
  try {
    const response = await shiftService.getSitePlan(shift._id);
    const data = response?.data;
    if (data?.sitePlan && data?.sitePlanData) return data;
    return null;
  } catch (error) {
    console.error("Failed to load lead monitoring site plan:", error);
    return null;
  }
}

const LEAD_PDF_PERMISSIONS = {
  printing: "highResolution",
  modifying: false,
  copying: false,
  annotating: false,
  fillingForms: false,
  contentAccessibility: false,
  documentAssembly: false,
};

function buildLeadReportDefinition({
  content,
  images,
  reportReference,
  revision,
  mainPageCount,
}) {
  const hasLogo = Boolean(images?.companyLogo);
  return {
    pageSize: "A4",
    pageMargins: [40, 105, 40, 58],
    defaultStyle: { font: "Gothic", fontSize: 9, alignment: "justify" },
    images: images || {},
    header: hasLogo
      ? function () {
          return {
            stack: [
              {
                columns: [
                  { image: "companyLogo", width: 165 },
                  {
                    stack: [
                      {
                        text: "Lancaster & Dickenson Consulting Pty Ltd",
                        fontSize: 9,
                        margin: [0, 1, 0, 1],
                        color: "black",
                        lineHeight: 1.5,
                      },
                      {
                        text: "4/6 Dacre Street, Mitchell ACT 2911",
                        fontSize: 9,
                        margin: [0, 1, 0, 1],
                        color: "black",
                        lineHeight: 1.5,
                      },
                      {
                        text: "W: www.landd.com.au",
                        fontSize: 9,
                        margin: [0, 1, 0, 1],
                        color: "black",
                        lineHeight: 1.5,
                      },
                    ],
                    alignment: "right",
                  },
                ],
                margin: [0, 0, 0, 4],
              },
              {
                canvas: [
                  {
                    type: "line",
                    x1: 0,
                    y1: 0,
                    x2: LEAD_GREEN_RULE_WIDTH,
                    y2: 0,
                    lineWidth: 1.5,
                    lineColor: "#16b12b",
                  },
                ],
                margin: [0, 0, 0, 4],
              },
            ],
            margin: [40, 30, 40, 0],
          };
        }
      : undefined,
    styles: {
      header: { fontSize: 10, bold: true, margin: [0, 0, 0, 3], alignment: "justify" },
      body: { fontSize: 9, margin: [0, 0, 0, 3], lineHeight: 1.35, alignment: "justify" },
      tableHeader: { fontSize: 8, bold: true, fillColor: "#f0f0f0" },
      tableContent: { fontSize: 8 },
    },
    content,
    footer: (currentPage) =>
      buildLeadMonitoringFooter({
        reportReference,
        revision,
        currentPage,
        mainPageCount,
        isMainReportPage: mainPageCount > 0 && currentPage <= mainPageCount,
      }),
  };
}

function createPdfBlob(docDefinition) {
  const pdfDoc = pdfMake.createPdf(docDefinition, undefined, undefined, {
    permissions: LEAD_PDF_PERMISSIONS,
  });
  return new Promise((resolve, reject) => {
    pdfDoc.getBlob((blob) =>
      blob ? resolve(blob) : reject(new Error("Failed to get PDF blob")),
    );
  });
}

function buildSitePlanAppendixContent({
  sitePlanImage,
  entries,
  mapUnavailable = false,
  includeWatermark = false,
}) {
  const content = [
    ...(includeWatermark
      ? [
          {
            image: "watermarkLogo",
            width: 300,
            opacity: 0.15,
            absolutePosition: { x: 160, y: 270 },
          },
        ]
      : []),
    {
      text: "APPENDIX B",
      style: "header",
      fontSize: 18,
      alignment: "center",
      margin: [0, 300, 0, 8],
      color: "#16b12b",
    },
    {
      text: "SITE PLAN",
      style: "body",
      fontSize: 18,
      alignment: "center",
      margin: [0, 0, 0, 24],
    },
    {
      text: "",
      pageBreak: "before",
    },
  ];

  if (sitePlanImage) {
    content.push(
      {
        columns: [
          { text: "", width: "*" },
          {
            width: 28,
            stack: [
              {
                canvas: [
                  {
                    type: "line",
                    x1: 14,
                    y1: 12,
                    x2: 14,
                    y2: 0,
                    lineWidth: 1.5,
                    lineColor: "#333333",
                  },
                  {
                    type: "line",
                    x1: 14,
                    y1: 0,
                    x2: 10,
                    y2: 4,
                    lineWidth: 1.5,
                    lineColor: "#333333",
                  },
                  {
                    type: "line",
                    x1: 14,
                    y1: 0,
                    x2: 18,
                    y2: 4,
                    lineWidth: 1.5,
                    lineColor: "#333333",
                  },
                ],
              },
              { text: "N", alignment: "center", bold: true, fontSize: 9, margin: [0, 1, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        image: sitePlanImage,
        width: 515,
        margin: [0, 0, 0, 10],
      },
    );
  } else if (mapUnavailable) {
    content.push({
      text: "The site plan map could not be loaded. Sampling locations recorded for this shift are listed below.",
      style: "body",
      margin: [0, 0, 0, 8],
    });
  }

  if (entries.length > 0) {
    content.push({
      table: {
        headerRows: 1,
        widths: ["100%"],
        body: [
          [
            {
              text: "SAMPLING LOCATIONS",
              style: "tableHeader",
              fillColor: "#f0f0f0",
            },
          ],
          [
            {
              stack: entries.map((entry) => ({
                text: [
                  { text: `${entry.letter}: `, bold: true, color: "#ff4444" },
                  { text: entry.text },
                ],
                style: "tableContent",
                margin: [0, 0, 0, 2],
              })),
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i, node) =>
          i === 0 || i === node.table.body.length ? 1 : 0.5,
        vLineWidth: () => 1,
        hLineColor: (i, node) =>
          i === 0 || i === node.table.body.length ? "#000000" : "#cccccc",
        vLineColor: () => "#000000",
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 8],
    });
  }

  content.push({
    text: [
      { text: "Note: ", bold: true },
      {
        text:
          entries.length > 0
            ? "Sample locations are approximate. Marker letters on the plan correspond to the locations listed above."
            : "Sample locations shown on the plan are approximate.",
      },
    ],
    style: "body",
    margin: [0, 0, 0, 0],
  });

  return content;
}

async function renderSitePlanAppendix({
  sitePlanImage,
  entries,
  mapUnavailable = false,
  reportReference,
  revision,
  companyLogo,
  watermarkLogo,
}) {
  const definition = buildLeadReportDefinition({
    content: buildSitePlanAppendixContent({
      sitePlanImage,
      entries,
      mapUnavailable,
      includeWatermark: Boolean(watermarkLogo),
    }),
    images: {
      ...(companyLogo ? { companyLogo } : {}),
      ...(watermarkLogo ? { watermarkLogo } : {}),
    },
    reportReference,
    revision,
    mainPageCount: 0,
  });
  return createPdfBlob(definition);
}

/**
 * Generate Lead Monitoring Shift Report PDF (letter-style report).
 * Includes the main report, Appendix A (certificate of analysis), and Appendix B (site plan) when a site plan is saved on the shift.
 * @param {Object} options
 * @param {Object} options.shift - Shift record (_id, analysisReportPath, analysisReportFiles, date, supervisor, defaultSampler)
 * @param {Object} options.job - LeadRemovalJob (leadAbatementContractor, projectName, client)
 * @param {Array} options.samples - Lead air samples (fullSampleID, location, startTime, endTime, nextDay, averageFlowrate, leadContent, leadConcentration)
 * @param {Object} options.project - Project (name, address, client)
 * @param {boolean} [options.openInNewTab=true] - Open in new tab vs download
 * @param {boolean} [options.returnPdfData=false] - Return base64 data URL instead of opening
 * @param {Object|null} [options.sitePlanData=null] - Optional { sitePlan, sitePlanData }. Loaded from the shift when omitted.
 */
export async function generateLeadMonitoringShiftReport({
  shift,
  job = {},
  samples = [],
  project = {},
  openInNewTab = true,
  returnPdfData = false,
  sitePlanData = null,
}) {
  const baseUrl =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : window.location.origin;

  pdfMake.fonts = {
    Gothic: {
      normal: `${baseUrl}/fonts/static/Gothic-Regular.ttf`,
      bold: `${baseUrl}/fonts/static/Gothic-Bold.ttf`,
      italics: `${baseUrl}/fonts/static/Gothic-Italic.ttf`,
      bolditalics: `${baseUrl}/fonts/static/Gothic-BoldItalic.ttf`,
    },
  };

  let companyLogo = await loadImageAsBase64("/api/logo");
  if (!companyLogo) companyLogo = await loadImageAsBase64("/logo.png");

  const watermarkLogo = await loadImageAsBase64("/api/logo-watermark");

  let samplerSignature = null;
  const samplerRef = shift?.supervisor || shift?.defaultSampler;
  const samplerId = samplerRef && (typeof samplerRef === "object" ? samplerRef._id : samplerRef);
  if (samplerId) {
    try {
      const userRes = await userService.getById(samplerId);
      samplerSignature = userRes?.data?.signature || null;
    } catch {
      samplerSignature = null;
    }
  }

  const siteName =
    project?.name ||
    job?.projectName ||
    job?.projectId?.name ||
    (job?.projectId?.projectId && typeof job.projectId.projectId === "object"
      ? job.projectId.projectId.name
      : null) ||
    "N/A";
  const shiftDate = shift?.date ? formatDateLong(shift.date) : "N/A";
  const pdfGenerationDate = formatDateLong(new Date().toISOString());
  const clientName =
    project?.client?.name ||
    (typeof job?.client === "string" ? job.client : null) ||
    "N/A";
  const siteAddress =
    project?.address || project?.client?.address || "N/A";
  const leadRemovalContractor = job?.leadAbatementContractor || "N/A";
  const sampler = getSamplerName(shift);

  const sortedSamples = [...samples].sort((a, b) => {
    const aMatch = a.fullSampleID?.match(/LP(\d+)$/);
    const bMatch = b.fullSampleID?.match(/LP(\d+)$/);
    const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
    const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
    return aNum - bNum;
  });

  const projectID =
    project?.projectID ||
    job?.projectId?.projectID ||
    job?.projectId?.projectId?.projectID ||
    (sortedSamples[0]?.fullSampleID
      ? sortedSamples[0].fullSampleID.substring(0, 8)
      : "") ||
    "";
  const siteNameForFilename =
    project?.name ||
    job?.projectName ||
    job?.projectId?.name ||
    (job?.projectId?.projectId && typeof job.projectId.projectId === "object"
      ? job.projectId.projectId.name
      : null) ||
    "";
  const issueDate = shift?.reportIssueDate || null;
  const revision = shift?.revision || 0;
  const sequenceNumber = shift?.sequenceNumber;
  const reportReference =
    toReportReference(shift?.reportReference) ||
    toReportReference(
      buildLeadAirMonitoringFilename({
        projectId: projectID,
        siteName: siteNameForFilename,
        reportIssueDate: issueDate,
        sequenceNumber,
        includeRevision: false,
        includeExtension: false,
      }),
    );
  const filename = withRevisionAndExtension(reportReference, revision, true);

  const hasNextDaySample = sortedSamples.some(sampleFinishesNextDay);
  const twoDayRange = hasNextDaySample ? formatTwoDayRange(shift?.date) : "";
  const spansTwoDays =
    hasNextDaySample && shiftDate && shiftDate !== "N/A" && Boolean(twoDayRange);
  const titleDate = spansTwoDays ? twoDayRange : shiftDate;
  const visitDates = spansTwoDays ? twoDayRange : shiftDate;
  const hasMarkedNextDayFinish = sortedSamples.some(
    (sample) => sampleFinishesNextDay(sample) && sample.endTime,
  );
  const twoDayNote = hasNextDaySample
    ? `Sampling was conducted across two days${
        spansTwoDays ? ` (${twoDayRange})` : ""
      }.${
        hasMarkedNextDayFinish
          ? " Finish times marked with an asterisk (*) were recorded on the following day."
          : ""
      }`
    : "";

  const loadedSitePlan = await loadLeadSitePlan(shift, sitePlanData);
  const sitePlanMarkers = Array.isArray(loadedSitePlan?.sitePlanData?.markers)
    ? loadedSitePlan.sitePlanData.markers
    : [];
  let sitePlanImage = null;
  if (loadedSitePlan?.sitePlanData?.staticMapUrl) {
    const imagePath = sitePlanImageRequestPath(
      loadedSitePlan.sitePlanData.staticMapUrl,
    );
    if (imagePath) {
      const loadedImage = await loadImageAsBase64(imagePath);
      sitePlanImage = isImageDataUrl(loadedImage) ? loadedImage : null;
    }
  }
  const sitePlanEntries = buildSitePlanLocationEntries(
    sitePlanMarkers,
    sortedSamples,
  );

  let sitePlanBlob = null;
  const canRenderSitePlan = Boolean(sitePlanImage || sitePlanEntries.length > 0);
  if (canRenderSitePlan) {
    const renderPlan = (image, mapUnavailable) =>
      renderSitePlanAppendix({
        sitePlanImage: image,
        entries: sitePlanEntries,
        mapUnavailable,
        reportReference,
        revision: shift?.revision ?? 0,
        companyLogo,
        watermarkLogo,
      });
    try {
      sitePlanBlob = await renderPlan(sitePlanImage, false);
    } catch (error) {
      console.error("Failed to render lead monitoring site plan:", error);
      if (sitePlanImage && sitePlanEntries.length > 0) {
        try {
          sitePlanImage = null;
          sitePlanBlob = await renderPlan(null, true);
        } catch (retryError) {
          console.error(
            "Failed to render lead monitoring site plan locations:",
            retryError,
          );
          sitePlanBlob = null;
        }
      } else {
        sitePlanBlob = null;
      }
    }
  }
  const includeSitePlanAppendix = Boolean(sitePlanBlob);
  const certificateSentence = includeSitePlanAppendix
    ? "Table 1 below outlines the samples that formed part of the inspection. The certificate of analysis for the samples is presented in Appendix A of this report. A site plan showing approximate sample locations is presented in Appendix B."
    : "Table 1 below outlines the samples that formed part of the inspection. The certificate of analysis for the samples is presented in Appendix A of this report.";

  const samplesAboveLimit = sortedSamples.filter((s) => {
    const n = parseLeadConcentrationNumeric(s.leadConcentration);
    return !isNaN(n) && n > 0.05;
  });
  const allBelowLimit =
    sortedSamples.filter((s) => {
      const n = parseLeadConcentrationNumeric(s.leadConcentration);
      return !isNaN(n);
    }).length > 0 &&
    samplesAboveLimit.length === 0;

  // Show "(and below the Practical Quantitation Limit)" only when all samples have lead content (μg/filter) equal to '<1'
  const allSamplesBelowPQL =
    sortedSamples.length > 0 &&
    sortedSamples.every((s) => {
      const v = s.leadContent;
      if (v == null || v === "") return false;
      const str = String(v).trim();
      if (!str.startsWith("<")) return false;
      const num = parseFloat(str.slice(1).trim());
      return !isNaN(num) && num === 1;
    });

  const discussionContent = allBelowLimit
    ? {
        stack: [
          {
            text: "As the monitoring conducted was static and not exposure monitoring, direct comparison against the exposure limit for airborne lead of 0.05 mg/m³ is not appropriate.",
            alignment: "justify",
          },
          {
            text: allSamplesBelowPQL
              ? "However, as all levels fell well below the exposure standard (and below the Practical Quantitation Limit), it can be concluded that the lead works did not pose a measurable lead exposure risk to building occupants."
              : "However, as all levels fell well below the exposure standard, it can be concluded that the lead works did not pose a measurable lead exposure risk to building occupants.",
            alignment: "justify",
            margin: [0, 5, 0, 0],
          },
        ],
      }
    : samplesAboveLimit.length > 0
      ? [
          {
            text: `Analysis of ${samplesAboveLimit.map((s) => s.fullSampleID || s.sampleNumber).join(", ")} found the sample${samplesAboveLimit.length > 1 ? "s" : ""} exceeded the exposure limit for airborne lead of 0.05 mg/m³. `,
            alignment: "justify",
          },
          {
            text: "Work should immediately cease until a review is conducted of the controls used for these lead works and improvements to control measures have been implemented. Work may only recommence once improvements to control measures have been assessed as satisfactory.",
            alignment: "justify",
            margin: [0, 8, 0, 0],
          }
        ]
      : { text: "[No lead concentration data available for conclusions.]", alignment: "justify" };

  // Build content array so we can split main report vs appendix and compute main page count
  const content = [
    // Client details
    {
      table: {
          widths: ["100%"],
          body: [
            [
              {
                stack: [
                  {
                    text: [
                      { text: clientName },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  {
                    text: [
                      {
                        text:
                          project?.projectContact?.name ||
                          project?.client?.contact1Name
            
                      },
                    ],
                    margin: [0, 0, 0, 2],
                  },

                  {
                    text:project?.projectContact?.email ||
                    project?.client?.contact1Email ||
                    project?.client?.contact2Email,
                    margin: [0, 14, 0, 0],
                  },
                  {
                    text: pdfGenerationDate,
                    margin: [0, 14, 0, 0],
                  },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 10],
      },
      // Title
      {
        text: [
          { text: "Lead Air Monitoring Results: ", bold: true },
          { text: `${siteName} - ${titleDate}`, bold: false },
          ...(shift?.reportApprovedBy ? [] : [{ text: " [DRAFT]", bold: true }]),
        ],
        margin: [0, 0, 0, 10],
        fontSize: 10,
      },
      // Introduction
      {
        text: "Introduction",
        style: "header",
        margin: [0, 0, 0, 8],
      },
      {
        stack: [
          {
            text: `Following discussions with ${clientName}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake air monitoring during lead works at ${siteName} (herein referred to as 'the Site').`,
            alignment: "justify",
          },
          {
            text: `Lead abatement works were undertaken by ${leadRemovalContractor}. ${sampler} from L&D visited the Site on ${visitDates}.`,
            alignment: "justify",
            margin: [0, 4, 0, 0],
          },

          {
            text: [
              "Static air monitoring was undertaken during works to ensure that controls were appropriate to mitigate lead exposure risks. Air monitoring was conducted in line with ",
              {
                text: "ISO 15202-1:2020: Workplace air - Determination of metals and metalloids in airborne particulate matter by inductively coupled plasma atomic emission spectrometry",
                italics: true,
              },

             {
                text: " and ",
                italics: false
              },
              {
                text: "AS/NZS 4361.2:2017: Guide to Hazardous Paint Management: Part 2.",
                italics: true,
              },
            ],
            alignment: "justify",
            margin: [0, 4, 0, 0],
          },

          {
            text: "Air samples were collected using IOM samplers and air monitors were placed at the approximate height of an adult's breathing zone (about 1.5m from ground surface) with monitoring conducted for a representative period of the work shift.",
            alignment: "justify",
            margin: [0, 4, 0, 0],
          },

          {
            text: certificateSentence,
            alignment: "justify",
            margin: [0, 4, 0, 0],
          },
        ],
        style: "body",
        margin: [0, 0, 0, 10],
      },
      // Table 1
      {
        text: [
          { text: "Table 1: ", bold: true },
          { text: "Lead Air Monitoring Results", bold: false },
        ],
        fontSize: 9,
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ["14%", "44.3%", "7%", "7%", "9%", "7.7%", "11%"],
          body: [
            [
              { text: "Sample ref.", style: "tableHeader" },
              { text: "Sample location", style: "tableHeader", alignment: "left" },
              { text: "Start time", style: "tableHeader" },
              { text: "Finish time", style: "tableHeader" },
              { text: "Flowrate (L/min)", style: "tableHeader" },
              { text: "Lead Content (µg)", style: "tableHeader" },
              { text: "Lead Conc. (mg/m³)", style: "tableHeader" },
            ],
            ...sortedSamples.map((s) => [
              { text: s.fullSampleID || "-", style: "tableContent" },
              {
                text:
                  s.location === "Field blank"
                    ? "Field blank"
                    : (s.location || "-"),
                style: "tableContent",
                alignment: "left",
              },
              {
                text: s.startTime ? formatTime(s.startTime) : "-",
                style: "tableContent",
              },
              {
                text: s.endTime
                  ? `${formatTime(s.endTime)}${sampleFinishesNextDay(s) ? "*" : ""}`
                  : "-",
                style: "tableContent",
              },
              {
                text:
                  s.status === "failed"
                    ? { text: "Failed", color: "red", bold: true }
                    : s.averageFlowrate != null
                      ? Number(s.averageFlowrate).toFixed(1)
                      : "-",
                style: "tableContent",
              },
              {
                text: s.leadContent != null && String(s.leadContent).trim() !== "" ? String(s.leadContent).trim() : "-",
                style: "tableContent",
              },
              {
                text: formatLeadConcentrationForDisplay(s.leadConcentration),
                style: "tableContent",
              },
            ]),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
        margin: [0, 0, 0, twoDayNote ? 4 : 10],
      },
      ...(twoDayNote
        ? [
            {
              text: [
                { text: "Note: ", bold: true },
                { text: twoDayNote },
              ],
              style: "body",
              margin: [0, 0, 0, 10],
            },
          ]
        : []),
      // Discussion & Conclusions
      {
        text: "Discussion & Conclusions",
        style: "header",
        margin: [0, 0, 0, 6],
      },
      {
        ...(discussionContent.stack
          ? { stack: discussionContent.stack }
          : Array.isArray(discussionContent)
            ? { stack: discussionContent }
            : { text: discussionContent.text ?? discussionContent }),
        style: "body",
        alignment: "justify",
        margin: [0, 0, 0, 5],
      },
      // Sign-off (no section header) — force onto a fresh page when sample table is likely to crowd footer/signature.
      ...(sortedSamples.length > 2 ? [{ text: "", pageBreak: "before" }] : []),
      {
        stack: [
          {
            text: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.",
            style: "body",
            alignment: "justify",
            margin: [0, 0, 0, 5],
          },
          {
            text: "For and on behalf of Lancaster and Dickenson Consulting.",
            style: "body",
            alignment: "justify",
            margin: [0, 0, 0, 5],
          },
          ...(samplerSignature
            ? [
                { image: "samplerSignature", width: 95, margin: [0, 0, 0, 5] },
              ]
            : []),
          {
            text: sampler,
            fontSize: 11,
            bold: true,
            margin: [0, 0, 0, 4],
          },
          {
            text: "Lancaster & Dickenson Consulting Pty Ltd",
            fontSize: 9,
            margin: [0, 0, 0, 0],
          },
        ],
      },
      // Appendix A cover page (page 2)
      {
        text: "",
        pageBreak: "before",
      },
      ...(watermarkLogo
        ? [
            {
              image: "watermarkLogo",
              width: 300,
              opacity: 0.15,
              absolutePosition: { x: 160, y: 270 },
            },
          ]
        : []),
      {
        text: "APPENDIX A",
        style: "header",
        fontSize: 18,
        alignment: "center",
        margin: [0, 300, 0, 8],
        color: "#16b12b",
      },
      {
        text: "CERTIFICATE OF ANALYSIS",
        style: "body",
        fontSize: 18,
        alignment: "center",
        margin: [0, 0, 0, 24],
      },
  ];

  const appendixStartIndex = content.findIndex((item) => item.pageBreak === "before");
  const mainContent = appendixStartIndex >= 0 ? content.slice(0, appendixStartIndex) : content;
  const appendixContent = appendixStartIndex >= 0 ? content.slice(appendixStartIndex) : [];

  // Main report is 2 pages when we inject a page break before sign-off (e.g. >2 samples), else 1
  const mainPageCount = sortedSamples.length > 2 ? 2 : 1;

  const docDefinition = buildLeadReportDefinition({
    content: [...mainContent, ...appendixContent],
    images: {
      ...(companyLogo ? { companyLogo } : {}),
      ...(samplerSignature ? { samplerSignature } : {}),
      ...(watermarkLogo ? { watermarkLogo } : {}),
    },
    reportReference,
    revision: shift?.revision ?? 0,
    mainPageCount,
  });

  const mainBlob = await createPdfBlob(docDefinition);

  if (!shift?._id) {
    throw new Error("Shift ID is required to generate the report.");
  }

  // Attach the analysis report PDF (required)
  let response;
  try {
    response = await api.get(
      `air-monitoring-shifts/${shift._id}/analysis-report`,
      { responseType: "arraybuffer", validateStatus: (s) => s === 200 },
    );
  } catch (err) {
    let backendMessage = null;
    const responseData = err?.response?.data;
    if (responseData instanceof ArrayBuffer) {
      try {
        const decoded = new TextDecoder("utf-8").decode(new Uint8Array(responseData));
        const parsed = JSON.parse(decoded);
        backendMessage = parsed?.message || null;
      } catch {
        backendMessage = null;
      }
    } else if (typeof responseData === "string") {
      backendMessage = responseData;
    } else if (responseData && typeof responseData === "object") {
      backendMessage = responseData.message || null;
    }

    const msg =
      err.response?.status === 404
        ? backendMessage ||
          "Analysis report file could not be found on the server. Please re-attach the PDF in the Attach Analysis Report modal before viewing."
        : backendMessage ||
          err.message ||
          "Failed to fetch analysis report.";
    throw new Error(msg);
  }

  if (!response?.data || response.data.byteLength === 0) {
    throw new Error(
      "No analysis reports have been attached for this shift. Please attach PDF(s) in the Attach Analysis Report modal before viewing.",
    );
  }

  const analysisBytes = response.data;
  let finalBlob;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const mainDoc = await PDFDocument.load(await mainBlob.arrayBuffer());
    const analysisDoc = await PDFDocument.load(analysisBytes);
    const mergedDoc = await PDFDocument.create();
    const mainPages = await mergedDoc.copyPages(mainDoc, mainDoc.getPageIndices());
    mainPages.forEach((p) => mergedDoc.addPage(p));
    const analysisPages = await mergedDoc.copyPages(analysisDoc, analysisDoc.getPageIndices());
    analysisPages.forEach((p) => mergedDoc.addPage(p));
    if (sitePlanBlob) {
      const sitePlanDoc = await PDFDocument.load(await sitePlanBlob.arrayBuffer());
      const sitePlanPages = await mergedDoc.copyPages(
        sitePlanDoc,
        sitePlanDoc.getPageIndices(),
      );
      sitePlanPages.forEach((p) => mergedDoc.addPage(p));
    }
    const mergedBytes = await mergedDoc.save();
    finalBlob = new Blob([mergedBytes], { type: "application/pdf" });
  } catch (err) {
    throw new Error(
      "Could not merge the analysis report. The attached file may be invalid. " +
        (err.message || ""),
    );
  }

  if (!finalBlob) {
    throw new Error("Failed to generate report.");
  }

  if (returnPdfData) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(finalBlob);
    });
  }

  const url = window.URL.createObjectURL(finalBlob);
  if (openInNewTab) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  // Delay revocation so Chrome's built-in PDF viewer can still download from the blob URL.
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60 * 1000);

  return filename;
}
