/** Default tip colour and legacy stamp rotation (degrees, 0 = tip up). */
export const DEFAULT_ARROW_COLOR = "#f44336";
export const DEFAULT_ARROW_ROTATION = -45;

/** Minimum drag length (normalised 0–1) to accept a drawn arrow. */
export const MIN_ARROW_DRAW_LENGTH = 0.04;

/** Legacy fixed-size arrows: approximate shaft length as fraction of the shorter image side. */
export const LEGACY_ARROW_LENGTH = 0.1;

/**
 * Tip offset within a 24×24 viewBox arrow (tip at top when rotation=0).
 * Used only for legacy stamp rendering.
 */
export function getArrowTipOffset(rotationDeg) {
  const r = ((rotationDeg ?? 0) * Math.PI) / 180;
  return {
    x: (12 + 10 * Math.sin(r)) / 24,
    y: (12 - 10 * Math.cos(r)) / 24,
  };
}

export function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/** Rotation in degrees from tail→tip (0 = pointing up / −Y). */
export function rotationFromPoints(x1, y1, x2, y2) {
  return (Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI;
}

export function distanceNorm(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

/**
 * Resolve any stored arrow into tail (x1,y1) and tip (x2,y2).
 * Supports drawn arrows (x1/y1/x2/y2) and legacy tip+rotation stamps.
 */
export function resolveArrowGeometry(arr) {
  if (!arr) return null;

  const hasDrawn =
    typeof arr.x1 === "number" &&
    typeof arr.y1 === "number" &&
    (typeof arr.x2 === "number" || typeof arr.x === "number") &&
    (typeof arr.y2 === "number" || typeof arr.y === "number");

  if (hasDrawn) {
    const x2 = typeof arr.x2 === "number" ? arr.x2 : arr.x;
    const y2 = typeof arr.y2 === "number" ? arr.y2 : arr.y;
    return {
      x1: arr.x1,
      y1: arr.y1,
      x2,
      y2,
      color: arr.color || DEFAULT_ARROW_COLOR,
      rotation: rotationFromPoints(arr.x1, arr.y1, x2, y2),
    };
  }

  const tipX = typeof arr.x === "number" ? arr.x : 0.5;
  const tipY = typeof arr.y === "number" ? arr.y : 0.5;
  const rot = ((arr.rotation ?? DEFAULT_ARROW_ROTATION) * Math.PI) / 180;
  const len = LEGACY_ARROW_LENGTH;
  // Tip points along +sin/−cos from centre of legacy SVG; tail sits opposite.
  return {
    x1: tipX - len * Math.sin(rot),
    y1: tipY + len * Math.cos(rot),
    x2: tipX,
    y2: tipY,
    color: arr.color || DEFAULT_ARROW_COLOR,
    rotation: arr.rotation ?? DEFAULT_ARROW_ROTATION,
  };
}

/** Build API payload fields for a drawn (or moved) arrow. */
export function buildArrowPayload({ x1, y1, x2, y2, color }) {
  const cx1 = clamp01(x1);
  const cy1 = clamp01(y1);
  const cx2 = clamp01(x2);
  const cy2 = clamp01(y2);
  return {
    x: cx2,
    y: cy2,
    x1: cx1,
    y1: cy1,
    x2: cx2,
    y2: cy2,
    rotation: rotationFromPoints(cx1, cy1, cx2, cy2),
    color: color || DEFAULT_ARROW_COLOR,
  };
}

/** Translate both endpoints by a delta (for drag-move), keeping the arrow on-image. */
export function translateArrowGeometry(geom, dx, dy) {
  const minX = Math.min(geom.x1, geom.x2);
  const maxX = Math.max(geom.x1, geom.x2);
  const minY = Math.min(geom.y1, geom.y2);
  const maxY = Math.max(geom.y1, geom.y2);
  let tdx = dx;
  let tdy = dy;
  if (minX + tdx < 0) tdx = -minX;
  if (maxX + tdx > 1) tdx = 1 - maxX;
  if (minY + tdy < 0) tdy = -minY;
  if (maxY + tdy > 1) tdy = 1 - maxY;
  return {
    x1: geom.x1 + tdx,
    y1: geom.y1 + tdy,
    x2: geom.x2 + tdx,
    y2: geom.y2 + tdy,
    color: geom.color,
  };
}

/** Rotate a normalised image point 90° clockwise. */
export function rotateNormalizedPoint90Cw(x, y) {
  return { x: 1 - y, y: x };
}

/** Rotate arrow endpoints 90° CW with the photo. */
export function rotateArrowGeometry90Cw(arr) {
  const geom = resolveArrowGeometry(arr);
  if (!geom) return null;
  const t1 = rotateNormalizedPoint90Cw(geom.x1, geom.y1);
  const t2 = rotateNormalizedPoint90Cw(geom.x2, geom.y2);
  return buildArrowPayload({
    x1: t1.x,
    y1: t1.y,
    x2: t2.x,
    y2: t2.y,
    color: geom.color || arr.color,
  });
}

/** Arrow head sizing (shared proportions for UI + PDF). */
const ARROW_HEAD_LEN_RATIO = 0.16;
const ARROW_HEAD_WIDTH_RATIO = 0.36;
const ARROW_HEAD_MAX_BASE_RATIO = 0.048;
const ARROW_HEAD_MIN_BASE_RATIO = 0.018;

/**
 * Compute tail→tip arrow geometry in pixel space.
 * Returns shaft line, compact triangular head, and stroke metrics.
 */
export function computeArrowGeometryPx(px1, py1, px2, py2, baseSize) {
  const dx = px2 - px1;
  const dy = py2 - py1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const base = Math.max(1, baseSize);

  const headLen = Math.min(
    base * ARROW_HEAD_MAX_BASE_RATIO,
    Math.max(base * ARROW_HEAD_MIN_BASE_RATIO, len * ARROW_HEAD_LEN_RATIO),
  );
  const headWidth = headLen * ARROW_HEAD_WIDTH_RATIO;
  const bx = px2 - ux * headLen;
  const by = py2 - uy * headLen;
  const px = -uy;
  const py = ux;
  const leftX = bx + px * headWidth;
  const leftY = by + py * headWidth;
  const rightX = bx - px * headWidth;
  const rightY = by - py * headWidth;

  const strokeWidth = Math.max(1.6, base * 0.0055);
  const outlineWidth = strokeWidth + 1.25;

  return {
    shaft: { x1: px1, y1: py1, x2: bx, y2: by },
    head: `M ${px2} ${py2} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`,
    tip: { x: px2, y: py2 },
    tail: { x: px1, y: py1 },
    strokeWidth,
    outlineWidth,
    hitWidth: Math.max(strokeWidth * 4.5, 10),
    handleR: Math.max(3.5, base * 0.009),
  };
}

/**
 * Build SVG geometry for an arrow from normalised tail→tip in pixel space.
 */
export function arrowPathInPixels(x1, y1, x2, y2, width, height) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return computeArrowGeometryPx(
    x1 * w,
    y1 * h,
    x2 * w,
    y2 * h,
    Math.min(w, h),
  );
}
