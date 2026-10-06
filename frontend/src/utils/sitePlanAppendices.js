/**
 * Shared site-plan appendix helpers (shape matches asbestos assessment / lead plans).
 */

export function normalizeSitePlan(plan, defaultFigureTitle) {
  return {
    sitePlan: true,
    sitePlanFile: plan.sitePlanFile,
    sitePlanLegend: Array.isArray(plan.sitePlanLegend) ? plan.sitePlanLegend : [],
    sitePlanLegendTitle: plan.sitePlanLegendTitle || "Key",
    sitePlanFigureTitle: plan.sitePlanFigureTitle || defaultFigureTitle,
    sitePlanSource: plan.sitePlanSource || "drawn",
  };
}

/**
 * Resolve plans from appendices array, falling back to legacy single sitePlanFile.
 * @param {object} entity
 * @param {{ appendicesField?: string, defaultFigureTitle?: string, countField?: string }} options
 */
export function getSitePlanAppendices(entity, options = {}) {
  const {
    appendicesField = "sitePlanAppendices",
    defaultFigureTitle = "Site Plan",
  } = options;
  if (!entity) return [];
  const fromArray = (entity[appendicesField] || []).filter(
    (p) => p && p.sitePlanFile,
  );
  if (fromArray.length > 0) {
    return fromArray.map((p) => normalizeSitePlan(p, defaultFigureTitle));
  }
  if (entity.sitePlanFile) {
    return [
      normalizeSitePlan(
        {
          sitePlanFile: entity.sitePlanFile,
          sitePlanLegend: entity.sitePlanLegend,
          sitePlanLegendTitle: entity.sitePlanLegendTitle,
          sitePlanFigureTitle: entity.sitePlanFigureTitle,
          sitePlanSource: entity.sitePlanSource,
        },
        defaultFigureTitle,
      ),
    ];
  }
  return [];
}

export function countSitePlans(entity, options = {}) {
  const { countField = "sitePlanAppendixFileCount", ...rest } = options;
  if (!entity) return 0;
  if (typeof entity[countField] === "number") {
    return entity[countField];
  }
  return getSitePlanAppendices(entity, rest).length;
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
