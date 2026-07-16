import pdfMake from "pdfmake/build/pdfmake";
import { formatDateInSydney } from '../utils/dateUtils';
import { compareLabReference } from '../utils/formatters';
import {
  buildFibreIDFilename,
  toReportReference,
  withRevisionAndExtension,
} from './reportFilenames';
import { buildLabReportFooter } from './pdfFooter';

// Helper to format date as DD/MM/YYYY in Sydney timezone (for report issue date, sample date)
function formatDate(dateStr) {
  if (!dateStr) return '';
  return formatDateInSydney(dateStr);
}

// Helper to load image as base64
async function loadImageAsBase64(imagePath) {
  try {
    const response = await fetch(imagePath);
    
    if (!response.ok) {
      console.error(`Failed to fetch ${imagePath}:`, response.status, response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = (error) => {
        console.error(`FileReader error for ${imagePath}:`, error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error loading image ${imagePath}:`, error);
    return null;
  }
}

const PT_TO_PX = 96 / 72;
const ptToPx = (pt) => pt * PT_TO_PX;

let gothicFontsLoadedForMeasurement = false;

async function ensureGothicFontsForMeasurement(baseUrl) {
  if (gothicFontsLoadedForMeasurement || typeof FontFace === 'undefined') {
    return;
  }

  const regular = new FontFace(
    'Gothic',
    `url(${baseUrl}/fonts/static/Gothic-Regular.ttf)`,
    { weight: '400', style: 'normal' }
  );
  const bold = new FontFace(
    'Gothic',
    `url(${baseUrl}/fonts/static/Gothic-Bold.ttf)`,
    { weight: '700', style: 'normal' }
  );

  await Promise.all([regular.load(), bold.load()]);
  document.fonts.add(regular);
  document.fonts.add(bold);
  await document.fonts.ready;
  gothicFontsLoadedForMeasurement = true;
}

function createPdfTextMeasurer() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let measureWordWidth = null;

  const setFont = (fontSizePt, bold) => {
    ctx.font = `${bold ? 'bold' : 'normal'} ${fontSizePt}pt Gothic, sans-serif`;
    measureWordWidth = (word) => ctx.measureText(word).width;
  };

  const wrapParagraph = (paragraph, maxWidthPx, fontSizePt, bold) => {
    setFont(fontSizePt, bold);
    const spaceWidth = measureWordWidth(' ');
    const words = paragraph.split(/\s+/).filter(Boolean);
    let lines = 1;
    let lineWidth = 0;

    words.forEach((word) => {
      const wordWidth = measureWordWidth(word);

      if (wordWidth > maxWidthPx) {
        if (lineWidth > 0) {
          lines += 1;
          lineWidth = 0;
        }

        let chunk = '';
        for (const char of word) {
          const nextChunk = chunk + char;
          if (measureWordWidth(nextChunk) > maxWidthPx && chunk) {
            lines += 1;
            chunk = char;
          } else {
            chunk = nextChunk;
          }
        }
        lineWidth = measureWordWidth(chunk);
        return;
      }

      const nextWidth = lineWidth > 0 ? lineWidth + spaceWidth + wordWidth : wordWidth;
      if (lineWidth > 0 && nextWidth > maxWidthPx) {
        lines += 1;
        lineWidth = wordWidth;
      } else {
        lineWidth = nextWidth;
      }
    });

    return lines;
  };

  const getLineHeightPx = (fontSizePt, bold) => {
    setFont(fontSizePt, bold);
    const metrics = ctx.measureText('Agypq');
    return (
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
      || metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
      || fontSizePt * PT_TO_PX * 1.15
    );
  };

  return {
    countLines(text, maxWidthPt, fontSizePt, bold = false) {
      if (!text || typeof text !== 'string') {
        return 1;
      }

      const maxWidthPx = ptToPx(maxWidthPt);
      let totalLines = 0;

      text.split('\n').forEach((paragraph) => {
        if (!paragraph || !paragraph.trim()) {
          totalLines += 1;
          return;
        }
        totalLines += wrapParagraph(paragraph, maxWidthPx, fontSizePt, bold);
      });

      return Math.max(totalLines, 1);
    },
    getLineHeightPt(fontSizePt, bold = false) {
      return getLineHeightPx(fontSizePt, bold) / PT_TO_PX;
    },
  };
}

export async function generateFibreIDReport({ assessment, sampleItems, analyst, openInNewTab, returnPdfData = false, reportApprovedBy = null, reportIssueDate = null }) {
  // Detect if this is a client-supplied job (has jobType but no assessorId)
  const isClientSupplied = assessment?.jobType === "Fibre ID" && !assessment?.assessorId;
  // Detect if this is an L&D supplied report (has assessorId, not client supplied)
  const isLDSupplied = !isClientSupplied && assessment?.assessorId;

  // Determine base URL for fonts - use window.location.origin to avoid CORS issues
  // Use window.location.origin to load fonts from the same origin as the app
  // This prevents CORS errors when accessing from different domains
  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : window.location.origin;

pdfMake.fonts = {
  Gothic: {
    normal: `${baseUrl}/fonts/static/Gothic-Regular.ttf`,
    bold: `${baseUrl}/fonts/static/Gothic-Bold.ttf`,
    italics: `${baseUrl}/fonts/static/Gothic-Italic.ttf`,
    bolditalics: `${baseUrl}/fonts/static/Gothic-BoldItalic.ttf`
  }
};
  

  // Load logos
  const companyLogo = await loadImageAsBase64(`${baseUrl}/logo.png`);
  const nataLogo = await loadImageAsBase64(`${baseUrl}/NATA_logo.png`);

  if (!companyLogo) {
    console.error('Failed to load company logo');
    return;
  }

  if (!nataLogo) {
    console.warn('Failed to load NATA logo, proceeding without it');
  }

  await ensureGothicFontsForMeasurement(baseUrl).catch((error) => {
    console.warn('Could not load Gothic fonts for PDF line measurement; row heights may be approximate.', error);
  });
  const textMeasurer = createPdfTextMeasurer();

  const projectID = assessment?.projectId?.projectID || '';
  const siteName = assessment?.projectId?.name || '';
  const issueDate = reportIssueDate || assessment?.reportIssueDate || null;
  const revision = assessment?.revision || 0;
  const reportReference =
    toReportReference(assessment?.fibreIdReportReference) ||
    toReportReference(assessment?.reportReference) ||
    toReportReference(
      buildFibreIDFilename({
        projectId: projectID,
        siteName,
        reportIssueDate: issueDate,
        includeRevision: false,
        includeExtension: false,
      }),
    );
  const filename = withRevisionAndExtension(reportReference, revision, true);

  // Sort sample items by lab reference (numeric order: Lab1, Lab2, ..., Lab9, Lab10, not text order)
  const sortedSampleItems = [...sampleItems].sort(compareLabReference);

  // Build the document definition
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 30, 40, 90],
    defaultStyle: {
      font: 'Gothic'
    },
    images: nataLogo ? { nataLogo: nataLogo } : {},
    
    // DEBUG: Log document definition structure
    _debug: {
      pageSize: "A4",
      pageMargins: [40, 30, 40, 90],
      defaultStyle: { font: 'Gothic' },
      hasNataLogo: !!nataLogo,
      hasCompanyLogo: !!companyLogo
    },
    styles: {
      header: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 4],
      },
      subheader: {
        fontSize: 9,
        bold: false,
        margin: [0, 1, 0, 1],
        color: "black",
        lineHeight: 1.5,
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: "black",
      },
      tableContent: {
        fontSize: 8,
      },
      notes: {
        fontSize: 8,
        margin: [0, 5, 0, 2],
        alignment: 'justify',
      },
    },
    
    
    content: (function(measurer) {
      return [
      // Page 1 Content
      {
        stack: [
          // Header
          {
            columns: [
              { image: companyLogo, width: 165 },
              {
                stack: [
                  { text: 'Lancaster & Dickenson Consulting Pty Ltd', style: 'subheader' },
                  { text: '4/6 Dacre Street, Mitchell ACT 2911', style: 'subheader' },
                  { text: 'W: www.landd.com.au', style: 'subheader' },
                ],
                alignment: 'right',
              },
            ],
            margin: [0, 0, 0, 4],
          },
          
          // Green border beneath header - USING TABLE BORDER INSTEAD OF CANVAS
          {
            table: {
              body: [['']],
              widths: ['100%']
            },
            layout: {
              hLineWidth: function(i) { return i === 0 ? 2 : 0; }, // Only top border
              vLineWidth: function() { return 0; },
              hLineColor: function(i) { return i === 0 ? '#16b12b' : 'white'; }, // Only top border green
              vLineColor: function() { return 'white'; }
            },
            margin: [0, 0, 0, 12]
          },
          
                    { text: 'ASBESTOS FIBRE CERTIFICATE OF ANALYSIS', style: 'header', margin: [0, 0, 0, 10], alignment: 'center' },
          
          // Client and Lab details in single table
          {
              table: {
                headerRows: 1,
                widths: ['50%', '50%'],
                body: [
                  [
                    { text: 'CLIENT DETAILS', style: 'tableHeader', fillColor: '#f0f0f0' },
                    { text: 'LABORATORY DETAILS', style: 'tableHeader', fillColor: '#f0f0f0' }
                  ],
                [
                  {
                    stack: [
                      { text: [ { text: 'Client: ', bold: true }, { text: assessment?.projectId?.client?.name || 'Unknown Client' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Contact: ', bold: true }, { text: (() => {
                        if (isClientSupplied) {
                          // For client-supplied: project contact name, then client contact1Name, then "-"
                          return assessment?.projectId?.projectContact?.name || assessment?.projectId?.client?.contact1Name || '-';
                        }
                        // For L&D supplied: project contact name, then client contact1Name, then "-"
                        return assessment?.projectId?.projectContact?.name || assessment?.projectId?.client?.contact1Name || '-';
                      })() } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: (() => {
                        if (isClientSupplied) {
                          // For client-supplied: project contact email, then client invoiceEmail, then client contact1Email, then "-"
                          return assessment?.projectId?.projectContact?.email || assessment?.projectId?.client?.invoiceEmail || assessment?.projectId?.client?.contact1Email || '-';
                        }
                        // For L&D supplied: project contact email, then client invoiceEmail, then client contact1Email, then "-"
                        return assessment?.projectId?.projectContact?.email || assessment?.projectId?.client?.invoiceEmail || assessment?.projectId?.client?.contact1Email || '-';
                      })() } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: isClientSupplied ? 'Client reference: ' : 'Site Name: ', bold: true }, { text: assessment?.projectId?.name || (isClientSupplied ? '-' : 'Unknown Site Name') } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  },
                  {
                    stack: [
                      { text: [ { text: 'Laboratory: ', bold: true }, { text: 'Lancaster & Dickenson Consulting Pty Ltd' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Address: ', bold: true }, { text: '4/6 Dacre Street, Mitchell ACT 2911' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Phone: ', bold: true }, { text: '(02) 6241 2779' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: 'enquiries@landd.com.au' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: function(i, node) {
                return (i === 0 || i === node.table.body.length) ? 1 : 0.5;
              },
              vLineWidth: function(i, node) {
                return (i === 0 || i === node.table.widths.length) ? 1 : 0.5;
              },
              hLineColor: function(i, node) {
                return 'gray';
              },
              vLineColor: function(i, node) {
                return 'gray';
              },
              paddingLeft: function(i, node) { return 4; },
              paddingRight: function(i, node) { return 4; },
              paddingTop: function(i, node) { return 2; },
              paddingBottom: function(i, node) { return 2; },
            },
            margin: [0, 0, 0, 10],
          },
          
          // Report Details in table
          {
            table: {
              headerRows: 1,
              widths: ['50%', '50%'],
              body: [
                [
                  { text: 'REPORT DETAILS', style: 'tableHeader', fillColor: '#f0f0f0', colSpan: 2 },
                  {}
                ],
                [
                  {
                    stack: [
                      { text: [ { text: 'L&D Job Reference: ', bold: true }, { text: assessment?.projectId?.projectID || '' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'No. of Samples: ', bold: true }, { text: sampleItems.length.toString() } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Analysed by: ', bold: true }, { text: analyst || 'Jordan Smith' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [
                        { text: 'Report Issue Date: ', bold: true },
                        {
                          text: issueDate ? formatDate(issueDate) : 'Pending authorisation',
                          color: issueDate ? 'black' : 'red',
                        },
                      ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  },
                  {
                    stack: [
                      { text: [ { text: 'Sampled by: ', bold: true }, { text: assessment?.LAA || (assessment?.assessorId?.firstName && assessment?.assessorId?.lastName ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : (isClientSupplied ? 'Client' : 'LAA')) } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Samples Received: ', bold: true }, { text: (() => {
                        // Use explicitly captured sample-receipt dates first:
                        // - assessment-linked L&D jobs: samplesReceivedDate from "Submit Samples to Lab"
                        // - client-supplied jobs: sampleReceiptDate from the job form
                        const preferredDate =
                          assessment?.samplesReceivedDate ||
                          assessment?.sampleReceiptDate ||
                          null;

                        if (preferredDate) {
                          const date = new Date(preferredDate);
                          return !isNaN(date.getTime()) ? formatDate(preferredDate) : 'Date invalid';
                        }

                        // Legacy fallback for older records where sample receipt date was not captured.
                        if (assessment?.projectId?.d_Date) {
                          const date = new Date(assessment.projectId.d_Date);
                          return !isNaN(date.getTime()) ? formatDate(assessment.projectId.d_Date) : 'Date invalid';
                        } else if (assessment?.projectId?.createdAt) {
                          const date = new Date(assessment.projectId.createdAt);
                          return !isNaN(date.getTime()) ? formatDate(assessment.projectId.createdAt) : 'Date invalid';
                        }

                        return formatDate(new Date());
                      })() } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: ' ', style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Report Approved by: ', bold: true }, { text: reportApprovedBy || 'Report not approved', color: reportApprovedBy ? 'black' : 'red' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: function(i, node) {
                return (i === 0 || i === node.table.body.length) ? 1 : 0.5;
              },
              vLineWidth: function(i, node) {
                return (i === 0 || i === node.table.widths.length) ? 1 : 0.5;
              },
              hLineColor: function(i, node) {
                return 'gray';
              },
              vLineColor: function(i, node) {
                return 'gray';
              },
              paddingLeft: function(i, node) { return 4; },
              paddingRight: function(i, node) { return 4; },
              paddingTop: function(i, node) { return 2; },
              paddingBottom: function(i, node) { return 2; },
            },
            margin: [0, 0, 0, 10],
          },
          
          // Test Specifications
          { text: 'TEST SPECIFICATIONS', style: 'tableHeader', margin: [0, 10, 0, 2], fontSize: 9 },
          { 
            text: 'Qualitative identification of Chrysotile, Amosite and Crocidolite asbestos fibre in bulk samples using Polarised Light Microscopy (PLM) and Dispersion Staining Techniques including Synthetic Mineral Fibre (SMF) and Organic Fibre as per Australian Standard 4964-2004 and methods identified in Section C of the Lancaster & Dickenson Consulting (L & D) Laboratory Manual.',
            margin: [0, 0, 0, 10],
            fontSize: 8,
          },
          
          // Notes
          { text: 'NOTES', style: 'tableHeader', margin: [0, 10, 0, 2] },
          {
            stack: (() => {
              // Check if any sampleItem has uncountableDueToDust set to true (handle both boolean and string)
              const hasUDDSample = sampleItems && sampleItems.some(item => 
                item.analysisData?.uncountableDueToDust === true || 
                item.analysisData?.uncountableDueToDust === 'true'
              );
              
              // Check if any sample has "Unidentified Mineral Fibre" in standard fibre analysis
              const hasUMFInFibres = sampleItems && sampleItems.some(item => {
                if (item.analysisData?.fibres && Array.isArray(item.analysisData.fibres)) {
                  return item.analysisData.fibres.some(fibre => 
                    fibre?.result === 'Unidentified Mineral Fibre'
                  );
                }
                return false;
              });
              
              // Check if any sample has "Unidentified Mineral Fibre" in trace analysis
              // (excluding cases where trace count is "< 5 unequivocal")
              const hasUMFInTrace = sampleItems && sampleItems.some(item => {
                const hasTraceAnalysis = 
                  item.analysisData?.traceAsbestos === "yes" && 
                  item.analysisData?.traceCount && 
                  item.analysisData?.traceAsbestosContent;
                
                if (hasTraceAnalysis) {
                  const isUMF = item.analysisData.traceAsbestosContent === 'Unidentified Mineral Fibre';
                  const isNotLessThan5 = item.analysisData.traceCount !== '< 5 unequivocal';
                  return isUMF && isNotLessThan5;
                }
                return false;
              });
                         
              // Notes for client-supplied reports
              const clientSuppliedNotes = [
                { text: '1. Asbestos in bulk materials requiring disintegration such as vinyl, resins, mastic and caulking can be difficult to detect using PLM and dispersion staining due to the low grade or small diameter of asbestos fibres present in the material. Where no asbestos is detected in such a sample, another, independent analytical technique should be considered.', style: 'notes' },
                { text: '2. This report must not be reproduced except in full.', style: 'notes' },
                { text: '3. The practical detection limit for identification of asbestos fibre using PLM and dispersion staining techniques is 0.01-0.1%, equivalent to 0.1-1g/kg.', style: 'notes' },
                { text: '4. Reported sample weights include the weight of the sample bag.', style: 'notes' },
                { text: '5. Fibres that cannot be unequivocally identified as one of the three asbestos forms, will be reported as Unknown Mineral Fibres (UMF). The fibres detected may or may not be asbestos fibres. To confirm the identities of these fibres, another independent analytical technique may be required.', style: 'notes' },
                { text: '6. The samples analysed covered by this report along with the site and sample descriptions were supplied by a third party. L&D makes no claim to the validity of these details', style: 'notes' },
                { text: '7. This report relates to samples provided by a third party and the results within apply to the samples as received.', style: 'notes' },
                { text: '8. Accredited for compliance with ISO/IEC 17025-Testing. Accreditation no: 19512.', style: 'notes' },
              ];

              // Notes for L&D-supplied reports
              const ldSuppliedNotes = [
                { text: '1. Asbestos in bulk materials requiring disintegration such as vinyl, resins, mastic and caulking can be difficult to detect using PLM and dispersion staining due to the low grade or small diameter of asbestos fibres present in the material. Where no asbestos is detected in such a sample, another, independent analytical technique should be considered.', style: 'notes' },
                { text: '2. This report must not be reproduced except in full.', style: 'notes' },
                { text: '3. The practical detection limit for identification of asbestos fibre using PLM and dispersion staining techniques is 0.01-0.1%, equivalent to 0.1-1g/kg.', style: 'notes' },
                { text: '4. Reported sample weights include the weight of the sample bag.', style: 'notes' },
                { text: '5. Fibres that cannot be unequivocally identified as one of the three asbestos forms, will be reported as Unknown Mineral Fibres (UMF). The fibres detected may or may not be asbestos fibres. To confirm the identities of these fibres, another independent analytical technique may be required.', style: 'notes' },
                { text: '6. The results of the testing relate only to the samples as supplied to the laboratory.', style: 'notes' },
                { text: '7. Accredited for compliance with ISO/IEC 17025-Testing. Accreditation no: 19512.', style: 'notes' },
              ];

              // Select notes based on report type
              const notes = isLDSupplied ? ldSuppliedNotes : clientSuppliedNotes;

              return notes;
            })(),
            margin: [0, 0, 0, 10],
          },
        ]
      },
      
      // Page 2 Content
      {
        pageBreak: 'before',
        stack: [
          // Header for page 2
          {
            columns: [
              { image: companyLogo, width: 150 },
              {
                stack: [
                  { text: 'Lancaster & Dickenson Consulting Pty Ltd', style: 'subheader' },
                  { text: '4/6 Dacre Street, Mitchell ACT 2911', style: 'subheader' },
                  { text: 'W: www.landd.com.au', style: 'subheader' },
                ],
                alignment: 'right',
              },
            ],
            margin: [0, 0, 0, 10],
          },
          
          // Green border beneath header - USING TABLE BORDER INSTEAD OF CANVAS
          {
            table: {
              body: [['']],
              widths: ['100%']
            },
            layout: {
              hLineWidth: function(i) { return i === 0 ? 2 : 0; }, // Only top border
              vLineWidth: function() { return 0; },
              hLineColor: function(i) { return i === 0 ? '#16b12b' : 'white'; }, // Only top border green
              vLineColor: function() { return 'white'; }
            },
            margin: [0, 0, 0, 12]
          },
          
          // Sample Analysis Table — centred content; shorter cells get equal top/bottom margin
          (function() {
            // Table column widths in percentage: ['16%', '11%', '11%', '19%', '11%', '13%', '19%']
            // A4 page width: 595pt, margins: 40pt each side = 515pt usable width
            const usablePageWidth = 515; // A4 width (595pt) - left margin (40pt) - right margin (40pt)
            const columnWidths = [0.16, 0.11, 0.11, 0.19, 0.11, 0.13, 0.19];
            const CELL_FONT_SIZE = 8;
            const CELL_VERTICAL_PADDING = 4;
            const CELL_HORIZONTAL_PADDING = 8; // layout paddingLeft + paddingRight
            const CELL_BORDER_WIDTH = 1; // 0.5pt left + 0.5pt right cell borders
            const WRAP_WIDTH_SAFETY_PT = 2; // pdfMake vs canvas measurement fudge
            const LINE_HEIGHT_PT = measurer.getLineHeightPt(CELL_FONT_SIZE, false);
            // Small gap between stacked fibre results (do not use empty text spacers —
            // pdfMake still allocates a full line box for those and hugely overspaces).
            const FIBRE_ITEM_GAP_PT = 2;
            const MIN_ROW_LINES = 2;

            const getColumnInnerWidthPt = (columnIndex) =>
              (columnWidths[columnIndex] * usablePageWidth)
              - CELL_HORIZONTAL_PADDING
              - CELL_BORDER_WIDTH
              - WRAP_WIDTH_SAFETY_PT;

            const estimateWrappedLines = (text, columnIndex, { bold = false } = {}) =>
              measurer.countLines(
                text,
                getColumnInnerWidthPt(columnIndex),
                CELL_FONT_SIZE,
                bold
              );

            const buildSampleCell = ({ text, bold = false }) => ({
              text,
              fontSize: CELL_FONT_SIZE,
              bold,
              alignment: 'center',
            });

            const countFibreStackLines = (items, columnIndex, bold = false) => {
              if (!items?.length) return 1;
              const textLines = items.reduce(
                (sum, item) => sum + estimateWrappedLines(item, columnIndex, { bold }),
                0
              );
              const gapLines = Math.max(0, items.length - 1) * (FIBRE_ITEM_GAP_PT / LINE_HEIGHT_PT);
              return Math.max(textLines + gapLines, 1);
            };

            const buildFibreStackCell = (items, bold = false) => {
              if (!items?.length) return buildSampleCell({ text: 'None', bold });
              if (items.length === 1) return buildSampleCell({ text: items[0], bold });

              return {
                stack: items.map((item, itemIndex) => ({
                  text: item,
                  fontSize: CELL_FONT_SIZE,
                  bold,
                  alignment: 'center',
                  margin: itemIndex < items.length - 1
                    ? [0, 0, 0, FIBRE_ITEM_GAP_PT]
                    : [0, 0, 0, 0],
                })),
              };
            };
            
            const tableRows = sortedSampleItems.map((item, index) => {
                  // Get analysis date with safety checks
                  let analysisDate = '';
                  if (item.analysisData?.analysedAt) {
                    const date = new Date(item.analysisData.analysedAt);
                    if (!isNaN(date.getTime())) {
                      analysisDate = formatDate(item.analysisData.analysedAt);
                    } else {
                      analysisDate = 'Date invalid';
                    }
                  } else {
                    analysisDate = formatDate(new Date());
                  }
                  
                  // Ensure analysisDate is never undefined or null
                  if (!analysisDate || analysisDate === 'undefined' || analysisDate === 'null') {
                    analysisDate = 'Date not specified';
                  }
                  
                  // Get sample mass from analysis data or use default
                  let sampleMass = '';
                  if (item.analysisData?.sampleMass) {
                    sampleMass = item.analysisData.sampleMass + ' g';
                  } else if (item.analysisData?.sampleDimensions) {
                    const dims = item.analysisData.sampleDimensions;
                    
                    if (dims.x && dims.y && dims.z && 
                        !isNaN(dims.x) && !isNaN(dims.y) && !isNaN(dims.z) &&
                        dims.x !== 'undefined' && dims.y !== 'undefined' && dims.z !== 'undefined') {
                      sampleMass = `${dims.x} × ${dims.y} × ${dims.z} mm`;
                    } else {
                      sampleMass = 'Dimensions not specified';
                    }
                  } else {
                    sampleMass = 'Not specified';
                  }
                  
                  // Extract fibre analysis results
                  const getFibreResults = (item) => {
                    
                    // First, process fibre analysis to get non-asbestos results
                    // This is needed even when trace analysis is present
                    let nonAsbestosResults = [];
                    let asbestosResultsFromFibres = [];
                    
                    if (item.analysisData?.fibres && Array.isArray(item.analysisData.fibres)) {
                      const fibres = item.analysisData.fibres;
                      
                      // Ensure fibres is an array and has valid items
                      if (Array.isArray(fibres) && fibres.length > 0) {
                        fibres.forEach((fibre, fibreIndex) => {
                          if (fibre && fibre.result && fibre.result.trim() !== '' && fibre.result !== 'undefined' && fibre.result !== 'null') {
                            const r = fibre.result.trim();
                            const isUMF = /^umf$/i.test(r) || /^unidentified\s+mineral\s+fibre$/i.test(r);
                            if (fibre.result.includes('Asbestos') || isUMF) {
                              asbestosResultsFromFibres.push(isUMF ? 'UMF' : fibre.result);
                            } else {
                              nonAsbestosResults.push(fibre.result);
                            }
                          }
                        });
                      }
                    }
                    
                    // Check if trace analysis is present and has results
                    const hasTraceAnalysis = 
                      item.analysisData?.traceAsbestos === "yes" && 
                      item.analysisData?.traceCount && 
                      item.analysisData?.traceAsbestosContent;
                    
                    // Determine asbestos result - trace analysis takes priority.
                    // Default only used if analysis data is missing (PDF generation is gated on all samples analysed).
                    let asbestosResult = '[Result not set]';
                    
                    if (item.analysisData?.finalResult) {
                      const finalResult = item.analysisData.finalResult;
                      
                      // Use finalResult if:
                      // 1. Trace analysis is present (hasTraceAnalysis)
                      // 2. Result is no-asbestos (from trace < 5 or "No fibres detected" checkbox); accept either casing for legacy data
                      // 3. Result contains "Trace" (trace analysis results)
                      const isNoAsbestos = /^no asbestos detected$/i.test(finalResult.trim());
                      if (hasTraceAnalysis || 
                          isNoAsbestos || 
                          finalResult.includes("Trace")) {
                        asbestosResult = isNoAsbestos ? "No Asbestos Detected" : finalResult;
                      } else if (asbestosResultsFromFibres.length > 0) {
                        // Fall back to fibre analysis results if no trace analysis
                        asbestosResult = asbestosResultsFromFibres;
                      }
                    } else if (asbestosResultsFromFibres.length > 0) {
                      // Use fibre analysis results if no finalResult
                      asbestosResult = asbestosResultsFromFibres;
                    }
                    // Non-asbestos fibres identified but no asbestos: report "No Asbestos Detected"
                    if (asbestosResult === '[Result not set]' && nonAsbestosResults.length > 0 && asbestosResultsFromFibres.length === 0) {
                      asbestosResult = 'No Asbestos Detected';
                    }
                    // No asbestos fibre types (Chrysotile, Amosite, Crocidolite, UMF): report "No Asbestos Detected" (covers no fibres at all, or only non-asbestos)
                    if (asbestosResult === '[Result not set]' && asbestosResultsFromFibres.length === 0) {
                      asbestosResult = 'No Asbestos Detected';
                    }
                    
                    const result = {
                      nonAsbestosItems: nonAsbestosResults.length > 0 ? nonAsbestosResults : ['None'],
                      asbestosItems: Array.isArray(asbestosResult)
                        ? asbestosResult
                        : [asbestosResult],
                    };
                    
                    // Ensure we never return undefined values
                    if (!result.nonAsbestosItems?.length) result.nonAsbestosItems = ['None'];
                    if (!result.asbestosItems?.length) result.asbestosItems = ['[Result not set]'];
                    
                    return result;
                  };
                  
                  const fibreResults = getFibreResults(item);
                  
                  // Ensure all values are safe strings to prevent NaN
                  const safeProjectID = (assessment?.projectId?.projectID && assessment.projectId.projectID !== 'undefined' && assessment.projectId.projectID !== 'null') ? assessment.projectId.projectID : 'Unknown';
                  // For client-supplied jobs, use clientReference for sample reference
                  // For LD supplied / assessment-linked jobs, use assessment item sample reference (e.g. LD-001), not lab ref
                  const safeSampleRef = (() => {
                    if (isClientSupplied) {
                      const ref = item.clientReference || item.labReference || item.sampleReference;
                      if (ref && ref !== 'undefined' && ref !== 'null') {
                        return ref;
                      }
                      return `Sample ${index + 1}`;
                    } else {
                      // Regular (LD supplied) jobs: show sample reference from assessment items (LD-XXX)
                      const ref = item.sampleReference || item.labReference || item.clientReference;
                      if (ref && ref !== 'undefined' && ref !== 'null') {
                        return ref;
                      }
                      return `Sample ${index + 1}`;
                    }
                  })();
                  const safeAnalysisDate = (analysisDate && analysisDate !== 'undefined' && analysisDate !== 'null') ? analysisDate : 'Unknown';
                  const safeDescription = (item.analysisData?.sampleDescription || item.locationDescription || item.clientReference) ? 
                    (item.analysisData?.sampleDescription || item.locationDescription || item.clientReference) : 'No description';
                  const safeSampleMass = (sampleMass && sampleMass !== 'undefined' && sampleMass !== 'null') ? sampleMass : 'Unknown';
                  const safeNonAsbestosItems = fibreResults.nonAsbestosItems;
                  const safeAsbestosItems = fibreResults.asbestosItems;
                  
                  // Check for any problematic values
                  const allValues = [safeProjectID, safeSampleRef, safeAnalysisDate, safeDescription, safeSampleMass, ...safeNonAsbestosItems, ...safeAsbestosItems];
                  allValues.forEach((value, i) => {
                    if (value === null || value === undefined || value === 'null' || value === 'undefined' || value === 'NaN' || value.includes('NaN')) {
                      console.error(`PROBLEMATIC VALUE FOUND at index ${i}:`, value);
                    }
                  });
                  
                  // L&D ID Reference format: {projectID}-Lab{x} where x starts at 1 and increments for each sample
                  const safeLabRef = `${safeProjectID}-Lab${index + 1}`;

                  const lineCounts = [
                    estimateWrappedLines(safeLabRef, 0),
                    estimateWrappedLines(safeSampleRef, 1),
                    estimateWrappedLines(safeAnalysisDate, 2),
                    estimateWrappedLines(safeDescription, 3),
                    estimateWrappedLines(safeSampleMass, 4),
                    countFibreStackLines(safeNonAsbestosItems, 5, false),
                    countFibreStackLines(safeAsbestosItems, 6, true),
                  ];
                  
                  return {
                    cells: [
                      buildSampleCell({ text: safeLabRef }),
                      buildSampleCell({ text: safeSampleRef }),
                      buildSampleCell({ text: safeAnalysisDate }),
                      buildSampleCell({ text: safeDescription }),
                      buildSampleCell({ text: safeSampleMass }),
                      buildFibreStackCell(safeNonAsbestosItems, false),
                      buildFibreStackCell(safeAsbestosItems, true),
                    ],
                    lineCounts,
                  };
                });

          const dataRows = tableRows.map((row) => {
            const maxLines = Math.max(...row.lineCounts, 1);
            const layoutLines = Math.max(maxLines, MIN_ROW_LINES);

            return row.cells.map((cell, cellIndex) => {
              const cellLines = row.lineCounts[cellIndex];
              const verticalMargin = Math.max(0, ((layoutLines - cellLines) * LINE_HEIGHT_PT) / 2);

              return {
                ...cell,
                // Symmetric top/bottom padding so shorter cells sit centred in the row
                margin: [0, verticalMargin, 0, verticalMargin],
              };
            });
          });

          const tableBody = [
            [
              { text: 'L&D ID Reference', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' },
              { text: 'Sample Reference', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' },
              { text: 'Analysis Date', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' },
              { text: 'Sample Description', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' },
              { text: 'Mass/Dimensions', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' },
              { text: 'Non-Asbestos Fibres', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' },
              { text: 'Reported Result', style: 'tableHeader', fontSize: CELL_FONT_SIZE, alignment: 'center' }
            ],
            ...dataRows
          ];

          const tableDefinition = {
            table: {
              headerRows: 1,
              widths: ['16%', '11%', '11%', '19%', '11%', '13%', '19%'],
              body: tableBody
            },
            layout: {
              hLineWidth: function(i, node) {
                return (i === 0 || i === node.table.body.length) ? 1 : 0.5;
              },
              vLineWidth: function(i, node) {
                return (i === 0 || i === node.table.widths.length) ? 1 : 0.5;
              },
              hLineColor: function(i, node) {
                return 'gray';
              },
              vLineColor: function(i, node) {
                return 'gray';
              },
              paddingLeft: function(i, node) { return 4; },
              paddingRight: function(i, node) { return 4; },
              paddingTop: function(i, node) { return CELL_VERTICAL_PADDING; },
              paddingBottom: function(i, node) { return CELL_VERTICAL_PADDING; },
              fillColor: function (rowIndex, node, columnIndex) {
                if (rowIndex === 0) return '#f0f0f0';
                return (rowIndex % 2 === 1) ? '#f9f9f9' : 'white';
              }
            }
          };
          
          
          return tableDefinition;
          })()
        ]
      }
    ];
    })(textMeasurer),
    
    footer: (function(nataLogo) {
      return function(currentPage, pageCount) {
        return buildLabReportFooter({
          reportReference,
          revision: assessment?.revision || 0,
          currentPage,
          pageCount,
          hasNataLogo: !!nataLogo,
          lineSpacing: 4,
          lineWidth: 2,
        });
      };
    })(nataLogo)
  };

  const pdfDoc = pdfMake.createPdf(docDefinition, undefined, undefined, {
    // Security options to prevent text selection/copying
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false
    }
  });
  
  // Handle opening in new tab if requested
  if (openInNewTab) {
    pdfDoc.open({}, undefined, filename);
  }
  
  // Handle returning PDF data if requested
  if (returnPdfData) {
    return new Promise((resolve) => {
      pdfDoc.getDataUrl((dataUrl) => {
        resolve(dataUrl);
      });
    });
  } else {
    // Only download if not opening in new tab and not returning data
    if (!openInNewTab) {
      pdfDoc.download(filename);
    }
  }
} 