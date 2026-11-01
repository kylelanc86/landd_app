import pdfMake from "pdfmake/build/pdfmake";
import { formatDateInSydney } from "./dateUtils";
import {
  buildVersionControlContent,
  loadVersionControlRows,
} from "./versionControlPage";
import {
  buildMycometerAirScopeFilename,
  toReportReference,
  withRevisionAndExtension,
} from "./reportFilenames";
import {
  calculateAirAllergenMaav,
  calculateAirFai,
  calculateAirFungiMafv,
  getAirAllergenResultCategory,
  getAirFaiResultCategory,
  getAirFungiResultCategory,
  getAnalystDisplayWithCertFromMeta,
  getSamplerDisplayWithCertFromMeta,
} from "../scenes/laboratory-services/mycometerConstants";

function sameOrBoth(primary, secondary) {
  const left = primary || "";
  const right = secondary || "";
  if (!left && !right) return "N/A";
  if (!right || left === right) return left || right;
  if (!left) return right;
  return `${left} / ${right}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return formatDateInSydney(dateStr);
}

function categoryText(category) {
  if (!category) return { text: "—", color: "black" };
  return {
    text: `${category.code} (${category.label})`,
    color: category.sx?.bgcolor || "black",
  };
}

function resultCell(result, getCategory) {
  const value = result?.kind === "value" ? result.value : null;
  const category = categoryText(value === null ? null : getCategory(value));
  return {
    valueText: value === null ? result?.display || "—" : String(value),
    category,
  };
}

async function loadImageAsBase64(imagePath) {
  try {
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : window.location.origin;
    const response = await fetch(
      imagePath.startsWith("http") ? imagePath : `${baseUrl}${imagePath}`,
    );
    if (!response.ok) return null;
    const blob = await response.blob();
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

function pairSamples(fungiSamples, allergenSamples) {
  const allergenById = new Map();
  (allergenSamples || []).forEach((sample) => {
    if (sample.sampleId) allergenById.set(sample.sampleId, sample);
  });
  const used = new Set();
  const rows = [];
  (fungiSamples || []).forEach((fungi) => {
    const allergen = fungi.sampleId ? allergenById.get(fungi.sampleId) : null;
    if (fungi.sampleId) used.add(fungi.sampleId);
    rows.push({
      sampleId: fungi.sampleId,
      location: fungi.sampleLocation || allergen?.sampleLocation,
      fungi,
      allergen,
    });
  });
  (allergenSamples || []).forEach((allergen) => {
    if (allergen.sampleId && used.has(allergen.sampleId)) return;
    rows.push({
      sampleId: allergen.sampleId,
      location: allergen.sampleLocation,
      fungi: null,
      allergen,
    });
  });
  return rows;
}

/**
 * One air report for the types in scope.
 * Fungi only, allergen only, fungi + allergen, or fungi + allergen + FAI.
 */
export async function generateMycometerAirReport({
  job,
  project,
  openInNewTab = true,
  returnPdfBundle = false,
}) {
  const projectData = project || job?.projectId || {};
  const projectID = projectData?.projectID || "Unknown";
  const siteName = projectData?.name || "Unknown";
  const fungiMeta = (job?.samplingMeta || []).find(
    (item) => item.sampleType === "Air Fungi",
  );
  const allergenMeta = (job?.samplingMeta || []).find(
    (item) => item.sampleType === "Air Allergen",
  );
  const fungiAnalysis = (job?.analysisMeta || []).find(
    (item) => item.sampleType === "Air Fungi",
  );
  const allergenAnalysis = (job?.analysisMeta || []).find(
    (item) => item.sampleType === "Air Allergen",
  );
  const scope = job?.scopeOfWorks || [];
  const includeFungi = scope.includes("Air Fungi");
  const includeAllergen = scope.includes("Air Allergen");
  const includeFai =
    includeFungi &&
    includeAllergen &&
    (typeof job?.includeFaiOnReport === "boolean"
      ? job.includeFaiOnReport
      : scope.includes("Air FAI"));
  const includedAnalyses = [
    includeFungi ? fungiAnalysis : null,
    includeAllergen ? allergenAnalysis : null,
  ].filter(Boolean);
  const allAuthorised =
    includedAnalyses.length > 0 &&
    includedAnalyses.every((item) => item.reportApprovedBy);
  const revision = includedAnalyses.reduce(
    (max, item) => Math.max(max, Number(item.revision) || 0),
    0,
  );
  const issueDate = allAuthorised
    ? includedAnalyses.map((item) => item.reportIssueDate).find(Boolean) ||
      null
    : null;
  const filenameTitle =
    includeFungi && includeAllergen && includeFai
      ? "Mycometer FAI Report"
      : includeFungi && includeAllergen
        ? "Mycometer Air Report"
        : includeFungi
          ? "Mycometer Air Fungi Report"
          : includeAllergen
            ? "Mycometer Air Allergen Report"
            : "Mycometer Air Report";
  const reportTitle = filenameTitle.toUpperCase();
  const reportReference =
    toReportReference(
      buildMycometerAirScopeFilename({
        projectId: projectID,
        siteName,
        reportTitle: filenameTitle,
        reportIssueDate: issueDate,
        includeRevision: false,
        includeExtension: false,
      }),
    ) || `${projectID}_${filenameTitle}`;
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
  const paired = pairSamples(
    includeFungi
      ? (job?.samples || []).filter(
          (sample) => sample.sampleType === "Air Fungi",
        )
      : [],
    includeAllergen
      ? (job?.samples || []).filter(
          (sample) => sample.sampleType === "Air Allergen",
        )
      : [],
  );
  const noteItems = [
    includeFungi &&
      "Mycometer Air Fungi measures the level of fungal particles such as fungal spores, micro-fragments, and hyphal fragments. The result shows the amount of fungi present and the potential exposure in the room.",
    includeAllergen &&
      "Mycometer Air Allergen measures a marker for sources of allergens such as dust mites, pollen, fungi, and pet dander. It shows the total level of potential allergenic material in an activated air sample. It does not measure specific allergens and does not identify the source.",
    includeFungi &&
      "Hidden fungal growth, for example within wall cavities or below the floor, cannot always be revealed by air or dust samples. If the growth is encapsulated so that no fungal particles can enter the space, it cannot be revealed. It is not possible to prove the absence of fungal growth.",
    "Activated air sampling — standard protocol defined by Mycometer A/S has been used, where settled dust particles are resuspended in the air. Activated sampling has been shown to give representative and reproducible sample results.",
  ].filter(Boolean);

  const reading = (value) =>
    value === null || value === undefined || value === "" ? "—" : String(value);
  const dataCell = (text, extra = {}) => ({
    text,
    fontSize: 6.5,
    alignment: "center",
    ...extra,
  });
  const categoryFill = {
    "A+": "#c8e6c9",
    A: "#a5d6a7",
    B: "#fff59d",
    C: "#ffcc80",
    D: "#ef9a9a",
  };
  const categoryCell = (category) =>
    dataCell(category ? `${category.code}\n${category.label}` : "—", {
      color: "black",
      fillColor: category ? categoryFill[category.code] : undefined,
      fontSize: 6,
      bold: Boolean(category),
    });
  const riskTableLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => "gray",
    vLineColor: () => "gray",
    paddingLeft: () => 3,
    paddingRight: () => 3,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  };
  const riskTable = (rangeHeading, rows) => ({
    table: {
      headerRows: 1,
      widths: ["16%", "18%", "*"],
      body: [
        [
          {
            text: "Rating",
            style: "tableHeader",
            fontSize: 8,
            alignment: "center",
            fillColor: "#f0f0f0",
          },
          {
            text: rangeHeading,
            style: "tableHeader",
            fontSize: 8,
            alignment: "center",
            fillColor: "#f0f0f0",
          },
          {
            text: "Descriptor",
            style: "tableHeader",
            fontSize: 8,
            alignment: "center",
            fillColor: "#f0f0f0",
          },
        ],
        ...rows.map(([code, label, range, descriptor]) => [
          {
            text: `${code}\n${label}`,
            fontSize: 8,
            alignment: "center",
            color: "black",
            bold: true,
            fillColor: categoryFill[code],
          },
          {
            text: range,
            fontSize: 8,
            alignment: "center",
          },
          {
            text: descriptor,
            fontSize: 8,
          },
        ]),
      ],
    },
    layout: riskTableLayout,
    margin: [0, 0, 0, 12],
  });
  const resultsTable = (headers, rows) => ({
    table: {
      headerRows: 1,
      widths: headers.map((header) => header.width),
      body: [
        headers.map((header) => ({
          text: header.text,
          style: "tableHeader",
          fontSize: 8,
          fillColor: "#f0f0f0",
          alignment: header.align || "center",
        })),
        ...(rows.length
          ? rows
          : [
              [
                {
                  text: "No samples",
                  colSpan: headers.length,
                  alignment: "center",
                  fontSize: 8,
                },
                ...Array.from({ length: headers.length - 1 }, () => ({})),
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
  });
  const plainCell = (text, extra = {}) => dataCell(text, { fontSize: 8, ...extra });
  const ratedCell = (category) => ({
    ...categoryCell(category),
    fontSize: 8,
  });

  const analysisRows = paired.map((row) => {
    const mafvResult = calculateAirFungiMafv({
      analysisValue: row.fungi?.analysisValue,
      blankValue: row.fungi?.blankValue,
      qualityControl: row.fungi?.qualityControl,
    });
    const maavResult = calculateAirAllergenMaav({
      analysisValue: row.allergen?.analysisValue,
      blankValue: row.allergen?.blankValue,
    });
    const fungiValue = resultCell(mafvResult, getAirFungiResultCategory);
    const allergenValue = resultCell(maavResult, getAirAllergenResultCategory);
    const fai = calculateAirFai(mafvResult, maavResult);
    const identity = [
      plainCell(row.sampleId || "—", { alignment: "left", noWrap: true }),
      plainCell(row.location || "—", { alignment: "left" }),
    ];
    return {
      fungi: [
        ...identity,
        plainCell(reading(row.fungi?.blankValue)),
        plainCell(reading(row.fungi?.analysisValue)),
        plainCell(fungiValue.valueText),
        ratedCell(
          mafvResult.kind === "value"
            ? getAirFungiResultCategory(mafvResult.value)
            : null,
        ),
      ],
      allergen: [
        plainCell(row.sampleId || "—", { alignment: "left", noWrap: true }),
        plainCell(row.location || "—", { alignment: "left" }),
        plainCell(reading(row.allergen?.blankValue)),
        plainCell(reading(row.allergen?.analysisValue)),
        plainCell(allergenValue.valueText),
        ratedCell(
          maavResult.kind === "value"
            ? getAirAllergenResultCategory(maavResult.value)
            : null,
        ),
      ],
      fai: [
        plainCell(row.sampleId || "—", { alignment: "left", noWrap: true }),
        plainCell(row.location || "—", { alignment: "left" }),
        plainCell(fai.display),
        ratedCell(fai.ok ? getAirFaiResultCategory(fai.value) : null),
      ],
    };
  });
  const valueHeaders = (valueLabel) => [
    { text: "Sample ID", width: "20.8%", align: "left" },
    { text: "Sample Location", width: "*", align: "left" },
    { text: "Blank Value", width: "8%" },
    { text: "Analysis Value", width: "11%" },
    { text: valueLabel, width: "11%" },
    { text: "Result", width: "10%" },
  ];

  const sampledBy = sameOrBoth(
    includeFungi && fungiMeta
      ? getSamplerDisplayWithCertFromMeta(fungiMeta, "Air Fungi")
      : "",
    includeAllergen && allergenMeta
      ? getSamplerDisplayWithCertFromMeta(allergenMeta, "Air Allergen")
      : "",
  );
  const analysedBy = sameOrBoth(
    includeFungi && fungiAnalysis
      ? getAnalystDisplayWithCertFromMeta(fungiAnalysis, "Air Fungi")
      : "",
    includeAllergen && allergenAnalysis
      ? getAnalystDisplayWithCertFromMeta(allergenAnalysis, "Air Allergen")
      : "",
  );
  const analysisDate = sameOrBoth(
    includeFungi && fungiAnalysis?.analysisDate
      ? formatDate(fungiAnalysis.analysisDate)
      : "",
    includeAllergen && allergenAnalysis?.analysisDate
      ? formatDate(allergenAnalysis.analysisDate)
      : "",
  );
  const authorisedBy = allAuthorised
    ? sameOrBoth(
        includeFungi ? fungiAnalysis?.reportApprovedBy : "",
        includeAllergen ? allergenAnalysis?.reportApprovedBy : "",
      )
    : "";
  const storedIssueDate =
    includedAnalyses.map((item) => item.reportIssueDate).find(Boolean) || null;
  const versionControlContent = buildVersionControlContent(
    await loadVersionControlRows({
      reportType: "mycometer",
      reportId: job?._id,
      reportKey: "Air Sampling",
      revision,
      approvedBy: authorisedBy,
      issueDate: storedIssueDate,
    }),
  );

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 120, 40, 90],
    defaultStyle: { font: "Gothic" },
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
      header: { fontSize: 12, bold: true, margin: [0, 0, 0, 1] },
      tableHeader: { bold: true, fontSize: 8, color: "black" },
      tableContent: { fontSize: 8 },
      notes: { fontSize: 8, margin: [0, 5, 0, 2], alignment: "justify" },
    },
    content: [
      {
        stack: [
      {
        text: [
          { text: reportTitle },
          ...(allAuthorised ? [] : [{ text: " [DRAFT]", bold: true }]),
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
                      { text: String(paired.length) },
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
                      { text: sampledBy },
                    ],
                    style: "tableContent",
                    width: "50%",
                  },
                  {
                    text: [
                      { text: "Sample Date: ", bold: true },
                      {
                        text: fungiMeta?.sampleDate
                          ? formatDate(fungiMeta.sampleDate)
                          : allergenMeta?.sampleDate
                            ? formatDate(allergenMeta.sampleDate)
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
                      { text: analysedBy },
                    ],
                    style: "tableContent",
                    width: "50%",
                  },
                  {
                    text: [
                      { text: "Analysis Date: ", bold: true },
                      { text: analysisDate },
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
                        text: authorisedBy || "Pending authorisation",
                        color: authorisedBy ? "black" : "red",
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
                    ul: noteItems.map((text) => ({
                      text,
                      margin: [0, 2, 0, 8],
                    })),
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
      ...(includeFungi
        ? [
      {
        pageBreak: "before",
        stack: [
          {
            text: "Air Fungi",
            style: "header",
            fontSize: 11,
            margin: [0, 0, 0, 6],
          },
          resultsTable(
            valueHeaders("MAFV/m³"),
            analysisRows.map((row) => row.fungi),
          ),
          riskTable("MAFV/m³", [
            [
              "A+",
              "Low",
              "≤35",
              "The level of fungi is low and corresponds to what is found in rooms/buildings without fungal (mould) growth and/or moisture problems and a high cleaning standard.",
            ],
            [
              "A",
              "Normal",
              "36–145",
              "The level of fungi is normal and corresponds to the level typically found in rooms/buildings without fungal (mould) growth or moisture problems and a normal cleaning standard.",
            ],
            [
              "B",
              "Elevated",
              "146–240",
              "The level of fungi is elevated and corresponds to what is found in rooms/buildings with an inadequate cleaning standard. If the cleaning standard is good or very good, a category B result should lead to an extra thorough inspection to exclude the presence of a fungal source (fungal growth).",
            ],
            [
              "C",
              "High",
              "241–680",
              "The level of fungi is high, which means that there is a fungal source (fungal growth) or a very poor cleaning standard. The high level of fungi should lead to a thorough inspection to determine the source.",
            ],
            [
              "D",
              "Very high",
              ">680",
              "The level of fungi is very high, which means that there is a fungal source (fungal growth) or a very poor cleaning standard. The very high level of fungi should lead to a thorough inspection to determine the source.",
            ],
          ]),
          {
            text: "MAFV = Mycometer Air Fungi Value.",
            style: "notes",
            margin: [0, 0, 0, 0],
          },
        ],
      },
          ]
        : []),
      ...(includeAllergen
        ? [
      {
        pageBreak: "before",
        stack: [
          {
            text: "Air Allergen",
            style: "header",
            fontSize: 11,
            margin: [0, 0, 0, 6],
          },
          resultsTable(
            valueHeaders("MAAV/m³"),
            analysisRows.map((row) => row.allergen),
          ),
          riskTable("MAAV/m³", [
            [
              "A+",
              "Low",
              "<275",
              "The level of allergens is low, corresponding to what is found in rooms/buildings with a high cleaning standard.",
            ],
            [
              "A",
              "Normal",
              "276–1375",
              "The level of allergens is normal, corresponding to what is found in rooms/buildings with a normal cleaning standard.",
            ],
            [
              "B",
              "Elevated",
              "1376–2300",
              "The level of allergens is elevated, corresponding to what is found in normal rooms/building with a normal to poor cleaning standard.",
            ],
            [
              "C",
              "High",
              "2301–7750",
              "The level of allergens is high. This is often an indication of an inadequate cleaning standard.",
            ],
            [
              "D",
              "Very high",
              ">7750",
              "The level of allergens is very high. This is often an indication of a highly inadequate cleaning standard and/or a significant influence from allergen sources such as pets, mould, dust mites etc.",
            ],
          ]),
          {
            text: "MAAV = Mycometer Air Allergen Value.",
            style: "notes",
            margin: [0, 0, 0, 0],
          },
        ],
      },
          ]
        : []),
      ...(includeFai
        ? [
      {
        pageBreak: "before",
        stack: [
          {
            text: "FAI",
            style: "header",
            fontSize: 11,
            margin: [0, 0, 0, 6],
          },
          resultsTable(
            [
              { text: "Sample ID", width: "20.8%", align: "left" },
              { text: "Sample Location", width: "*", align: "left" },
              { text: "FAI", width: "10%" },
              { text: "FAI Rating", width: "16%" },
            ],
            analysisRows.map((row) => row.fai),
          ),
          riskTable("FAI", [
            [
              "A+",
              "Low",
              "≤5%",
              "The FAI value is low. There is no indication of a fungal source (mold growth) in the sampling area or in adjacent spaces.",
            ],
            [
              "A",
              "Normal",
              "6–14%",
              "The FAI value is in the normal range. There is no indication of a fungal source (mold growth) in the sampling area or in immediately adjacent spaces.",
            ],
            [
              "B",
              "Elevated",
              "15–22%",
              "The FAI result is inconclusive. A B result can be obtained in non-problem buildings, but also in rooms with a minor fungal source or in rooms neighbouring a fungal source. A further inspection is recommended.",
            ],
            [
              "C",
              "High",
              "23–35%",
              "The FAI value is higher than what is normally found in non-problem buildings. This indicates the presence of a fungal source (mold growth) in the sampling area or adjacent spaces.",
            ],
            [
              "D",
              "Very high",
              ">35%",
              "The FAI value is very high. This strongly indicates the presence of a significant fungal source (mold growth) in the sampling area or adjacent spaces.",
            ],
          ]),
          {
            text: "FAI = Fungal to Allergen Index = (MAFV / MAAV) × 100%.",
            style: "notes",
            margin: [0, 0, 0, 0],
          },
        ],
      },
          ]
        : []),
          versionControlContent,
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
  if (returnPdfBundle) {
    return new Promise((resolve) => {
      pdfDoc.getDataUrl((dataUrl) => {
        resolve({ dataUrl, filename });
      });
    });
  }
  void openInNewTab;
  // Opening a blob tab saves as a UUID. Download uses the report name, including [DRAFT].
  pdfDoc.download(filename);
}

export async function generateMycometerAirFaiReport(args) {
  return generateMycometerAirReport(args);
}
