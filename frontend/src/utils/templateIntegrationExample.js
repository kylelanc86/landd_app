import { populateTemplateContent, getSectionContent } from './templateDataBinding';

/**
 * Example of how to integrate template content with existing PDF generation
 * This shows how to replace hardcoded text in your generateClearanceReport.js
 */
export const integrateTemplateWithPDF = async (clearance, setError, options = {}) => {
  try {
    // Step 1: Populate template with job data
    const populatedTemplate = await populateTemplateContent(clearance);
    
    // Step 2: Use template content instead of hardcoded text
    // This is how you would replace the hardcoded content in your PDF generation
    
    // Example replacements for your existing generateClearanceReport.js:
    
    // Instead of:
    // doc.text("ASBESTOS REMOVAL CLEARANCE CERTIFICATE", leftMargin, y);
    // Use:
    const reportTitle = populatedTemplate.standardSections.frontCoverTitle;
    // doc.text(reportTitle, leftMargin, y);
    
    // Instead of:
    // doc.text("Inspection Details", headerPadding3, y3);
    // Use:
    const inspectionTitle = populatedTemplate.standardSections.inspectionDetailsTitle;
    // doc.text(inspectionTitle, headerPadding3, y3);
    
    // Instead of:
    // const inspectionText = `Following discussions with ${clearance.projectId?.client?.name || "{Client Name}"}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of ${clearance.clearanceType?.toLowerCase() || "non-friable"} asbestos from ${clearance.projectId?.name || "{Site Address}"} (herein referred to as 'the Site').`;
    // Use:
    const inspectionIntro = populatedTemplate.standardSections.inspectionIntroduction;
    // doc.text(inspectionIntro, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    
    // Instead of:
    // doc.text("Clearance Certification", headerPadding3, y3);
    // Use:
    const certificationTitle = populatedTemplate.standardSections.clearanceCertificationTitle;
    // doc.text(certificationTitle, headerPadding3, y3);
    
    // Instead of:
    // const certificationText = `An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on ${clearance.clearanceDate ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB") : "25 July 2024"}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.`;
    // Use:
    const certificationText = populatedTemplate.standardSections.clearanceCertificationText;
    // doc.text(certificationText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    
    // Instead of:
    // const riskText = "The LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.";
    // Use:
    const riskText = populatedTemplate.standardSections.riskAssessmentText;
    // doc.text(riskText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    
    // Instead of:
    // const contactText = "Please do not hesitate to contact the undersigned should you have any queries regarding this report.";
    // Use:
    const contactText = populatedTemplate.standardSections.contactText;
    // doc.text(contactText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    
    // Instead of:
    // const behalfText = "For and on behalf of Lancaster and Dickenson Consulting.";
    // Use:
    const behalfText = populatedTemplate.standardSections.behalfText;
    // doc.text(behalfText, headerPadding3, y3, { maxWidth: pageWidth - headerPadding3 * 2, align: "justify" });
    
    // Instead of:
    // doc.text("ACT Licensed Asbestos Assessor - AA00004", headerPadding3, y3);
    // Use:
    const signatureTitle = populatedTemplate.standardSections.signatureTitle;
    // doc.text(signatureTitle, headerPadding3, y3);
    
    // Instead of:
    // const backgroundText = "Following completion of non-friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:";
    // Use:
    const backgroundText = populatedTemplate.standardSections.backgroundIntroduction;
    // doc.text(backgroundText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    
    // Instead of:
    // const bulletPoint1 = "• Visual inspection of the work area for asbestos dust or debris";
    // Use:
    const bulletPoint1 = populatedTemplate.standardSections.bulletPoint1;
    // doc.text(bulletPoint1, headerPadding4 + 10, y4, { maxWidth: pageWidth - headerPadding4 * 2 - 10 });
    
    // Instead of:
    // const legislativeText = "Non-Friable Clearance Certificates should be written in general accordance with and with reference to:";
    // Use:
    const legislativeText = populatedTemplate.standardSections.legislativeIntroduction;
    // doc.text(legislativeText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    
    // Instead of:
    // const limitationsText = "The visual clearance inspection was only carried out in the locations outlined within this document. L&D did not inspect any areas of the property that fall outside of the locations listed in this certificate and therefore make no comment regarding the presence or condition of other ACM that may or may not be present. When undertaking the inspection, the LAA tries to inspect as much of the asbestos removal area as possible. However, no inspection is absolute. Should suspect ACM be identified following the inspection, works should cease until an assessment of the materials is completed.";
    // Use:
    const limitationsText = populatedTemplate.standardSections.limitationsText;
    // doc.text(limitationsText, headerPadding4, y4, { maxWidth: pageWidth - headerPadding4 * 2, align: "justify" });
    
    // Instead of:
    // const footerText = `${clearance.clearanceType || "Non-friable"} Clearance Certificate: ${clearance.projectId?.name || "{Site Name}"}`;
    // Use:
    const footerText = populatedTemplate.standardSections.footerText;
    // doc.text(footerText, footerPadding, footerY + 3);
    
    console.log("Template integration example - populated content:", {
      reportTitle,
      inspectionTitle,
      inspectionIntro,
      certificationTitle,
      certificationText,
      riskText,
      contactText,
      behalfText,
      signatureTitle,
      backgroundText,
      bulletPoint1,
      legislativeText,
      limitationsText,
      footerText,
    });
    
    return populatedTemplate;
    
  } catch (error) {
    console.error("Error integrating template with PDF:", error);
    if (setError) {
      setError("Failed to load template content");
    }
    throw error;
  }
};

/**
 * Example of how to get specific section content
 */
export const getSpecificSectionExample = async (clearance, sectionKey) => {
  try {
    const populatedTemplate = await populateTemplateContent(clearance);
    return getSectionContent(populatedTemplate, sectionKey, populatedTemplate.jobData);
  } catch (error) {
    console.error("Error getting section content:", error);
    return "";
  }
};

/**
 * Example of how to validate template data before generating PDF
 */
export const validateTemplateBeforePDF = async (clearance) => {
  try {
    const populatedTemplate = await populateTemplateContent(clearance);
    
    // Check if all required sections have content
    const requiredSections = [
      'frontCoverTitle',
      'inspectionDetailsTitle',
      'clearanceCertificationTitle',
      'clearanceCertificationText',
      'riskAssessmentText',
    ];
    
    const missingSections = requiredSections.filter(
      section => !populatedTemplate.standardSections[section]
    );
    
    if (missingSections.length > 0) {
      console.warn("Missing template sections:", missingSections);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error validating template:", error);
    return false;
  }
}; 