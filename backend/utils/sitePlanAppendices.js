/**
 * Shared sanitize / sync helpers for sitePlanAppendices on clearances and assessments.
 */

function sanitizePlanAppendixList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const sitePlanFile =
        typeof entry.sitePlanFile === "string" && entry.sitePlanFile.trim()
          ? entry.sitePlanFile.trim()
          : null;
      if (!sitePlanFile) return null;
      const legend = Array.isArray(entry.sitePlanLegend)
        ? entry.sitePlanLegend
            .filter((e) => e && e.color)
            .map((e) => ({
              color: String(e.color || "").trim(),
              description:
                typeof e.description === "string" ? e.description.trim() : "",
            }))
        : [];
      return {
        sitePlan: true,
        sitePlanFile,
        sitePlanSource: ["uploaded", "drawn"].includes(entry.sitePlanSource)
          ? entry.sitePlanSource
          : "drawn",
        sitePlanLegend: legend,
        sitePlanLegendTitle:
          typeof entry.sitePlanLegendTitle === "string" &&
          entry.sitePlanLegendTitle.trim()
            ? entry.sitePlanLegendTitle.trim()
            : "Key",
        sitePlanFigureTitle:
          typeof entry.sitePlanFigureTitle === "string" &&
          entry.sitePlanFigureTitle.trim()
            ? entry.sitePlanFigureTitle.trim()
            : null,
      };
    })
    .filter(Boolean);
}

/** Keep legacy single sitePlan* fields in sync with the first appendix entry. */
function syncLegacySitePlanFieldsFromAppendices(target, appendices) {
  if (!appendices || appendices.length === 0) {
    target.sitePlan = false;
    target.sitePlanFile = null;
    target.sitePlanSource = undefined;
    target.sitePlanLegend = [];
    target.sitePlanLegendTitle = null;
    target.sitePlanFigureTitle = null;
    return;
  }
  const first = appendices[0];
  target.sitePlan = true;
  target.sitePlanFile = first.sitePlanFile;
  target.sitePlanSource = first.sitePlanSource;
  target.sitePlanLegend = first.sitePlanLegend;
  target.sitePlanLegendTitle = first.sitePlanLegendTitle;
  target.sitePlanFigureTitle = first.sitePlanFigureTitle;
}

/** Resolve appendices with legacy single-file fallback (for PDF). */
function resolveSitePlanAppendices(data, appendicesField = "sitePlanAppendices") {
  const fromArray = (data?.[appendicesField] || []).filter(
    (p) => p && p.sitePlanFile,
  );
  if (fromArray.length > 0) return fromArray;
  if (data?.sitePlan && data?.sitePlanFile) {
    return [
      {
        sitePlan: true,
        sitePlanFile: data.sitePlanFile,
        sitePlanSource: data.sitePlanSource || "drawn",
        sitePlanLegend: Array.isArray(data.sitePlanLegend)
          ? data.sitePlanLegend
          : [],
        sitePlanLegendTitle: data.sitePlanLegendTitle || "Key",
        sitePlanFigureTitle: data.sitePlanFigureTitle || null,
      },
    ];
  }
  return [];
}

module.exports = {
  sanitizePlanAppendixList,
  syncLegacySitePlanFieldsFromAppendices,
  resolveSitePlanAppendices,
};
