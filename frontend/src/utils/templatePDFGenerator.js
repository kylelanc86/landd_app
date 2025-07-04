import jsPDF from "jspdf";

export const generateTemplatePDF = async (template, sampleData, replacePlaceholders) => {
  // Create a new PDF document
  const doc = new jsPDF();
  
  // Set up the page
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  
  let y = margin;

  // Helper function to add text with proper spacing
  const addText = (text, fontSize = 11, fontStyle = "normal", spacing = 8) => {
    if (!text) return y;
    
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", fontStyle);
    
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(text, margin, y, { maxWidth: contentWidth });
    
    y += (lines.length * fontSize * 1.2) + spacing;
    return y;
  };

  // Helper function to add header
  const addHeader = (text, fontSize = 14, fontStyle = "bold") => {
    return addText(text, fontSize, fontStyle, 12);
  };

  // Front Cover
  y = addHeader(
    replacePlaceholders(
      template.standardSections.frontCoverTitle || "Non-friable Asbestos Removal Clearance"
    ),
    16,
    "bold"
  );
  y = addText(
    replacePlaceholders(template.standardSections.frontCoverSubtitle || ""),
    12,
    "normal",
    20
  );

  // Add a line break
  y += 10;

  // Company Details
  if (template.companyDetails) {
    y = addHeader("Company Details", 12, "bold");
    Object.entries(template.companyDetails).forEach(([key, value]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      y = addText(`${label}: ${value}`, 10, "normal", 4);
    });
    y += 10;
  }

  // Inspection Details
  y = addHeader(
    replacePlaceholders(
      template.standardSections.inspectionDetailsTitle || "Inspection Details"
    ),
    12,
    "bold"
  );
  y = addText(
    replacePlaceholders(template.standardSections.inspectionIntroduction || ""),
    10,
    "normal",
    8
  );
  y = addText(
    replacePlaceholders(template.standardSections.inspectionSpecifics || ""),
    10,
    "normal",
    8
  );
  y = addText(
    replacePlaceholders(template.standardSections.tableIntroduction || ""),
    10,
    "normal",
    8
  );

  // Add a sample inspection table
  y = addText("Sample Inspection Results:", 10, "bold", 4);
  
  // Simple table structure
  const tableData = [
    ["Area", "Material Type", "Condition", "Result"],
    ["Kitchen", "Vinyl Floor Tiles", "Good", "Pass"],
    ["Bathroom", "Vinyl Floor Tiles", "Good", "Pass"],
    ["Living Room", "Vinyl Floor Tiles", "Good", "Pass"],
  ];

  tableData.forEach((row, index) => {
    const isHeader = index === 0;
    const fontStyle = isHeader ? "bold" : "normal";
    const fontSize = isHeader ? 10 : 9;
    
    // Calculate column widths
    const colWidths = [40, 50, 40, 30];
    let x = margin;
    
    row.forEach((cell, colIndex) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", fontStyle);
      doc.text(cell, x, y, { maxWidth: colWidths[colIndex] });
      x += colWidths[colIndex] + 5;
    });
    
    y += fontSize * 1.2 + 2;
  });
  
  y += 10;

  // Check if we need a new page
  if (y > pageHeight - 100) {
    doc.addPage();
    y = margin;
  }

  // Clearance Certification
  y = addHeader(
    replacePlaceholders(
      template.standardSections.clearanceCertificationTitle || "Clearance Certification"
    ),
    12,
    "bold"
  );
  y = addText(
    replacePlaceholders(template.standardSections.clearanceCertificationText || ""),
    10,
    "normal",
    8
  );
  y = addText(
    replacePlaceholders(template.standardSections.riskAssessmentText || ""),
    10,
    "normal",
    8
  );
  y = addText(
    replacePlaceholders(template.standardSections.contactText || ""),
    10,
    "normal",
    8
  );
  y = addText(
    replacePlaceholders(template.standardSections.behalfText || ""),
    10,
    "normal",
    8
  );
  y = addText(
    replacePlaceholders(template.standardSections.signatureTitle || ""),
    10,
    "bold",
    8
  );

  // Check if we need a new page
  if (y > pageHeight - 100) {
    doc.addPage();
    y = margin;
  }

  // Background Information
  y = addHeader(
    replacePlaceholders(
      template.standardSections.backgroundTitle || "Background Information"
    ),
    12,
    "bold"
  );
  y = addText(
    replacePlaceholders(template.standardSections.backgroundIntroduction || ""),
    10,
    "normal",
    8
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.bulletPoint1 || "")}`,
    10,
    "normal",
    4
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.bulletPoint2 || "")}`,
    10,
    "normal",
    4
  );
  y = addText(
    replacePlaceholders(template.standardSections.requirementsText || ""),
    10,
    "normal",
    8
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.bulletPoint3 || "")}`,
    10,
    "normal",
    4
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.bulletPoint4 || "")}`,
    10,
    "normal",
    4
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.bulletPoint5 || "")}`,
    10,
    "normal",
    4
  );

  // Check if we need a new page
  if (y > pageHeight - 100) {
    doc.addPage();
    y = margin;
  }

  // Legislative Requirements
  y = addHeader(
    replacePlaceholders(
      template.standardSections.legislativeTitle || "Legislative Requirements"
    ),
    12,
    "bold"
  );
  y = addText(
    replacePlaceholders(template.standardSections.legislativeIntroduction || ""),
    10,
    "normal",
    8
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.legislativePoint1 || "")}`,
    10,
    "normal",
    4
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.legislativePoint2 || "")}`,
    10,
    "normal",
    4
  );
  y = addText(
    `• ${replacePlaceholders(template.standardSections.legislativePoint3 || "")}`,
    10,
    "normal",
    4
  );

  // Limitations
  y = addHeader(
    replacePlaceholders(
      template.standardSections.limitationsTitle || "Limitations"
    ),
    12,
    "bold"
  );
  y = addText(
    replacePlaceholders(template.standardSections.limitationsText || ""),
    10,
    "normal",
    8
  );

  // Check if we need a new page for signature
  if (y > pageHeight - 150) {
    doc.addPage();
    y = margin;
  }

  // Signature Section
  y = addHeader("Authorised Signature", 12, "bold");
  y += 20; // Space for signature line
  
  // Signature line
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 80, y);
  y += 5;
  
  // Signature details
  y = addText("Name: John Smith", 10, "normal", 4);
  y = addText("License: AI000456", 10, "normal", 4);
  y = addText("Date: 25 July 2024", 10, "normal", 4);
  
  y += 20;

  // Footer
  y = addText(
    replacePlaceholders(template.standardSections.footerText || ""),
    9,
    "normal",
    8
  );

  // Save the PDF
  const fileName = `asbestos-clearance-template-preview-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);

  return fileName;
}; 