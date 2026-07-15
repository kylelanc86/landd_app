import pdfMake from "pdfmake/build/pdfmake";
import api from "../services/api";
import { formatDateInSydney } from "../utils/dateUtils";
import {
  buildMycometerAirAllergenFilename,
  toReportReference,
  withRevisionAndExtension,
} from "./reportFilenames";
import {
  calculateAirAllergenMaav,
  getAirAllergenResultCategory,
  getAnalystDisplayWithCertFromMeta,
  getSamplerDisplayWithCertFromMeta,
} from "../scenes/laboratory-services/mycometerConstants";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return formatDateInSydney(dateStr);
}

function getCategoryForPdf(maav) {
  const category = getAirAllergenResultCategory(maav);
  if (!category) return { text: "—", color: "black" };
  return {
    text: `${category.code} (${category.label})`,
    color: category.sx?.bgcolor || "black",
  };
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
 * Mycometer Air Allergen PDF — layout mirrors Surface Fungi report.
 */
export async function generateMycometerAirAllergenReport({
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
      buildMycometerAirAllergenFilename({
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
    const maavResult = calculateAirAllergenMaav({
      analysisValue: sample.analysisValue,
      blankValue: sample.blankValue,
    });
    const maav = maavResult.kind === "value" ? maavResult.value : null;
    const category = getCategoryForPdf(maav);
    return [
      { text: sample.sampleId || "—", style: "tableContent" },
      { text: sample.sampleLocation || "—", style: "tableContent" },
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
        text: maav === null ? maavResult.display || "—" : String(maav),
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
        alignment: "justify",
      },
    },
    content: [
      {
        stack: [
          {
            text: [
              { text: "MYCOMETER AIR ALLERGEN REPORT" },
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
                              "Air Allergen",
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
                              "Air Allergen",
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
                        text: [{ text: "Notes: ", bold: true }],
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "MAAV/m³ = Mycometer Air Allergen Value",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "A+ - Low (MAAV <275)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of allergens is low, corresponding to what is found in rooms/buildings with a high cleaning standard.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "A - Normal (MAAV 276–1375)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of allergens is normal, corresponding to what is found in rooms/buildings with a normal cleaning standard.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "B - Elevated (MAAV 1376–2300)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of allergens is elevated, corresponding to what is found in normal rooms/building with a normal to poor cleaning standard.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "C - High (MAAV 2301–7750)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of allergens is high. This is often an indication of an inadequate cleaning standard.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "D - Very high (MAAV >7750)",
                        style: "notes",
                        bold: true,
                        margin: [0, 2, 0, 2],
                      },
                      {
                        text: "The level of allergens is very high. This is often an indication of a highly inadequate cleaning standard and/or a significant influence from allergen sources such as pets, mould, dust mites etc.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "Mycometer air Allergen measures a marker showing the presence of sources of allergens such as dust mites, pollen, fungi, pet dander etc. The Mycometer Air Allergen value is a measure of the total level of potential allergenic material present when measured by an activated air sample. The method does not measure specific allergens and as such gives no indication of the source.",
                        style: "notes",
                        margin: [0, 0, 0, 6],
                      },
                      {
                        text: "Activated air sampling - standard protocol defined by Mycometer A/S has been used, where settled dust particles are resuspended in the air. Activated sampling has been shown to give representative and reproducible sample results.",
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
            pageBreak: "before",
            table: {
              headerRows: 1,
              widths: ["14%", "30%", "12%", "14%", "14%", "16%"],
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
                    text: "MAAV/m³",
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
                          colSpan: 6,
                          alignment: "center",
                          style: "tableContent",
                        },
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
