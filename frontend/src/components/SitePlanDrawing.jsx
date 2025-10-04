import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Slider,
  Button,
  Typography,
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

const SitePlanDrawing = ({ onSave, onCancel, existingSitePlan }) => {
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Set up responsive canvas sizing
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Set canvas size to match container
        canvas.width = containerWidth;
        canvas.height = containerHeight;

        // Set CSS size to maintain aspect ratio
        canvas.style.width = containerWidth + "px";
        canvas.style.height = containerHeight + "px";

        // Redraw all items after resizing
        setTimeout(() => {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          redrawCanvas();
        }, 0);
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      return () => {
        window.removeEventListener("resize", resizeCanvas);
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const imageData = canvas.toDataURL("image/png");
    onSave(imageData);
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
    if (selectedItem) {
      drawSelectionHandles(ctx, selectedItem);
    }
  }, [drawnItems, selectedItem, drawSelectionHandles]);

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

  // Redraw canvas when drawnItems or selectedItem change
  useEffect(() => {
    redrawCanvas();
  }, [drawnItems, selectedItem, redrawCanvas]);

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
        </Box>
      </Paper>

      {/* Drawing Canvas */}
      <Paper sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
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
            backgroundColor: "#fff",
            display: "block",
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
