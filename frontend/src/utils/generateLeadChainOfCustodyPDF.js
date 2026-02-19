import pdfMake from "pdfmake/build/pdfmake";
import api from "../services/api";

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

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generate Lead Monitoring Chain of Custody PDF.
 * @param {Object} options
 * @param {Object} options.shift - Shift record (date, etc.)
 * @param {Array} options.samples - Samples for the shift (fullSampleID)
 * @param {Object} options.confirmedBy - User who clicked confirm { firstName, lastName, email }
 * @param {string} options.analysisTurnaroundDate - YYYY-MM-DD
 * @param {string} [options.analysisTurnaroundLabel] - Display text e.g. 'Standard', '3-day', '24hr', 'Same Day'
 * @param {Date} options.confirmedAt - Date when Complete Sampling was clicked
 * @param {string} [options.projectID] - Project ID for the job
 * @param {boolean} [options.openInNewTab] - If true, open PDF in new tab instead of downloading
 */
export async function generateLeadChainOfCustodyPDF({
  shift,
  samples = [],
  confirmedBy,
  analysisTurnaroundDate,
  analysisTurnaroundLabel,
  confirmedAt = new Date(),
  projectID,
  openInNewTab = false,
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

  // Prefer logo from backend (backend/assets/logo.png), fallback to frontend public
  let companyLogo = await loadImageAsBase64("/api/logo");
  if (!companyLogo) companyLogo = await loadImageAsBase64("/logo.png");
  const confirmedByName = confirmedBy
    ? [confirmedBy.firstName, confirmedBy.lastName].filter(Boolean).join(" ") || "—"
    : "—";
  const confirmedByEmail = confirmedBy?.email || "—";
  const signatureImage = confirmedBy?.signature || null; // data URL from user profile (EditUserPage)
  // Analysis Required by: display literal turnaround text ('Standard', '3-day', '24hr', 'Same Day'), not a date
  const analysisRequiredBy = analysisTurnaroundLabel != null && analysisTurnaroundLabel !== ""
    ? analysisTurnaroundLabel
    : (analysisTurnaroundDate ? formatDate(analysisTurnaroundDate) : "—");
  const shiftDate = shift?.date ? formatDate(shift.date) : "—";
  const confirmedAtStr = formatDateTime(confirmedAt);

  const sortedSamples = [...samples].sort((a, b) => {
    const aMatch = a.fullSampleID?.match(/LP(\d+)$/);
    const bMatch = b.fullSampleID?.match(/LP(\d+)$/);
    const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
    const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
    return aNum - bNum;
  });

  const SAMPLES_PER_PAGE = 11;

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function buildSampleDataRows(pageSamples) {
    const rows = pageSamples.map((s) => [
      "",
      s.fullSampleID || "",
      "Filter",
      shiftDate,
      "Lead",
    ]);
    while (rows.length < SAMPLES_PER_PAGE) rows.push(["", "", "", "", ""]);
    return rows;
  }

  const dataRowHeight = 19; // reduced 20% from previous 24
  const headerRowHeight = 18; // reduced 20% from previous 22
  const pageMargin = 40;
  const a4Width = 595.28;
  const contentWidth = a4Width - pageMargin * 2;
  const tableRightMargin = 24; // gap between table right edge and page
  const sampleTableWidth = contentWidth - tableRightMargin;

  function buildPageContent(pageSamples) {
    const sampleDataRows = buildSampleDataRows(pageSamples);
    return [
      // First section: Title + Logo
      {
        columns: [
          companyLogo
            ? { image: "companyLogo", width: 120, margin: [0, 0, 0, 0] }
            : { text: "" },
          {
            text: "Laboratory Chain of Custody",
            fontSize: 18,
            bold: true,
            alignment: "right",
            margin: [0, 10, 0, 0],
          },
        ],
        margin: [0, 0, 0, 20],
      },
      // Second section: Company, Contact, Address, Laboratory Details (table)
      {
        table: {
          widths: [130, "*"],
          body: [
            [
              { text: "Company", bold: true, fillColor: "#f5f5f5" },
              { text: "Lancaster & Dickenson Consulting" },
            ],
            [
              { text: "Contact", bold: true, fillColor: "#f5f5f5" },
              { text: "Jordan Smith" },
            ],
            [
              { text: "Address", bold: true, fillColor: "#f5f5f5" },
              { text: "Unit 4, 6 Dacre St, Mitchell ACT 2911" },
            ],
            [
              { text: "Contact number", bold: true, fillColor: "#f5f5f5" },
              { text: "(02) 6241 2779" },
            ],
            [
              { text: "Contact email", bold: true, fillColor: "#f5f5f5" },
              { text: "labreports@landd.com.au,   " + confirmedByEmail },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 16],
      },
      // Third section: Contact number, Contact email, Analysis Required by (table)
      {
        table: {
          widths: [130, "*"],
          body: [
            [
              { text: "Project ID", bold: true, fillColor: "#f5f5f5" },
              { text: projectID || "—" },
            ],
            [
              { text: "Analysis Required by", bold: true, fillColor: "#f5f5f5" },
              { text: analysisRequiredBy },
            ],
            [
              { text: "Laboratory Details", bold: true, fillColor: "#f5f5f5" },
              { text: "Envirolab - 12 Ashley Street Chatswood NSW 2067" },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 16],
      },
      // Fourth section: Sample table (11 rows per page)
      {
        table: {
          headerRows: 1,
          widths: [
            sampleTableWidth * 0.2,
            sampleTableWidth * 0.2,
            sampleTableWidth * 0.2,
            sampleTableWidth * 0.15,
            sampleTableWidth * 0.20,
          ],
          heights: (rowIndex) =>
            rowIndex === 0 ? headerRowHeight : dataRowHeight,
          body: [
            [
              {
                text: "Lab Sample ID",
                bold: true,
                fillColor: "#e0e0e0",
                alignment: "center",
              },
              {
                text: "L&D Sample ID",
                bold: true,
                fillColor: "#e0e0e0",
                alignment: "center",
              },
              {
                text: "Type of sample",
                bold: true,
                fillColor: "#e0e0e0",
                alignment: "center",
              },
              {
                text: "Date Sampled",
                bold: true,
                fillColor: "#e0e0e0",
                alignment: "center",
              },
              {
                text: "Analysis Required",
                bold: true,
                fillColor: "#e0e0e0",
                alignment: "center",
              },
            ],
            ...sampleDataRows.map((row) =>
              row.map((cell) => ({
                text: cell,
                alignment: "center",
                verticalAlignment: "center",
              })),
            ),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: (i) =>
            i === 0 ? (headerRowHeight - 12) / 2 : (dataRowHeight - 12) / 2,
          paddingBottom: (i) =>
            i === 0 ? (headerRowHeight - 12) / 2 : (dataRowHeight - 12) / 2,
        },
        margin: [0, 0, tableRightMargin, 24],
      },
      // Fifth section: 2 column, 4 row table with borders (width matches sample table, signature row bottom-aligned)
      {
        table: {
          widths: [sampleTableWidth / 2, sampleTableWidth / 2],
          heights: (rowIndex) => (rowIndex === 3 ? 44 : undefined),
          body: [
            [
              {
                text: [
                  { text: "Samples sent by: ", bold: true },
                  { text: "L&D Consulting" },
                ],
                margin: [6, 6],
              },
              { text: "Received by (lab):", bold: true, margin: [6, 6] },
            ],
            [
              {
                text: [{ text: "Name: ", bold: true }, { text: confirmedByName }],
                margin: [6, 6],
              },
              { text: "Name: ", bold: true, margin: [6, 6] },
            ],
            [
              {
                text: [
                  { text: "Date and Time: ", bold: true },
                  { text: confirmedAtStr },
                ],
                margin: [6, 6],
              },
              { text: "Date & Time:", bold: true, margin: [6, 6] },
            ],
            [
              signatureImage
                ? {
                    columns: [
                      {
                        text: "Signature:",
                        bold: true,
                        width: 70,
                        margin: [1, 1, 1, 1],
                      },
                      { image: "userSignature", width: 95, margin: [1, 1, 1, 1] },
                    ],
                    margin: [1, 1, 1, 1],
                  }
                : { text: "Signature: ", bold: true, margin: [1, 1, 1, 1] },
              { text: "Signature: ", bold: true, margin: [1, 1, 1, 1] },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: (i) => (i === 3 ? 20 : 6),
          paddingBottom: (i) => (i === 3 ? 6 : 6),
        },
        margin: [0, 0, tableRightMargin, 0],
      },
    ];
  }

  const samplePages = chunkArray(sortedSamples, SAMPLES_PER_PAGE);
  if (samplePages.length === 0) samplePages.push([]);
  const content = samplePages.flatMap((pageSamples, idx) => {
    const page = buildPageContent(pageSamples);
    if (idx > 0) page[0] = { ...page[0], pageBreak: "before" };
    return page;
  });

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [pageMargin, pageMargin, pageMargin, pageMargin],
    defaultStyle: { font: "Gothic", fontSize: 10 },
    images: {
      ...(companyLogo ? { companyLogo } : {}),
      ...(signatureImage ? { userSignature: signatureImage } : {}),
    },
    content,
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 9,
      margin: [0, 10, 0, 0],
    }),
  };

  const filename = `Lead_Chain_of_Custody_${shiftDate.replace(/\//g, "-") || "shift"}.pdf`;
  const pdfDoc = pdfMake.createPdf(docDefinition);
  if (openInNewTab) {
    pdfDoc.open();
    return;
  }
  pdfDoc.download(filename);
}
