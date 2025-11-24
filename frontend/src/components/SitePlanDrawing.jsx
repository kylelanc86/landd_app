import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Slider,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Edit as EditIcon,
  Circle as CircleIcon,
  Square as SquareIcon,
  Straighten as LineIcon,
  TextFields as TextIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
  Mouse as SelectIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  PanTool as HandIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import loadGoogleMapsApi from "../utils/loadGoogleMapsApi";
import GoogleMapsDialog from "./GoogleMapsDialog";

// Canvas dimensions will be set dynamically based on viewport
const DEFAULT_DRAW_OPACITY = 1;
const TRANSPARENT_DRAW_OPACITY = 0.35;

const applyOpacitySettings = (item, transparent) => {
  if (!item) {
    return item;
  }

  const strokeOpacity = transparent
    ? TRANSPARENT_DRAW_OPACITY
    : DEFAULT_DRAW_OPACITY;

  if (item.type === "circle" || item.type === "rectangle") {
    const next = { ...item, strokeOpacity };
    if (item.isFilled && item.fillColor) {
      next.fillOpacity = transparent
        ? TRANSPARENT_DRAW_OPACITY
        : DEFAULT_DRAW_OPACITY;
    } else if ("fillOpacity" in next) {
      delete next.fillOpacity;
    }
    return next;
  }

  if (item.type === "line" || item.type === "pen") {
    return { ...item, strokeOpacity };
  }

  return { ...item };
};

const normalizeLegendEntries = (entries = []) => {
  const seen = new Set();
  const normalized = [];

  entries.forEach((entry) => {
    if (!entry || !entry.color) {
      return;
    }
    const colorValue = String(entry.color).trim();
    if (!colorValue) {
      return;
    }
    const key = colorValue.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push({
      id: key,
      color: colorValue,
      description: entry.description || "",
    });
  });

  return normalized;
};

const legendArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].color?.toLowerCase() !== b[i].color?.toLowerCase() ||
      (a[i].description || "") !== (b[i].description || "")
    ) {
      return false;
    }
  }
  return true;
};

const SitePlanDrawing = ({
  onSave,
  onCancel,
  existingSitePlan,
  existingLegend = [],
  existingLegendTitle = "Key",
}) => {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState("pen");
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [color, setColor] = useState("#000000");
  const [fillColor] = useState("#ffffff");
  const [isFilled] = useState(false);
  const [useTransparentDrawing, setUseTransparentDrawing] = useState(false);
  const [showGoogleMaps, setShowGoogleMaps] = useState(false);
  const [history, setHistory] = useState([[]]); // Initialize with empty array
  const [historyIndex, setHistoryIndex] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [inlineTextInput, setInlineTextInput] = useState("");
  const [showInlineTextInput, setShowInlineTextInput] = useState(false);
  const [inlineTextPosition, setInlineTextPosition] = useState({ x: 0, y: 0 });
  const inlineTextInputRef = useRef(null);
  const [showGoogleMapsDialog, setShowGoogleMapsDialog] = useState(false);
  const [drawnItems, setDrawnItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isMovingItem, setIsMovingItem] = useState(false);
  const [isResizingItem, setIsResizingItem] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 720 });
  const [zoom, setZoom] = useState(1); // Default zoom at 100%
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const prevItemsLengthRef = useRef(0);
  const [legendEntries, setLegendEntries] = useState([]);
  const [legendTitle, setLegendTitle] = useState("Key");
  const [legendDialogOpen, setLegendDialogOpen] = useState(false);
  const [legendDraftEntries, setLegendDraftEntries] = useState([]);
  const [legendDraftTitle, setLegendDraftTitle] = useState("Key");
  const renderForExportRef = useRef(false);
  const activePointerIdRef = useRef(null);

  useEffect(() => {
    setLegendEntries(normalizeLegendEntries(existingLegend));
    setLegendDraftEntries(normalizeLegendEntries(existingLegend));
  }, [existingLegend]);

  useEffect(() => {
    const nextTitle = existingLegendTitle || "Key";
    setLegendTitle(nextTitle);
    setLegendDraftTitle(nextTitle);
  }, [existingLegendTitle]);

  const openLegendDialog = () => {
    setLegendDraftTitle(legendTitle || "Key");
    setLegendDraftEntries(legendEntries.map((entry) => ({ ...entry })));
    setLegendDialogOpen(true);
  };

  const handleLegendDialogClose = () => {
    setLegendDialogOpen(false);
  };

  const handleLegendEntryChange = (entryId, value) => {
    setLegendDraftEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, description: value } : entry
      )
    );
  };

  const handleLegendDialogClear = () => {
    setLegendDraftEntries((prev) =>
      prev.map((entry) => ({ ...entry, description: "" }))
    );
  };

  const handleAddLegendEntry = () => {
    const newId = `custom-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const newEntry = {
      id: newId,
      color: "#000000",
      description: "",
    };
    setLegendDraftEntries((prev) => [...prev, newEntry]);
  };

  const handleRemoveLegendEntry = (entryId) => {
    setLegendDraftEntries((prev) =>
      prev.filter((entry) => entry.id !== entryId)
    );
  };

  const handleLegendColorChange = (entryId, newColor) => {
    setLegendDraftEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, color: newColor } : entry
      )
    );
  };

  const handleLegendDialogSave = () => {
    const cleanedTitle = legendDraftTitle.trim() || "Key";
    const cleanedEntries = legendDraftEntries.map((entry) => ({
      id: entry.id,
      color: entry.color,
      description: entry.description.trim(),
    }));

    setLegendTitle(cleanedTitle);
    setLegendEntries(cleanedEntries);
    setLegendDialogOpen(false);
  };

  useEffect(() => {
    if (!drawnItems || drawnItems.length === 0) {
      return;
    }

    const seenColors = new Map();
    const registerColor = (rawColor) => {
      if (!rawColor) return;
      const colorValue = String(rawColor).trim();
      if (!colorValue) return;
      const key = colorValue.toLowerCase();
      if (!seenColors.has(key)) {
        seenColors.set(key, colorValue);
      }
    };

    drawnItems.forEach((item) => {
      registerColor(item.color);
      if (
        (item.type === "circle" || item.type === "rectangle") &&
        item.isFilled
      ) {
        registerColor(item.fillColor);
      }
    });

    if (seenColors.size === 0) {
      return;
    }

    const orderedColors = Array.from(seenColors.values());

    setLegendEntries((prev) => {
      const prevMap = new Map(
        prev.map((entry) => [
          entry.color?.toLowerCase(),
          { description: entry.description || "", id: entry.id },
        ])
      );
      const nextEntries = orderedColors.map((colorValue) => {
        const lower = colorValue.toLowerCase();
        const previous = prevMap.get(lower);
        return {
          id: previous?.id || lower,
          color: colorValue,
          description: previous?.description || "",
        };
      });

      return legendArraysEqual(nextEntries, prev) ? prev : nextEntries;
    });
  }, [drawnItems]);

  // Initialize Google Maps when showGoogleMaps changes
  useEffect(() => {
    if (showGoogleMaps && !mapLoaded) {
      initializeGoogleMaps();
    }
  }, [showGoogleMaps, mapLoaded]);

  // Ensure map container is properly sized when it becomes visible
  useEffect(() => {
    if (showGoogleMaps && mapInstanceRef.current) {
      // Small delay to ensure the container is rendered
      setTimeout(() => {
        if (mapInstanceRef.current) {
          console.log("Triggering resize for visible map");
          window.google.maps.event.trigger(mapInstanceRef.current, "resize");
        }
      }, 200);
    }
  }, [showGoogleMaps]);

  const initializeGoogleMaps = async () => {
    try {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not found");
        return;
      }

      await loadGoogleMapsApi(apiKey);

      if (mapRef.current) {
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: -35.2809, lng: 149.13 }, // Canberra default
          zoom: 15,
          mapTypeId: window.google.maps.MapTypeId.SATELLITE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          gestureHandling: "none", // Disable map interaction
          tilt: 0,
          heading: 0,
        });

        mapInstanceRef.current = map;
        setMapLoaded(true);
      }
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  };

  // Constrain coordinates to canvas boundaries
  const constrainToCanvas = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y)),
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate proper coordinates accounting for canvas scaling, zoom, and pan
    const scaleX = canvas.width / (rect.width / zoom);
    const scaleY = canvas.height / (rect.height / zoom);
    const rawX = ((e.clientX - rect.left - panOffset.x) / zoom) * scaleX;
    const rawY = ((e.clientY - rect.top - panOffset.y) / zoom) * scaleY;

    // Constrain to canvas boundaries
    const { x, y } = constrainToCanvas(rawX, rawY);

    // Store starting coordinates for shape tools
    canvas.startX = x;
    canvas.startY = y;

    if (currentTool === "pen") {
      // Initialize pen drawing path
      canvas.penPath = [{ x, y }];
      canvas.strokeStyle = color;
      canvas.lineWidth = brushSize;
    } else if (currentTool === "text") {
      // For text tool, show inline text input at click position
      setInlineTextPosition({ x, y });
      setShowInlineTextInput(true);
      setInlineTextInput("");
      setIsDrawing(false); // Don't continue drawing for text
    } else if (currentTool === "hand") {
      // For hand tool, start panning
      setIsPanning(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      setIsDrawing(false); // Don't continue drawing for hand tool
    } else if (currentTool === "select") {
      // For select tool, check if clicking on a resize handle first
      if (selectedItem) {
        const clickedHandle = getHandleAtPosition(x, y, selectedItem);
        if (clickedHandle) {
          setResizeHandle(clickedHandle);
          setDragStart({ x, y });
          setIsResizingItem(true);
          setIsDrawing(false);
          return;
        }
      }

      // Check if clicking on an item
      const clickedItem = getItemAtPosition(x, y);
      if (clickedItem) {
        setSelectedItem(clickedItem);
        setDragStart({ x, y });
        setIsMovingItem(true);
      } else {
        setSelectedItem(null);
      }
      setIsDrawing(false);
    } else {
      // Shape tools will use background redraw system for preview
    }
  };

  const draw = (e) => {
    if (!isDrawing && !isMovingItem && !isResizingItem && !isPanning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rect = canvas.getBoundingClientRect();

    // Calculate proper coordinates accounting for canvas scaling, zoom, and pan
    const scaleX = canvas.width / (rect.width / zoom);
    const scaleY = canvas.height / (rect.height / zoom);
    const rawX = ((e.clientX - rect.left - panOffset.x) / zoom) * scaleX;
    const rawY = ((e.clientY - rect.top - panOffset.y) / zoom) * scaleY;

    // Constrain to canvas boundaries
    const { x, y } = constrainToCanvas(rawX, rawY);

    if (isPanning) {
      // Handle panning - constrain to keep canvas in view
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const container = canvasContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const maxPanX = (rect.width * zoom - containerRect.width) / 2;
      const maxPanY = (rect.height * zoom - containerRect.height) / 2;

      const newPanOffset = {
        x: Math.max(-maxPanX, Math.min(maxPanX, e.clientX - dragStart.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, e.clientY - dragStart.y)),
      };
      setPanOffset(newPanOffset);
      return;
    }

    if (isMovingItem && selectedItem) {
      // Handle moving selected item
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;

      const updatedItem = moveItem(selectedItem, deltaX, deltaY);
      setSelectedItem(updatedItem);

      // Update the item in the array
      setDrawnItems((prev) =>
        prev.map((item) => (item.id === selectedItem.id ? updatedItem : item))
      );

      setDragStart({ x, y });
      redrawCanvas();
      return;
    }

    if (isResizingItem && selectedItem && resizeHandle) {
      // Handle resizing selected item
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;

      const updatedItem = resizeItem(
        selectedItem,
        resizeHandle,
        deltaX,
        deltaY
      );
      setSelectedItem(updatedItem);

      // Update the item in the array
      setDrawnItems((prev) =>
        prev.map((item) => (item.id === selectedItem.id ? updatedItem : item))
      );

      setDragStart({ x, y });
      redrawCanvas();
      return;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    const previewOpacity = useTransparentDrawing
      ? TRANSPARENT_DRAW_OPACITY
      : DEFAULT_DRAW_OPACITY;

    if (currentTool === "pen") {
      // Add point to pen path
      if (canvas.penPath) {
        canvas.penPath.push({ x, y });
      }
    } else if (currentTool === "circle") {
      // Clear and redraw background + existing items for preview
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background image if it exists
      if (canvas.backgroundImage) {
        ctx.drawImage(
          canvas.backgroundImage,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      // Redraw all existing items
      drawnItems.forEach((item) => {
        drawItem(ctx, item);
      });

      // Draw preview circle
      ctx.save();
      ctx.globalAlpha = previewOpacity;
      const radius = Math.sqrt(
        Math.pow(x - canvas.startX, 2) + Math.pow(y - canvas.startY, 2)
      );
      ctx.beginPath();
      ctx.arc(canvas.startX, canvas.startY, radius, 0, 2 * Math.PI);
      if (isFilled && fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    } else if (currentTool === "rectangle") {
      // Clear and redraw background + existing items for preview
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background image if it exists
      if (canvas.backgroundImage) {
        ctx.drawImage(
          canvas.backgroundImage,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      // Redraw all existing items
      drawnItems.forEach((item) => {
        drawItem(ctx, item);
      });

      // Draw preview rectangle
      ctx.save();
      ctx.globalAlpha = previewOpacity;
      const width = x - canvas.startX;
      const height = y - canvas.startY;
      ctx.beginPath();
      ctx.rect(canvas.startX, canvas.startY, width, height);
      if (isFilled && fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    } else if (currentTool === "line") {
      // Clear and redraw background + existing items for preview
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background image if it exists
      if (canvas.backgroundImage) {
        ctx.drawImage(
          canvas.backgroundImage,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      // Redraw all existing items
      drawnItems.forEach((item) => {
        drawItem(ctx, item);
      });

      // Draw preview line
      ctx.save();
      ctx.globalAlpha = previewOpacity;
      ctx.beginPath();
      ctx.moveTo(canvas.startX, canvas.startY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    }
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      setIsDrawing(false);
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (
        currentTool === "pen" &&
        canvas.penPath &&
        canvas.penPath.length > 1
      ) {
        // Create pen item object
        const newItem = {
          id: Date.now().toString(),
          type: "pen",
          path: [...canvas.penPath],
          color: canvas.strokeStyle,
          lineWidth: canvas.lineWidth,
        };
        addDrawnItem(newItem);
        canvas.penPath = null;
      } else if (e && currentTool !== "pen") {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width / zoom);
        const scaleY = canvas.height / (rect.height / zoom);
        const rawX = ((e.clientX - rect.left - panOffset.x) / zoom) * scaleX;
        const rawY = ((e.clientY - rect.top - panOffset.y) / zoom) * scaleY;
        const { x, y } = constrainToCanvas(rawX, rawY);

        // Restore to the state before preview started
        if (canvas.previewImageData) {
          ctx.putImageData(canvas.previewImageData, 0, 0);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;

        if (currentTool === "circle") {
          const radius = Math.sqrt(
            Math.pow(x - canvas.startX, 2) + Math.pow(y - canvas.startY, 2)
          );
          const newItem = {
            id: Date.now().toString(),
            type: "circle",
            centerX: canvas.startX,
            centerY: canvas.startY,
            radius: radius,
            color: color,
            lineWidth: brushSize,
            isFilled: isFilled,
            fillColor: fillColor,
          };
          addDrawnItem(newItem);
        } else if (currentTool === "rectangle") {
          const width = x - canvas.startX;
          const height = y - canvas.startY;
          const newItem = {
            id: Date.now().toString(),
            type: "rectangle",
            x: Math.min(canvas.startX, x),
            y: Math.min(canvas.startY, y),
            width: Math.abs(width),
            height: Math.abs(height),
            color: color,
            lineWidth: brushSize,
            isFilled: isFilled,
            fillColor: fillColor,
          };
          addDrawnItem(newItem);
        } else if (currentTool === "line") {
          const newItem = {
            id: Date.now().toString(),
            type: "line",
            x1: canvas.startX,
            y1: canvas.startY,
            x2: x,
            y2: y,
            color: color,
            lineWidth: brushSize,
          };
          addDrawnItem(newItem);
        }
      }

      // Preview data no longer needed - using background redraw system
    }

    if (isMovingItem) {
      setIsMovingItem(false);
      saveToHistory();
    }

    if (isResizingItem) {
      setIsResizingItem(false);
      setResizeHandle(null);
      saveToHistory();
    }
  };

  const finalizePointerInteraction = (event) => {
    if (
      activePointerIdRef.current !== null &&
      event.pointerId !== activePointerIdRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (canvas && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore release errors (e.g., if capture was never set)
      }
    }

    activePointerIdRef.current = null;
    stopDrawing(event);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    activePointerIdRef.current = event.pointerId;

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture errors
      }
    }

    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }

    startDrawing(event);
  };

  const handlePointerMove = (event) => {
    if (
      activePointerIdRef.current !== null &&
      event.pointerId !== activePointerIdRef.current
    ) {
      return;
    }

    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }

    draw(event);
  };

  const handlePointerUp = (event) => {
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    finalizePointerInteraction(event);
  };

  const handlePointerLeave = (event) => {
    finalizePointerInteraction(event);
  };

  const handlePointerCancel = (event) => {
    finalizePointerInteraction(event);
  };

  const moveItem = (item, deltaX, deltaY) => {
    const updatedItem = { ...item };

    switch (item.type) {
      case "line":
        updatedItem.x1 += deltaX;
        updatedItem.y1 += deltaY;
        updatedItem.x2 += deltaX;
        updatedItem.y2 += deltaY;
        break;
      case "pen":
        // Move all points in the pen path
        updatedItem.path = item.path.map((point) => ({
          x: point.x + deltaX,
          y: point.y + deltaY,
        }));
        break;
      case "circle":
        updatedItem.centerX += deltaX;
        updatedItem.centerY += deltaY;
        break;
      case "rectangle":
        updatedItem.x += deltaX;
        updatedItem.y += deltaY;
        break;
      case "text":
        updatedItem.x += deltaX;
        updatedItem.y += deltaY;
        break;
      case "image":
        updatedItem.x += deltaX;
        updatedItem.y += deltaY;
        break;
      default:
        break;
    }

    return updatedItem;
  };

  const resizeItem = (item, handle, deltaX, deltaY) => {
    const updatedItem = { ...item };

    switch (item.type) {
      case "line":
        if (handle.type === "start") {
          updatedItem.x1 += deltaX;
          updatedItem.y1 += deltaY;
        } else if (handle.type === "end") {
          updatedItem.x2 += deltaX;
          updatedItem.y2 += deltaY;
        }
        break;
      case "circle":
        if (handle.type === "radius") {
          // Calculate new radius based on mouse position
          const newRadius = Math.sqrt(
            Math.pow(handle.x + deltaX - item.centerX, 2) +
              Math.pow(handle.y + deltaY - item.centerY, 2)
          );
          updatedItem.radius = Math.max(5, newRadius); // Minimum radius of 5
        }
        break;
      case "rectangle":
        console.log(
          "Resizing rectangle with handle:",
          handle.type,
          "delta:",
          deltaX,
          deltaY
        );
        if (handle.type === "topLeft") {
          const newWidth = item.width - deltaX;
          const newHeight = item.height - deltaY;
          console.log("topLeft - newWidth:", newWidth, "newHeight:", newHeight);
          if (newWidth > 5 && newHeight > 5) {
            updatedItem.x += deltaX;
            updatedItem.y += deltaY;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "topRight") {
          const newWidth = item.width + deltaX;
          const newHeight = item.height - deltaY;
          console.log(
            "topRight - newWidth:",
            newWidth,
            "newHeight:",
            newHeight
          );
          if (newWidth > 5 && newHeight > 5) {
            updatedItem.y += deltaY;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "bottomLeft") {
          const newWidth = item.width - deltaX;
          const newHeight = item.height + deltaY;
          console.log(
            "bottomLeft - newWidth:",
            newWidth,
            "newHeight:",
            newHeight
          );
          if (newWidth > 5 && newHeight > 5) {
            updatedItem.x += deltaX;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "bottomRight") {
          const newWidth = item.width + deltaX;
          const newHeight = item.height + deltaY;
          console.log(
            "bottomRight - newWidth:",
            newWidth,
            "newHeight:",
            newHeight
          );
          if (newWidth > 5 && newHeight > 5) {
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        }
        console.log("Rectangle resize result:", updatedItem);
        break;
      case "text":
        if (handle.type === "topLeft") {
          const newWidth = item.width - deltaX;
          const newHeight = item.height - deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.x += deltaX;
            updatedItem.y += deltaY;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "topRight") {
          const newWidth = item.width + deltaX;
          const newHeight = item.height - deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.y += deltaY;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "bottomLeft") {
          const newWidth = item.width - deltaX;
          const newHeight = item.height + deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.x += deltaX;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "bottomRight") {
          const newWidth = item.width + deltaX;
          const newHeight = item.height + deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        }
        break;
      case "image":
        if (handle.type === "topLeft") {
          const newWidth = item.width - deltaX;
          const newHeight = item.height - deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.x += deltaX;
            updatedItem.y += deltaY;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "topRight") {
          const newWidth = item.width + deltaX;
          const newHeight = item.height - deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.y += deltaY;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "bottomLeft") {
          const newWidth = item.width - deltaX;
          const newHeight = item.height + deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.x += deltaX;
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        } else if (handle.type === "bottomRight") {
          const newWidth = item.width + deltaX;
          const newHeight = item.height + deltaY;
          if (newWidth > 10 && newHeight > 10) {
            updatedItem.width = newWidth;
            updatedItem.height = newHeight;
          }
        }
        break;
      default:
        break;
    }

    return updatedItem;
  };

  const saveToHistory = useCallback(() => {
    // Save the current drawnItems array to history instead of canvas snapshot
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...drawnItems]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, drawnItems]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDrawnItems([...history[newIndex]]);
      setSelectedItem(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDrawnItems([...history[newIndex]]);
      setSelectedItem(null);
    }
  };

  const deleteSelectedItem = useCallback(() => {
    if (selectedItem) {
      setDrawnItems((prev) =>
        prev.filter((item) => item.id !== selectedItem.id)
      );
      setSelectedItem(null);
      saveToHistory();
    }
  }, [selectedItem, saveToHistory]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderForExportRef.current = true;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image first if it exists
    if (canvas.backgroundImage) {
      ctx.drawImage(canvas.backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    // If map is shown, capture it and draw it on canvas
    if (showGoogleMaps && mapRef.current) {
      try {
        // Dynamically import html2canvas
        const html2canvas = (await import("html2canvas")).default;

        // Capture the map container
        const mapCanvas = await html2canvas(mapRef.current, {
          backgroundColor: null,
          scale: 1,
          useCORS: true,
          logging: false,
        });

        // Draw map with 5% bottom crop at full opacity for export
        const mapHeight = mapCanvas.height * 0.95;
        ctx.drawImage(
          mapCanvas,
          0,
          0,
          mapCanvas.width,
          mapHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } catch (error) {
        console.error("Error capturing map:", error);
        // Continue with export even if map capture fails
      }
    }

    // Draw all items on top
    drawnItems.forEach((item) => {
      drawItem(ctx, item);
    });

    const imageData = canvas.toDataURL("image/png");
    renderForExportRef.current = false;
    redrawCanvas();

    onSave({
      imageData,
      legend: legendEntries,
      legendTitle,
    });
  };

  const handleInlineTextSubmit = () => {
    if (inlineTextInput.trim()) {
      const newItem = {
        id: Date.now().toString(),
        type: "text",
        x: inlineTextPosition.x,
        y: inlineTextPosition.y,
        text: inlineTextInput,
        color: color,
        fontSize: fontSize,
        width: inlineTextInput.length * fontSize * 0.6, // Estimate text width
        height: fontSize, // Font size
      };

      setDrawnItems((prev) => [...prev, newItem]);
      setInlineTextInput("");
      setShowInlineTextInput(false);
      saveToHistory();
    }
  };

  const handleInlineTextCancel = () => {
    setInlineTextInput("");
    setShowInlineTextInput(false);
  };

  const addDrawnItem = (item) => {
    const itemWithOpacity = applyOpacitySettings(item, useTransparentDrawing);
    setDrawnItems((prev) => [...prev, itemWithOpacity]);
  };

  const handleTransparencyToggle = (checked) => {
    setUseTransparentDrawing(checked);
    setDrawnItems((prev) => {
      const nextItems = prev.map((item) => applyOpacitySettings(item, checked));
      setSelectedItem((current) => {
        if (!current) {
          return current;
        }
        const match = nextItems.find((item) => item.id === current.id);
        return match || applyOpacitySettings(current, checked);
      });
      return nextItems;
    });
  };

  const drawSelectionHandles = useCallback((ctx, item) => {
    const handles = getSelectionHandles(item);

    ctx.save();
    ctx.strokeStyle = "#007bff";
    ctx.fillStyle = "#007bff";
    ctx.lineWidth = 2;

    handles.forEach((handle) => {
      ctx.beginPath();
      ctx.rect(handle.x - 4, handle.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }, []);

  const drawItem = (ctx, item) => {
    if (!item) {
      return;
    }

    const strokeOpacity = item.strokeOpacity ?? 1;
    const fillOpacity = item.fillOpacity ?? strokeOpacity;

    ctx.save();

    switch (item.type) {
      case "line":
        ctx.globalAlpha = strokeOpacity;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth || 2;
        ctx.beginPath();
        ctx.moveTo(item.x1, item.y1);
        ctx.lineTo(item.x2, item.y2);
        ctx.stroke();
        break;
      case "pen":
        if (item.path && item.path.length > 0) {
          ctx.globalAlpha = strokeOpacity;
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.lineWidth || 2;
          ctx.beginPath();
          ctx.moveTo(item.path[0].x, item.path[0].y);
          for (let i = 1; i < item.path.length; i += 1) {
            ctx.lineTo(item.path[i].x, item.path[i].y);
          }
          ctx.stroke();
        }
        break;
      case "circle":
        ctx.lineWidth = item.lineWidth || 2;
        ctx.beginPath();
        ctx.arc(item.centerX, item.centerY, item.radius, 0, 2 * Math.PI);
        if (item.isFilled && item.fillColor) {
          ctx.globalAlpha = fillOpacity;
          ctx.fillStyle = item.fillColor;
          ctx.fill();
        }
        ctx.globalAlpha = strokeOpacity;
        ctx.strokeStyle = item.color;
        ctx.stroke();
        break;
      case "rectangle":
        ctx.lineWidth = item.lineWidth || 2;
        ctx.beginPath();
        ctx.rect(item.x, item.y, item.width, item.height);
        if (item.isFilled && item.fillColor) {
          ctx.globalAlpha = fillOpacity;
          ctx.fillStyle = item.fillColor;
          ctx.fill();
        }
        ctx.globalAlpha = strokeOpacity;
        ctx.strokeStyle = item.color;
        ctx.stroke();
        break;
      case "text":
        ctx.globalAlpha = 1;
        ctx.fillStyle = item.color;
        ctx.font = `${item.fontSize}px Arial`;
        ctx.fillText(item.text, item.x, item.y);
        break;
      case "image":
        ctx.globalAlpha = 1;
        if (item.imageElement) {
          ctx.drawImage(
            item.imageElement,
            item.x,
            item.y,
            item.width,
            item.height
          );
        }
        break;
      default:
        break;
    }

    ctx.restore();
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image if it exists
    if (canvas.backgroundImage) {
      ctx.drawImage(canvas.backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    // Redraw all items
    drawnItems.forEach((item) => {
      drawItem(ctx, item);
    });

    // Draw selected item with selection handles
    if (selectedItem && !renderForExportRef.current) {
      drawSelectionHandles(ctx, selectedItem);
    }
  }, [drawnItems, selectedItem, drawSelectionHandles]);

  // Calculate canvas size to fill viewport
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!canvasContainerRef.current) return;

      const container = canvasContainerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Calculate available space (accounting for padding)
      // Use full container size - padding is handled by the container Box
      const availableWidth = containerRect.width;
      const availableHeight = containerRect.height;

      // Set canvas size to fill available space
      setCanvasSize({ width: availableWidth, height: availableHeight });
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Initialize canvas with calculated size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize.width || !canvasSize.height) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    canvas.style.touchAction = "none";

    redrawCanvas();
  }, [canvasSize, redrawCanvas]);

  const getSelectionHandles = (item) => {
    const handles = [];

    switch (item.type) {
      case "line":
        handles.push(
          { x: item.x1, y: item.y1, type: "start" },
          { x: item.x2, y: item.y2, type: "end" }
        );
        break;
      case "pen":
        if (item.path && item.path.length > 0) {
          // Add handles at the start and end of the pen path
          const firstPoint = item.path[0];
          const lastPoint = item.path[item.path.length - 1];
          handles.push(
            { x: firstPoint.x, y: firstPoint.y, type: "start" },
            { x: lastPoint.x, y: lastPoint.y, type: "end" }
          );
        }
        break;
      case "circle":
        handles.push(
          { x: item.centerX, y: item.centerY, type: "center" },
          { x: item.centerX + item.radius, y: item.centerY, type: "radius" }
        );
        break;
      case "rectangle":
        handles.push(
          { x: item.x, y: item.y, type: "topLeft" },
          { x: item.x + item.width, y: item.y, type: "topRight" },
          { x: item.x, y: item.y + item.height, type: "bottomLeft" },
          {
            x: item.x + item.width,
            y: item.y + item.height,
            type: "bottomRight",
          }
        );
        break;
      case "text":
        // Text items cannot be resized, only moved
        break;
      case "image":
        handles.push(
          { x: item.x, y: item.y, type: "topLeft" },
          { x: item.x + item.width, y: item.y, type: "topRight" },
          { x: item.x, y: item.y + item.height, type: "bottomLeft" },
          {
            x: item.x + item.width,
            y: item.y + item.height,
            type: "bottomRight",
          }
        );
        break;
      default:
        break;
    }

    return handles;
  };

  const getItemAtPosition = (x, y) => {
    // Check items in reverse order (top to bottom)
    for (let i = drawnItems.length - 1; i >= 0; i--) {
      const item = drawnItems[i];
      if (isPointInItem(x, y, item)) {
        return item;
      }
    }
    return null;
  };

  const getHandleAtPosition = (x, y, item) => {
    const handles = getSelectionHandles(item);
    for (const handle of handles) {
      const handleSize = 8; // Handle size is 8x8 pixels
      const isInHandle =
        x >= handle.x - handleSize / 2 &&
        x <= handle.x + handleSize / 2 &&
        y >= handle.y - handleSize / 2 &&
        y <= handle.y + handleSize / 2;
      if (isInHandle) {
        return handle;
      }
    }
    return null;
  };

  const isPointInItem = (x, y, item) => {
    switch (item.type) {
      case "line":
        // Simple line hit test (distance to line)
        const lineDist = distanceToLine(
          x,
          y,
          item.x1,
          item.y1,
          item.x2,
          item.y2
        );
        return lineDist < 10; // 10 pixel tolerance
      case "pen":
        // Check distance to any point in the pen path
        if (item.path && item.path.length > 0) {
          for (let i = 0; i < item.path.length; i++) {
            const point = item.path[i];
            const dist = Math.sqrt(
              Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2)
            );
            if (dist < 15) {
              // 15 pixel tolerance for pen strokes
              return true;
            }
          }
        }
        return false;
      case "circle":
        const dist = Math.sqrt(
          Math.pow(x - item.centerX, 2) + Math.pow(y - item.centerY, 2)
        );
        return Math.abs(dist - item.radius) < 10;
      case "rectangle":
        return (
          x >= item.x &&
          x <= item.x + item.width &&
          y >= item.y &&
          y <= item.y + item.height
        );
      case "text":
        const textWidth = item.text.length * item.fontSize * 0.6;
        const textHeight = item.fontSize;
        return (
          x >= item.x &&
          x <= item.x + textWidth &&
          y >= item.y - textHeight &&
          y <= item.y
        );
      case "image":
        return (
          x >= item.x &&
          x <= item.x + item.width &&
          y >= item.y &&
          y <= item.y + item.height
        );
      default:
        return false;
    }
  };

  const distanceToLine = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Save to history when items are added (not when they're removed or modified)
  useEffect(() => {
    // Only save to history if the length increased (new item added)
    if (
      drawnItems.length > prevItemsLengthRef.current &&
      drawnItems.length > 0
    ) {
      saveToHistory();
    }
    prevItemsLengthRef.current = drawnItems.length;
  }, [drawnItems.length, saveToHistory]);

  // Redraw canvas when drawn items, selected item, or legend configuration changes
  useEffect(() => {
    redrawCanvas();
  }, [drawnItems, selectedItem, legendEntries, legendTitle, redrawCanvas]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedItem) {
          deleteSelectedItem();
        }
      }
      if (event.key === "Escape") {
        setSelectedItem(null);
        redrawCanvas();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedItem, deleteSelectedItem, redrawCanvas]);

  // Focus the inline text input when it appears
  useEffect(() => {
    if (showInlineTextInput) {
      // Multiple attempts to ensure focus works
      const focusInput = () => {
        if (inlineTextInputRef.current) {
          inlineTextInputRef.current.focus();
          inlineTextInputRef.current.select(); // Also select any existing text
        }
      };

      // Try immediately
      focusInput();

      // Try again after a short delay
      setTimeout(focusInput, 50);

      // Try one more time after a longer delay
      setTimeout(focusInput, 150);
    }
  }, [showInlineTextInput]);

  // Handle wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prevZoom) => {
        const newZoom = Math.max(1, Math.min(3, prevZoom + delta)); // No zoom out below 100%
        // Constrain pan offset when zooming
        const rect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const maxPanX = Math.max(
          0,
          (rect.width * newZoom - containerRect.width) / 2
        );
        const maxPanY = Math.max(
          0,
          (rect.height * newZoom - containerRect.height) / 2
        );

        setPanOffset((prev) => ({
          x: Math.max(-maxPanX, Math.min(maxPanX, prev.x)),
          y: Math.max(-maxPanY, Math.min(maxPanY, prev.y)),
        }));

        return newZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Load existing site plan data when component mounts
  useEffect(() => {
    if (existingSitePlan) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      // Create an image from the base64 data
      const img = new Image();
      img.onload = () => {
        // Store the background image in canvas for later use
        canvas.backgroundImage = img;

        // Draw the existing site plan image as background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        console.log("Loaded existing site plan as background");
      };
      img.src = existingSitePlan;
    }
  }, [existingSitePlan]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;

          // Calculate scaled dimensions to fit canvas viewport
          const maxWidth = canvas.width * 0.8; // 80% of canvas width
          const maxHeight = canvas.height * 0.8; // 80% of canvas height

          let scaledWidth = img.width;
          let scaledHeight = img.height;

          // Scale down if image is too large
          if (scaledWidth > maxWidth) {
            const ratio = maxWidth / scaledWidth;
            scaledWidth = maxWidth;
            scaledHeight = scaledHeight * ratio;
          }

          if (scaledHeight > maxHeight) {
            const ratio = maxHeight / scaledHeight;
            scaledHeight = maxHeight;
            scaledWidth = scaledWidth * ratio;
          }

          // Create image item at center of canvas with scaled dimensions
          const x = (canvas.width - scaledWidth) / 2;
          const y = (canvas.height - scaledHeight) / 2;

          const newItem = {
            id: Date.now().toString(),
            type: "image",
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
            imageElement: img,
            src: e.target.result,
            originalWidth: img.width,
            originalHeight: img.height,
          };

          addDrawnItem(newItem);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMapSelection = (mapData) => {
    if (!mapData) {
      return;
    }

    setShowGoogleMaps(true);

    // If map already exists, update it instead of recreating
    if (mapInstanceRef.current) {
      console.log("Updating existing map with new data");
      mapInstanceRef.current.setCenter(mapData.center);
      mapInstanceRef.current.setZoom(mapData.zoom);
      mapInstanceRef.current.setMapTypeId(
        window.google.maps.MapTypeId[mapData.mapType.toUpperCase()]
      );

      // Force a resize to ensure proper rendering
      setTimeout(() => {
        if (mapInstanceRef.current) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize");
        }
      }, 100);
    } else {
      // Clear existing map first
      setMapLoaded(false);
      // Initialize with new data
      initializeGoogleMapsWithData(mapData);
    }
  };

  const initializeGoogleMapsWithData = async (mapData) => {
    try {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not found");
        return;
      }

      console.log("Initializing map with data:", mapData);

      await loadGoogleMapsApi(apiKey);

      // Wait a bit longer to ensure the container is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (mapRef.current) {
        console.log(
          "Creating map with center:",
          mapData.center,
          "zoom:",
          mapData.zoom
        );

        // Log container dimensions
        const containerRect = mapRef.current.getBoundingClientRect();
        console.log(
          "Map container dimensions:",
          containerRect.width,
          "x",
          containerRect.height
        );

        // Check if container has proper dimensions
        if (containerRect.width === 0 || containerRect.height === 0) {
          console.warn("Map container has zero dimensions, retrying in 500ms");
          setTimeout(() => initializeGoogleMapsWithData(mapData), 500);
          return;
        }

        const map = new window.google.maps.Map(mapRef.current, {
          center: mapData.center,
          zoom: mapData.zoom,
          mapTypeId:
            window.google.maps.MapTypeId[mapData.mapType.toUpperCase()],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          gestureHandling: "none",
          tilt: 0,
          heading: 0,
        });

        // Add a listener to ensure the map is fully loaded
        window.google.maps.event.addListenerOnce(map, "idle", () => {
          console.log("Map is idle - fully loaded");
          console.log("Final map center:", map.getCenter().toJSON());
          console.log("Final map zoom:", map.getZoom());
          console.log("Final map type:", map.getMapTypeId());
          // Force a resize to ensure proper rendering
          window.google.maps.event.trigger(map, "resize");
        });

        mapInstanceRef.current = map;
        setMapLoaded(true);

        console.log("Map created successfully");

        // Add a small delay to ensure the map renders properly
        setTimeout(() => {
          if (mapInstanceRef.current) {
            console.log("Forcing map refresh after delay");
            window.google.maps.event.trigger(mapInstanceRef.current, "resize");
          }
        }, 100);
      } else {
        console.error("Map ref not available");
      }
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  };

  const tools = [
    { id: "select", icon: <SelectIcon />, label: "Select" },
    { id: "pen", icon: <EditIcon />, label: "Pen" },
    { id: "hand", icon: <HandIcon />, label: "Hand" },
    { id: "circle", icon: <CircleIcon />, label: "Circle" },
    { id: "rectangle", icon: <SquareIcon />, label: "Rectangle" },
    { id: "line", icon: <LineIcon />, label: "Line" },
    { id: "text", icon: <TextIcon />, label: "Text" },
  ];

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "row" }}>
      {/* Toolbar */}
      <Paper
        sx={{
          p: 2,
          mr: 2,
          width: 280,
          height: "100%",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Drawing Tools */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Tools
            </Typography>
            <Box
              display="flex"
              gap={1}
              alignItems="center"
              flexWrap="wrap"
              sx={{ mb: 1 }}
            >
              {tools.map((tool) => (
                <Tooltip key={tool.id} title={tool.label}>
                  <IconButton
                    onClick={() => setCurrentTool(tool.id)}
                    color={currentTool === tool.id ? "primary" : "default"}
                    variant={currentTool === tool.id ? "contained" : "outlined"}
                    size="small"
                  >
                    {tool.icon}
                  </IconButton>
                </Tooltip>
              ))}
              <FormControl size="small" sx={{ minWidth: 100, ml: 1 }}>
                <InputLabel>Brush Size</InputLabel>
                <Select
                  value={brushSize}
                  label="Brush Size"
                  onChange={(e) => setBrushSize(e.target.value)}
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}px
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Colors */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Colors
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              {/* Stroke Color */}
              <Box display="flex" alignItems="center" gap={2}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: 60,
                    height: 40,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                />
                <Box display="flex" alignItems="center" gap={1}>
                  <input
                    type="checkbox"
                    checked={useTransparentDrawing}
                    onChange={(e) => handleTransparencyToggle(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                  <Typography variant="caption">Transparent</Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Font Size - only show when text tool is selected */}
          {currentTool === "text" && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Font Size: {fontSize}px
              </Typography>
              <Slider
                value={fontSize}
                onChange={(e, value) => setFontSize(value)}
                min={8}
                max={48}
                size="small"
              />
            </Box>
          )}

          {/* Action Buttons */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Actions
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Tooltip title="Undo">
                <Button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  startIcon={<UndoIcon />}
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 60 }}
                >
                  Undo
                </Button>
              </Tooltip>
              <Tooltip title="Redo">
                <Button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  startIcon={<RedoIcon />}
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 60 }}
                >
                  Redo
                </Button>
              </Tooltip>
              <Tooltip title="Delete Selected">
                <Button
                  onClick={deleteSelectedItem}
                  disabled={!selectedItem}
                  color="error"
                  startIcon={<DeleteIcon />}
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 60 }}
                >
                  Delete
                </Button>
              </Tooltip>
            </Box>
          </Box>

          {/* Zoom Controls */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Zoom
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Tooltip title="Zoom Out">
                <IconButton
                  onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                  size="small"
                  disabled={zoom <= 1}
                >
                  <ZoomOutIcon />
                </IconButton>
              </Tooltip>
              <Typography
                variant="body2"
                sx={{ textAlign: "center", minWidth: 50 }}
              >
                {Math.round(zoom * 100)}%
              </Typography>
              <Tooltip title="Zoom In">
                <IconButton
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                  size="small"
                  disabled={zoom >= 3}
                >
                  <ZoomInIcon />
                </IconButton>
              </Tooltip>
              <Box sx={{ ml: 2 }}>
                <Tooltip title="Reset View">
                  <IconButton
                    onClick={() => {
                      setZoom(1); // Reset to 100%
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    size="small"
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          {/* Image Section */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Image
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                size="small"
                fullWidth
              >
                Add Image Layer
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageUpload}
                />
              </Button>
              {selectedItem?.type === "image" && (
                <Button
                  variant="outlined"
                  onClick={deleteSelectedItem}
                  size="small"
                  color="error"
                  fullWidth
                  startIcon={<DeleteIcon />}
                >
                  Delete Image
                </Button>
              )}
            </Box>
          </Box>

          {/* Map Section */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Map
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                variant={showGoogleMaps ? "contained" : "outlined"}
                onClick={() => setShowGoogleMapsDialog(true)}
                size="small"
                fullWidth
              >
                {showGoogleMaps ? "Change Map Layer" : "Add Map Layer"}
              </Button>
              {showGoogleMaps && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowGoogleMaps(false);
                    setMapLoaded(false);
                  }}
                  size="small"
                  color="error"
                  fullWidth
                  startIcon={<DeleteIcon />}
                >
                  Remove Map
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Drawing Canvas */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          ref={canvasContainerRef}
          sx={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#cfd8dc",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerCancel}
              style={{
                position: "relative",
                zIndex: 2,
                cursor:
                  currentTool === "hand"
                    ? isPanning
                      ? "grabbing"
                      : "grab"
                    : currentTool === "select" && selectedItem
                    ? "pointer"
                    : "crosshair",
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                backgroundColor: showGoogleMaps ? "transparent" : "#ffffff",
                borderRadius: 8,
                border: "1px solid rgba(69, 90, 100, 0.5)",
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: "top left",
                display: "block",
              }}
            />

            {/* Inline Text Input Overlay */}
            {showInlineTextInput && (
              <Box
                sx={{
                  position: "absolute",
                  left: inlineTextPosition.x,
                  top: inlineTextPosition.y,
                  zIndex: 1000,
                  backgroundColor: "white",
                  border: "2px solid #007bff",
                  borderRadius: 1,
                  padding: 1,
                  minWidth: 200,
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                }}
              >
                <input
                  ref={inlineTextInputRef}
                  autoFocus
                  type="text"
                  value={inlineTextInput}
                  onChange={(e) => setInlineTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleInlineTextSubmit();
                    } else if (e.key === "Escape") {
                      handleInlineTextCancel();
                    }
                  }}
                  placeholder="Enter text..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: fontSize,
                    fontFamily: "Arial, sans-serif",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleInlineTextSubmit}
                    disabled={!inlineTextInput.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleInlineTextCancel}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            )}

            {/* Google Maps Overlay */}
            {showGoogleMaps && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${canvasSize.width}px`,
                  height: `${canvasSize.height}px`,
                  pointerEvents: "none",
                  zIndex: 1,
                  overflow: "hidden",
                  clipPath: "inset(0 0 5% 0)",
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  ref={mapRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    opacity: 0.7,
                  }}
                />
                {!mapLoaded && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <Typography variant="h6" color="text.secondary">
                      Loading Google Maps...
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box
          display="flex"
          justifyContent="space-between"
          gap={2}
          sx={{ p: 2, borderTop: 1, borderColor: "divider" }}
        >
          <Button
            variant={legendEntries.length > 0 ? "contained" : "outlined"}
            onClick={openLegendDialog}
            size="small"
          >
            {legendEntries.length > 0 ? "View/Edit Key" : "View/Edit Key"}
          </Button>
          <Box display="flex" gap={2}>
            <Button onClick={onCancel} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              startIcon={<SaveIcon />}
            >
              Save Site Plan
            </Button>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={legendDialogOpen}
        onClose={handleLegendDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manage Site Plan Key</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Key header"
            fullWidth
            value={legendDraftTitle}
            onChange={(event) => setLegendDraftTitle(event.target.value)}
            sx={{ mb: 3 }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {legendDraftEntries.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Colours are added automatically as you draw on the plan. You can
                also add custom key items.
              </Typography>
            )}
            {legendDraftEntries.map((entry, index) => (
              <Box
                key={entry.id || `${entry.color}-${index}`}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  columnGap: 16,
                  rowGap: 8,
                  alignItems: "center",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <input
                    type="color"
                    value={entry.color}
                    onChange={(e) =>
                      handleLegendColorChange(entry.id, e.target.value)
                    }
                    style={{
                      width: 40,
                      height: 40,
                      border: "1px solid rgba(55, 65, 81, 0.4)",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Colour
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {entry.color}
                    </Typography>
                  </Box>
                </Box>
                <TextField
                  label={`Description ${index + 1}`}
                  value={entry.description}
                  onChange={(event) =>
                    handleLegendEntryChange(entry.id, event.target.value)
                  }
                  fullWidth
                />
                <IconButton
                  onClick={() => handleRemoveLegendEntry(entry.id)}
                  color="error"
                  size="small"
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              onClick={handleAddLegendEntry}
              variant="outlined"
              startIcon={<AddIcon />}
              size="small"
              sx={{ mt: 1 }}
            >
              Add Key Item
            </Button>
          </Box>
          {legendDraftEntries.length > 0 && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                mt: 3,
              }}
            >
              <Button
                onClick={handleLegendDialogClear}
                variant="text"
                color="error"
                size="small"
              >
                Clear Descriptions
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLegendDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleLegendDialogSave} variant="contained">
            Save Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Google Maps Dialog */}
      <GoogleMapsDialog
        open={showGoogleMapsDialog}
        onClose={() => setShowGoogleMapsDialog(false)}
        onSelectMap={handleMapSelection}
      />
    </Box>
  );
};

export default SitePlanDrawing;
