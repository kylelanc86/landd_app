export const DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE = "Asbestos Survey Site Plan";

export function isResidentialAssessmentPath(pathname) {
  return (pathname || "").includes("residential-asbestos");
}

export function getAssessmentSitePlansBasePath(pathname, assessmentId) {
  return isResidentialAssessmentPath(pathname)
    ? `/surveys/residential-asbestos/${assessmentId}/site-plans`
    : `/surveys/asbestos-assessment/${assessmentId}/site-plans`;
}

export function getAssessmentSitePlanEditPath(pathname, assessmentId, planIndex) {
  const base = getAssessmentSitePlansBasePath(pathname, assessmentId);
  return `${base}/${planIndex}/edit`;
}

export function getAssessmentItemsPath(pathname, assessmentId) {
  return isResidentialAssessmentPath(pathname)
    ? `/surveys/residential-asbestos/${assessmentId}/items`
    : `/surveys/asbestos-assessment/${assessmentId}/items`;
}

function normalizePlan(plan) {
  return {
    sitePlan: true,
    sitePlanFile: plan.sitePlanFile,
    sitePlanLegend: Array.isArray(plan.sitePlanLegend) ? plan.sitePlanLegend : [],
    sitePlanLegendTitle: plan.sitePlanLegendTitle || "Key",
    sitePlanFigureTitle:
      plan.sitePlanFigureTitle || DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE,
    sitePlanSource: plan.sitePlanSource || "drawn",
  };
}

/** Resolve site plans from appendices array, falling back to legacy single sitePlanFile. */
export function getAsbestosSitePlanAppendices(assessment) {
  if (!assessment) return [];
  const fromArray = (assessment.sitePlanAppendices || []).filter(
    (p) => p && p.sitePlanFile,
  );
  if (fromArray.length > 0) {
    return fromArray.map(normalizePlan);
  }
  if (assessment.sitePlanFile) {
    return [
      normalizePlan({
        sitePlanFile: assessment.sitePlanFile,
        sitePlanLegend: assessment.sitePlanLegend,
        sitePlanLegendTitle: assessment.sitePlanLegendTitle,
        sitePlanFigureTitle: assessment.sitePlanFigureTitle,
        sitePlanSource: assessment.sitePlanSource,
      }),
    ];
  }
  return [];
}

export function countAsbestosSitePlans(assessment) {
  if (!assessment) return 0;
  if (typeof assessment.sitePlanAppendixFileCount === "number") {
    return assessment.sitePlanAppendixFileCount;
  }
  return getAsbestosSitePlanAppendices(assessment).length;
}

export function stripPlanForApi(plan) {
  return {
    sitePlan: true,
    sitePlanFile: plan.sitePlanFile,
    sitePlanLegend: Array.isArray(plan.sitePlanLegend) ? plan.sitePlanLegend : [],
    sitePlanLegendTitle: plan.sitePlanLegendTitle || "Key",
    sitePlanFigureTitle: plan.sitePlanFigureTitle || null,
    sitePlanSource: plan.sitePlanSource || "drawn",
  };
}

export function buildAssessmentUpdatePayload(assessment, extra = {}) {
  return {
    projectId: assessment.projectId?._id || assessment.projectId,
    assessmentDate: assessment.assessmentDate,
    status: assessment.status,
    ...extra,
  };
}
