import pdfMake from "pdfmake/build/pdfmake";
import api from '../services/api';

// Helper functions (formatDate, formatTime, getSampleNumber, loadImageAsBase64, formatReportedConcentration) remain unchanged
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
  const match = sampleID.match(/\d+$/);
  return match ? parseInt(match[0]) : 0;
}

// Helper to load image as base64
async function loadImageAsBase64(imagePath) {
  try {
    console.log(`Attempting to load image: ${imagePath}`);
    
    let response;
    
    // Check if this is an API call (needs authentication) or a static asset
    if (imagePath.startsWith('/api/')) {
      // For API calls, use the existing API instance to get proper authentication
      // Remove the /api prefix since the API instance already has it in baseURL
      const apiPath = imagePath.substring(4); // Remove '/api' from the beginning
      console.log(`API URL: ${api.defaults.baseURL}${apiPath}`);
      response = await api.get(apiPath, { responseType: 'blob' });
      console.log(`Response status for ${imagePath}:`, response.status);
    } else {
      // For static assets (logos), use fetch with frontend URL
      const baseUrl = process.env.NODE_ENV === 'development' ? "http://localhost:3000" : window.location.origin;
      const fullUrl = imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`;
      
      console.log(`Static URL: ${fullUrl}`);
      response = await fetch(fullUrl);
      console.log(`Response status for ${imagePath}:`, response.status);
    }
    
    if (!response.ok && !response.status) {
      console.error(`Failed to fetch ${imagePath}:`, response.status, response.statusText);
      return null;
    }
    
    // Handle blob from either fetch or axios
    const blob = response.data || await response.blob();
    console.log(`Blob size for ${imagePath}:`, blob.size);
    console.log(`Blob type for ${imagePath}:`, blob.type);
    
    // Debug: Check if the response is actually an image
    if (blob.size < 1000) {
      console.warn(`Small blob size (${blob.size} bytes) - might be an error response`);
      // Try to read as text to see what error message we're getting
      const text = await blob.text();
      console.log(`Response content:`, text);
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log(`Successfully loaded ${imagePath} as base64, length:`, reader.result.length);
        console.log(`Base64 preview:`, reader.result.substring(0, 100) + '...');
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

// Helper function to add sample type indicator to location
const formatSampleLocation = (sample) => {
  if (!sample.location) return 'N/A';
  
  const location = sample.location;
  const sampleType = sample.type; // Use 'type' field, not 'sampleType'
  
  if (sampleType && sampleType.toLowerCase() === 'exposure') {
    return `${location} (E)`;
  } else if (sampleType && sampleType.toLowerCase() === 'clearance') {
    return `${location} (C)`;
  }
  
  return location;
};

// Add this helper function at the top of the file
const formatReportedConcentration = (sample) => {
  if (!sample.analysis) return '-';
  
  // If sample is uncountable
  if (sample.analysis.edgesDistribution === 'fail' || sample.analysis.backgroundDust === 'fail') {
    return { text: 'Uncountable', color: 'red' };
  }
  
  // If it's a field blank
  if (sample.location === 'Field blank') {
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

export async function generateShiftReport({ shift, job, samples, project, openInNewTab, returnPdfData = false, sitePlanData = null }) {
  console.log("generateShiftReport called with sitePlanData:", sitePlanData);
  // Debug logging
  console.log('generateShiftReport called with:', { shift, job, samples, project, openInNewTab, returnPdfData });
  console.log('job type:', typeof job, 'job value:', job);
  
  // Ensure job is an object
  if (typeof job !== 'object' || job === null) {
    console.warn('job is not an object, using empty object:', job);
    job = {};
  }
  
  // Determine base URL for fonts - use window.location for reliable detection
  console.log('Window location:', {
    hostname: window.location.hostname,
    href: window.location.href,
    origin: window.location.origin
  });
  
  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : 'https://app.landd.com.au';
  
  console.log('Font base URL:', baseUrl);

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

  // Load site plan image if available
  let sitePlanImage = null;
  if (sitePlanData?.sitePlanData?.staticMapUrl) {
    console.log("=== SITE PLAN IMAGE LOADING START ===");
    console.log("Loading site plan image from:", sitePlanData.sitePlanData.staticMapUrl);
    try {
      sitePlanImage = await loadImageAsBase64(sitePlanData.sitePlanData.staticMapUrl);
      if (sitePlanImage) {
        console.log("Successfully loaded site plan image, length:", sitePlanImage.length);
      } else {
        console.log("Failed to load site plan image - returned null");
        sitePlanImage = null;
      }
    } catch (error) {
      console.error("Failed to load site plan image:", error);
      sitePlanImage = null;
    }
    console.log("=== SITE PLAN IMAGE LOADING END ===");
  } else {
    console.log("No site plan data or static map URL available");
  }

  // Sort samples
  const sortedSamples = [...samples].sort((a, b) => {
    const aNum = getSampleNumber(a.fullSampleID);
    const bNum = getSampleNumber(b.fullSampleID);
    return aNum - bNum;
  });

  // Unique samplers
  const uniqueSamplers = Array.from(new Set(samples.map(s => {
    if (s.collectedBy && typeof s.collectedBy === 'object') {
      return (s.collectedBy.firstName || '') + (s.collectedBy.lastName ? ' ' + s.collectedBy.lastName : '');
    }
    return s.collectedBy || '';
  }).filter(Boolean)));

  // Document definition
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
          
          { text: 'AIRBORNE ASBESTOS FIBRE ESTIMATION TEST REPORT', style: 'header', margin: [0, 0, 0, 10], alignment: 'center' },
          
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
                      { text: [ { text: 'Client Name: ', bold: true }, { text: job?.projectId?.client?.name || '' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Client Contact: ', bold: true }, { text: job?.projectId?.client?.contact1Name || '' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Email: ', bold: true }, { text: job?.projectId?.client?.contact1Email || job?.projectId?.client?.invoiceEmail || job?.projectId?.client?.contact2Email || 'N/A' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Site Name: ', bold: true }, { text: job?.projectId?.name || '' } ], style: 'tableContent', margin: [0, 0, 0, 2] },
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
                    columns: [
                      {
                        text: [ { text: 'L&D Job Reference: ', bold: true }, { text: job?.projectId?.projectID || 'N/A' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Asbestos Removalist: ', bold: true }, { text: job?.asbestosRemovalist || 'N/A' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      }
                    ]
                  }
                ],
                [
                  {
                    text: [ { text: 'Description of Works: ', bold: true }, { text: shift?.descriptionOfWorks || job?.description || 'N/A' } ],
                    style: 'tableContent',
                    margin: [0, 0, 0, 2]
                  }
                ],
                [
                  {
                    columns: [
                      {
                        text: [ { text: 'Sampled by: ', bold: true }, { text: shift?.supervisor ? `${shift.supervisor.firstName} ${shift.supervisor.lastName}` : shift?.defaultSampler ? `${shift.defaultSampler.firstName} ${shift.defaultSampler.lastName}` : 'N/A' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Sample Date: ', bold: true }, { text: shift?.date ? formatDate(shift.date) : 'N/A' } ],
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
                        text: [ { text: 'Analysed by: ', bold: true }, { text: shift?.analysedBy || 'Jordan Smith' } ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Analysis Date: ', bold: true }, { text: shift?.analysisDate ? formatDate(shift.analysisDate) : 'N/A' } ],
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
                            text: shift?.reportApprovedBy || 'Pending authorization',
                            color: (!shift?.reportApprovedBy) ? 'red' : 'black'
                          } 
                        ],
                        style: 'tableContent',
                        margin: [0, 0, 0, 2],
                        width: '50%'
                      },
                      {
                        text: [ { text: 'Report Issue Date: ', bold: true }, { text: shift?.reportIssueDate ? formatDate(shift.reportIssueDate) : formatDate(new Date()) } ],
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
                        stack: [
                          { text: '1. Samples taken from the direct flow of negative air units are reported as a fibre count only', style: 'notes' },
                          { text: '2. The NOHSC: 3003 (2005) recommended Control Level for all forms of asbestos is 0.01 fibres/mL', style: 'notes' },
                          { text: '3. Safe Work Australia\'s recommended Exposure Standard for all forms of asbestos is 0.1 fibres/mL', style: 'notes' },
                          { text: '4. Accredited for compliance with ISO/IEC 17025 – Testing. Accreditation no: 19512', style: 'notes' },
                          { text: '5. The results of the testing relate only to the samples as supplied to the laboratory.', style: 'notes' },
                          { text: '6. (E) = Exposure Monitoring, (C) = Clearance Monitoring.', style: 'notes' },
                        ],
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
              widths: ['16%', '35%', '7%', '7%', '9%', '7%', '7%', '12%'],
              body: [
                                  [
                    { text: 'Sample Ref', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Sample Location', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Time On', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Time Off', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Ave flow (L/min)', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Field Count', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Fibre Count', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' },
                    { text: 'Reported Conc. (fibres/ml)', style: 'tableHeader', fontSize: 8, bold: true, fillColor: '#f0f0f0' }
                  ],
                                  ...sortedSamples.map(sample => [
                    { text: sample.fullSampleID || sample.sampleID || 'N/A', style: 'tableContent' },
                    { text: formatSampleLocation(sample), style: 'tableContent' },
                    { text: sample.startTime ? formatTime(sample.startTime) : '-', style: 'tableContent' },
                    { text: sample.endTime ? formatTime(sample.endTime) : '-', style: 'tableContent' },
                    { text: sample.averageFlowrate ? sample.averageFlowrate.toFixed(1) : '-', style: 'tableContent' },
                    { text: (sample.analysis?.fieldsCounted !== undefined && sample.analysis?.fieldsCounted !== null) ? sample.analysis.fieldsCounted : 'N/A', style: 'tableContent' },
                    { text: (sample.analysis?.fibresCounted !== undefined && sample.analysis?.fibresCounted !== null) ? sample.analysis.fibresCounted : 'N/A', style: 'tableContent' },
                  { 
                    text: formatReportedConcentration(sample),
                    style: 'tableContent',
                    ...(typeof formatReportedConcentration(sample) === 'object' && formatReportedConcentration(sample).color ? { color: formatReportedConcentration(sample).color } : {})
                  }
                ])
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
            margin: [0, 0, 0, 20]
          },
        ]
      },

      // Site Plan Page (if site plan data exists)
      ...(sitePlanData?.sitePlan && sitePlanData?.sitePlanData ? [
        {
          text: '',
          pageBreak: 'before'
        },
        {
          stack: [
            // Header for Site Plan page
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
            
            { text: 'SITE PLAN', style: 'header', margin: [0, 0, 0, 20], alignment: 'center' },
            
            // Site plan diagram with North indicator overlay
            {
              columns: [
                { width: '*', text: '' }, // Left spacer
                {
                  width: 500,
                  stack: [
                    {
                      image: sitePlanImage,
                      width: 500,
                      margin: [0, 0, 0, 0]
                    },
                    {
                      // North indicator positioned at top-right of image
                      absolutePosition: { x: 490, y: 180 },
                      stack: [
                        {
                          canvas: [
                            // White background circle
                            {
                              type: 'ellipse',
                              x: 0,
                              y: 5,
                              r1: 20,
                              r2: 20,
                              color: 'white',
                              fillOpacity: 0.9
                            },
                            // Arrow pointing up
                            {
                              type: 'line',
                              x1: 0,
                              y1: 8,
                              x2: 0,
                              y2: -8,
                              lineWidth: 2,
                              lineColor: '#333333'
                            },
                            // Arrow head left
                            {
                              type: 'line',
                              x1: 1,
                              y1: -8,
                              x2: -4,
                              y2: -4,
                              lineWidth: 2,
                              lineColor: '#333333'
                            },
                            // Arrow head right
                            {
                              type: 'line',
                              x1: -1,
                              y1: -8,
                              x2: 4,
                              y2: -4,
                              lineWidth: 2,
                              lineColor: '#333333'
                            }
                          ]
                        },
                        {
                          text: 'N',
                          color: '#333333',
                          fontSize: 12,
                          bold: true,
                          absolutePosition: { x: 485, y: 188 }
                        }
                      ]
                    }
                  ]
                },
                { width: '*', text: '' } // Right spacer
              ],
              columnGap: 0,
              margin: [0, 0, 0, 15]
            },

            // Sampling locations table below the map
            {
              table: {
                headerRows: 1,
                widths: ['100%'],
                body: [
                  [
                    { text: 'SAMPLING LOCATIONS', style: 'tableHeader', fillColor: '#f0f0f0' }
                  ],
                  [
                    {
                      stack: [
                        ...sitePlanData.sitePlanData.markers
                          .filter(marker => marker.type === 'sampling_point')
                          .map((marker, index) => {
                            const letter = String.fromCharCode(65 + index); // A, B, C, etc.
                            const sampleNumber = marker.sampleNumber || marker.label || 'N/A';
                            
                            // Find the actual sample to get its location/description
                            const sample = samples.find(s => s.sampleNumber === sampleNumber || s.fullSampleID === sampleNumber);
                            const sampleLocation = sample?.location || marker.description || 'Sampling location';
                            const fullSampleID = sample?.fullSampleID || sampleNumber;
                            
                            return {
                              text: [ 
                                { text: `${letter}: `, bold: true, color: '#ff4444' }, 
                                { text: `${sampleLocation} - ${fullSampleID}` } 
                              ], 
                              style: 'tableContent', 
                              margin: [0, 0, 0, 2] 
                            };
                          })
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
                  return 1;
                },
                hLineColor: function(i, node) {
                  return (i === 0 || i === node.table.body.length) ? '#000000' : '#cccccc';
                },
                vLineColor: function(i, node) {
                  return '#000000';
                }
              },
              margin: [0, 0, 0, 10]
            },

            // Note about map
            {
              text: [
                { text: 'Note: ', bold: true },
                { text: 'Sample locations are approximates. Marker letters correspond to the locations listed in the sampling locations table above.' }
              ],
              style: 'notes',
              alignment: 'left',
              margin: [0, 0, 0, 0]
            }
          ]
        }
      ] : [])
    ],
    footer: (function(nataLogo, job, sortedSamples, companyLogo) {
      return function(currentPage, pageCount) {
        console.log('Footer function called - NATA logo available:', !!nataLogo);
        const footerBlocks = [];
        footerBlocks.push({
            canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#16b12b' }
          ],
          margin: [0, 0, 0, 8]
        });
        footerBlocks.push({
            columns: [
              {
                stack: [
                  { text: `Report Reference: ${job?.projectID || (sortedSamples[0]?.fullSampleID ? sortedSamples[0].fullSampleID.substring(0, 8) : '') || job?.jobID || job?.id || ''}`, fontSize: 8 },
                  { text: `Revision: ${shift?.revision || 0}`, fontSize: 8 }
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
    })(nataLogo, job || {}, sortedSamples, companyLogo)
  };

  // Build filename (unchanged)
  const projectID = job?.projectID || (sortedSamples[0]?.fullSampleID ? sortedSamples[0].fullSampleID.substring(0, 8) : '') || job?.jobID || job?.id || '';
  const projectNameRaw = project?.name || '';
  const projectName = projectNameRaw.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  const samplingDate = shift?.date ? formatDateForFilename(shift.date) : '';
  const filename = `${projectID}: Air Monitoring Report - ${projectName}${samplingDate ? ` (${samplingDate})` : ''}.pdf`;

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