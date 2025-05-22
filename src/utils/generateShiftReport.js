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

export async function generateShiftReport({ shift, job, samples }) {
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

  // Build the document definition
  const docDefinition = {
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
              { text: `Client Name: ${job?.clientName || ''}` },
              { text: `Client Contact: ${job?.clientContact || ''}` },
              { text: `Email: ${job?.clientEmail || ''}` },
              { text: `Site Name: ${job?.siteName || ''}` },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'LABORATORY DETAILS', style: 'tableHeader' },
              { text: `Address: 4/6 Dacre Street, Mitchell ACT 2911` },
              { text: `Email: laboratory@landd.com.au` },
              { text: `Lab Manager: Jordan Smith` },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
      // Report details
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: 'L&D Job Reference:', bold: true },
              job?.projectID ||
                (sortedSamples[0]?.fullSampleID
                  ? sortedSamples[0].fullSampleID.substring(0, 8)
                  : '') ||
                job?.jobID ||
                job?.id ||
                ''
            ],
            [
              { text: 'Description of works:', bold: true },
              job?.description || ''
            ],
            [
              { text: 'Asbestos Removalist:', bold: true },
              job?.asbestosRemovalist || ''
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10],
      },
      // Summary table
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'No. of Samples', bold: true },
              sortedSamples.length,
              { text: 'Samples Received', bold: true },
              formatDate(shift?.samplesReceivedDate)
            ],
            [
              { text: 'Sampling Date', bold: true },
              formatDate(shift?.samplingDate),
              { text: 'Sampled by', bold: true },
              shift?.sampledBy || ''
            ],
            [
              { text: 'Analysis Date', bold: true },
              formatDate(shift?.analysisDate),
              { text: 'Analysed by', bold: true },
              shift?.analysedBy || ''
            ],
            [
              { text: 'Report Issue Date', bold: true },
              formatDate(shift?.reportIssueDate),
              { text: 'Report approved by', bold: true },
              shift?.reportApprovedBy || ''
            ],
          ],
        },
        margin: [0, 0, 0, 10],
      },
      // Results table
      {
        table: {
          headerRows: 1,
          widths: [50, 40, '20%', 40, 40, 50, 40, 40, 60],
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
                isUncountable 
                  ? { text: 'Sample uncountable', color: 'red' }
                  : (isFieldBlank ? dash : (typeof s.analysis?.reportedConcentration === 'number' ? s.analysis.reportedConcentration : dash)),
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
          'Samples taken from the direct flow of negative air units are reported as a fibre count only.',
          'The NOHSC: 3003 (2005) recommended Control Level for all forms of asbestos is 0.01 fibres/mL.',
          'Safe Work Australias recommended Exposure Standard for all forms of asbestos is 0.1 fibres/mL.',
          'AFC = air fibre concentration',
          'Field blank samples are used to verify the cleanliness of the sampling equipment and laboratory procedures.',
        ],
      },
      { text: 'Accredited for compliance with ISO/IEC 17025 – Testing', italics: true, margin: [0, 10, 0, 0] },
      { text: 'Accreditation no: 19512', italics: true },
      // Remove the previous NATA logo columns footer
      {
        columns: [
          { text: `Job Reference: ${job?.projectID || ''}`, alignment: 'left' }
        ],
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 12, bold: true },
      title: { fontSize: 14, bold: true, alignment: 'center' },
      tableHeader: { bold: true, fillColor: '#eeeeee' },
    },
    defaultStyle: {
      fontSize: 10,
    },
    pageMargins: [30, 30, 30, 80],
    footer: function(currentPage, pageCount) {
      return {
        columns: [
          { width: '*', text: '' },
          { image: nataLogo, width: 50, alignment: 'center', margin: [0, 0, 0, 0] },
          { width: '*', text: '' }
        ],
        margin: [0, 0, 0, 0]
      };
    }
  };

  pdfMake.createPdf(docDefinition).download(`LDC_Report_${job?.projectID || ''}.pdf`);
} 