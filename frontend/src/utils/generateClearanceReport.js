import jsPDF from "jspdf";
import { loadImageAsBase64, compressImageForPDF } from "./pdfImageUtils";
import asbestosClearanceReportService from "../services/asbestosClearanceReportService";
import './Gothic-normal.js'
import './Gothic-bold.js'
import './Gothic-italic.js'
import './Gothic-bold-italic.js'

// Helper function to calculate text height and provide consistent spacing
const addTextWithSpacing = (doc, text, x, y, options = {}) => {
  const {
    maxWidth,
    align = "left",
    fontSize = 11,
    fontFamily = "GOTHIC",
    fontStyle = "normal",
    lineSpacing = 1.2, // Multiplier for line height
    marginAfter = 8, // Default spacing after text
    marginBefore = 0 // Default spacing before text
  } = options;

  // Set font properties
  doc.setFontSize(fontSize);
  doc.setFont(fontFamily, fontStyle);

  // Calculate text height
  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * lineSpacing;
  const textHeight = lines.length * lineHeight;

  // Add margin before if specified
  if (marginBefore > 0) {
    y += marginBefore;
  }

  // Add the text
  doc.text(text, x, y, { maxWidth, align });

  // Return the new Y position (end of text + margin after)
  return y + textHeight + marginAfter;
};

// Helper function for headers with consistent spacing
const addHeader = (doc, text, x, y, options = {}) => {
  const {
    fontSize = 12,
    fontFamily = "Gothic Bold",
    fontStyle = "bold",
    marginAfter = 6,
    marginBefore = 0
  } = options;

  return addTextWithSpacing(doc, text, x, y, {
    fontSize,
    fontFamily,
    fontStyle,
    marginAfter,
    marginBefore
  });
};

// Helper function for bullet points with consistent spacing
const addBulletPoint = (doc, text, x, y, options = {}) => {
  const {
    indent = 10,
    marginAfter = 8,
    fontSize = 11,
    fontFamily = "GOTHIC",
    fontStyle = "normal"
  } = options;

  return addTextWithSpacing(doc, text, x + indent, y, {
    fontSize,
    fontFamily,
    fontStyle,
    marginAfter,
    maxWidth: options.maxWidth - indent
  });
};

// Helper function for paragraphs with justified text
const addParagraph = (doc, text, x, y, options = {}) => {
  return addTextWithSpacing(doc, text, x, y, {
    ...options,
    align: "justify"
  });
};

// New helper function for multi-line text blocks with internal line breaks
const addTextBlock = (doc, textLines, x, y, options = {}) => {
  const {
    maxWidth,
    align = "left",
    fontSize = 11,
    fontFamily = "GOTHIC",
    fontStyle = "normal",
    lineSpacing = 1.2,
    marginAfter = 8,
    marginBefore = 0,
    lineBreakSpacing = 2 // Spacing between lines within the block
  } = options;

  // Set font properties
  doc.setFontSize(fontSize);
  doc.setFont(fontFamily, fontStyle);

  // Add margin before if specified
  if (marginBefore > 0) {
    y += marginBefore;
  }

  let totalHeight = 0;
  const lineHeight = fontSize * lineSpacing;

  // Process each line or text block
  textLines.forEach((line, index) => {
    if (typeof line === 'string') {
      // Single line of text
      doc.text(line, x, y + totalHeight, { maxWidth, align });
      totalHeight += lineHeight;
    } else if (line.type === 'paragraph') {
      // Multi-line paragraph
      const lines = doc.splitTextToSize(line.text, maxWidth);
      doc.text(line.text, x, y + totalHeight, { maxWidth, align });
      totalHeight += lines.length * lineHeight;
    } else if (line.type === 'bullet') {
      // Bullet point
      const bulletText = `• ${line.text}`;
      const lines = doc.splitTextToSize(bulletText, maxWidth - 10);
      doc.text(bulletText, x + 10, y + totalHeight, { maxWidth: maxWidth - 10, align });
      totalHeight += lines.length * lineHeight;
    } else if (line.type === 'spacing') {
      // Custom spacing
      totalHeight += line.amount || lineBreakSpacing;
    }
  });

  // Return the new Y position (end of text block + margin after)
  return y + totalHeight + marginAfter;
};

// Helper function for section headers
const addSectionHeader = (doc, text, x, y, options = {}) => {
  return addTextBlock(doc, [text], x, y, {
    fontSize: 12,
    fontFamily: "Gothic Bold",
    fontStyle: "bold",
    marginAfter: 4,
    ...options
  });
};

// Helper function to add text and return the actual Y position after text
const addTextAndGetHeight = (doc, text, x, y, options = {}) => {
  const {
    maxWidth,
    align = "left",
    fontSize = 11,
    fontFamily = "GOTHIC",
    fontStyle = "normal",
    lineSpacing = 8, // Fixed 8pt per line instead of multiplier
    marginAfter = 0,
    marginAfterInLines = true // Default to interpreting marginAfter as lines for easier use
  } = options;

  // Set font properties
  doc.setFontSize(fontSize);
  doc.setFont(fontFamily, fontStyle);

  // Calculate how many lines the text will take
  const lines = doc.splitTextToSize(text, maxWidth);
  const textHeight = lines.length * lineSpacing; // Use fixed 8pt per line

  // Add the text
  doc.text(text, x, y, { maxWidth, align });

  // Calculate actual margin: if marginAfterInLines is true, multiply by lineSpacing
  const actualMargin = marginAfterInLines ? marginAfter * lineSpacing : marginAfter;

  // Return the new Y position (current Y + text height + margin)
  return y + textHeight + actualMargin;
};

export const generateClearanceReport = async (clearance, setError, options = {}) => {
  const { includePhotographs = true } = options;
  
  try {
    // Fetch clearance items for the report
    const reportsResponse = await asbestosClearanceReportService.getByClearanceId(clearance._id);
    const items = Array.isArray(reportsResponse) ? reportsResponse : [];

    // Load images as base64 with error handling
    let frontImg, logoImg;
    try {
      [frontImg, logoImg] = await Promise.all([
        loadImageAsBase64("/images/clearance_front.bmp"),
        loadImageAsBase64("/images/logo.png"),
      ]);
    } catch (error) {
      console.error("Error loading images:", error);
      // Continue without images if they fail to load
      frontImg = null;
      logoImg = null;
    }

    // Create PDF
    const doc = new jsPDF();;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // --- FRONT COVER ---
    // Draw the grayscale image on the right half only if image loaded successfully
    if (frontImg) {
      doc.addImage(frontImg, "JPEG", 0, 0, pageWidth, pageHeight);
    } else {
      // Fallback: add a simple background color
      doc.setFillColor(240, 240, 240);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
    }

    const centerX = pageWidth / 2
    // Define a polygon for the white overlay (user can edit this array)
    const poly = [
      [-20, -20],
      [10, -20],
      [centerX, 60],
      [centerX, pageHeight-60],
      [10, pageHeight+20],
      [-20, pageHeight+20], 
      [-20, -20]
    ];

    // Draw the white polygon with green border ONLY on the first page
    if (doc.internal.getNumberOfPages() === 1) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 153, 0);
      doc.setLineWidth(3);
      if (typeof doc.polygon === 'function') {
        doc.polygon(poly, "FD"); // Fill and draw border
      } else {
        // Convert absolute points to relative for doc.lines
        const relPoly = [];
        for (let i = 1; i < poly.length; i++) {
          relPoly.push([poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]]);
        }
        doc.lines(relPoly, poly[0][0], poly[0][1], [1, 1], "FD");
      }
      // Reset colors and line width for the rest of the doc
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
    }


    // Content box margins
    const leftMargin = 7;
    let y = 38 + 35;
    const contentWidth = pageWidth / 2 - leftMargin * 2;

    // Title
    doc.setFontSize(21);
    doc.setFont("Gothic Bold", "bold");
    doc.text(
      `${clearance.clearanceType?.toUpperCase() || "ASBESTOS"} REMOVAL CLEARANCE CERTIFICATE`,
      leftMargin,
      y,
      { maxWidth: contentWidth }
    );
    y += 12;

    // Black line between title and site name
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(leftMargin, y, leftMargin + contentWidth, y);
    y += 12;

    // Site Name & Address
    doc.setFontSize(20);
    doc.setFont("GOTHIC", "normal");
    if (clearance.projectId?.name) {
      doc.text(clearance.projectId.name, leftMargin, y, { maxWidth: contentWidth });
      y += 8;
    }
    if (clearance.projectId?.address) {
      doc.text(clearance.projectId.address, leftMargin, y, { maxWidth: contentWidth });
      y += 8;
    }
    if (clearance.projectId?.suburb || clearance.projectId?.state || clearance.projectId?.postcode) {
      const addrLine = [clearance.projectId.suburb, clearance.projectId.state, clearance.projectId.postcode].filter(Boolean).join(" ");
      if (addrLine) {
        doc.text(addrLine, leftMargin, y, { maxWidth: contentWidth });
        y += 8;
      }
    }
    y += 24;

    // Job Reference
    doc.setFontSize(16);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Job Reference", leftMargin, y);
    doc.setFont("GOTHIC", "normal");
    y += 7;
    doc.text(clearance.projectId?.projectID || "N/A", leftMargin, y);
    y += 15;

    // Clearance Date
    doc.setFontSize(16);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Clearance Date", leftMargin, y);
    doc.setFont("GOTHIC", "normal");
    y += 7;
    doc.text(
      clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB")
        : "N/A",
      leftMargin,
      y
    );
    y += 15;

    // Company details (bottom left)
    const companyY = pageHeight - 55;
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    doc.text("Lancaster & Dickenson Consulting Pty Ltd", leftMargin, companyY);
    doc.text("4/6 Dacre Street, Mitchell ACT 2911", leftMargin, companyY + 6);
    doc.text("enquiries@landd.com.au", leftMargin, companyY + 12);
    doc.text("(02) 6241 2779", leftMargin, companyY + 18);


    // Logo (bottom right, but inside white area)
    const logoWidth = 65;
    const logoHeight = 18;
    doc.addImage(
      logoImg,
      "PNG",
      pageWidth - logoWidth - 18,
      pageHeight - logoHeight - 18,
      logoWidth,
      logoHeight
    );

    // --- VERSION CONTROL PAGE ---
    doc.addPage();

    // Header section height - reduced spacing
    const headerPadding = 18;

    // Draw logo in top left
    doc.addImage(
      logoImg,
      "PNG",
      headerPadding,
      headerPadding,
      logoWidth,
      logoHeight
    );

    // Company details in top right - reduced line spacing
    doc.setFont("GOTHIC", "normal");
    doc.setFontSize(10);
    const companyDetails = [
      "Lancaster & Dickenson Consulting Pty Ltd",
      "4/6 Dacre Street",
      "Mitchell ACT 2911",
      "W: www.landd.com.au"
    ];
    const rightX = pageWidth - headerPadding;
    let headerCompanyY = headerPadding + 2;
    companyDetails.forEach(line => {
      doc.text(line, rightX, headerCompanyY, { align: "right" });
      headerCompanyY += 6; // Reduced from 16 to 12
    });

    // Green header underline - reduced thickness and positioned closer to content
    const headerBottomY = headerPadding + logoHeight + 8; // Position just beneath header content
    // doc.setDrawColor(0, 153, 0);
    // doc.setLineWidth(1.5); // Reduced from 3 to 1.5 (50% reduction)
    // doc.line(headerPadding, headerBottomY, pageWidth - headerPadding, headerBottomY);
    // doc.setDrawColor(0, 0, 0); // Reset to black
    // doc.setLineWidth(0.2); // Reset line width

    // Green line beneath header
    doc.setDrawColor(0, 153, 0);
    doc.setLineWidth(1);
    doc.line(
      headerPadding,
      headerBottomY,
      pageWidth - headerPadding,
      headerBottomY
    );

    // --- VERSION CONTROL CONTENT ---
    let yVC = headerBottomY + 25;
    doc.setFontSize(18);
    doc.setFont("Gothic Bold", "bold");
    doc.text(
      `${clearance.clearanceType?.toUpperCase() || "ASBESTOS"} REMOVAL CLEARANCE CERTIFICATE`,
      headerPadding,
      yVC
    );
    yVC += 8;

    doc.setFontSize(16);
    doc.setFont("GOTHIC", "normal");
    doc.text(clearance.projectId?.name || "{Site Name}", headerPadding, yVC);
    yVC += 18;

    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("PREPARED FOR:", headerPadding, yVC);
    yVC += 8;

    doc.setFont("GOTHIC", "normal");
    doc.text(clearance.projectId?.client?.name || "{Client Name}", headerPadding, yVC);
    yVC += 14;

    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("PREPARED BY:", headerPadding, yVC);
    yVC += 8;

    doc.setFont("GOTHIC", "normal");
    doc.text("Lancaster and Dickenson Consulting Pty Ltd", headerPadding, yVC);
    yVC += 8;
    doc.text("ABN 74 169 785 915", headerPadding, yVC);
    yVC += 18;

    // DOCUMENT DETAILS
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("DOCUMENT DETAILS", headerPadding, yVC);
    yVC += 8;
    doc.setFont("GOTHIC", "normal");
    doc.setFontSize(10);
    doc.text(`File Name: ${clearance.projectId?.projectID || "-"}_Clearance_Report.pdf`, headerPadding, yVC);
    yVC += 7;
    doc.text(`Issue Date: ${clearance.clearanceDate ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB") : "-"}`, headerPadding, yVC);
    yVC += 7;
    doc.text(`Report Author: ${clearance.LAA || "-"}`, headerPadding, yVC);
    yVC += 7;
    doc.text(`Report Authoriser: ${clearance.LAA || "-"}`, headerPadding, yVC);
    yVC += 18;

    // REVISION HISTORY TABLE
    doc.setFontSize(10);
    doc.setFont("Gothic Bold", "bold");
    doc.text("REVISION HISTORY", headerPadding, yVC);
    doc.setFont("GOTHIC", "normal");
    const revHeaders = ["Reason for Revision", "Rev Number", "Approved By", "Date"];
    const revColWidths = [70, 30, 50, 20];
    let revX = headerPadding;
    let revY = yVC + 4;
    // Draw header row
    let colX = revX;
    doc.setFont("Gothic Bold", "bold");
    doc.setDrawColor(89, 89, 89);
    doc.setLineWidth(0.7);
    for (let i = 0; i < revHeaders.length; i++) {
      doc.rect(colX, revY, revColWidths[i], 10, "D");
      doc.text(revHeaders[i], colX + 2, revY + 8);
      colX += revColWidths[i];
    }
    // Draw one empty row for now
    revY += 10;
    colX = revX;
    doc.setFont("GOTHIC", "normal");
    for (let i = 0; i < revHeaders.length; i++) {
      doc.rect(colX, revY, revColWidths[i], 10, "D");
      colX += revColWidths[i];
    }

    // --- FOOTER SECTION ---
    const footerY = pageHeight - 10;
    const footerPadding = 18;
    
    // Green border above footer
    doc.setDrawColor(0, 153, 0);
    doc.setLineWidth(1.0);
    doc.line(footerPadding, footerY - 5, pageWidth - footerPadding, footerY - 5);

    
    // Footer text
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const footerText = `${clearance.clearanceType || "Non-friable"} Clearance Certificate: ${clearance.projectId?.name || "{Site Name}"}`;
    doc.text(footerText, footerPadding, footerY + 3); // Added 3 point gap between border and text

    // --- PAGE 3: INSPECTION DETAILS ---
    doc.addPage();

    // Header section height - same as page 2
    const headerPadding3 = 18;

    // Draw logo in top left
    doc.addImage(
      logoImg,
      "PNG",
      headerPadding3,
      headerPadding3,
      logoWidth,
      logoHeight
    );

    // Company details in top right - same as page 2
    doc.setFont("GOTHIC", "normal");
    doc.setFontSize(10);
    const companyDetails3 = [
      "Lancaster & Dickenson Consulting Pty Ltd",
      "4/6 Dacre Street",
      "Mitchell ACT 2911",
      "W: www.landd.com.au"
    ];
    const rightX3 = pageWidth - headerPadding3;
    let headerCompanyY3 = headerPadding3 + 2;
    companyDetails3.forEach(line => {
      doc.text(line, rightX3, headerCompanyY3, { align: "right" });
      headerCompanyY3 += 6;
    });

    // Green line beneath header - same as page 2
    const headerBottomY3 = headerPadding3 + logoHeight + 8;
    doc.setDrawColor(0, 153, 0);
    doc.setLineWidth(1);
    doc.line(
      headerPadding3,
      headerBottomY3,
      pageWidth - headerPadding3,
      headerBottomY3
    );
    
    // INSPECTION DETAILS SECTION
    let y3 = headerBottomY3 + 10;
    
    // Header
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Inspection Details", headerPadding3, y3);
    y3 += 6;
    
    // Grouped text with height-aware spacing
    const inspectionText = `Following discussions with ${clearance.projectId?.client?.name || "{Client Name}"}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of ${clearance.clearanceType?.toLowerCase() || "non-friable"} asbestos from ${clearance.projectId?.name || "{Site Address}"} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by ${clearance.asbestosRemovalist || "Choose an item"}. ${clearance.LAA || "Patrick Cerone"} (ACT Licensed Asbestos Assessor - AA00031) from L&D visited the Site at time on ${clearance.clearanceDate ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB") : "25 July 2024"}.\n\nTable 1 below outlines the ACM that formed part of the inspection. Photographs of the Asbestos Removal Area and a Site Plan are presented in Appendix A and Appendix B respectively.`;
    
    // Set font properties BEFORE rendering text
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    
    // Add the text directly without the problematic height calculation
    doc.text(inspectionText, headerPadding3, y3, {
      maxWidth: pageWidth - headerPadding3 * 2,
      align: "justify"
    });
    
    // Manually adjust Y position for the next element
    y3 += 50; // Adjust this value as needed
    
    // TABLE 1: Asbestos Removal Areas
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Table 1: Asbestos Removal Areas", headerPadding3, y3);
    y3 += 4;
    
    if (items.length > 0) {
      // Table headers
      const tableHeaders = ["Item", "Location", "Material Description", "Asbestos Type"];
      const colWidths = [20,80, 40, 30];
      let tableX = headerPadding3;
      let tableY = y3;
      
      // Draw header row
      doc.setFont("Gothic Bold", "bold");
      doc.setFontSize(10);
      doc.setDrawColor(89, 89, 89);
      doc.setLineWidth(0.7);
      let colX = tableX;
      for (let i = 0; i < tableHeaders.length; i++) {
        doc.rect(colX, tableY, colWidths[i], 12, "D");
        doc.text(tableHeaders[i], colX + 2, tableY + 9);
        colX += colWidths[i];
      }
      
      // Draw data rows
      tableY += 12;
      doc.setFont("GOTHIC", "normal");
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (tableY > pageHeight - 100) {
          doc.addPage();
          tableY = 30;
        }
        
        colX = tableX;
        doc.rect(colX, tableY, colWidths[0], 10, "D");
        doc.text(`${i + 1}`, colX + 2, tableY + 7);
        colX += colWidths[0];
        
        doc.rect(colX, tableY, colWidths[1], 10, "D");
        doc.text(item.locationDescription || "N/A", colX + 2, tableY + 7);
        colX += colWidths[1];
        
        doc.rect(colX, tableY, colWidths[2], 10, "D");
        doc.text(item.materialDescription || "N/A", colX + 2, tableY + 7);
        colX += colWidths[2];
        
        doc.rect(colX, tableY, colWidths[3], 10, "D");
        doc.text(item.asbestosType || "N/A", colX + 2, tableY + 7);
        
        tableY += 10;
      }
      y3 = tableY + 10;
    } else {
      doc.setFont("GOTHIC", "normal");
      doc.text("No removal items recorded", headerPadding3, y3);
      y3 += 15;
    }
    
    // INSPECTION EXCLUSIONS SECTION
    if (y3 > pageHeight - 80) {
      doc.addPage();
      y3 = 30;
    }
    
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Inspection Exclusions", headerPadding3, y3);
    y3 += 6;
    
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const exclusionsText = "This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.";
    doc.text(exclusionsText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    y3 += 20;
    
    // CLEARANCE CERTIFICATION SECTION
    // Only add new page if we're very close to the bottom and can't fit the certification content
    if (y3 > pageHeight - 80) {
      doc.addPage();
      y3 = 30;
    }
    
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Clearance Certification", headerPadding3, y3);
    y3 += 6;
    
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const certificationText = `An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on ${clearance.clearanceDate ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB") : "25 July 2024"}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.`;
    doc.text(certificationText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    y3 += 20;
    
    const riskText = "The LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.";
    doc.text(riskText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    y3 += 12;
    
    const contactText = "Please do not hesitate to contact the undersigned should you have any queries regarding this report.";
    doc.text(contactText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    y3 += 12;
    
    const behalfText = "For and on behalf of Lancaster and Dickenson Consulting.";
    doc.text(behalfText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    y3 += 8;
    
    // Signature line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    // doc.line(footerPadding3, footerY3 - 5, pageWidth - footerPadding3, footerY3 - 5);
    y3 += 5;
    doc.setFontSize(10);
    doc.text(`${clearance.LAA || "Report Author"}`, headerPadding3, y3);
    y3 += 5;
    doc.text("ACT Licensed Asbestos Assessor - AA00004", headerPadding3, y3);
    
    // Footer for page 3
    const footerY3 = pageHeight - 10;
    const footerPadding3 = 18;
    
    // Green border above footer
    doc.setDrawColor(0, 153, 0);
    doc.setLineWidth(1.0);
    doc.line(footerPadding3, footerY3 - 5, pageWidth - footerPadding3, footerY3 - 5);

    // Footer text
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const footerText3 = `${clearance.clearanceType || "Non-friable"} Clearance Certificate: ${clearance.projectId?.name || "{Site Name}"}`;
    doc.text(footerText3, footerPadding3, footerY3 + 3);
    
    // Page number in bottom right
    doc.text("1", pageWidth - footerPadding3, footerY3 + 3, { align: "right" });

    // --- PAGE 4: BACKGROUND INFORMATION ---
    doc.addPage();

    // Header section height - same as page 3
    const headerPadding4 = 18;

    // Draw logo in top left
    doc.addImage(
      logoImg,
      "PNG",
      headerPadding4,
      headerPadding4,
      logoWidth,
      logoHeight
    );

    // Company details in top right - same as page 3
    doc.setFont("GOTHIC", "normal");
    doc.setFontSize(10);
    const companyDetails4 = [
      "Lancaster & Dickenson Consulting Pty Ltd",
      "4/6 Dacre Street",
      "Mitchell ACT 2911",
      "W: www.landd.com.au"
    ];
    const rightX4 = pageWidth - headerPadding4;
    let headerCompanyY4 = headerPadding4 + 2;
    companyDetails4.forEach(line => {
      doc.text(line, rightX4, headerCompanyY4, { align: "right" });
      headerCompanyY4 += 6;
    });

    // Green line beneath header - same as page 3
    const headerBottomY4 = headerPadding4 + logoHeight + 8;
    doc.setDrawColor(0, 153, 0);
    doc.setLineWidth(1);
    doc.line(
      headerPadding4,
      headerBottomY4,
      pageWidth - headerPadding4,
      headerBottomY4
    );
    
    // BACKGROUND INFORMATION SECTION
    let y4 = headerBottomY4 + 10;
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Background Information Regarding Non-friable Clearance Inspections", headerPadding4, y4);
    y4 += 6;
    
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const backgroundText = "Following completion of non-friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:";
    doc.text(backgroundText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    y4 += 20;
    
    // Bullet points
    const bulletPoint1 = "• Visual inspection of the work area for asbestos dust or debris";
    doc.text(bulletPoint1, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 8;
    
    const bulletPoint2 = "• Visual inspection of the adjacent area including the access and egress pathways for visible asbestos dust and debris";
    doc.text(bulletPoint2, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 12;
    
    const requirementsText = "It is required that a Non-Friable Clearance Certificate be issued on completion of a successful inspection. The issuer needs to ensure:";
    doc.text(requirementsText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    y4 += 12;
    
    // More bullet points
    const bulletPoint3 = "• This certificate should be issued prior to the area being re-occupied. This chain of events should occur regardless of whether the site is a commercial or residential property.";
    doc.text(bulletPoint3, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 12;
    
    const bulletPoint4 = "• The asbestos removal area and areas immediately surrounding it are visibly clean from asbestos contamination";
    doc.text(bulletPoint4, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 12;
    
    const bulletPoint5 = "• The removal area does not pose a risk to health safety and safety from exposure to asbestos";
    doc.text(bulletPoint5, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 18;
    
    // LEGISLATIVE REQUIREMENTS SECTION
    if (y4 > pageHeight - 100) {
      doc.addPage();
      y4 = 30;
    }
    
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Legislative Requirements", headerPadding4, y4);
    y4 += 6;
    
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const legislativeText = "Non-Friable Clearance Certificates should be written in general accordance with and with reference to:";
    doc.text(legislativeText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    y4 += 8;
    
    // Legislative bullet points
    const legislativePoint1 = "• ACT Work Health and Safety (WHS) Act 2011";
    doc.text(legislativePoint1, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 8;
    
    const legislativePoint2 = "• ACT Work Health and Safety Regulation 2011";
    doc.text(legislativePoint2, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 8;
    
    const legislativePoint3 = "• ACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) 2022";
    doc.text(legislativePoint3, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    y4 += 20;
    
    // LIMITATIONS SECTION
    if (y4 > pageHeight - 60) {
      doc.addPage();
      y4 = 30;
    }
    
    doc.setFontSize(12);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Non-Friable Clearance Certificate Limitations", headerPadding4, y4);
    y4 += 6;
    
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const limitationsText = "The visual clearance inspection was only carried out in the locations outlined within this document. L&D did not inspect any areas of the property that fall outside of the locations listed in this certificate and therefore make no comment regarding the presence or condition of other ACM that may or may not be present. When undertaking the inspection, the LAA tries to inspect as much of the asbestos removal area as possible. However, no inspection is absolute. Should suspect ACM be identified following the inspection, works should cease until an assessment of the materials is completed.";
    doc.text(limitationsText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    
    // Footer for page 4
    const footerY4 = pageHeight - 10;
    const footerPadding4 = 18;
    
    // Green border above footer
    doc.setDrawColor(0, 153, 0);
    doc.setLineWidth(1.0);
    doc.line(footerPadding4, footerY4 - 5, pageWidth - footerPadding4, footerY4 - 5);

    // Footer text
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    const footerText4 = `${clearance.clearanceType || "Non-friable"} Clearance Certificate: ${clearance.projectId?.name || "{Site Name}"}`;
    doc.text(footerText4, footerPadding4, footerY4 + 3);
    
    // Page number in bottom right
    doc.text("2", pageWidth - footerPadding4, footerY4 + 3, { align: "right" });

    // --- REST OF REPORT (existing logic) ---
    if (items.length > 0) {
      doc.addPage();
      doc.setFontSize(18);
      doc.setFont("Gothic Bold", "bold");
      doc.text("Clearance Items", 20, 30);
      let yPosition = 50;
      let itemNumber = 1;
      for (const item of items) {
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 30;
        }
        doc.setFontSize(14);
        doc.setFont("Gothic Bold", "bold");
        doc.text(
          `Item ${itemNumber}: ${item.locationDescription}`,
          20,
          yPosition
        );
        yPosition += 15;
        doc.setFontSize(12);
        doc.setFont("GOTHIC", "normal");
        doc.text(
          `Material Description: ${item.materialDescription}`,
          20,
          yPosition
        );
        yPosition += 10;
        doc.text(
          `Asbestos Type: ${item.asbestosType || "N/A"}`,
          20,
          yPosition
        );
        yPosition += 10;
        if (item.notes) {
          doc.text(`Notes: ${item.notes}`, 20, yPosition);
          yPosition += 10;
        }
        if (item.photograph && includePhotographs) {
          try {
            // Use the utility function for image compression
            const compressedImage = await compressImageForPDF(item.photograph, 700, 400, 0.8);
            
            // Get image dimensions for positioning
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              setTimeout(reject, 5000);
              img.src = compressedImage;
            });
            
            let imgWidth = img.width;
            let imgHeight = img.height;
            
            if (yPosition + imgHeight > pageHeight - 30) {
              doc.addPage();
              yPosition = 30;
            }
            
            doc.addImage(
              compressedImage,
              "JPEG",
              20,
              yPosition,
              imgWidth,
              imgHeight
            );
            yPosition += imgHeight + 10;
          } catch (error) {
            console.error("Error adding image to PDF:", error);
            doc.text("Photo: [Error loading image]", 20, yPosition);
            yPosition += 10;
          }
        } else {
          doc.text("Photo: No photo available", 20, yPosition);
          yPosition += 10;
        }
        if (!includePhotographs && item.photograph) {
          doc.text("Photo: [Photographs disabled for file size optimization]", 20, yPosition);
          yPosition += 10;
        }
        if (itemNumber < items.length) {
          doc.setDrawColor(200, 200, 200);
          doc.line(20, yPosition, pageWidth - 20, yPosition);
          yPosition += 20;
        }
        itemNumber++;
      }
    }
    // Save the PDF
    const fileName = `Clearance_Report_${clearance.projectId?.projectID || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error("Error generating PDF report:", err);
    if (setError) {
      setError("Failed to generate PDF report");
    }
  }
}; 