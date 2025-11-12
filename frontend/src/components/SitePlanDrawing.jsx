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
} from "@mui/material";
import {
  Edit as EditIcon,
  Circle as CircleIcon,
  Square as SquareIcon,
  Straighten as LineIcon,
  TextFields as TextIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
  Mouse as SelectIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  PanTool as HandIcon,
} from "@mui/icons-material";
import loadGoogleMapsApi from "../utils/loadGoogleMapsApi";
import GoogleMapsDialog from "./GoogleMapsDialog";

const CANVAS_SAFE_WIDTH = 1000;
const CANVAS_SAFE_HEIGHT = 720;

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
  existingLegendTitle = "Site Plan Key",
}) => {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState("pen");
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [color, setColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [isFilled, setIsFilled] = useState(false);
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
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const prevItemsLengthRef = useRef(0);
  const [legendEntries, setLegendEntries] = useState(() =>
    normalizeLegendEntries(existingLegend)
  );
  const [legendTitle, setLegendTitle] = useState(
    existingLegendTitle || "Site Plan Key"
  );
  const [legendDialogOpen, setLegendDialogOpen] = useState(false);
  const [legendDraftEntries, setLegendDraftEntries] = useState(() =>
    normalizeLegendEntries(existingLegend)
  );
  const [legendDraftTitle, setLegendDraftTitle] = useState(
    existingLegendTitle || "Site Plan Key"
  );
  const [imageScale, setImageScale] = useState(100);
  const renderForExportRef = useRef(false);

  useEffect(() => {
    setLegendEntries(normalizeLegendEntries(existingLegend));
    setLegendDraftEntries(normalizeLegendEntries(existingLegend));
  }, [existingLegend]);

  useEffect(() => {
    const nextTitle = existingLegendTitle || "Site Plan Key";
    setLegendTitle(nextTitle);
    setLegendDraftTitle(nextTitle);
  }, [existingLegendTitle]);

  const openLegendDialog = () => {
    setLegendDraftTitle(legendTitle || "Site Plan Key");
    setLegendDraftEntries(
      legendEntries.map((entry) => ({ ...entry }))
    );
    setLegendDialogOpen(true);
  };

  const handleLegendDialogClose = () => {
    setLegendDialogOpen(false);
  };

  const handleLegendEntryChange = (colorKey, value) => {
    setLegendDraftEntries((prev) =>
      prev.map((entry) =>
        entry.color.toLowerCase() === colorKey.toLowerCase()
          ? { ...entry, description: value }
          : entry
      )
    );
  };

  const handleLegendDialogClear = () => {
    setLegendDraftEntries((prev) =>
      prev.map((entry) => ({ ...entry, description: "" }))
    );
  };

  const handleLegendDialogSave = () => {
    const cleanedTitle = legendDraftTitle.trim() || "Site Plan Key";
    const cleanedEntries = legendDraftEntries.map((entry) => ({
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
        prev.map((entry) => [entry.color?.toLowerCase(), entry.description || ""])
      );
      const nextEntries = orderedColors.map((colorValue) => ({
        color: colorValue,
        description: prevMap.get(colorValue.toLowerCase()) || "",
      }));

      return legendArraysEqual(nextEntries, prev) ? prev : nextEntries;
    });
  }, [drawnItems]);

  useEffect(() => {
    if (selectedItem?.type === "image") {
      const baseWidth = selectedItem.originalWidth || selectedItem.width;
      if (baseWidth) {
        const ratio = (selectedItem.width / baseWidth) * 100;
        setImageScale(Math.round(ratio));
        return;
      }
    }
    setImageScale(100);
  }, [selectedItem]);

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

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate proper coordinates accounting for canvas scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

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

    // Calculate proper coordinates accounting for canvas scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (isPanning) {
      // Handle panning
      const newPanOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
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
      const radius = Math.sqrt(
        Math.pow(x - canvas.startX, 2) + Math.pow(y - canvas.startY, 2)
      );
      ctx.beginPath();
      ctx.arc(canvas.startX, canvas.startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
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
      const width = x - canvas.startX;
      const height = y - canvas.startY;
      ctx.beginPath();
      ctx.rect(canvas.startX, canvas.startY, width, height);
      ctx.stroke();
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
      ctx.beginPath();
      ctx.moveTo(canvas.startX, canvas.startY);
      ctx.lineTo(x, y);
      ctx.stroke();
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
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

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

  const updateImageScale = useCallback((item, scalePercent) => {
    if (!item || item.type !== "image") {
      return item;
    }

    const baseWidth = item.originalWidth || item.width;
    const baseHeight = item.originalHeight || item.height;
    if (!baseWidth || !baseHeight) {
      return item;
    }

    const ratio = Math.max(0.1, scalePercent / 100);
    const newWidth = Math.max(20, baseWidth * ratio);
    const newHeight = Math.max(20, baseHeight * ratio);
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;

    return {
      ...item,
      width: newWidth,
      height: newHeight,
      x: centerX - newWidth / 2,
      y: centerY - newHeight / 2,
      originalWidth: baseWidth,
      originalHeight: baseHeight,
    };
  }, []);

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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnItems([]);
    setSelectedItem(null);
    setHistory([[]]);
    setHistoryIndex(0);
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

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderForExportRef.current = true;
    redrawCanvas();
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
    setDrawnItems((prev) => [...prev, item]);
  };

  const drawSelectionHandles = useCallback((ctx, item) => {
    const handles = getSelectionHandles(item);

    ctx.strokeStyle = "#007bff";
    ctx.fillStyle = "#007bff";
    ctx.lineWidth = 2;

    handles.forEach((handle) => {
      ctx.beginPath();
      ctx.rect(handle.x - 4, handle.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    });
  }, []);

  const drawItem = (ctx, item) => {
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = item.lineWidth || 2;

    switch (item.type) {
      case "line":
        ctx.beginPath();
        ctx.moveTo(item.x1, item.y1);
        ctx.lineTo(item.x2, item.y2);
        ctx.stroke();
        break;
      case "pen":
        if (item.path && item.path.length > 0) {
          ctx.beginPath();
          ctx.moveTo(item.path[0].x, item.path[0].y);
          for (let i = 1; i < item.path.length; i++) {
            ctx.lineTo(item.path[i].x, item.path[i].y);
          }
          ctx.stroke();
        }
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(item.centerX, item.centerY, item.radius, 0, 2 * Math.PI);
        if (item.isFilled) {
          ctx.fillStyle = item.fillColor;
          ctx.fill();
          ctx.fillStyle = item.color; // Reset to stroke color
        }
        ctx.stroke();
        break;
      case "rectangle":
        ctx.beginPath();
        ctx.rect(item.x, item.y, item.width, item.height);
        if (item.isFilled) {
          ctx.fillStyle = item.fillColor;
          ctx.fill();
          ctx.fillStyle = item.color; // Reset to stroke color
        }
        ctx.stroke();
        break;
      case "text":
        ctx.font = `${item.fontSize}px Arial`;
        ctx.fillText(item.text, item.x, item.y);
        break;
      case "image":
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
  };

  const drawLegend = useCallback(
    (ctx, canvas) => {
      if (!legendEntries.length) {
        return;
      }

      const padding = 16;
      const rowHeight = 28;
      const colorBoxSize = 18;
      const columnGap = 12;
      const maxAllowedWidth = canvas.width * 0.45;
      const minWidth = 240;
      const headerText = legendTitle || "Site Plan Key";

      ctx.save();

      ctx.font = "16px Arial";
      ctx.textBaseline = "top";
      let maxTextWidth = ctx.measureText(headerText).width;

      ctx.font = "14px Arial";
      legendEntries.forEach((entry) => {
        const width = ctx.measureText(entry.description || "").width;
        if (width > maxTextWidth) {
          maxTextWidth = width;
        }
      });

      const contentWidth =
        padding * 2 + colorBoxSize + columnGap + maxTextWidth;
      const width = Math.max(
        minWidth,
        Math.min(maxAllowedWidth, contentWidth)
      );
      const height = padding * 2 + 24 + legendEntries.length * rowHeight;
      const x = canvas.width - width - 20;
      const y = canvas.height - height - 20;

      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.fillRect(x, y, width, height);

      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "#1f1f1f";
      ctx.font = "16px Arial";
      ctx.textBaseline = "top";
      ctx.fillText(headerText, x + padding, y + padding);

      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.moveTo(x + padding, y + padding + 22);
      ctx.lineTo(x + width - padding, y + padding + 22);
      ctx.stroke();

      const tableTop = y + padding + 28;
      ctx.font = "14px Arial";
      ctx.textBaseline = "middle";

      legendEntries.forEach((entry, index) => {
        const rowTop = tableTop + index * rowHeight;
        const boxY = rowTop + (rowHeight - colorBoxSize) / 2;

        ctx.fillStyle = entry.color || "#6b7280";
        ctx.fillRect(x + padding, boxY, colorBoxSize, colorBoxSize);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.strokeRect(x + padding, boxY, colorBoxSize, colorBoxSize);

        ctx.fillStyle = "#1f1f1f";
        ctx.fillText(
          entry.description || "",
          x + padding + colorBoxSize + columnGap,
          rowTop + rowHeight / 2
        );

        ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
        ctx.beginPath();
        ctx.moveTo(x + padding, rowTop + rowHeight);
        ctx.lineTo(x + width - padding, rowTop + rowHeight);
        ctx.stroke();
      });

      ctx.restore();
    },
    [legendEntries, legendTitle]
  );

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

    // Draw legend overlay if configured (only during editing)
    if (!renderForExportRef.current) {
      drawLegend(ctx, canvas);
    }

    // Draw selected item with selection handles
    if (selectedItem && !renderForExportRef.current) {
      drawSelectionHandles(ctx, selectedItem);
    }
  }, [drawnItems, selectedItem, drawLegend, drawSelectionHandles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    canvas.width = CANVAS_SAFE_WIDTH;
    canvas.height = CANVAS_SAFE_HEIGHT;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    redrawCanvas();
  }, [redrawCanvas]);

  const handleImageScaleChange = useCallback(
    (event, value) => {
      if (!selectedItem || selectedItem.type !== "image") {
        return;
      }

      const scaleValue = Array.isArray(value) ? value[0] : value;
      setImageScale(scaleValue);

      const updatedItem = updateImageScale(selectedItem, scaleValue);
      if (!updatedItem) {
        return;
      }

      setSelectedItem(updatedItem);
      setDrawnItems((prev) =>
        prev.map((item) => (item.id === selectedItem.id ? updatedItem : item))
      );
      redrawCanvas();
    },
    [selectedItem, updateImageScale, redrawCanvas]
  );

  const handleImageScaleChangeCommitted = useCallback(() => {
    if (selectedItem?.type === "image") {
      saveToHistory();
    }
  }, [selectedItem, saveToHistory]);

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
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prevZoom) => Math.max(0.25, Math.min(3, prevZoom + delta)));
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
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
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {/* Drawing Tools */}
          <Box display="flex" gap={1}>
            {tools.map((tool) => (
              <Tooltip key={tool.id} title={tool.label}>
                <IconButton
                  onClick={() => setCurrentTool(tool.id)}
                  color={currentTool === tool.id ? "primary" : "default"}
                  variant={currentTool === tool.id ? "contained" : "outlined"}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>

          {/* Brush Size */}
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="caption" display="block">
              Brush Size: {brushSize}px
            </Typography>
            <Slider
              value={brushSize}
              onChange={(e, value) => setBrushSize(value)}
              min={1}
              max={20}
              size="small"
            />
          </Box>

          {/* Font Size - only show when text tool is selected */}
          {currentTool === "text" && (
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="caption" display="block">
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

          {/* Color Controls */}
          <Box display="flex" gap={2} alignItems="center">
            {/* Stroke Color */}
            <Box display="flex" flexDirection="column" alignItems="center">
              <Typography variant="caption">Stroke</Typography>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: 40,
                  height: 40,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              />
            </Box>

            {/* Fill Color - only show for shapes */}
            {(currentTool === "circle" || currentTool === "rectangle") && (
              <>
                <Box display="flex" flexDirection="column" alignItems="center">
                  <Typography variant="caption">Fill</Typography>
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    style={{
                      width: 40,
                      height: 40,
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  />
                </Box>
                <Box display="flex" flexDirection="column" alignItems="center">
                  <Typography variant="caption">Fill</Typography>
                  <input
                    type="checkbox"
                    checked={isFilled}
                    onChange={(e) => setIsFilled(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                </Box>
              </>
            )}
          </Box>

          {/* Action Buttons */}
          <Box display="flex" gap={1}>
            <Tooltip title="Undo">
              <IconButton onClick={undo} disabled={historyIndex <= 0}>
                <UndoIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo">
              <IconButton
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <RedoIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear">
              <IconButton onClick={clearCanvas}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Selected">
              <IconButton
                onClick={deleteSelectedItem}
                disabled={!selectedItem}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Zoom Controls */}
          <Box display="flex" gap={1} alignItems="center">
            <Tooltip title="Zoom Out">
              <IconButton onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Typography
              variant="body2"
              sx={{ minWidth: 60, textAlign: "center" }}
            >
              {Math.round(zoom * 100)}%
            </Typography>
            <Tooltip title="Zoom In">
              <IconButton onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset View">
              <IconButton
                onClick={() => {
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Upload Image Button */}
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            sx={{ whiteSpace: "nowrap" }}
          >
            Upload Image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageUpload}
            />
          </Button>

          {/* Google Maps Controls */}
          <Button
            variant={showGoogleMaps ? "contained" : "outlined"}
            onClick={() => setShowGoogleMapsDialog(true)}
            size="small"
          >
            {showGoogleMaps ? "Change Map View" : "Add Map Layer"}
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
            >
              Remove Map
            </Button>
          )}
          <Button
            variant={legendEntries.length > 0 ? "contained" : "outlined"}
            onClick={openLegendDialog}
            size="small"
          >
            {legendEntries.length > 0 ? "Edit Key" : "Add Key"}
          </Button>
          {selectedItem?.type === "image" && (
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="caption" display="block">
                Image Size: {imageScale}%
              </Typography>
              <Slider
                value={imageScale}
                onChange={handleImageScaleChange}
                onChangeCommitted={handleImageScaleChangeCommitted}
                min={25}
                max={300}
                size="small"
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Drawing Canvas */}
      <Paper
        sx={{
          position: "relative",
          backgroundColor: "#dfe3e8",
          borderRadius: 3,
          p: 3,
          width: "100%",
          maxWidth: 900,
          aspectRatio: `${CANVAS_SAFE_WIDTH} / ${CANVAS_SAFE_HEIGHT}`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          mx: "auto",
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={(e) => stopDrawing(e)}
          onMouseLeave={(e) => stopDrawing(e)}
          style={{
            cursor:
              currentTool === "hand"
                ? isPanning
                  ? "grabbing"
                  : "grab"
                : currentTool === "select" && selectedItem
                ? "pointer"
                : "crosshair",
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            borderRadius: 8,
            boxShadow: "0 0 0 2px rgba(69, 90, 100, 0.4)",
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "top left",
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
              right: 0,
              bottom: 0,
              pointerEvents: "none",
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
      </Paper>

      {/* Action Buttons */}
      <Box display="flex" justifyContent="flex-end" gap={2} sx={{ mt: 2 }}>
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

      {legendEntries.length > 0 && (
        <Box
          sx={{
            width: "100%",
            maxWidth: 900,
            mx: "auto",
            mt: 3,
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: "#fafbfc",
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, mb: 1, textTransform: "uppercase" }}
            >
              {legendTitle || "Site Plan Key"}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {legendEntries.map((entry) => (
                <Box
                  key={entry.color}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "4px",
                      border: "1px solid rgba(55, 65, 81, 0.4)",
                      backgroundColor: entry.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: entry.description ? "inherit" : "text.secondary", fontStyle: entry.description ? "normal" : "italic" }}>
                    {entry.description || "No description provided"}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

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
                Colours are added automatically as you draw on the plan.
              </Typography>
            )}
            {legendDraftEntries.map((entry, index) => (
              <Box
                key={entry.color}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
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
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      border: "1px solid rgba(55, 65, 81, 0.4)",
                      backgroundColor: entry.color,
                      flexShrink: 0,
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
                    handleLegendEntryChange(entry.color, event.target.value)
                  }
                  fullWidth
                />
              </Box>
            ))}
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
