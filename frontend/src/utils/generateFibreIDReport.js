import pdfMake from "pdfmake/build/pdfmake";

// Helper to format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

// Helper to load image as base64
async function loadImageAsBase64(imagePath) {
  try {
    console.log(`Attempting to load image: ${imagePath}`);
    const response = await fetch(imagePath);
    console.log(`Response status for ${imagePath}:`, response.status);
    
    if (!response.ok) {
      console.error(`Failed to fetch ${imagePath}:`, response.status, response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    console.log(`Blob size for ${imagePath}:`, blob.size);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log(`Successfully loaded ${imagePath} as base64`);
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

export async function generateFibreIDReport({ job, sampleItems, openInNewTab, returnPdfData = false }) {

  // Determine base URL for fonts - use window.location for reliable detection
  console.log('Fibre ID - Window location:', {
    hostname: window.location.hostname,
    href: window.location.href,
    origin: window.location.origin
  });
  
  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : 'https://app.landd.com.au';
  
  console.log('Fibre ID - Font base URL:', baseUrl);

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

  console.log('Logo loading results:');
  console.log('Company logo loaded:', !!companyLogo);
  console.log('NATA logo loaded:', !!nataLogo);

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
      },
    },
    content: [
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
          
          // Green border beneath header
          {
            canvas: [
              {
                type: 'line',
                x1: 0, y1: 0, x2: 520, y2: 0,
                lineWidth: 2,
                lineColor: '#16b12b'
              }
            ],
            margin: [0, 0, 0, 20]
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
                      { text: [ { text: 'Client: ', bold: true }, { text: job?.projectId?.client?.name || 'Unknown Client' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Contact: ', bold: true }, { text: job?.projectId?.client?.contact1Name || 'Unknown Contact' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: job?.projectId?.client?.contact1Email || 'Unknown Email' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Address: ', bold: true }, { text: job?.projectId?.client?.address || 'Unknown Address' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
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
                  { text: 'REPORT DETAILS', style: 'tableHeader', fillColor: '#f0f0f0' },
                  { text: '', style: 'tableHeader', fillColor: '#f0f0f0' }
                ],
                [
                  {
                    stack: [
                      { text: [ { text: 'L&D Job Reference: ', bold: true }, { text: job?.projectId?.projectID || job?.jobNumber || '' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'No. of Samples: ', bold: true }, { text: sampleItems.length.toString() } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Sampled by: ', bold: true }, { text: job?.assessorName || job?.assessorId?.firstName ? `${job.assessorId.firstName} ${job.assessorId.lastName}` : 'LAA' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Samples Received: ', bold: true }, { text: job?.projectId?.d_Date ? formatDate(job.projectId.d_Date) : (job?.projectId?.createdAt ? formatDate(job.projectId.createdAt) : formatDate(new Date())) } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  },
                  {
                    stack: [
                      { text: [ { text: 'Analysed by: ', bold: true }, { text: job?.analyst || 'Jordan Smith' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Report approved by: ', bold: true }, { text: 'Jordan Smith' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Report Issue Date: ', bold: true }, { text: formatDate(new Date()) } ], style: 'tableContent', margin: [0, 0, 0, 2] },
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
            stack: [
              { text: '1. The detection of asbestos in certain materials may be difficult due to the nature of the matrix. Independent analytical techniques should be used to confirm the presence or absence of asbestos.', style: 'notes' },
              { text: '2. This report must not be reproduced except in full.', style: 'notes' },
              { text: '3. The practical detection limit for asbestos fibre identification is 0.01-0.1% (0.1-1g/kg).', style: 'notes' },
              { text: '4. Reported sample weights include the weight of the sample bag.', style: 'notes' },
              { text: '5. Unknown Mineral Fibres (UMF) are reported as detected. Further analysis is required to confirm the identity of these fibres.', style: 'notes' },
              { text: '6. Accredited for compliance with ISO/IEC 17025-Testing. Accreditation no: 19512.', style: 'notes' },
            ],
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
          
          // Green border beneath header
          {
            canvas: [
              {
                type: 'line',
                x1: 0, y1: 0, x2: 520, y2: 0,
                lineWidth: 2,
                lineColor: '#16b12b'
              }
            ],
            margin: [0, 0, 0, 20]
          },
          
          // Sample Analysis Table with dynamic page breaks
          {
            table: {
              headerRows: 1,
              widths: ['11%', '11%', '11%', '23%', '12%', '15%', '17%'],
              body: [
                [
                  { text: 'L&D ID Reference', style: 'tableHeader', fontSize: 8 },
                  { text: 'Sample Reference', style: 'tableHeader', fontSize: 8 },
                  { text: 'Analysis Date', style: 'tableHeader', fontSize: 8 },
                  { text: 'Sample Description', style: 'tableHeader', fontSize: 8 },
                  { text: 'Mass/Dimensions', style: 'tableHeader', fontSize: 8 },
                  { text: 'Non-Asbestos Fibres', style: 'tableHeader', fontSize: 8 },
                  { text: 'Asbestos Fibres', style: 'tableHeader', fontSize: 8 }
                ],
                ...sortedSampleItems.map((item, index) => {
                  const analysisDate = item.analysisData?.analyzedAt 
                    ? formatDate(item.analysisData.analyzedAt)
                    : formatDate(new Date());
                  
                  // Get sample mass from analysis data or use default
                  let sampleMass = '';
                  if (item.analysisData?.sampleMass) {
                    sampleMass = item.analysisData.sampleMass + ' g';
                  } else if (item.analysisData?.sampleDimensions) {
                    const dims = item.analysisData.sampleDimensions;
                    if (dims.x && dims.y && dims.z) {
                      sampleMass = `${dims.x} × ${dims.y} × ${dims.z} mm`;
                    }
                  }
                  
                  // Extract fibre analysis results
                  const getFibreResults = (item) => {
                    if (!item.analysisData || !item.analysisData.fibres) {
                      return { nonAsbestos: 'Pending', asbestos: 'Pending' };
                    }
                    
                    const fibres = item.analysisData.fibres;
                    const nonAsbestosResults = [];
                    const asbestosResults = [];
                    
                    fibres.forEach(fibre => {
                      if (fibre.result) {
                        if (fibre.result.includes('Asbestos')) {
                          asbestosResults.push(fibre.result);
                        } else {
                          nonAsbestosResults.push(fibre.result);
                        }
                      }
                    });
                    
                    return {
                      nonAsbestos: nonAsbestosResults.length > 0 ? nonAsbestosResults.join(', ') : 'None detected',
                      asbestos: asbestosResults.length > 0 ? asbestosResults.join(', ') : 'None detected'
                    };
                  };
                  
                  const fibreResults = getFibreResults(item);
                  
                  return [
                    { text: `${job?.projectId?.projectID}-${index + 1}`, fontSize: 8 },
                    { text: item.sampleReference || `Sample ${index + 1}`, fontSize: 8 },
                    { text: analysisDate, fontSize: 8 },
                    { text: item.analysisData?.sampleDescription || item.locationDescription || 'No description', fontSize: 8 },
                    { text: sampleMass, fontSize: 8 },
                    { text: fibreResults.nonAsbestos, fontSize: 8 },
                    { text: fibreResults.asbestos, fontSize: 8, bold: true }
                  ];
                })
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
              paddingTop: function(i, node) { return 9; },
              paddingBottom: function(i, node) { return 9; },
              fillColor: function (rowIndex, node, columnIndex) {
                return (rowIndex % 2 === 0) ? '#f9f9f9' : null;
              }
            },
            pageBreak: 'auto'
          },
        ]
      }
    ],
    
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
                    { text: `Report Reference: ${job?.projectId?.projectID}`, fontSize: 8 },
                    { text: 'Revision: 0', fontSize: 8 }
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
  const projectID = job?.projectId?.projectID || '';
  const projectNameRaw = job?.projectId?.name || '';
  // Sanitize project name for filename (remove/replace unsafe characters)
  const projectName = projectNameRaw.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  
  // Get sample date - try to use the first sample's date, or job creation date, or current date
  let sampleDate = '';
  if (sampleItems && sampleItems.length > 0 && sampleItems[0].analyzedAt) {
    sampleDate = formatDate(sampleItems[0].analyzedAt);
  } else if (job?.projectId?.d_Date) {
    sampleDate = formatDate(job.projectId.d_Date);
  } else if (job?.projectId?.createdAt) {
    sampleDate = formatDate(job.projectId.createdAt);
  } else {
    sampleDate = formatDate(new Date());
  }
  
  const filename = `${projectID}: Fibre ID Report - ${projectName} (${sampleDate}).pdf`;

  const pdfDoc = pdfMake.createPdf(docDefinition);
  
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