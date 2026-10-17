/** Furthest the clearance site-plan map can be zoomed out. */
export const SITE_PLAN_MIN_ZOOM = 14;

/**
 * Closest zoom. The Maps API often stops native satellite tiles around 20;
 * 22 allows up to two extra enlarged levels where Google has no closer tile.
 */
export const SITE_PLAN_MAX_ZOOM = 22;

/** User-facing zoom: 1 is the furthest view, higher numbers are closer. */
export const SITE_PLAN_ZOOM_LEVELS =
  SITE_PLAN_MAX_ZOOM - SITE_PLAN_MIN_ZOOM + 1;

export function mapZoomToLevel(mapZoom) {
  const clamped = Math.min(
    SITE_PLAN_MAX_ZOOM,
    Math.max(SITE_PLAN_MIN_ZOOM, Number(mapZoom) || SITE_PLAN_MIN_ZOOM),
  );
  return Math.round(clamped - SITE_PLAN_MIN_ZOOM + 1);
}

export function levelToMapZoom(level) {
  const clamped = Math.min(
    SITE_PLAN_ZOOM_LEVELS,
    Math.max(1, Number(level) || 1),
  );
  return SITE_PLAN_MIN_ZOOM + clamped - 1;
}

export function applySitePlanMapZoomRange(map) {
  if (!map?.setOptions || !map.mapTypes) return;
  map.setOptions({
    minZoom: SITE_PLAN_MIN_ZOOM,
    maxZoom: SITE_PLAN_MAX_ZOOM,
  });
  ["roadmap", "satellite", "hybrid", "terrain"].forEach((typeId) => {
    const mapType = map.mapTypes.get(typeId);
    if (mapType) mapType.maxZoom = SITE_PLAN_MAX_ZOOM;
  });
}
