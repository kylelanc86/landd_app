import pdfMake from "pdfmake/build/pdfmake";
import api, { userService } from "../services/api";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function formatDateForFilename(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
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

/**
 * Generate Lead Monitoring Shift Report PDF (letter-style 3-pager).
 * Includes main report, Appendix A cover page (page 2), and attached analysis report when available.
 * @param {Object} options
 * @param {Object} options.shift - Shift record (_id, analysisReportPath, date, supervisor, defaultSampler)
 * @param {Object} options.job - LeadRemovalJob (leadAbatementContractor, projectName, client)
 * @param {Array} options.samples - Lead air samples (fullSampleID, location, startTime, endTime, averageFlowrate, leadContent, leadConcentration)
 * @param {Object} options.project - Project (name, address, client)
 * @param {boolean} [options.openInNewTab=true] - Open in new tab vs download
 * @param {boolean} [options.returnPdfData=false] - Return base64 data URL instead of opening
 */
export async function generateLeadMonitoringShiftReport({
  shift,
  job = {},
  samples = [],
  project = {},
  openInNewTab = true,
  returnPdfData = false,
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

  const siteName = project?.name || job?.projectName || "N/A";
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

  const reportRef =
    project?.projectID ||
    job?.projectId?.projectID ||
    job?.projectId?.projectId?.projectID ||
    (sortedSamples[0]?.fullSampleID ? sortedSamples[0].fullSampleID.substring(0, 8) : "") ||
    "";

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

  const discussionContent = allBelowLimit
    ? {
        stack: [
          {
            text: "As the monitoring conducted was static and not exposure monitoring, direct comparison against the exposure limit for airborne lead of 0.05 mg/m³ is not appropriate.",
            alignment: "justify",
          },
          {
            text: "However, as all levels fell well below the exposure standard (and below the Practical Quantitation Limit), it can be concluded that the lead works did not pose a measurable lead exposure risk to building occupants.",
            alignment: "justify",
            margin: [0, 12, 0, 0],
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
            text: "Work should immediately stop and a review conducted of the controls used for these lead abatement works. ",
            alignment: "justify",
          },
          {
            text: "Work may only recommence once improvements to control measures have been implemented and assessed.",
            alignment: "justify",
          },
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
        margin: [0, 0, 0, 16],
      },
      // Title
      
      {
        text: [
          { text: "Lead Air Monitoring Results: ", bold: true },
          { text: `${siteName} - ${shiftDate}`, bold: false },
        ],
        margin: [0, 0, 0, 16],
        fontSize: 10,
      },
      // Introduction
      {
        text: "Introduction",
        style: "header",
        margin: [0, 0, 0, 6],
      },
      {
        stack: [
          {
            text: `Following discussions with ${clientName}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake air monitoring during lead abatement works at ${siteAddress} (herein referred to as 'the Site').`,
            alignment: "justify",
          },
          {
            text: `Lead abatement works were undertaken by ${leadRemovalContractor}. ${sampler} from L&D visited the Site on ${shiftDate}.`,
            alignment: "justify",
            margin: [0, 8, 0, 0],
          },

          {
            text: "Table 1 below outlines the samples that formed part of the inspection. The certificate of analysis for the samples is presented in Appendix A of this report.",
            alignment: "justify",
            margin: [0, 8, 0, 0],
          },
        ],
        style: "body",
        margin: [0, 0, 0, 16],
      },
      // Table 1
      {
        text: [
          { text: "Table 1: ", bold: true },
          { text: "Lead Air Monitoring Results", bold: false },
        ],
        fontSize: 10,
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ["15%", "30%", "12%", "12%", "10%", "20%"],
          body: [
            [
              { text: "Sample ref.", style: "tableHeader" },
              { text: "Sample location", style: "tableHeader" },
              { text: "Start time", style: "tableHeader" },
              { text: "Finish time", style: "tableHeader" },
              { text: "Flowrate (L/min)", style: "tableHeader" },
              { text: "Lead Concentration (mg/m³)", style: "tableHeader" },
            ],
            ...sortedSamples.map((s) => [
              { text: s.fullSampleID || "-", style: "tableContent" },
              {
                text:
                  s.location === "Field blank"
                    ? "Field blank"
                    : (s.location || "-"),
                style: "tableContent",
              },
              {
                text: s.startTime ? formatTime(s.startTime) : "-",
                style: "tableContent",
              },
              {
                text: s.endTime ? formatTime(s.endTime) : "-",
                style: "tableContent",
              },
              {
                text:
                  s.status === "failed"
                    ? { text: "Failed", color: "red", bold: true }
                    : s.averageFlowrate != null
                      ? String(s.averageFlowrate)
                      : "-",
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
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 16],
      },
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
        margin: [0, 0, 0, 8],
      },
      // Sign-off (no section header)
      {
        stack: [
          {
            text: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.",
            style: "body",
            alignment: "justify",
            margin: [0, 0, 0, 8],
          },
          {
            text: "For and on behalf of Lancaster and Dickenson Consulting.",
            style: "body",
            alignment: "justify",
            margin: [0, 0, 0, 8],
          },
          ...(samplerSignature
            ? [
                { image: "samplerSignature", width: 95, margin: [0, 0, 0, 8] },
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

  // Generate a main-only PDF to get the number of pages before the first appendix cover
  const mainOnlyDocDef = {
    pageSize: "A4",
    pageMargins: [40, 105, 40, 58],
    defaultStyle: { font: "Gothic", fontSize: 10, alignment: "justify" },
    images: {
      ...(companyLogo ? { companyLogo } : {}),
      ...(samplerSignature ? { samplerSignature } : {}),
      ...(watermarkLogo ? { watermarkLogo } : {}),
    },
    header: undefined,
    styles: {
      header: { fontSize: 11, bold: true, margin: [0, 0, 0, 4], alignment: "justify" },
      body: { fontSize: 10, margin: [0, 0, 0, 6], lineHeight: 1.4, alignment: "justify" },
      tableHeader: { fontSize: 9, bold: true, fillColor: "#f0f0f0" },
      tableContent: { fontSize: 9 },
    },
    content: mainContent,
  };
  const mainOnlyBlob = await new Promise((resolve, reject) => {
    pdfMake.createPdf(mainOnlyDocDef).getBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to get main-only PDF blob"))));
  });
  const { PDFDocument } = await import("pdf-lib");
  const mainOnlyPdf = await PDFDocument.load(await mainOnlyBlob.arrayBuffer());
  const mainPageCount = mainOnlyPdf.getPageCount();

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 105, 40, 58],
    defaultStyle: { font: "Gothic", fontSize: 10, alignment: "justify" },
    images: {
      ...(companyLogo ? { companyLogo } : {}),
      ...(samplerSignature ? { samplerSignature } : {}),
      ...(watermarkLogo ? { watermarkLogo } : {}),
    },
    header: companyLogo
      ? function (currentPage, pageCount) {
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
                    x2: 520,
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
      header: { fontSize: 11, bold: true, margin: [0, 0, 0, 4], alignment: "justify" },
      body: { fontSize: 10, margin: [0, 0, 0, 6], lineHeight: 1.4, alignment: "justify" },
      tableHeader: { fontSize: 9, bold: true, fillColor: "#f0f0f0" },
      tableContent: { fontSize: 9 },
    },
    content: [...mainContent, ...appendixContent],
    footer: (currentPage, pageCount) => {
      const isMainReportPage = currentPage <= mainPageCount;
      const footerBlocks = [
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 1.5,
              lineColor: "#16b12b",
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              stack: [
                {
                  text: `Report Reference: ${reportRef}`,
                  fontSize: 8,
                },
                {
                  text: `Revision: ${shift?.revision ?? 0}`,
                  fontSize: 8,
                },
              ],
              alignment: "left",
              width: "30%",
            },
            { text: "", width: "40%" },
            {
              stack: isMainReportPage
                ? [
                    {
                      text: `Page ${currentPage} of ${mainPageCount}`,
                      alignment: "right",
                      fontSize: 8,
                    },
                  ]
                : [],
              alignment: "right",
              width: "30%",
            },
          ],
        },
      ];
      return {
        stack: footerBlocks,
        margin: [40, 6, 40, 0],
      };
    },
  };

  const projectID =
    project?.projectID ||
    job?.projectId?.projectID ||
    job?.projectId?.projectId?.projectID ||
    "";
  const projectName = (siteName || "").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_");
  const samplingDate = shift?.date ? formatDateForFilename(shift.date) : "";
  const filename = `Lead Air Monitoring Report_${projectID || "report"}${samplingDate ? `_${samplingDate}` : ""}.pdf`;

  const pdfDoc = pdfMake.createPdf(docDefinition, undefined, undefined, {
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    },
  });

  const mainBlob = await new Promise((resolve, reject) => {
    pdfDoc.getBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to get PDF blob"))));
  });

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
    const msg =
      err.response?.status === 404
        ? "No analysis report has been attached for this shift. Please attach the PDF in the Attach Analysis Report modal before viewing."
        : (typeof err.response?.data === "string"
            ? err.response.data
            : err.response?.data?.message) ||
          err.message ||
          "Failed to fetch analysis report.";
    throw new Error(msg);
  }

  if (!response?.data || response.data.byteLength === 0) {
    throw new Error(
      "No analysis report has been attached for this shift. Please attach the PDF in the Attach Analysis Report modal before viewing.",
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
  window.URL.revokeObjectURL(url);

  return filename;
}
