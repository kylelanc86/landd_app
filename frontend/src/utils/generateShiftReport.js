import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.vfs || (pdfFonts.default && pdfFonts.default.vfs);

// Helper to format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
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
    const response = await fetch(imagePath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

// Add this helper function at the top of the file
const formatReportedConcentration = (sample) => {
  if (!sample.analysis) return '-';
  
  // If sample is uncountable
  if (sample.analysis.edgesDistribution === 'fail' || sample.analysis.backgroundDust === 'fail') {
    return { text: 'Sample uncountable', color: 'red' };
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
  const numValue = parseFloat(reportedConc);
  if (numValue < 0.0149 && sample.analysis.fibresCounted < 10) {
    return '<0.01';
  }
  return numValue.toFixed(2);
};

export async function generateShiftReport({ shift, job, samples, project, openInNewTab }) {
  // Add debug logging
  console.log('Shift data in report generation:', shift);
  console.log('Samples received date:', shift?.samplesReceivedDate);
  
  // Load logos
  const companyLogo = await loadImageAsBase64('/logo.png');
  const nataLogo = await loadImageAsBase64('/NATA_logo.png');

  if (!companyLogo || !nataLogo) {
    console.error('Failed to load one or more logos');
    return;
  }

  // Sort samples by number (lowest to highest)
  const sortedSamples = [...samples].sort((a, b) => {
    const aNum = getSampleNumber(a.fullSampleID);
    const bNum = getSampleNumber(b.fullSampleID);
    return aNum - bNum;
  });

  // Before docDefinition, extract unique samplers and sample dates from samples
  const uniqueSamplers = Array.from(new Set(samples.map(s => {
    if (s.collectedBy && typeof s.collectedBy === 'object') {
      return (s.collectedBy.firstName || '') + (s.collectedBy.lastName ? ' ' + s.collectedBy.lastName : '');
    }
    return s.collectedBy || '';
  }).filter(Boolean)));
  const uniqueSampleDates = Array.from(new Set(samples.map(s => s.date ? formatDate(s.date) : '').filter(Boolean)));

  // Build the document definition
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
    },
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: "black",
      },
    },
    content: [
      // Header
      {
        columns: [
          { image: companyLogo, width: 150 },
          {
            stack: [
              { text: 'Lancaster & Dickenson Consulting Pty Ltd', style: 'subheader' },
              { text: 'Unit 4, 6 Dacre St, Mitchell ACT 2911' },
              { text: 'Tel: (02) 6241 2779' },
              { text: 'www.landd.com.au', color: 'blue', link: 'http://www.landd.com.au' },
            ],
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 20],
      },
      { text: 'AIRBORNE ASBESTOS FIBRE ESTIMATION TEST REPORT', style: 'title', margin: [0, 0, 0, 10] },
      // Client and Lab details
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'CLIENT DETAILS', style: 'tableHeader' },
              { text: [ { text: 'Client Name: ', bold: true }, { text: project?.client?.name || '' } ], margin: [0, 0, 0, 2] },
              { text: [ { text: 'Client Contact: ', bold: true }, { text: project?.client?.contact1Name || '' } ], margin: [0, 0, 0, 2] },
              { text: [ { text: 'Email: ', bold: true }, { text: project?.client?.contact1Email || '' } ], margin: [0, 0, 0, 2] },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'LABORATORY DETAILS', style: 'tableHeader' },
              { text: [
                { text: 'Address: ', bold: true },
                { text: '4/6 Dacre Street, Mitchell ACT 2911' }
              ], margin: [0, 0, 0, 2] },
              { text: [
                { text: 'Email: ', bold: true },
                { text: 'laboratory@landd.com.au' }
              ], margin: [0, 0, 0, 2] },
              { text: [
                { text: 'Lab Manager: ', bold: true },
                { text: 'Jordan Smith' }
              ], margin: [0, 0, 0, 2] },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
      // Add JOB DETAILS header
      { text: 'JOB DETAILS', style: 'tableHeader', margin: [0, 10, 0, 2] },
      {
        stack: [
          { text: [ { text: 'L&D Job Reference: ', bold: true }, { text: job?.projectID || (sortedSamples[0]?.fullSampleID ? sortedSamples[0].fullSampleID.substring(0, 8) : '') || job?.jobID || job?.id || '' } ], margin: [0, 0, 0, 2] },
          { text: [ { text: 'Site Name: ', bold: true }, { text: project?.name || '' } ], margin: [0, 0, 0, 2] },
          { text: [ { text: 'Description of works: ', bold: true }, { text: shift?.descriptionOfWorks || '' } ], margin: [0, 0, 0, 2] },
          { text: [ { text: 'Asbestos Removalist: ', bold: true }, { text: job?.asbestosRemovalist || '' } ], margin: [0, 0, 0, 2] },
        ],
        margin: [0, 0, 0, 10],
      },
      // Replace summary section with two-column layout for sampling and analysis details
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'SAMPLING DETAILS', style: 'tableHeader', margin: [0, 10, 0, 2] },
              { text: [ { text: 'Sampled by: ', bold: true }, { text: uniqueSamplers.join(', ') } ], margin: [0, 0, 0, 2] },
              { text: [ { text: 'Sampling Date: ', bold: true }, { text: formatDate(shift?.date) } ], margin: [0, 0, 0, 2] },
              { text: [ { text: 'Samples Received: ', bold: true }, { text: formatDate(shift?.samplesReceivedDate) } ], margin: [0, 0, 0, 2] },
            ]
          },
          {
            width: '50%',
            stack: [
              { text: 'ANALYSIS DETAILS', style: 'tableHeader', margin: [0, 10, 0, 2] },
              { text: [ { text: 'Analysis Date: ', bold: true }, { text: formatDate(shift?.analysisDate) } ], margin: [0, 0, 0, 2] },
              { text: [ { text: 'Analysed by: ', bold: true }, { text: shift?.analysedBy || '' } ], margin: [0, 0, 0, 2] },
            ]
          }
        ],
        margin: [0, 0, 0, 10],
      },
      // Results table
      {
        table: {
          headerRows: 1,
          widths: ['12%', '6%', '23%', '7%', '7%', '12%', '10%', '10%', '13%'],
          heights: 24,
          body: [
            [
              { text: 'Sample Ref.', style: 'tableHeader' },
              { text: 'Type', style: 'tableHeader' },
              { text: 'Sample Location', style: 'tableHeader' },
              { text: 'Time on', style: 'tableHeader' },
              { text: 'Time off', style: 'tableHeader' },
              { text: 'Ave. flow rate (mL/min)', style: 'tableHeader' },
              { text: 'Fields Counted', style: 'tableHeader' },
              { text: 'Fibres Counted', style: 'tableHeader' },
              { text: 'Reported AFC (fibres/mL)', style: 'tableHeader' },
            ],
            ...sortedSamples.map((s) => {
              const isFieldBlank = s.location === 'Field blank';
              const isUncountable = s.analysis?.edgesDistribution === 'fail' || s.analysis?.backgroundDust === 'fail';
              const dash = '-';
              // Type initial
              const typeInitial = s.type ? s.type[0].toUpperCase() : dash;
              // Calculate flow rate (multiply by 1000)
              const flowRate = s.averageFlowrate ? (s.averageFlowrate * 1000).toFixed(0) : null;
              return [
                s.fullSampleID || s.sampleNumber || dash,
                typeInitial,
                s.location || dash,
                isFieldBlank ? dash : formatTime(s.startTime) || dash,
                isFieldBlank ? dash : formatTime(s.endTime) || dash,
                isFieldBlank ? dash : (flowRate ?? dash),
                isUncountable ? 'N/A' : (s.analysis?.fieldsCounted ?? dash),
                isUncountable ? 'N/A' : (typeof s.analysis?.fibresCounted === 'number' ? s.analysis.fibresCounted : dash),
                formatReportedConcentration(s),
              ];
            }),
          ],
        },
        layout: {
          hLineWidth: function(i, node) { return 1; },
          vLineWidth: function(i, node) { return 1; },
          hLineColor: function(i, node) { return '#aaa'; },
          vLineColor: function(i, node) { return '#aaa'; },
          paddingLeft: function(i, node) { return 4; },
          paddingRight: function(i, node) { return 4; },
          paddingTop: function(i, node) { return 2; },
          paddingBottom: function(i, node) { return 2; },
        },
        margin: [0, 0, 0, 10],
        fontSize: 8,
      },
      // Notes and footer
      { text: 'Notes', style: 'tableHeader', margin: [0, 10, 0, 2] },
      {
        ul: [
          'Monitoring types: B = Background, C = Clearance, E = Exposure.',
          'Samples taken from the direct flow of negative air units are reported as a fibre count only.',
          'The NOHSC: 3003 (2005) recommended Control Level for all forms of asbestos is 0.01 fibres/mL.',
          'Safe Work Australias recommended Exposure Standard for all forms of asbestos is 0.1 fibres/mL.',
          'AFC = air fibre concentration',
          'Field blank samples are used to verify the cleanliness of the sampling equipment and laboratory procedures.',
        ],
      },
      { text: ' ', margin: [0, 0, 0, 16] },
      {
        stack: [
          { text: [ { text: 'Report Issue Date: ', bold: true }, { text: formatDate(shift?.reportIssueDate) } ], margin: [0, 2, 0, 0] },
          { text: [ { text: 'Report approved by: ', bold: true }, { text: shift?.reportApprovedBy || '' } ], margin: [0, 0, 0, 0] },
        ],
        margin: [0, 0, 0, 10],
      },
    ],
    footer: function(currentPage, pageCount) {
      return {
        columns: [
          { width: '*', text: '' },
          {
            stack: [
              { image: nataLogo, width: 50, alignment: 'center', margin: [0, 0, 0, 2] },
              { text: 'Accredited for compliance with ISO/IEC 17025 – Testing', italics: true, fontSize: 7, alignment: 'center', margin: [0, 2, 0, 0] },
              { text: 'Accreditation no: 19512', italics: true, fontSize: 7, alignment: 'center' }
            ],
            alignment: 'center',
          },
          { width: '*', text: '' }
        ],
        margin: [0, 0, 0, 0]
      };
    }
  };

  // Build filename: ProjectID: Air Monitoring Report - ProjectName (Date).pdf
  const projectID = job?.projectID || (sortedSamples[0]?.fullSampleID ? sortedSamples[0].fullSampleID.substring(0, 8) : '') || job?.jobID || job?.id || '';
  const projectNameRaw = project?.name || '';
  // Sanitize project name for filename (remove/replace unsafe characters)
  const projectName = projectNameRaw.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  const samplingDate = shift?.date ? formatDate(shift.date) : '';
  const filename = `${projectID}: Air Monitoring Report - ${projectName}${samplingDate ? ` (${samplingDate})` : ''}.pdf`;

  const pdfDoc = pdfMake.createPdf(docDefinition);
  if (openInNewTab) {
    pdfDoc.open({}, undefined, filename);
  } else {
    pdfDoc.download(filename);
  }
} 