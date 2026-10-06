/**
 * Normalise photo-arrow payload for Mongo storage.
 * Supports drawn endpoints (x1,y1 → x2,y2) and legacy tip + rotation.
 */
function mapPhotoArrow(a = {}) {
  const color = a.color || "#f44336";
  const hasDrawn =
    typeof a.x1 === "number" &&
    typeof a.y1 === "number" &&
    (typeof a.x2 === "number" || typeof a.x === "number") &&
    (typeof a.y2 === "number" || typeof a.y === "number");

  if (hasDrawn) {
    const x2 = typeof a.x2 === "number" ? a.x2 : a.x;
    const y2 = typeof a.y2 === "number" ? a.y2 : a.y;
    const rotation =
      typeof a.rotation === "number"
        ? a.rotation
        : (Math.atan2(x2 - a.x1, -(y2 - a.y1)) * 180) / Math.PI;
    const sub = {
      x: x2,
      y: y2,
      x1: a.x1,
      y1: a.y1,
      x2,
      y2,
      rotation,
      color,
    };
    if (a._id) sub._id = a._id;
    return sub;
  }

  const sub = {
    x: typeof a.x === "number" ? a.x : 0.5,
    y: typeof a.y === "number" ? a.y : 0.5,
    rotation: typeof a.rotation === "number" ? a.rotation : -45,
    color,
  };
  if (a._id) sub._id = a._id;
  return sub;
}

function applyArrowUpdates(arrow, body = {}) {
  const { x, y, rotation, color, x1, y1, x2, y2 } = body;
  if (typeof x === "number") arrow.x = x;
  if (typeof y === "number") arrow.y = y;
  if (typeof rotation === "number") arrow.rotation = rotation;
  if (color !== undefined) arrow.color = color;
  if (typeof x1 === "number") arrow.x1 = x1;
  if (typeof y1 === "number") arrow.y1 = y1;
  if (typeof x2 === "number") {
    arrow.x2 = x2;
    arrow.x = x2;
  }
  if (typeof y2 === "number") {
    arrow.y2 = y2;
    arrow.y = y2;
  }
  if (
    typeof arrow.x1 === "number" &&
    typeof arrow.y1 === "number" &&
    typeof arrow.x === "number" &&
    typeof arrow.y === "number" &&
    typeof rotation !== "number"
  ) {
    arrow.rotation =
      (Math.atan2(arrow.x - arrow.x1, -(arrow.y - arrow.y1)) * 180) / Math.PI;
  }
}

const DEFAULT_ARROW_ROTATION = -45;
const LEGACY_ARROW_LENGTH = 0.1;

function resolveArrowGeometry(arr) {
  if (!arr) return null;
  const hasDrawn =
    typeof arr.x1 === "number" &&
    typeof arr.y1 === "number" &&
    (typeof arr.x2 === "number" || typeof arr.x === "number") &&
    (typeof arr.y2 === "number" || typeof arr.y === "number");

  if (hasDrawn) {
    const x2 = typeof arr.x2 === "number" ? arr.x2 : arr.x;
    const y2 = typeof arr.y2 === "number" ? arr.y2 : arr.y;
    return { x1: arr.x1, y1: arr.y1, x2, y2, color: arr.color || "#f44336" };
  }

  const tipX = typeof arr.x === "number" ? arr.x : 0.5;
  const tipY = typeof arr.y === "number" ? arr.y : 0.5;
  const rot = ((arr.rotation ?? DEFAULT_ARROW_ROTATION) * Math.PI) / 180;
  const len = LEGACY_ARROW_LENGTH;
  return {
    x1: tipX - len * Math.sin(rot),
    y1: tipY + len * Math.cos(rot),
    x2: tipX,
    y2: tipY,
    color: arr.color || "#f44336",
  };
}

const ARROW_HEAD_LEN_RATIO = 0.16;
const ARROW_HEAD_WIDTH_RATIO = 0.36;
const ARROW_HEAD_MAX_LEN = 5;
const ARROW_HEAD_MIN_LEN = 2;

function arrowPathInPercent(x1, y1, x2, y2) {
  const px1 = x1 * 100;
  const py1 = y1 * 100;
  const px2 = x2 * 100;
  const py2 = y2 * 100;
  const dx = px2 - px1;
  const dy = py2 - py1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLen = Math.min(
    ARROW_HEAD_MAX_LEN,
    Math.max(ARROW_HEAD_MIN_LEN, len * ARROW_HEAD_LEN_RATIO),
  );
  const headWidth = headLen * ARROW_HEAD_WIDTH_RATIO;
  const bx = px2 - ux * headLen;
  const by = py2 - uy * headLen;
  const px = -uy;
  const py = ux;
  return {
    shaft: { x1: px1, y1: py1, x2: bx, y2: by },
    head: `M ${px2} ${py2} L ${bx + px * headWidth} ${by + py * headWidth} L ${bx - px * headWidth} ${by - py * headWidth} Z`,
    outlineWidth: 2.2,
    strokeWidth: 1.35,
  };
}

/** Full-bleed SVG overlay HTML for PDF photo cells. */
function buildArrowOverlaysHtml(arrows) {
  if (!arrows || arrows.length === 0) return "";
  const shapes = arrows
    .map((arr) => {
      const geom = resolveArrowGeometry(arr);
      if (!geom) return "";
      const color = String(geom.color || "#f44336").replace(/"/g, "&quot;");
      const { shaft, head, outlineWidth, strokeWidth } = arrowPathInPercent(
        geom.x1,
        geom.y1,
        geom.x2,
        geom.y2,
      );
      return (
        `<line x1="${shaft.x1.toFixed(2)}" y1="${shaft.y1.toFixed(2)}" x2="${shaft.x2.toFixed(2)}" y2="${shaft.y2.toFixed(2)}" stroke="rgba(0,0,0,0.55)" stroke-width="${outlineWidth}" stroke-linecap="round"/>` +
        `<path d="${head}" fill="rgba(0,0,0,0.5)" stroke="rgba(0,0,0,0.55)" stroke-width="0.5" stroke-linejoin="round"/>` +
        `<line x1="${shaft.x1.toFixed(2)}" y1="${shaft.y1.toFixed(2)}" x2="${shaft.x2.toFixed(2)}" y2="${shaft.y2.toFixed(2)}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>` +
        `<path d="${head}" fill="${color}" stroke="${color}" stroke-width="0.3" stroke-linejoin="round"/>`
      );
    })
    .join("");
  if (!shapes) return "";
  return `<svg class="pdf-arrow-layer" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`;
}

module.exports = {
  mapPhotoArrow,
  applyArrowUpdates,
  resolveArrowGeometry,
  buildArrowOverlaysHtml,
};
