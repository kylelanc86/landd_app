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

export async function generateFibreIDReport({ assessment, sampleItems, analyst, openInNewTab, returnPdfData = false, reportApprovedBy = null, reportIssueDate = null }) {
  // Detect if this is a client-supplied job (has jobType but no assessorId)
  const isClientSupplied = assessment?.jobType === "Fibre ID" && !assessment?.assessorId;

  // Determine base URL for fonts - use window.location.origin to avoid CORS issues
  console.log('Fibre ID - Window location:', {
    hostname: window.location.hostname,
    href: window.location.href,
    origin: window.location.origin
  });
  
  // Use window.location.origin to load fonts from the same origin as the app
  // This prevents CORS errors when accessing from different domains
  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : window.location.origin;
  
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
  const companyLogo = await loadImageAsBase64(`${baseUrl}/logo.png`);
  const nataLogo = await loadImageAsBase64(`${baseUrl}/NATA_logo.png`);

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
      },
    },
    
    // DEBUG: Log assessment data before content creation
    _debugAssessment: (function() {
      console.log('=== ASSESSMENT DATA DEBUG ===');
      console.log('assessment?.projectId?.client?.name:', assessment?.projectId?.client?.name, 'type:', typeof assessment?.projectId?.client?.name);
      console.log('assessment?.projectId?.client?.contact1Name:', assessment?.projectId?.client?.contact1Name, 'type:', typeof assessment?.projectId?.client?.contact1Name);
      console.log('assessment?.projectId?.client?.contact1Email:', assessment?.projectId?.client?.contact1Email, 'type:', typeof assessment?.projectId?.client?.contact1Email);
      console.log('assessment?.projectId?.client?.address:', assessment?.projectId?.client?.address, 'type:', typeof assessment?.projectId?.client?.address);
      console.log('=== END ASSESSMENT DATA DEBUG ===');
      return null;
    })(),
    
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
                      { text: [ { text: isClientSupplied ? 'Client reference: ' : 'Address: ', bold: true }, { text: isClientSupplied ? (assessment?.projectId?.name || '-') : (assessment?.projectId?.client?.address || 'Unknown Address') } ], style: 'tableContent', margin: [0, 0, 0, 2] },
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
                      { text: [ { text: 'Report Issue Date: ', bold: true }, { text: reportIssueDate ? formatDate(reportIssueDate) : formatDate(new Date()) } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                    ]
                  },
                  {
                    stack: [
                      { text: [ { text: 'Sampled by: ', bold: true }, { text: isClientSupplied ? 'Client' : (assessment?.assessorId?.firstName && assessment?.assessorId?.lastName ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}` : 'LAA') } ], style: 'tableContent', margin: [0, 0, 0, 2] },
                      { text: [ { text: 'Samples Received: ', bold: true }, { text: (() => {
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
            stack: [
              { text: '1. The detection of asbestos in certain materials may be difficult due to the nature of the matrix. Independent analytical techniques should be used to confirm the presence or absence of asbestos.', style: 'notes' },
              { text: '2. This report must not be reproduced except in full.', style: 'notes' },
              { text: '3. The practical detection limit for asbestos fibre identification is 0.01-0.1% (0.1-1g/kg).', style: 'notes' },
              { text: '4. Reported sample weights include the weight of the sample bag.', style: 'notes' },
              { text: '5. Unknown Mineral Fibres (UMF) are reported as detected. Further analysis is required to confirm the identity of these fibres.', style: 'notes' },
              { text: '6. The analysed samples detailed within this report along with the site and sample descriptions were supplied by a third party. L&D makes no claim to the validity of these details nor the quality of the supplied samples.', style: 'notes' },
              { text: '7. Accredited for compliance with ISO/IEC 17025-Testing. Accreditation no: 19512.', style: 'notes' },
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
            margin: [0, 0, 0, 20]
          },
          
          // Sample Analysis Table with dynamic page breaks
          {
            table: {
              headerRows: 1,
              widths: ['11%', '16.8%', '11%', '17.2%', '12%', '15%', '17%'],
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
                  // DEBUG: Log all item data to find NaN source
                  console.log(`=== ITEM ${index + 1} DEBUG ===`);
                  console.log('Item:', item);
                  console.log('analysisData:', item.analysisData);
                  console.log('sampleDimensions:', item.analysisData?.sampleDimensions);
                  console.log('sampleMass:', item.analysisData?.sampleMass);
                  console.log('analyzedAt:', item.analysisData?.analyzedAt);
                  console.log('fibres:', item.analysisData?.fibres);
                  
                  // Get analysis date with safety checks
                  let analysisDate = '';
                  if (item.analysisData?.analyzedAt) {
                    const date = new Date(item.analysisData.analyzedAt);
                    console.log('Date object created:', date);
                    console.log('Date is valid:', !isNaN(date.getTime()));
                    if (!isNaN(date.getTime())) {
                      analysisDate = formatDate(item.analysisData.analyzedAt);
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
                  
                  console.log('Final analysisDate:', analysisDate);
                  
                  // Get sample mass from analysis data or use default
                  let sampleMass = '';
                  if (item.analysisData?.sampleMass) {
                    sampleMass = item.analysisData.sampleMass + ' g';
                    console.log('Using sampleMass:', sampleMass);
                  } else if (item.analysisData?.sampleDimensions) {
                    const dims = item.analysisData.sampleDimensions;
                    console.log('Raw dimensions:', dims);
                    console.log('dims.x:', dims.x, 'type:', typeof dims.x, 'isNaN:', isNaN(dims.x));
                    console.log('dims.y:', dims.y, 'type:', typeof dims.y, 'isNaN:', isNaN(dims.y));
                    console.log('dims.z:', dims.z, 'type:', typeof dims.z, 'isNaN:', isNaN(dims.z));
                    
                    if (dims.x && dims.y && dims.z && 
                        !isNaN(dims.x) && !isNaN(dims.y) && !isNaN(dims.z) &&
                        dims.x !== 'undefined' && dims.y !== 'undefined' && dims.z !== 'undefined') {
                      sampleMass = `${dims.x} × ${dims.y} × ${dims.z} mm`;
                      console.log('Using calculated dimensions:', sampleMass);
                    } else {
                      sampleMass = 'Dimensions not specified';
                      console.log('Using fallback dimensions text');
                    }
                  } else {
                    sampleMass = 'Not specified';
                    console.log('Using fallback text');
                  }
                  console.log('Final sampleMass:', sampleMass);
                  console.log(`=== END ITEM ${index + 1} DEBUG ===`);
                  
                  // Extract fibre analysis results
                  const getFibreResults = (item) => {
                    console.log('=== FIBRE RESULTS DEBUG ===');
                    console.log('item.analysisData:', item.analysisData);
                    console.log('item.analysisData.fibres:', item.analysisData?.fibres);
                    
                    if (!item.analysisData || !item.analysisData.fibres || !Array.isArray(item.analysisData.fibres)) {
                      console.log('No fibres data, returning defaults');
                      return { nonAsbestos: 'None', asbestos: 'No Asbestos Detected' };
                    }
                    
                    const fibres = item.analysisData.fibres;
                    console.log('Raw fibres array:', fibres);
                    const nonAsbestosResults = [];
                    const asbestosResults = [];
                    
                    // Ensure fibres is an array and has valid items
                    if (Array.isArray(fibres) && fibres.length > 0) {
                      fibres.forEach((fibre, fibreIndex) => {
                        console.log(`Fibre ${fibreIndex}:`, fibre);
                        console.log(`Fibre result:`, fibre.result, 'type:', typeof fibre.result);
                        
                        if (fibre && fibre.result && fibre.result.trim() !== '' && fibre.result !== 'undefined' && fibre.result !== 'null') {
                          if (fibre.result.includes('Asbestos')) {
                            asbestosResults.push(fibre.result);
                            console.log('Added to asbestos results');
                          } else {
                            nonAsbestosResults.push(fibre.result);
                            console.log('Added to non-asbestos results');
                          }
                        } else {
                          console.log('Skipping invalid fibre result');
                        }
                      });
                    } else {
                      console.log('No valid fibres array found');
                    }
                    
                    const result = {
                      nonAsbestos: nonAsbestosResults.length > 0 ? nonAsbestosResults.join(' ') : 'None',
                      asbestos: asbestosResults.length > 0 ? asbestosResults.join(' ') : 'None detected'
                    };
                    
                    // Ensure we never return undefined values
                    if (!result.nonAsbestos) result.nonAsbestos = 'None';
                    if (!result.asbestos) result.asbestos = 'None detected';
                    
                    console.log('Final fibre results:', result);
                    console.log('=== END FIBRE RESULTS DEBUG ===');
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
                  const safeAsbestos = (fibreResults.asbestos && fibreResults.asbestos !== 'undefined' && fibreResults.asbestos !== 'null') ? fibreResults.asbestos : 'None detected';
                  
                  // DEBUG: Log every single value being passed to pdfMake
                  console.log(`=== TABLE ROW ${index + 1} DEBUG ===`);
                  console.log('safeProjectID:', safeProjectID, 'type:', typeof safeProjectID, 'length:', safeProjectID.length);
                  console.log('safeSampleRef:', safeSampleRef, 'type:', typeof safeSampleRef, 'length:', safeSampleRef.length);
                  console.log('safeAnalysisDate:', safeAnalysisDate, 'type:', typeof safeAnalysisDate, 'length:', safeAnalysisDate.length);
                  console.log('safeDescription:', safeDescription, 'type:', typeof safeDescription, 'length:', safeDescription.length);
                  console.log('safeSampleMass:', safeSampleMass, 'type:', typeof safeSampleMass, 'length:', safeSampleMass.length);
                  console.log('safeNonAsbestos:', safeNonAsbestos, 'type:', typeof safeNonAsbestos, 'length:', safeNonAsbestos.length);
                  console.log('safeAsbestos:', safeAsbestos, 'type:', typeof safeAsbestos, 'length:', safeAsbestos.length);
                  
                  // Check for any problematic values
                  const allValues = [safeProjectID, safeSampleRef, safeAnalysisDate, safeDescription, safeSampleMass, safeNonAsbestos, safeAsbestos];
                  allValues.forEach((value, i) => {
                    if (value === null || value === undefined || value === 'null' || value === 'undefined' || value === 'NaN' || value.includes('NaN')) {
                      console.error(`PROBLEMATIC VALUE FOUND at index ${i}:`, value);
                    }
                  });
                  console.log(`=== END TABLE ROW ${index + 1} DEBUG ===`);
                  
                  // Use labReference for L&D ID Reference, or fall back to projectID-index
                  const safeLabRef = (item.labReference && item.labReference !== 'undefined' && item.labReference !== 'null') 
                    ? item.labReference 
                    : `${safeProjectID}-${index + 1}`;
                  
                  return [
                    { text: safeLabRef, fontSize: 8 },
                    { text: safeSampleRef, fontSize: 8 },
                    { text: safeAnalysisDate, fontSize: 8 },
                    { text: safeDescription, fontSize: 8 },
                    { text: safeSampleMass, fontSize: 8 },
                    { text: safeNonAsbestos, fontSize: 8 },
                    { text: safeAsbestos, fontSize: 8, bold: true }
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
                return (rowIndex % 2 === 0) ? '#f9f9f9' : 'white';
              }
            },
          },
        ]
      }
    ],
    
    footer: (function(nataLogo) {
      return function(currentPage, pageCount) {
        // DEBUG: Log footer function parameters
        console.log('=== FOOTER FUNCTION DEBUG ===');
        console.log('currentPage:', currentPage, 'type:', typeof currentPage);
        console.log('pageCount:', pageCount, 'type:', typeof pageCount);
        console.log('nataLogo exists:', !!nataLogo);
        console.log('assessment?.projectId?.projectID:', assessment?.projectId?.projectID, 'type:', typeof assessment?.projectId?.projectID);
        console.log('=== END FOOTER FUNCTION DEBUG ===');
        
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

  // DEBUG: Log filename generation
  console.log('=== FILENAME GENERATION DEBUG ===');
  console.log('assessment?.projectId?.projectID:', assessment?.projectId?.projectID, 'type:', typeof assessment?.projectId?.projectID);
  console.log('assessment?.projectId?.name:', assessment?.projectId?.name, 'type:', typeof assessment?.projectId?.name);
  
  // Build filename: ProjectID: Fibre ID Report - ProjectName (SampleDate).pdf
  const projectID = assessment?.projectId?.projectID || '';
  const projectNameRaw = assessment?.projectId?.name || '';
  // Sanitize project name for filename (remove/replace unsafe characters)
  const projectName = projectNameRaw.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  
  console.log('projectID:', projectID, 'type:', typeof projectID);
  console.log('projectNameRaw:', projectNameRaw, 'type:', typeof projectNameRaw);
  console.log('projectName (sanitized):', projectName, 'type:', typeof projectName);
  console.log('=== END FILENAME GENERATION DEBUG ===');
  
  // DEBUG: Log sample date generation
  console.log('=== SAMPLE DATE GENERATION DEBUG ===');
  console.log('sampleItems:', sampleItems, 'type:', typeof sampleItems, 'length:', sampleItems?.length);
  if (sampleItems && sampleItems.length > 0) {
    console.log('sampleItems[0].analyzedAt:', sampleItems[0].analyzedAt, 'type:', typeof sampleItems[0].analyzedAt);
  }
  console.log('assessment?.projectId?.d_Date:', assessment?.projectId?.d_Date, 'type:', typeof assessment?.projectId?.d_Date);
  console.log('assessment?.projectId?.createdAt:', assessment?.projectId?.createdAt, 'type:', typeof assessment?.projectId?.createdAt);
  
  // Get sample date - try to use the first sample's date, or job creation date, or current date
  let sampleDate = '';
  if (sampleItems && sampleItems.length > 0 && sampleItems[0].analyzedAt) {
    const date = new Date(sampleItems[0].analyzedAt);
    sampleDate = !isNaN(date.getTime()) ? formatDate(sampleItems[0].analyzedAt) : formatDate(new Date());
  } else if (assessment?.projectId?.d_Date) {
    const date = new Date(assessment.projectId.d_Date);
    sampleDate = !isNaN(date.getTime()) ? formatDate(assessment.projectId.d_Date) : formatDate(new Date());
  } else if (assessment?.projectId?.createdAt) {
    const date = new Date(assessment.projectId.createdAt);
    sampleDate = !isNaN(date.getTime()) ? formatDate(assessment.projectId.createdAt) : formatDate(new Date());
  } else {
    sampleDate = formatDate(new Date());
  }
  
  console.log('Final sampleDate:', sampleDate, 'type:', typeof sampleDate);
  console.log('=== END SAMPLE DATE GENERATION DEBUG ===');
  
  const filename = `${projectID}: Fibre ID Report - ${projectName} (${sampleDate}).pdf`;

      // DEBUG: Final check before pdfMake.createPdf
    console.log('=== FINAL DEBUG BEFORE PDFMAKE ===');
    console.log('docDefinition type:', typeof docDefinition);
    console.log('docDefinition keys:', Object.keys(docDefinition));
    console.log('docDefinition.content type:', typeof docDefinition.content);
    console.log('docDefinition.content length:', docDefinition.content?.length);
    console.log('docDefinition.styles type:', typeof docDefinition.styles);
    console.log('docDefinition.images type:', typeof docDefinition.images);
    console.log('docDefinition.images keys:', Object.keys(docDefinition.images || {}));
    console.log('docDefinition.defaultStyle:', docDefinition.defaultStyle);
    
    // DEBUG: Inspect content array structure
    console.log('=== CONTENT ARRAY INSPECTION ===');
    if (docDefinition.content && Array.isArray(docDefinition.content)) {
      docDefinition.content.forEach((item, index) => {
        console.log(`Content item ${index}:`, item);
        if (item && typeof item === 'object') {
          console.log(`  Item ${index} keys:`, Object.keys(item));
          
          // DEBUG: Inspect stack arrays in detail
          if (item.stack && Array.isArray(item.stack)) {
            console.log(`  Item ${index} stack length:`, item.stack.length);
            item.stack.forEach((stackItem, stackIndex) => {
              console.log(`    Stack item ${stackIndex}:`, stackItem);
              if (stackItem && typeof stackItem === 'object') {
                console.log(`      Stack item ${stackIndex} keys:`, Object.keys(stackItem));
                
                // DEBUG: Inspect table structures
                if (stackItem.table && stackItem.table.body) {
                  console.log(`      Stack item ${stackIndex} table body rows:`, stackItem.table.body.length);
                  stackItem.table.body.forEach((row, rowIndex) => {
                    console.log(`        Row ${rowIndex}:`, row);
                    if (Array.isArray(row)) {
                      row.forEach((cell, cellIndex) => {
                        console.log(`          Cell ${cellIndex}:`, cell, 'type:', typeof cell);
                        if (cell && typeof cell === 'object') {
                          console.log(`            Cell ${cellIndex} keys:`, Object.keys(cell));
                        }
                      });
                    }
                  });
                }
                
                // DEBUG: Inspect canvas lines
                if (stackItem.canvas) {
                  console.log(`      Stack item ${stackIndex} canvas:`, stackItem.canvas);
                  if (stackItem.canvas.length) {
                    stackItem.canvas.forEach((line, lineIndex) => {
                      console.log(`        Canvas line ${lineIndex}:`, line);
                      if (line && typeof line === 'object') {
                        console.log(`          Line ${lineIndex} keys:`, Object.keys(line));
                        if (line.x1 !== undefined) console.log(`          Line ${lineIndex} x1:`, line.x1, 'type:', typeof line.x1);
                        if (line.y1 !== undefined) console.log(`          Line ${lineIndex} y1:`, line.y1, 'type:', typeof line.y1);
                        if (line.x2 !== undefined) console.log(`          Line ${lineIndex} x2:`, line.x2, 'type:', typeof line.x2);
                        if (line.y2 !== undefined) console.log(`          Line ${lineIndex} y2:`, line.y2, 'type:', typeof line.y2);
                      }
                    });
                  }
                }
                
                // DEBUG: Inspect text elements
                if (stackItem.text !== undefined) {
                  console.log(`      Stack item ${stackIndex} text:`, stackItem.text, 'type:', typeof stackItem.text);
                }
              }
            });
          }
        }
      });
    }
    console.log('=== END CONTENT ARRAY INSPECTION ===');
    
    console.log('=== END FINAL DEBUG BEFORE PDFMAKE ===');

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