import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import {
  MIN_ARROW_DRAW_LENGTH,
  arrowPathInPixels,
  buildArrowPayload,
  clamp01,
  distanceNorm,
  resolveArrowGeometry,
  translateArrowGeometry,
} from "../utils/photoArrows";

function ArrowSvg({
  x1,
  y1,
  x2,
  y2,
  width,
  height,
  color,
  selected = false,
  preview = false,
  hitTarget = false,
  onPointerDown,
}) {
  const geo = arrowPathInPixels(x1, y1, x2, y2, width, height);
  const stroke = color || "#f44336";
  const sw = selected ? geo.strokeWidth * 1.15 : geo.strokeWidth;
  const ow = selected ? geo.outlineWidth * 1.1 : geo.outlineWidth;
  const opacity = preview ? 0.88 : 1;

  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: hitTarget ? "move" : undefined }}
      opacity={opacity}
    >
      {hitTarget && (
        <line
          x1={geo.tail.x}
          y1={geo.tail.y}
          x2={geo.tip.x}
          y2={geo.tip.y}
          stroke="transparent"
          strokeWidth={geo.hitWidth}
          strokeLinecap="round"
        />
      )}
      {/* Soft outline */}
      <line
        x1={geo.shaft.x1}
        y1={geo.shaft.y1}
        x2={geo.shaft.x2}
        y2={geo.shaft.y2}
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={ow}
        strokeLinecap="round"
        pointerEvents="none"
      />
      <path
        d={geo.head}
        fill="rgba(0,0,0,0.5)"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={0.6}
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {/* Main arrow */}
      <line
        x1={geo.shaft.x1}
        y1={geo.shaft.y1}
        x2={geo.shaft.x2}
        y2={geo.shaft.y2}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        pointerEvents="none"
      />
      <path
        d={geo.head}
        fill={stroke}
        stroke={stroke}
        strokeWidth={0.35}
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {selected && (
        <>
          <circle
            cx={geo.tail.x}
            cy={geo.tail.y}
            r={geo.handleR}
            fill="#fff"
            stroke="#2196f3"
            strokeWidth={1.25}
            pointerEvents="none"
          />
          <circle
            cx={geo.tip.x}
            cy={geo.tip.y}
            r={geo.handleR * 0.85}
            fill="#fff"
            stroke="#2196f3"
            strokeWidth={1.25}
            pointerEvents="none"
          />
        </>
      )}
    </g>
  );
}

/**
 * Interactive photo + arrow overlay.
 * - drawMode: click-drag to draw a new arrow (tail → tip)
 * - otherwise: drag an existing arrow to move it; click to select
 */
export default function PhotoArrowEditor({
  src,
  alt = "Photo",
  arrows = [],
  drawMode = false,
  selectedArrowId = null,
  selectedColor = "#f44336",
  onSelectArrow,
  onDrawComplete,
  onMoveComplete,
  imgStyle,
  maxHeight = "75vh",
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const draftRef = useRef(null);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(1, rect.width), h: Math.max(1, rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  const clientToNorm = useCallback((clientX, clientY) => {
    const el = containerRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0.5, y: 0.5 };
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const finishInteraction = useCallback(() => {
    const currentDraft = draftRef.current;
    const currentDrag = dragRef.current;

    if (currentDraft) {
      const { x1, y1, x2, y2, color } = currentDraft;
      if (distanceNorm(x1, y1, x2, y2) >= MIN_ARROW_DRAW_LENGTH) {
        onDrawComplete?.(buildArrowPayload({ x1, y1, x2, y2, color }));
      }
      setDraft(null);
      draftRef.current = null;
    }

    if (currentDrag) {
      const payload = buildArrowPayload(currentDrag.geom);
      onMoveComplete?.(currentDrag.arrowId, payload);
      setDrag(null);
      dragRef.current = null;
    }
  }, [onDrawComplete, onMoveComplete]);

  useEffect(() => {
    const onMove = (e) => {
      const pt = clientToNorm(e.clientX, e.clientY);
      if (draftRef.current) {
        setDraft((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : prev));
        return;
      }
      if (dragRef.current) {
        const { startPt, origin } = dragRef.current;
        const dx = pt.x - startPt.x;
        const dy = pt.y - startPt.y;
        const moved = translateArrowGeometry(origin, dx, dy);
        setDrag((prev) =>
          prev
            ? {
                ...prev,
                geom: {
                  ...moved,
                  color: prev.geom.color,
                },
              }
            : prev,
        );
      }
    };
    const onUp = () => finishInteraction();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clientToNorm, finishInteraction]);

  const handleSurfacePointerDown = (e) => {
    if (!drawMode || drag) return;
    e.preventDefault();
    const pt = clientToNorm(e.clientX, e.clientY);
    const next = {
      x1: pt.x,
      y1: pt.y,
      x2: pt.x,
      y2: pt.y,
      color: selectedColor,
    };
    setDraft(next);
    draftRef.current = next;
    onSelectArrow?.(null);
  };

  const handleArrowPointerDown = (e, arr) => {
    if (drawMode) return;
    e.preventDefault();
    e.stopPropagation();
    const arrowId = arr._id;
    if (!arrowId || arrowId === "legacy") {
      onSelectArrow?.(arrowId || "legacy");
      return;
    }
    const geom = resolveArrowGeometry(arr);
    if (!geom) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    const next = {
      arrowId,
      startPt: pt,
      origin: { x1: geom.x1, y1: geom.y1, x2: geom.x2, y2: geom.y2 },
      geom: { ...geom },
    };
    setDrag(next);
    dragRef.current = next;
    onSelectArrow?.(arrowId);
  };

  const displayArrows = arrows.map((arr, idx) => {
    const id = arr._id || `arrow-${idx}`;
    if (drag && drag.arrowId === arr._id) {
      return { id, geom: drag.geom, raw: arr, moving: true };
    }
    return { id, geom: resolveArrowGeometry(arr), raw: arr, moving: false };
  });

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        touchAction: "none",
        userSelect: "none",
        maxWidth: "100%",
      }}
      onPointerDown={handleSurfacePointerDown}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight,
          objectFit: "contain",
          display: "block",
          cursor: drawMode ? "crosshair" : "default",
          pointerEvents: "none",
          ...imgStyle,
        }}
      />
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: drawMode ? "none" : "auto",
        }}
      >
        {displayArrows.map(({ id, geom, raw, moving }) => {
          if (!geom) return null;
          const isSelected =
            selectedArrowId === raw._id ||
            (selectedArrowId === "legacy" && !raw._id) ||
            moving;
          return (
            <ArrowSvg
              key={id}
              x1={geom.x1}
              y1={geom.y1}
              x2={geom.x2}
              y2={geom.y2}
              width={size.w}
              height={size.h}
              color={geom.color}
              selected={isSelected}
              hitTarget={!drawMode}
              onPointerDown={(e) => handleArrowPointerDown(e, raw)}
            />
          );
        })}
        {draft && (
          <ArrowSvg
            x1={draft.x1}
            y1={draft.y1}
            x2={draft.x2}
            y2={draft.y2}
            width={size.w}
            height={size.h}
            color={draft.color}
            preview
          />
        )}
      </svg>
    </Box>
  );
}

/** Read-only arrow overlays for thumbnail cards. */
export function PhotoArrowOverlays({
  arrows = [],
  onDeleteArrow,
  showDelete = false,
}) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 1, h: 1 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(1, rect.width), h: Math.max(1, rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        pointerEvents: showDelete ? "auto" : "none",
      }}
    >
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {arrows.map((arr, idx) => {
          const geom = resolveArrowGeometry(arr);
          if (!geom) return null;
          const id = arr._id || `thumb-arrow-${idx}`;
          const midX = ((geom.x1 + geom.x2) / 2) * size.w;
          const midY = ((geom.y1 + geom.y2) / 2) * size.h;
          const r = Math.max(8, Math.min(size.w, size.h) * 0.04);
          return (
            <g key={id}>
              <ArrowSvg
                x1={geom.x1}
                y1={geom.y1}
                x2={geom.x2}
                y2={geom.y2}
                width={size.w}
                height={size.h}
                color={geom.color}
              />
              {showDelete && onDeleteArrow && (
                <g
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteArrow(arr);
                  }}
                >
                  <circle
                    cx={midX}
                    cy={midY - r * 1.2}
                    r={r}
                    fill="rgba(0,0,0,0.75)"
                  />
                  <text
                    x={midX}
                    y={midY - r * 1.2 + r * 0.35}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={r * 1.2}
                    fontFamily="sans-serif"
                    pointerEvents="none"
                  >
                    ×
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
