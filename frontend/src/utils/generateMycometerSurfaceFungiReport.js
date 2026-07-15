import pdfMake from "pdfmake/build/pdfmake";
import api from "../services/api";
import { formatDateInSydney } from "../utils/dateUtils";
import {
  buildMycometerSurfaceFungiFilename,
  toReportReference,
  withRevisionAndExtension,
} from "./reportFilenames";
import {
  getAnalystDisplayWithCertFromMeta,
  getSamplerDisplayWithCertFromMeta,
} from "../scenes/laboratory-services/mycometerConstants";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return formatDateInSydney(dateStr);
}

function calculateMsfv(analysisValue, blankValue) {
  if (
    analysisValue === "" ||
    analysisValue === null ||
    analysisValue === undefined ||
    blankValue === "" ||
    blankValue === null ||
    blankValue === undefined
  ) {
    return null;
  }
  const analysis = Number(analysisValue);
  const blank = Number(blankValue);
  if (!Number.isFinite(analysis) || !Number.isFinite(blank)) return null;
  return Math.max(0, analysis - blank);
}

function getResultCategory(msfv) {
  if (msfv === null || !Number.isFinite(msfv)) {
    return { text: "—", color: "black" };
  }
  if (msfv <= 20) {
    return { text: "A (Normal)", color: "#2e7d32" };
  }
  if (msfv <= 135) {
    return { text: "B (Elevated)", color: "#ed6c02" };
  }
  return { text: "C (High)", color: "#d32f2f" };
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

    if (!response.ok && !response.status) {
      return null;
    }

    const blob = response.data || (await response.blob());
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error loading image ${imagePath}:`, error);
    return null;
  }
}

/**
 * Temporary Mycometer Surface Fungi PDF based on the air monitoring shift report layout.
 * Content/structure can be refined after review.
 */
export async function generateMycometerSurfaceFungiReport({
  job,
  samples = [],
  samplingMeta,
  analysisMeta,
  project,
  openInNewTab = true,
  returnPdfData = false,
}) {
  if (typeof job !== "object" || job === null) {
    job = {};
  }

  const projectData = project || job?.projectId || {};
  const projectID = projectData?.projectID || "Unknown";
  const siteName = projectData?.name || "Unknown";
  const isAuthorised = Boolean(analysisMeta?.reportApprovedBy);
  // Issue date is set on authorisation and preserved for filenames across revisions.
  // Only display it once authorised; otherwise show Pending authorisation.
  const issueDate = isAuthorised
    ? analysisMeta?.reportIssueDate || null
    : null;
  const revision = analysisMeta?.revision || 0;
  const reportReference =
    toReportReference(analysisMeta?.reportReference) ||
    toReportReference(
      buildMycometerSurfaceFungiFilename({
        projectId: projectID,
        siteName,
        reportIssueDate: analysisMeta?.reportIssueDate || null,
        includeRevision: false,
        includeExtension: false,
      }),
    );
  const filename = withRevisionAndExtension(reportReference, revision, true);

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

  const companyLogo = await loadImageAsBase64("/logo.png");

  const sampleRows = (samples || []).map((sample) => {
    const msfv = calculateMsfv(sample.analysisValue, sample.blankValue);
    const category = getResultCategory(msfv);
    return [
      { text: sample.sampleId || "—", style: "tableContent" },
      {
        text: sample.sampleLocation || "—",
        style: "tableContent",
      },
      { text: sample.cleaningStage || "—", style: "tableContent" },
      {
        text:
          sample.blankValue === null || sample.blankValue === undefined
            ? "—"
            : String(sample.blankValue),
        style: "tableContent",
        alignment: "center",
      },
      {
        text:
          sample.analysisValue === null || sample.analysisValue === undefined
            ? "—"
            : String(sample.analysisValue),
        style: "tableContent",
        alignment: "center",
      },
      {
        text: msfv === null ? "—" : String(msfv),
        style: "tableContent",
        alignment: "center",
      },
      {
        text: category.text,
        style: "tableContent",
        alignment: "center",
        bold: category.text !== "—",
      },
    ];
  });

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 120, 40, 90],
    defaultStyle: {
      font: "Gothic",
    },
    images: {
      ...(companyLogo ? { companyLogo } : {}),
    },
    header: companyLogo
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
                    x2: 520,
                    y2: 0,
                    lineWidth: 1.5,
                    lineColor: "#16b12b",
                  },
                ],
                margin: [0, 0, 0, 10],
              },
            ],
            margin: [40, 30, 40, 0],
          };
        }
      : undefined,
    styles: {
      header: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 1],
      },
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: "black",
      },
      tableContent: {
        fontSize: 8,
      },
      notes: {
        fontSize: 8,
        margin: [0, 5, 0, 2],
      },
    },
    content: [
      {
        stack: [
          {
            text: [
              { text: "MYCOMETER SURFACE FUNGI REPORT" },
              ...(analysisMeta?.reportApprovedBy
                ? []
                : [{ text: " [DRAFT]", bold: true }]),
            ],
            style: "header",
            margin: [0, -10, 0, 10],
            alignment: "center",
          },
          {
            table: {
              headerRows: 1,
              widths: ["50%", "50%"],
              body: [
                [
                  {
                    text: "CLIENT DETAILS",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "LABORATORY DETAILS",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                  },
                ],
                [
                  {
                    stack: [
                      {
                        text: [
                          { text: "Client Name: ", bold: true },
                          {
                            text:
                              projectData?.client?.name ||
                              job?.projectId?.client?.name ||
                              "",
                          },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: [
                          { text: "Client Contact: ", bold: true },
                          {
                            text:
                              projectData?.projectContact?.name ||
                              job?.projectId?.projectContact?.name ||
                              projectData?.client?.contact1Name ||
                              "",
                          },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: [
                          { text: "Email: ", bold: true },
                          {
                            text:
                              projectData?.projectContact?.email ||
                              projectData?.client?.contact1Email ||
                              projectData?.client?.invoiceEmail ||
                              "N/A",
                          },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: [
                          { text: "Site Name: ", bold: true },
                          { text: siteName },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                    ],
                  },
                  {
                    stack: [
                      {
                        text: [
                          { text: "Address: ", bold: true },
                          { text: "4/6 Dacre Street, Mitchell ACT 2911" },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: [
                          { text: "Email: ", bold: true },
                          { text: "laboratory@landd.com.au" },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                      {
                        text: [
                          { text: "Lab Manager: ", bold: true },
                          { text: "Jordan Smith" },
                        ],
                        style: "tableContent",
                        margin: [0, 0, 0, 2],
                      },
                    ],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: (i, node) =>
                i === 0 || i === node.table.body.length ? 1 : 0.5,
              vLineWidth: (i, node) =>
                i === 0 || i === node.table.widths.length ? 1 : 0.5,
              hLineColor: () => "gray",
              vLineColor: () => "gray",
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ["100%"],
              body: [
                [
                  {
                    text: "REPORT DETAILS",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                  },
                ],
                [
                  {
                    columns: [
                      {
                        text: [
                          { text: "L&D Job Reference: ", bold: true },
                          { text: projectID },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                      {
                        text: [
                          { text: "Number of Samples: ", bold: true },
                          { text: String(samples.length) },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                    ],
                  },
                ],
                [
                  {
                    columns: [
                      {
                        text: [
                          { text: "Sampled by: ", bold: true },
                          {
                            text: getSamplerDisplayWithCertFromMeta(
                              samplingMeta,
                              "Surface Fungi",
                            ),
                          },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                      {
                        text: [
                          { text: "Sample Date: ", bold: true },
                          {
                            text: samplingMeta?.sampleDate
                              ? formatDate(samplingMeta.sampleDate)
                              : "N/A",
                          },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                    ],
                  },
                ],
                [
                  {
                    columns: [
                      {
                        text: [
                          { text: "Analysed by: ", bold: true },
                          {
                            text: getAnalystDisplayWithCertFromMeta(
                              analysisMeta,
                              "Surface Fungi",
                            ),
                          },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                      {
                        text: [
                          { text: "Analysis Date: ", bold: true },
                          {
                            text: analysisMeta?.analysisDate
                              ? formatDate(analysisMeta.analysisDate)
                              : "N/A",
                          },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                    ],
                  },
                ],
                [
                  {
                    columns: [
                      {
                        text: [
                          { text: "Report Authorised by: ", bold: true },
                          {
                            text:
                              analysisMeta?.reportApprovedBy ||
                              "Pending authorisation",
                            color: !analysisMeta?.reportApprovedBy
                              ? "red"
                              : "black",
                          },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                      {
                        text: [
                          { text: "Report Issue Date: ", bold: true },
                          {
                            text: issueDate
                              ? formatDate(issueDate)
                              : "Pending authorisation",
                            color: issueDate ? "black" : "red",
                          },
                        ],
                        style: "tableContent",
                        width: "50%",
                      },
                    ],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: (i, node) =>
                i === 0 || i === 1 || i === node.table.body.length ? 1 : 0,
              vLineWidth: () => 1,
              hLineColor: () => "gray",
              vLineColor: () => "gray",
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 0,
              widths: ["100%"],
              body: [
                [
                  {
                    stack: [
                      {
                        text: [
                          { text: "Notes: ", bold: true },

                        ],
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "MSFV = Mycometer Surface Fungi Value",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                                 
                      {
                        text: "A - Normal (MSFV: ≤20)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of fungi on the surface is within the normal range and corresponds to the level found on visually clean surfaces in buildings with no visual (or smell) signs of fungal growth or moisture problems. Category A is the success criteria for post remediation clearance.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "B - Elevated (MSFV 21–135)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of fungi on the surface is elevated and corresponds to the level found on visually dusty/dirty surfaces in buildings without mold/moisture problems. It is indicative of a reservoir of fungal particles accumulating in the dust because of insufficient cleaning. It can also be due to low density growth or old dried out fungal growth (dead) due to reduction in enzyme activity.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "C - High (MSFV >135)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of fungi is high above the normal background level and above the levels found in normal household dust. A category C result means that there is fungal growth on the surface.",
                        style: "notes",
                        margin: [0, 0, 0, 0],
                      },
                    ],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => "gray",
              vLineColor: () => "gray",
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ["11%", "30%", "14%", "8%", "10%", "10%", "17%"],
              heights: () => 8 * 1.15 * 3,
              body: [
                [
                  {
                    text: "Sample ID",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "Sample Location",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "Cleaning Stage",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "Blank Value",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                    alignment: "center",
                  },
                  {
                    text: "Analysis Value",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                    alignment: "center",
                  },
                  {
                    text: "MSFV",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                    alignment: "center",
                  },
                  {
                    text: "Result Category",
                    style: "tableHeader",
                    fillColor: "#f0f0f0",
                    alignment: "center",
                  },
                ],
                ...(sampleRows.length > 0
                  ? sampleRows
                  : [
                      [
                        {
                          text: "No samples",
                          colSpan: 7,
                          alignment: "center",
                          style: "tableContent",
                        },
                        {},
                        {},
                        {},
                        {},
                        {},
                        {},
                      ],
                    ]),
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => "gray",
              vLineColor: () => "gray",
              paddingLeft: () => 3,
              paddingRight: () => 3,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
            margin: [0, 0, 0, 10],
          },
        ],
      },
    ],
    footer: function (currentPage, pageCount) {
      return {
        stack: [
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
            stack: [
              {
                text: `Report Reference: ${reportReference}`,
                fontSize: 8,
                margin: [0, 4, 4, 0],
              },
              {
                text: `Revision: ${revision}`,
                fontSize: 8,
                margin: [0, 8, 0, 0],
              },
              {
                text: `Page ${currentPage} of ${pageCount}`,
                fontSize: 8,
                margin: [0, 8, 0, 4],
              },
            ],
            alignment: "left",
          },
        ],
        margin: [40, 10, 40, 0],
      };
    },
  };

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

  if (returnPdfData) {
    return new Promise((resolve) => {
      pdfDoc.getDataUrl((dataUrl) => resolve(dataUrl));
    });
  }

  if (openInNewTab) {
    pdfDoc.open({}, undefined, filename);
  } else {
    pdfDoc.download(filename);
  }
}
