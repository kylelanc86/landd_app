import pdfMake from "pdfmake/build/pdfmake";
import { formatDateInSydney } from '../utils/dateUtils';

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

  // Sort sample items by lab reference
  const sortedSampleItems = [...sampleItems].sort((a, b) => {
    return (a.labReference || '').localeCompare(b.labReference || '');
  });

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
    
    
    content: (function() {
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
                        return assessment?.projectId?.client?.contact1Name || 'Unknown Contact';
                      })() } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: (() => {
                        if (isClientSupplied) {
                          // For client-supplied: project contact email, then client invoiceEmail, then client contact1Email, then "-"
                          return assessment?.projectId?.projectContact?.email || assessment?.projectId?.client?.invoiceEmail || assessment?.projectId?.client?.contact1Email || '-';
                        }
                        return assessment?.projectId?.client?.contact1Email || 'Unknown Email';
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
                      { text: [ { text: 'Report Issue Date: ', bold: true }, { text: formatDate(new Date()) } ], style: 'tableContent', margin: [0, 0, 0, 2] }, // Always use PDF generation date
                    ]
                  },
                  {
                    stack: [
                      { text: [ { text: 'Sampled by: ', bold: true }, { text: isClientSupplied ? 'Client' : (assessment?.LAA || (assessment?.assessorId?.firstName && assessment?.assessorId?.lastName ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : 'LAA')) } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Samples Received: ', bold: true }, { text: (() => {
                        // For client supplied jobs, use sampleReceiptDate first
                        if (isClientSupplied && assessment?.sampleReceiptDate) {
                          const date = new Date(assessment.sampleReceiptDate);
                          return !isNaN(date.getTime()) ? formatDate(assessment.sampleReceiptDate) : 'Date invalid';
                        }
                        // For regular jobs, use project dates
                        if (assessment?.projectId?.d_Date) {
                          const date = new Date(assessment.projectId.d_Date);
                          return !isNaN(date.getTime()) ? formatDate(assessment.projectId.d_Date) : 'Date invalid';
                        } else if (assessment?.projectId?.createdAt) {
                          const date = new Date(assessment.projectId.createdAt);
                          return !isNaN(date.getTime()) ? formatDate(assessment.projectId.createdAt) : 'Date invalid';
                        } else {
                          return formatDate(new Date());
                        }
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
          
          // Sample Analysis Table with fixed row heights
          // Build all rows first to calculate max lines per row
          (function() {
            // Table column widths in percentage: ['16%', '16.8%', '11%', '17.2%', '10.8%', '12.75%', '15.45%']
            // A4 page width: 595pt, margins: 40pt each side = 515pt usable width
            const usablePageWidth = 515; // A4 width (595pt) - left margin (40pt) - right margin (40pt)
            const columnWidths = [0.16, 0.168, 0.11, 0.172, 0.108, 0.1275, 0.1545];
            
            // Helper function to estimate how many lines text will wrap to
            // Based on column width, font size, and text length
            const estimateWrappedLines = (text, columnIndex) => {
              if (!text || typeof text !== 'string') {
                return 1;
              }
              
              // First check for explicit line breaks (\n\n)
              const explicitLines = text.split('\n\n').length;
              
              // Estimate character width: for 8pt font, actual rendered width varies
              // Using 0.8pt as a conservative estimate to better detect wrapping
              // This accounts for:
              // - Variable character widths (M, W are wider than i, l)
              // - Word spacing
              // - Font metrics (actual width may be larger than font size)
              // - Padding and cell constraints
              const avgCharWidth = 0.8;
              
              // Calculate column width in points
              const columnWidthPt = columnWidths[columnIndex] * usablePageWidth;
              
              // Estimate characters per line
              // Use 80% of available width to account for:
              // - Word boundaries (can't break in middle of words)
              // - Variable character widths (some chars wider than average)
              // - Padding and spacing
              // - Font rendering differences
              const charsPerLine = Math.floor(columnWidthPt / avgCharWidth * 0.8);
              
              // Calculate wrapped lines by splitting text into words and fitting them
              // This is more accurate than just dividing by charsPerLine
              const words = text.split(/\s+/);
              let currentLineLength = 0;
              let wrappedLines = 1;
              
              words.forEach(word => {
                const wordLength = word.length;
                // If adding this word would exceed the line, start a new line
                if (currentLineLength > 0 && currentLineLength + wordLength + 1 > charsPerLine) {
                  wrappedLines++;
                  currentLineLength = wordLength;
                } else {
                  currentLineLength += (currentLineLength > 0 ? 1 : 0) + wordLength; // +1 for space
                }
              });
              
              // Use the maximum of explicit lines or wrapped lines
              const totalLines = Math.max(explicitLines, wrappedLines, 1);
              
              return totalLines;
            };
            
            // Helper function to calculate content height based on number of lines
            const calculateContentHeight = (lines) => {
              // Font size: 8pt, line height: ~1.2x = 9.6pt per line
              // Add spacing between multiple lines
              const lineHeight = 9.6;
              const extraSpacing = (lines - 1) * 2; // Extra spacing between multiple lines
              const height = (lines * lineHeight) + extraSpacing;
              return height;
            };
            
            // Helper function to calculate row height (includes padding)
            const calculateRowHeight = (maxLines) => {
              // Font size: 8pt, line height: ~1.2x = 9.6pt per line
              // Padding: 8pt top + 8pt bottom = 16pt total (from layout functions)
              // Add spacing between multiple lines
              const lineHeight = 9.6;
              const padding = 16; // 8pt top + 8pt bottom
              const extraSpacing = (maxLines - 1) * 2;
              const height = (maxLines * lineHeight) + padding + extraSpacing;
              return height;
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
                    
                    // Determine asbestos result - trace analysis takes priority
                    let asbestosResult = 'No Asbestos Detected';
                    
                    if (item.analysisData?.finalResult) {
                      const finalResult = item.analysisData.finalResult;
                      
                      // Use finalResult if:
                      // 1. Trace analysis is present (hasTraceAnalysis)
                      // 2. Result is "No asbestos detected" (from trace < 5 or "No fibres detected" checkbox)
                      // 3. Result contains "Trace" (trace analysis results)
                      if (hasTraceAnalysis || 
                          finalResult === "No asbestos detected" || 
                          finalResult.includes("Trace")) {
                        asbestosResult = finalResult;
                      } else if (asbestosResultsFromFibres.length > 0) {
                        // Fall back to fibre analysis results if no trace analysis
                        asbestosResult = asbestosResultsFromFibres.join('\n\n');
                      }
                    } else if (asbestosResultsFromFibres.length > 0) {
                      // Use fibre analysis results if no finalResult
                      asbestosResult = asbestosResultsFromFibres.join('\n\n');
                    }
                    
                    const result = {
                      nonAsbestos: nonAsbestosResults.length > 0 ? nonAsbestosResults.join('\n\n') : 'None',
                      asbestos: asbestosResult
                    };
                    
                    // Ensure we never return undefined values
                    if (!result.nonAsbestos) result.nonAsbestos = 'None';
                    if (!result.asbestos) result.asbestos = 'No Asbestos Detected';
                    
                    return result;
                  };
                  
                  const fibreResults = getFibreResults(item);
                  
                  // Ensure all values are safe strings to prevent NaN
                  const safeProjectID = (assessment?.projectId?.projectID && assessment.projectId.projectID !== 'undefined' && assessment.projectId.projectID !== 'null') ? assessment.projectId.projectID : 'Unknown';
                  // For client-supplied jobs, use clientReference for sample reference
                  // For regular jobs, use labReference or sampleReference
                  const safeSampleRef = (() => {
                    if (isClientSupplied) {
                      // Client-supplied: prioritize clientReference
                      const ref = item.clientReference || item.labReference || item.sampleReference;
                      if (ref && ref !== 'undefined' && ref !== 'null') {
                        return ref;
                      }
                      return `Sample ${index + 1}`;
                    } else {
                      // Regular jobs: use existing logic
                      const ref = item.labReference || item.clientReference || item.sampleReference;
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
                  const safeNonAsbestos = (fibreResults.nonAsbestos && fibreResults.nonAsbestos !== 'undefined' && fibreResults.nonAsbestos !== 'null') ? fibreResults.nonAsbestos : 'None';
                  const safeAsbestos = (fibreResults.asbestos && fibreResults.asbestos !== 'undefined' && fibreResults.asbestos !== 'null') ? fibreResults.asbestos : 'No asbestos detected';
                  
                  // Check for any problematic values
                  const allValues = [safeProjectID, safeSampleRef, safeAnalysisDate, safeDescription, safeSampleMass, safeNonAsbestos, safeAsbestos];
                  allValues.forEach((value, i) => {
                    if (value === null || value === undefined || value === 'null' || value === 'undefined' || value === 'NaN' || value.includes('NaN')) {
                      console.error(`PROBLEMATIC VALUE FOUND at index ${i}:`, value);
                    }
                  });
                  
                  // L&D ID Reference format: {projectID}-Lab{x} where x starts at 1 and increments for each sample
                  const safeLabRef = `${safeProjectID}-Lab${index + 1}`;
                  
                  // Return row data with text values for line counting
                  // Note: valign is not supported by pdfMake, we'll use margins instead
                  return {
                    cells: [
                      { text: safeLabRef, fontSize: 8, alignment: 'left' },
                      { text: safeSampleRef, fontSize: 8, alignment: 'left' },
                      { text: safeAnalysisDate, fontSize: 8, alignment: 'left' },
                      { text: safeDescription, fontSize: 8, alignment: 'left' },
                      { text: safeSampleMass, fontSize: 8, alignment: 'left' },
                      { text: safeNonAsbestos, fontSize: 8, alignment: 'left' },
                      { text: safeAsbestos, fontSize: 8, bold: true, alignment: 'left' }
                    ],
                    // Store text values for line counting
                    textValues: [safeLabRef, safeSampleRef, safeAnalysisDate, safeDescription, safeSampleMass, safeNonAsbestos, safeAsbestos]
                  };
                });
          
          // Calculate max lines for each row and apply margins for vertical centering
          const rowsWithMargins = tableRows.map((row, rowIndex) => {
            // Find the maximum number of lines in this row, estimating wrapping for each column
            const lineCounts = row.textValues.map((text, colIndex) => estimateWrappedLines(text, colIndex));
            const maxLines = Math.max(...lineCounts);
            const rowHeight = calculateRowHeight(maxLines);
            
            // Apply margins to all cells in this row for vertical centering
            // pdfMake doesn't support valign, so we use margins to center content
            const cellsWithMargins = row.cells.map((cell, cellIndex) => {
              const cellLines = lineCounts[cellIndex];
              const contentHeight = calculateContentHeight(cellLines);
              
              // Calculate margin needed to center: (rowHeight - contentHeight) / 2
              // The rowHeight already includes padding, so we need to account for that
              // The layout padding functions return 8 (which pdfMake treats as points)
              // So padding is 8pt top + 8pt bottom = 16pt total
              const paddingTop = 8; // From layout: paddingTop returns 8
              const paddingBottom = 8; // From layout: paddingBottom returns 8
              const availableHeight = rowHeight - paddingTop - paddingBottom;
              const marginNeeded = (availableHeight - contentHeight) / 2;
              
              // Ensure margin is at least 0
              const topMargin = Math.max(0, marginNeeded);
              const bottomMargin = Math.max(0, marginNeeded);
              
              // Apply margins directly to the cell
              // pdfMake should support margins on table cells
              const cellWithMargins = {
                text: cell.text,
                fontSize: cell.fontSize || 8,
                bold: cell.bold || false,
                alignment: cell.alignment || 'left',
                margin: [0, topMargin, 0, bottomMargin] // [left, top, right, bottom] in points
              };
              
              return cellWithMargins;
            });
            
            return cellsWithMargins;
          });
          
          // Build the final table body with header row + data rows
          // Header row doesn't need margins since it's typically single-line
          const tableBody = [
            [
              { text: 'L&D ID Reference', style: 'tableHeader', fontSize: 8, alignment: 'left' },
              { text: 'Sample Reference', style: 'tableHeader', fontSize: 8, alignment: 'left' },
              { text: 'Analysis Date', style: 'tableHeader', fontSize: 8, alignment: 'left' },
              { text: 'Sample Description', style: 'tableHeader', fontSize: 8, alignment: 'left' },
              { text: 'Mass/Dimensions', style: 'tableHeader', fontSize: 8, alignment: 'left' },
              { text: 'Non-Asbestos Fibres', style: 'tableHeader', fontSize: 8, alignment: 'left' },
              { text: 'Reported Result', style: 'tableHeader', fontSize: 8, alignment: 'left' }
            ],
            ...rowsWithMargins
          ];
          
          
          // Sample Analysis Table with fixed row heights
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
              paddingTop: function(i, node) { 
                // Equal padding top and bottom for all cells to ensure vertical centering
                return 8; 
              },
              paddingBottom: function(i, node) { 
                // Equal padding top and bottom for all cells to ensure vertical centering
                return 8; 
              },
              fillColor: function (rowIndex, node, columnIndex) {
                return (rowIndex % 2 === 0) ? '#f9f9f9' : 'white';
              }
            }
          };
          
          
          return tableDefinition;
          })()
        ]
      }
    ];
    })(),
    
    footer: (function(nataLogo) {
      return function(currentPage, pageCount) {
        return {
          stack: [
            // Green border above footer
            {
              canvas: [
                { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#16b12b' }
              ],
              margin: [0, 0, 0, 8]
            },
            {
              columns: [
                {
                  stack: [
                    { text: `Report Reference: ${assessment?.projectId?.projectID}`, fontSize: 8 },
                    { text: `Revision: ${assessment?.revision || 0}`, fontSize: 8 }
                  ],
                  alignment: 'left',
                  width: '30%'
                },
                {
                  stack: nataLogo ? [ { image: 'nataLogo', fit: [180, 54], alignment: 'center' } ] : [],
                  alignment: 'center',
                  width: '40%'
                },
                {
                  stack: [
                    { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8 }
                  ],
                  alignment: 'right',
                  width: '30%'
                }
              ]
            }
          ],
          margin: [40, 10, 40, 0]
        };
      };
    })(nataLogo)
  };

  // Build filename: ProjectID: Fibre ID Report - ProjectName (SampleDate).pdf
  const projectID = assessment?.projectId?.projectID || '';
  const projectNameRaw = assessment?.projectId?.name || '';
  // Sanitize project name for filename (remove/replace unsafe characters)
  const projectName = projectNameRaw.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  
  // Get sample date - try to use reportIssueDate first, then first sample's analysedAt, or current date
  let sampleDate = '';
  if (reportIssueDate) {
    const date = new Date(reportIssueDate);
    sampleDate = !isNaN(date.getTime()) ? formatDate(reportIssueDate) : formatDate(new Date());
  } else if (sampleItems && sampleItems.length > 0 && sampleItems[0].analysisData?.analysedAt) {
    const date = new Date(sampleItems[0].analysisData.analysedAt);
    sampleDate = !isNaN(date.getTime()) ? formatDate(sampleItems[0].analysisData.analysedAt) : formatDate(new Date());
  } else {
    sampleDate = formatDate(new Date());
  }
  
  const filename = `${projectID}: Fibre ID Report - ${projectName} (${sampleDate}).pdf`;

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