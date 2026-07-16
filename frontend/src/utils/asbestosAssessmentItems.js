/**
 * Referred vs primary sample helpers for asbestos assessment items.
 *
 * Rules:
 * - isReferred === true → always a referred row (not a real sample)
 * - When multiple items share a sampleReference, only one is the primary sample;
 *   the rest are treated as referred (even if isReferred was wrongly false/undefined)
 * - A lone item with a sampleReference is always the primary sample
 */

const itemIdsEqual = (a, b) => {
  if (a == null || b == null) return false;
  return String(a) === String(b);
};

const sameItem = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return itemIdsEqual(a._id, b._id);
};

/**
 * Pick the primary sampled item among rows that share a sample reference.
 * Prefers: not explicitly referred → analysed → sole explicit primary → earliest created.
 */
export function pickPrimaryAmongDuplicates(withRef) {
  const group = withRef || [];
  if (group.length === 0) return null;
  if (group.length === 1) return group[0];

  const notMarkedReferred = group.filter((i) => i.isReferred !== true);
  const pool = notMarkedReferred.length > 0 ? notMarkedReferred : group;

  const analysed = pool.find((i) => i.analysisData?.isAnalysed === true);
  if (analysed) return analysed;

  const explicitPrimaries = pool.filter((i) => i.isReferred === false);
  if (explicitPrimaries.length === 1) return explicitPrimaries[0];

  return [...pool].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a._id || "").localeCompare(String(b._id || ""));
  })[0];
}

/** Primary (non-referred) item for a sample reference. */
export function findPrimarySampledItemForRef(items, ref) {
  const r = String(ref || "").trim();
  if (!r) return null;
  const withRef = (items || []).filter(
    (i) => String(i.sampleReference || "").trim() === r,
  );
  return pickPrimaryAmongDuplicates(withRef);
}

/**
 * True when this row is a referred sample (reference to another item's sample),
 * not a real sample for analysis / chain-of-custody / lab numbering.
 */
export function isAssessmentItemReferred(item, items = []) {
  if (!item) return false;
  if (item.isReferred === true) return true;

  const ref = String(item.sampleReference || "").trim();
  if (!ref) return false;

  const withRef = (items || []).filter(
    (i) => String(i.sampleReference || "").trim() === ref,
  );
  if (withRef.length <= 1) return false;

  const primary = pickPrimaryAmongDuplicates(withRef);
  if (!primary) return false;
  return !sameItem(item, primary);
}

/** Unique primary sampled items (one per sample reference), excluding referred rows. */
export function getPrimarySampledItems(items, { excludeVisuallyAssessed } = {}) {
  const list = items || [];
  const seen = new Set();
  return list.filter((item) => {
    const ref = String(item.sampleReference || "").trim();
    if (!ref) return false;
    if (
      excludeVisuallyAssessed &&
      typeof excludeVisuallyAssessed === "function" &&
      excludeVisuallyAssessed(item)
    ) {
      return false;
    }
    if (isAssessmentItemReferred(item, list)) return false;
    if (seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });
}

/**
 * Ensure isReferred flags match primary-vs-referred rules for shared sample refs.
 * Mutates items in place. Returns { items, changed }.
 */
export function healReferredFlags(items) {
  const list = items || [];
  let changed = false;

  const byRef = new Map();
  for (const item of list) {
    const ref = String(item.sampleReference || "").trim();
    if (!ref) {
      if (item.isReferred === true) {
        item.isReferred = false;
        changed = true;
      }
      continue;
    }
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(item);
  }

  for (const group of byRef.values()) {
    const primary = pickPrimaryAmongDuplicates(group);
    for (const item of group) {
      const shouldBeReferred = !sameItem(item, primary);
      if (item.isReferred !== shouldBeReferred) {
        item.isReferred = shouldBeReferred;
        changed = true;
      }
    }
  }

  return { items: list, changed };
}
