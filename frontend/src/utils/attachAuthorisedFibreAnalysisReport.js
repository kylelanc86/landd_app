import asbestosAssessmentService from "../services/asbestosAssessmentService";
import { generateFibreIDReport } from "./generateFibreIDReport";

function isVisuallyAssessed(item) {
  return (
    item.asbestosContent === "Visually Assessed as Asbestos" ||
    item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
    item.asbestosContent === "Visually Assessed as Non-asbestos"
  );
}

function analystName(fullAssessment) {
  const analyst = fullAssessment.analyst;
  if (analyst && typeof analyst === "object" && analyst.firstName) {
    return `${analyst.firstName} ${analyst.lastName}`;
  }
  const itemWithAnalyst = (fullAssessment.items || []).find(
    (item) => item.analysedBy && item.analysisData?.isAnalysed === true,
  );
  const analysedBy = itemWithAnalyst?.analysedBy;
  if (analysedBy && typeof analysedBy === "object" && analysedBy.firstName) {
    return `${analysedBy.firstName} ${analysedBy.lastName}`;
  }
  return "Unknown Analyst";
}

/** Store the authorised Fibre ID PDF on an assessment that was signed off without it. */
export async function attachAuthorisedFibreAnalysisReport(assessmentId) {
  const fullAssessment = await asbestosAssessmentService.getById(assessmentId, {
    omitPhotoData: true,
    omitPlanFiles: true,
  });
  const approvedBy = fullAssessment?.reportApprovedBy;
  if (approvedBy == null || String(approvedBy).trim() === "") {
    throw new Error(
      "The L&D supplied job must be authorised before this assessment report can be reviewed.",
    );
  }
  if (
    typeof fullAssessment.fibreAnalysisReport === "string" &&
    fullAssessment.fibreAnalysisReport.trim() !== ""
  ) {
    return;
  }

  const seenRefs = new Set();
  const sampledItems = (fullAssessment.items || []).filter((item) => {
    if (!item.sampleReference || item.sampleReference.trim() === "") return false;
    if (isVisuallyAssessed(item)) return false;
    if (item.analysisData?.isAnalysed !== true) return false;
    const ref = item.sampleReference.trim();
    if (seenRefs.has(ref)) return false;
    seenRefs.add(ref);
    return true;
  });
  if (sampledItems.length === 0) {
    throw new Error(
      "No analysed samples found. The L&D supplied report could not be saved on the assessment.",
    );
  }

  const projectID = fullAssessment.projectId?.projectID || "Unknown";
  const pdfDataUrl = await generateFibreIDReport({
    assessment: {
      _id: fullAssessment._id,
      projectId: fullAssessment.projectId,
      status: fullAssessment.status,
      assessmentDate: fullAssessment.assessmentDate,
      samplesReceivedDate: fullAssessment.samplesReceivedDate,
      revision: fullAssessment.revision || 0,
      LAA: fullAssessment.LAA,
      assessorId: fullAssessment.assessorId,
      fibreIdReportReference: fullAssessment.fibreIdReportReference || null,
    },
    sampleItems: sampledItems.map((item, index) => ({
      itemNumber: item.itemNumber || index + 1,
      sampleReference: item.sampleReference || `Sample ${index + 1}`,
      labReference: `${projectID}-Lab${index + 1}`,
      locationDescription: item.locationDescription || "N/A",
      analysisData: item.analysisData,
    })),
    analyst: analystName(fullAssessment),
    openInNewTab: false,
    returnPdfData: true,
    reportApprovedBy: approvedBy,
    reportIssueDate: fullAssessment.reportIssueDate || null,
  });
  const base64Data =
    pdfDataUrl && pdfDataUrl.includes(",") ? pdfDataUrl.split(",")[1] : null;
  if (!base64Data) {
    throw new Error("The L&D supplied analysis report could not be saved on the assessment.");
  }
  await asbestosAssessmentService.uploadFibreAnalysisReport(assessmentId, base64Data);
}
