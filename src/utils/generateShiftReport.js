import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.vfs || (pdfFonts.default && pdfFonts.default.vfs);

// Helper to format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

export function generateShiftReport({ shift, job, samples }) {
  // Placeholder logo (can be replaced with base64 image)
  const logo = '';

  // Build the document definition
  const docDefinition = {
    content: [
      // Header
      {
        columns: [
          logo
            ? { image: logo, width: 100 }
            : { text: 'LANCASTER AND DICKENSON CONSULTING', style: 'header' },
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
              job?.jobID || ''
            ],
            [
              { text: 'Description of works:', bold: true },
              job?.description || ''
            ],
            [
              { text: 'Asbestos Removalist:', bold: true },
              job?.asbestosRemovalist || ''
            ],
            [
              { text: 'Monitoring Type:', bold: true },
              shift?.monitoringType || ''
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
              samples.length,
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
          widths: [80, '*', 60, 60, 60, 60, 60],
          body: [
            [
              { text: 'Sample Ref.', style: 'tableHeader' },
              { text: 'Sample Location', style: 'tableHeader' },
              { text: 'Time on', style: 'tableHeader' },
              { text: 'Time off', style: 'tableHeader' },
              { text: 'Ave. flow rate (mL/min)', style: 'tableHeader' },
              { text: 'Fields Counted', style: 'tableHeader' },
              { text: 'Fibres Counted', style: 'tableHeader' },
              { text: 'Reported AFC (fibres/ml)', style: 'tableHeader' },
            ],
            ...samples.map((s) => [
              s.fullSampleID || s.sampleNumber || '',
              s.location || '',
              s.startTime || '',
              s.endTime || '',
              s.averageFlowrate || '',
              s.fieldsCounted || '',
              s.fibresCounted || '',
              s.reportedAFC || '',
            ]),
          ],
        },
        margin: [0, 0, 0, 10],
      },
      // Notes and footer
      { text: 'Notes', style: 'tableHeader', margin: [0, 10, 0, 2] },
      {
        ul: [
          'Samples taken from the direct flow of negative air units are reported as a fibre count only.',
          'The NOHSC: 3003 (2005) recommended Control Level for all forms of asbestos is 0.01 fibres/mL.',
          'Safe Work Australias recommended Exposure Standard for all forms of asbestos is 0.1 fibres/mL.',
          'AFC = air fibre concentration',
        ],
      },
      { text: 'Accredited for compliance with ISO/IEC 17025 – Testing', italics: true, margin: [0, 10, 0, 0] },
      { text: 'Accreditation no: 19512', italics: true },
      // Footer
      {
        columns: [
          { text: `Job Reference: ${job?.jobID || ''}`, alignment: 'left' },
          { text: 'NATA', alignment: 'right', bold: true },
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
    pageMargins: [30, 30, 30, 30],
  };

  pdfMake.createPdf(docDefinition).download(`LDC_Report_${job?.jobID || ''}.pdf`);
} 