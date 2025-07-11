// Default content for Lead Assessment Report Templates
const leadAssessmentDefaultContent = {
  // Executive Summary
  executiveSummaryTitle: "EXECUTIVE SUMMARY",
  executiveSummaryContent: "This report presents the findings of a comprehensive lead assessment conducted at {SITE_NAME}. The assessment was undertaken to evaluate potential lead hazards and provide recommendations for risk management.",
  
  // Site Description
  siteDescriptionTitle: "SITE DESCRIPTION",
  siteDescriptionContent: "The assessment was conducted at {SITE_NAME}, located at {SITE_ADDRESS}. The site consists of {BUILDING_DESCRIPTION} and was constructed in approximately {CONSTRUCTION_YEAR}.",
  
  // Assessment Methodology
  assessmentMethodologyTitle: "ASSESSMENT METHODOLOGY",
  assessmentMethodologyContent: "The lead assessment was conducted using the following methodology:\n\n• Visual inspection of all accessible areas\n• Surface sampling using wipe sampling techniques\n• Air monitoring for lead particulates\n• Analysis conducted in accordance with NATA accredited methods",
  
  // Sampling Results
  samplingResultsTitle: "SAMPLING RESULTS",
  samplingResultsContent: "A total of {NUMBER_OF_SAMPLES} samples were collected and analyzed for lead content. The results are presented in Table 1 below, with detailed laboratory reports attached in Appendix A.",
  
  // Risk Assessment
  riskAssessmentTitle: "RISK ASSESSMENT",
  riskAssessmentContent: "Based on the sampling results and visual inspection, the following risk assessment has been conducted:\n\n• Areas with lead levels above regulatory limits\n• Potential exposure pathways\n• Risk to building occupants and workers",
  
  // Recommendations
  recommendationsTitle: "RECOMMENDATIONS",
  recommendationsContent: "The following recommendations are provided based on the assessment findings:\n\n• Immediate actions required\n• Long-term management strategies\n• Monitoring requirements\n• Training and awareness programs",
  
  // Conclusion
  conclusionTitle: "CONCLUSION",
  conclusionContent: "The lead assessment has identified {NUMBER_OF_ISSUES} areas requiring attention. Implementation of the recommended control measures will ensure compliance with relevant legislation and protect the health and safety of building occupants.",
  
  // Footer
  footerText: "Lead Assessment Report: {SITE_NAME} - {REPORT_DATE}",
};

module.exports = leadAssessmentDefaultContent; 