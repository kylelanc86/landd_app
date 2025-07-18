import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

/**
 * Generate PDF from HTML templates using server-side Puppeteer
 * @param {string} templateType - Type of template (e.g., 'asbestos-clearance')
 * @param {Object} data - Clearance data
 * @returns {Promise<string>} - Generated PDF filename
 */
export const generateHTMLPDF = async (templateType, data) => {
  return generateHTMLTemplatePDF(templateType, data);
    };

export const generateAssessmentPDF = async (assessmentData) => {
  try {
    console.log('Starting assessment PDF generation with data:', assessmentData);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
    
    // Use the same API configuration as the rest of the app
    const apiBaseUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api");
    
    const requestUrl = `${apiBaseUrl}/pdf/generate-asbestos-assessment?t=${Date.now()}`;
    console.log('Calling backend URL:', requestUrl);

    // Call the server-side PDF generation endpoint with cache busting
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({ assessmentData: assessmentData })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText || 'Failed to generate assessment PDF' };
      }
      throw new Error(errorData.error || 'Failed to generate assessment PDF');
    }

    // Get the PDF blob
    const pdfBlob = await response.blob();
    console.log('Assessment PDF blob size:', pdfBlob.size, 'bytes');

    // Create a download link
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with new format
    const jobReference = assessmentData.projectId?.projectID || 'Unknown';
    const siteName = assessmentData.projectId?.name || 'Unknown Site';
    const assessmentDate = assessmentData.assessmentDate 
      ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB').replace(/\//g, '-')
      : new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    
    const fileName = `${jobReference}: Asbestos Assessment Report - ${siteName} (${assessmentDate}).pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    window.URL.revokeObjectURL(url);

    console.log('Assessment PDF downloaded successfully:', fileName);
    return fileName;
  } catch (error) {
    console.error('Error generating assessment PDF:', error);
    throw error;
  }
};

export const generateHTMLTemplatePDF = async (templateType, data) => {
  try {
    console.log('Starting server-side PDF generation with data:', data);
    
    // Use the same API configuration as the rest of the app
    const apiBaseUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api");
    
    const requestUrl = `${apiBaseUrl}/pdf/generate-asbestos-clearance?t=${Date.now()}`;
    console.log('Calling backend URL:', requestUrl);

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    try {
      // Call the server-side PDF generation endpoint with cache busting and timeout
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
        body: JSON.stringify({ clearanceData: data }),
        signal: controller.signal
    });

      clearTimeout(timeoutId); // Clear timeout if request completes

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Failed to generate PDF' };
        }
      throw new Error(errorData.error || 'Failed to generate PDF');
    }

    // Get the PDF blob
    const pdfBlob = await response.blob();
    console.log('PDF blob size:', pdfBlob.size, 'bytes');

      if (pdfBlob.size === 0) {
        throw new Error('Generated PDF is empty');
      }

    // Create a download link
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with new format
    const jobReference = data.projectId?.projectID || 'Unknown';
    const clearanceType = data.clearanceType || 'Non-friable';
    const siteName = data.projectId?.name || 'Unknown Site';
    const clearanceDate = data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB').replace(/\//g, '-')
      : new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    
    const fileName = `${jobReference}: ${clearanceType} Asbestos Clearance Report - ${siteName} (${clearanceDate}).pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    console.log('PDF generation completed successfully:', fileName);
    return fileName;
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('PDF generation timed out after 5 minutes. Please try again.');
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error("Error generating HTML template PDF:", error);
    console.error("Error stack:", error.stack);
    throw error;
  }
}; 