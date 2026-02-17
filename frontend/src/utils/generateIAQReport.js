import pdfMake from "pdfmake/build/pdfmake";
import api from '../services/api';

// Helper to format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

// Helper to format date as YYYYMMDD for filenames
function formatDateForFilename(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper to format time as HH:mm
function formatTime(timeStr) {
  if (!timeStr) return '';
  // Remove seconds if present
  return timeStr.split(':').slice(0, 2).join(':');
}

// Helper to extract number from sample ID
function getSampleNumber(sampleID) {
  if (!sampleID) return 0;
  const match = sampleID.match(/AM(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper to load image as base64
async function loadImageAsBase64(imagePath) {
  try {
    let response;
    
    // Check if this is an API call (needs authentication) or a static asset
    if (imagePath.startsWith('/api/')) {
      // For API calls, use the existing API instance to get proper authentication
      // Remove the /api prefix since the API instance already has it in baseURL
      const apiPath = imagePath.substring(4); // Remove '/api' from the beginning
      response = await api.get(apiPath, { responseType: 'blob' });
    } else {
      // For static assets (logos), use fetch with frontend URL
      const baseUrl = process.env.NODE_ENV === 'development' ? "http://localhost:3000" : window.location.origin;
      const fullUrl = imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`;
      
      response = await fetch(fullUrl);
    }
    
    if (!response.ok && !response.status) {
      console.error(`Failed to fetch ${imagePath}:`, response.status, response.statusText);
      return null;
    }
    
    // Handle blob from either fetch or axios
    const blob = response.data || await response.blob();
    
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

// Helper function to format reported concentration
const formatReportedConcentration = (sample) => {
  if (!sample.analysis) return '-';
  
  // Check for uncountable due to dust first (handle both boolean true and string "true")
  if (sample.analysis.uncountableDueToDust === true || sample.analysis.uncountableDueToDust === 'true') {
    return 'UDD';
  }
  
  // If sample is uncountable
  if (sample.analysis.edgesDistribution === 'fail' || sample.analysis.backgroundDust === 'fail') {
    return { text: 'Uncountable', color: 'red' };
  }
  
  // If it's a field blank
  if (sample.location === 'Field blank' || sample.isFieldBlank) {
    return '-';
  }
  
  // Get the reported concentration
  const reportedConc = sample.analysis.reportedConcentration;
  if (!reportedConc) return '-';
  
  // If it's already a string (like "<0.01"), return it as is
  if (typeof reportedConc === 'string' && reportedConc.startsWith('<')) {
    return reportedConc;
  }
  
  // If it's a number, format it to 2 decimal places
  if (typeof reportedConc === 'number') {
    return reportedConc.toFixed(2);
  }
  
  // If it's a string that represents a number, parse it and format to 2 decimal places
  if (typeof reportedConc === 'string') {
    const numValue = parseFloat(reportedConc);
    if (!isNaN(numValue)) {
      return numValue.toFixed(2);
    }
  }
  
  return reportedConc;
};

// Generate IAQ Reference
function generateIAQReference(record, allRecords) {
  if (!record || !allRecords) return '';
  
  const dateObj = new Date(record.monitoringDate);
  const month = dateObj.toLocaleString("default", { month: "short" });
  const year = dateObj.getFullYear();
  const monthYear = `${month} ${year}`;

  // Find all records for the same month-year, sorted by creation time
  const sameMonthYearRecords = allRecords
    .filter((r) => {
      const recordDate = new Date(r.monitoringDate);
      return (
        recordDate.getMonth() === dateObj.getMonth() &&
        recordDate.getFullYear() === dateObj.getFullYear()
      );
    })
    .sort((a, b) => {
      // Sort by creation time to maintain order
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  // Find the position of the current record (1-indexed)
  const reportNumber =
    sameMonthYearRecords.findIndex(
      (r) => (r._id || r.id) === (record._id || record.id)
    ) + 1;

  return `IAQ ${monthYear} - ${reportNumber}`;
}

export async function generateIAQReport({ record, allRecords, samples, openInNewTab = false, returnPdfData = false, reportApprovedBy = null, reportIssueDate = null }) {
  // Determine base URL for fonts
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
  const companyLogo = await loadImageAsBase64('/logo.png');
  const nataLogo = await loadImageAsBase64('/NATA_logo.png');

  // Sort samples
  const sortedSamples = [...samples].sort((a, b) => {
    const aNum = getSampleNumber(a.fullSampleID);
    const bNum = getSampleNumber(b.fullSampleID);
    return aNum - bNum;
  });

  // Get unique samplers
  const uniqueSamplers = Array.from(new Set(samples.map(s => {
    if (s.collectedBy && typeof s.collectedBy === 'object') {
      return (s.collectedBy.firstName || '') + (s.collectedBy.lastName ? ' ' + s.collectedBy.lastName : '');
    }
    return s.collectedBy || '';
  }).filter(Boolean)));

  // Get analyst name
  let analystName = 'N/A';
  if (record.analysedBy) {
    if (typeof record.analysedBy === 'object') {
      analystName = `${record.analysedBy.firstName || ''} ${record.analysedBy.lastName || ''}`.trim();
    }
  } else if (samples.length > 0 && samples[0].analysedBy) {
    const firstAnalysedBy = samples[0].analysedBy;
    if (typeof firstAnalysedBy === 'object') {
      analystName = `${firstAnalysedBy.firstName || ''} ${firstAnalysedBy.lastName || ''}`.trim();
    }
  }

  // Get IAQ reference
  const iaqReference = generateIAQReference(record, allRecords);

  // Document definition
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 120, 40, 90],
    defaultStyle: {
      font: 'Gothic'
    },
    images: {
      ...(nataLogo ? { nataLogo: nataLogo } : {}),
      ...(companyLogo ? { companyLogo: companyLogo } : {})
    },
    // Header function for all pages
    header: companyLogo ? function(currentPage, pageCount) {
      return {
        stack: [
          {
            columns: [
              { image: 'companyLogo', width: 165 },
              {
                stack: [
                  { 
                    text: 'Lancaster & Dickenson Consulting Pty Ltd', 
                    fontSize: 9,
                    margin: [0, 1, 0, 1],
                    color: "black",
                    lineHeight: 1.5
                  },
                  { 
                    text: '4/6 Dacre Street, Mitchell ACT 2911', 
                    fontSize: 9,
                    margin: [0, 1, 0, 1],
                    color: "black",
                    lineHeight: 1.5
                  },
                  { 
                    text: 'W: www.landd.com.au', 
                    fontSize: 9,
                    margin: [0, 1, 0, 1],
                    color: "black",
                    lineHeight: 1.5
                  },
                ],
                alignment: 'right',
              },
            ],
            margin: [0, 0, 0, 4],
          },
          {
            canvas: [
              {
                type: 'line',
                x1: 0, y1: 0, x2: 520, y2: 0,
                lineWidth: 1.5,
                lineColor: '#16b12b'
              }
            ],
            margin: [0, 0, 0, 10]
          }
        ],
        margin: [40, 30, 40, 0]
      };
    } : undefined,
    styles: {
      header: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 1],
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
      },
    },
    content: [
      // Page 1 Content
      {
        stack: [
          // Report title
          { text: 'AIRBORNE ASBESTOS FIBRE ESTIMATION TEST REPORT', style: 'header', margin: [0, -10, 0, 10], alignment: 'center' },
          
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
                      { text: [ { text: 'Client Name: ', bold: true }, { text: 'Lancaster & Dickenson Consulting Pty Ltd' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Client Contact: ', bold: true }, { text: 'N/A' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: 'laboratory@landd.com.au' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Site Name: ', bold: true }, { text: 'L&D Laboratory - Mitchell' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  },
                  {
                    stack: [
                      { text: [ { text: 'Address: ', bold: true }, { text: '4/6 Dacre Street, Mitchell ACT 2911' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: 'laboratory@landd.com.au' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Lab Manager: ', bold: true }, { text: 'Jordan Smith' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
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
              widths: ['100%'],
              body: [
                [
                  { text: 'REPORT DETAILS', style: 'tableHeader', fillColor: '#f0f0f0' }
                ],
                [
                  {
                    text: [{ text: 'L&D Reference: ', bold: true }, { text: iaqReference || 'N/A' }],
                    style: 'tableContent',
                    margin: [0, 0, 0, 2],
                  }
                ],
                [
                  {
                    text: [
                      { text: 'Description of Works: ', bold: true },
                      {
                        text: 'Indoor Air Quality Monitoring within Laboratory',
                      },
                    ],
                    style: 'tableContent',
                    margin: [0, 0, 0, 2],
                  },
                ],
                [
                  {
                    columns: [
                      {
                        text: [ { text: 'Sampled by: ', bold: true }, { text: uniqueSamplers.join(', ') || 'N/A' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Sample Date: ', bold: true }, { text: record.monitoringDate ? formatDate(record.monitoringDate) : 'N/A' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      }
                    ]
                  }
                ],
                [
                  {
                    columns: [
                      {
                        text: [ { text: 'Analysed by: ', bold: true }, { text: analystName } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Analysis Date: ', bold: true }, { text: record.updatedAt ? formatDate(record.updatedAt) : 'N/A' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                    ]
                  }
                ],
                [
                  {
                    columns: [
                      {
                        text: [ 
                          { text: 'Report Authorised by: ', bold: true }, 
                          { 
                            text: reportApprovedBy || 'Pending authorization',
                            color: (!reportApprovedBy) ? 'red' : 'black'
                          } 
                        ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Report Issue Date: ', bold: true }, { text: reportIssueDate ? formatDate(reportIssueDate) : formatDate(new Date()) } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      }
                    ]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: function(i, node) {
                return (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0;
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
          
          // Test Specifications and Notes in bordered table
          {
            table: {
              headerRows: 0,
              widths: ['100%'],
              body: [
                [
                  {
                    stack: [
                      {
                        text: 'Test Specifications',
                        style: 'header',
                        margin: [0, 0, 0, 3],
                        fontSize: 9
                      },
                      {
                        text: 'NOHSC: Guidance Note on the Membrane Filter Method for Estimating Airborne Asbestos Fibres [NOHSC: 3003 (2005)] and methods identified in Section B of the L & D Laboratory Manual',
                        margin: [0, 0, 0, 5],
                        fontSize: 8,
                      },
                      {
                        text: 'Notes',
                        style: 'header',
                        margin: [0, 10, 0, 3],
                        fontSize: 9,
                      },
                      {
                        stack: (() => {
                          // Check if any sample has uncountableDueToDust set to true
                          const hasUDDSample = samples && samples.some(sample => 
                            sample.analysis?.uncountableDueToDust === true || 
                            sample.analysis?.uncountableDueToDust === 'true'
                          );
                          
                          const notes = [
                            { text: '1. The NOHSC: 3003 (2005) recommended Control Level for all forms of asbestos is 0.01 fibres/mL', style: 'notes' },
                            { text: '2. AFC = air fibre concentration (fibres/ml)', style: 'notes' },
                            { text: '3. The results of the testing relate only to the samples as supplied to the laboratory.', style: 'notes' },
                            { text: '4. Accredited for compliance with ISO/IEC 17025 – Testing. Accreditation no: 19512', style: 'notes' },
                          ];

                          if (hasUDDSample) {
                            notes.push({ text: '* UDD = sample was uncountable due to heavy dust loading', style: 'notes' });
                          }
                          return notes;
                        })(),
                        margin: [0, 0, 0, 3],
                      }
                    ]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: function(i, node) {
                return 1;
              },
              vLineWidth: function(i, node) {
                return 1;
              },
              hLineColor: function(i, node) {
                return 'gray';
              },
              vLineColor: function(i, node) {
                return 'gray';
              },
              paddingLeft: function(i, node) { return 8; },
              paddingRight: function(i, node) { return 8; },
              paddingTop: function(i, node) { return 8; },
              paddingBottom: function(i, node) { return 8; },
            },
            margin: [0, 0, 0, 10],
          },
          
          // Sample Results Table
          {
            table: {
              headerRows: 1,
              dontBreakRows: true,
              widths: ['19%', '32%', '7%', '7%', '9%', '7%', '7%', '12%'],
              body: [
                [
                  { text: 'L&D Sample Ref', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Sample Location', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Time On', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Time Off', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Ave flow (L/min)', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Field Count', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Fibre Count', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                  { text: 'Reported AFC', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' }
                ],
                ...sortedSamples.map(sample => {
                  const uncountableDueToDust = sample.analysis?.uncountableDueToDust === true || sample.analysis?.uncountableDueToDust === 'true';
                  const isFailed = sample.status === "failed";
                  
                  // Format sample ID with IAQ reference
                  const sampleID = sample.fullSampleID || sample.sampleNumber || 'N/A';
                  const displaySampleID = iaqReference ? `${iaqReference} - ${sampleID}` : sampleID;
                  
                  return [
                    { text: displaySampleID, style: 'tableContent' },
                    { text: sample.location || 'N/A', style: 'tableContent' },
                    { text: sample.startTime ? formatTime(sample.startTime) : '-', style: 'tableContent' },
                    { text: sample.endTime ? formatTime(sample.endTime) : '-', style: 'tableContent' },
                    { 
                      text: isFailed 
                        ? [{ text: 'Failed', color: 'red', bold: true }]
                        : (sample.averageFlowrate ? sample.averageFlowrate.toFixed(1) : '-'), 
                      style: 'tableContent'
                    },
                    { text: isFailed ? '-' : (uncountableDueToDust ? '-' : ((sample.analysis?.fieldsCounted !== undefined && sample.analysis?.fieldsCounted !== null) ? sample.analysis.fieldsCounted : 'N/A')), style: 'tableContent' },
                    { text: isFailed ? '-' : (uncountableDueToDust ? '-' : ((sample.analysis?.fibresCounted !== undefined && sample.analysis?.fibresCounted !== null) ? sample.analysis.fibresCounted : 'N/A')), style: 'tableContent' },
                    { 
                      text: formatReportedConcentration(sample),
                      style: 'tableContent',
                      ...(typeof formatReportedConcentration(sample) === 'object' && formatReportedConcentration(sample).color ? { color: formatReportedConcentration(sample).color } : {})
                    }
                  ];
                })
              ]
            },
            layout: {
              hLineWidth: function(i, node) {
                return 1;
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
              paddingTop: function(i, node) { return 4; },
              paddingBottom: function(i, node) { return 4; },
            },
            margin: [0, 0, 0, 2]
          },
        ]
      },
    ],
    footer: (function(nataLogo, record, sortedSamples, companyLogo) {
      return function(currentPage, pageCount) {
        const footerBlocks = [];
        footerBlocks.push({
            canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#16b12b' }
          ],
          margin: [0, 0, 0, 8]
        });
        footerBlocks.push({
            columns: [
              {
                stack: [
                  { text: `Report Reference: ${generateIAQReference(record, [record]) || ''}`, fontSize: 8 }
                ],
                alignment: 'left',
              width: '30%',
              },
              {
              stack: nataLogo ? [ { image: nataLogo, fit: [180, 54], alignment: 'center' } ] : [],
                alignment: 'center',
              width: '40%'
              },
              {
                stack: [
                  { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8 }
                ],
                alignment: 'right',
              width: '30%',
            }
          ]
        });

        return {
          stack: footerBlocks,
        margin: [40, 10, 40, 0]
      };
      };
    })(nataLogo, record, sortedSamples, companyLogo)
  };

  // Build filename
  const iaqRef = generateIAQReference(record, allRecords || [record]);
  const monitoringDate = record.monitoringDate ? formatDateForFilename(record.monitoringDate) : '';
  const filename = `IAQ Report - ${iaqRef}${monitoringDate ? ` (${monitoringDate})` : ''}.pdf`;

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
  
  if (returnPdfData) {
    return new Promise((resolve) => {
      pdfDoc.getDataUrl((dataUrl) => {
        resolve(dataUrl);
      });
    });
  } else {
    if (openInNewTab) {
      pdfDoc.open({}, undefined, filename);
    } else {
      pdfDoc.download(filename);
    }
  }
}
