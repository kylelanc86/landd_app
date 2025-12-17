import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { tokens } from "../theme/tokens";
import loadGoogleMapsApi from "../utils/loadGoogleMapsApi";
import { sampleService } from "../services/api";

const SitePlanMap = ({
  open,
  onClose,
  shiftId,
  initialData,
  onSave,
  projectId,
}) => {
  const colors = tokens;
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [editingMarker, setEditingMarker] = useState(null);
  const [newMarkerType, setNewMarkerType] = useState("sampling_point");
  const [newMarkerDescription, setNewMarkerDescription] = useState("");
  const [mapCenter, setMapCenter] = useState({ lat: -35.2809, lng: 149.13 }); // Canberra default
  const [mapZoom, setMapZoom] = useState(15);
  const [samples, setSamples] = useState([]);
  const [availableSampleNumbers, setAvailableSampleNumbers] = useState([]);
  const availableSampleNumbersRef = useRef([]);
  const [usedSampleNumbers, setUsedSampleNumbers] = useState(new Set());
  const usedSampleNumbersRef = useRef(new Set());

  // Load samples for the shift
  useEffect(() => {
    if (open && shiftId) {
      loadSamples();
    }
  }, [open, shiftId]);

  // Initialize map
  useEffect(() => {
    if (open && !mapLoaded) {
      // Use setTimeout to ensure the Dialog is fully rendered and the map container element exists
      const timeoutId = setTimeout(() => {
        initializeMap();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [open, mapLoaded]);

  // Reset map when dialog closes
  useEffect(() => {
    if (!open) {
      setMapLoaded(false);
      setMarkers([]);
      setEditingMarker(null);
      markersRef.current = [];
      mapInstanceRef.current = null;
      usedSampleNumbersRef.current = new Set();
      setUsedSampleNumbers(new Set());
    }
  }, [open]);

  // Load initial data
  useEffect(() => {
    if (open && initialData && mapLoaded) {
      loadInitialData();
    }
  }, [open, initialData, mapLoaded]);

  const initializeMap = async () => {
    try {
      // Ensure the map container element exists and is a valid DOM element
      if (!mapRef.current || !(mapRef.current instanceof Element)) {
        console.error("Map container element is not available");
        return;
      }

      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not found");
        return;
      }

      await loadGoogleMapsApi(apiKey);

      // Double-check the element still exists after async operations
      if (!mapRef.current || !(mapRef.current instanceof Element)) {
        console.error(
          "Map container element is not available after loading API"
        );
        return;
      }

      const map = new window.google.maps.Map(mapRef.current, {
        center: mapCenter,
        zoom: mapZoom,
        mapTypeId: window.google.maps.MapTypeId.SATELLITE, // Use satellite view
        mapTypeControl: false, // Disable map type control to prevent 3D switching
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: "greedy",
        tilt: 0, // Force 2D overhead view - no tilt
        heading: 0, // Force north-up orientation
      });

      mapInstanceRef.current = map;

      // Trigger resize event to ensure map renders correctly in the Dialog
      setTimeout(() => {
        if (mapInstanceRef.current) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize");
        }
      }, 100);

      // Add click listener for adding markers
      map.addListener("click", (event) => {
        if (!editingMarker) {
          addMarker(event.latLng, newMarkerType, newMarkerDescription);
        }
      });

      setMapLoaded(true);
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  };

  const loadSamples = async () => {
    try {
      const response = await sampleService.getByShift(shiftId);
      const samplesData = response.data;

      // Filter out field blanks - they aren't site samples
      const siteSamples = samplesData.filter(
        (sample) =>
          sample.location && sample.location.toLowerCase() !== "field blank"
      );

      setSamples(siteSamples);
      console.log("Loaded samples (excluding field blanks):", siteSamples);

      // Create available sample numbers for automatic assignment, sorted alphabetically
      const sampleNumbers = siteSamples
        .map((sample) => ({
          value: sample.sampleNumber,
          label: sample.sampleNumber,
          id: sample._id,
        }))
        .sort((a, b) => a.value.localeCompare(b.value)); // Sort alphabetically (AM1, AM2, etc.)
      setAvailableSampleNumbers(sampleNumbers);
      availableSampleNumbersRef.current = sampleNumbers; // Store in ref for synchronous access
      console.log("Available sample numbers:", sampleNumbers);
      console.log(
        "Sample data details:",
        siteSamples.map((s) => ({ id: s._id, sampleNumber: s.sampleNumber }))
      );

      // Initialize used sample numbers from existing markers
      const existingUsed = new Set();
      if (initialData?.sitePlanData?.markers) {
        initialData.sitePlanData.markers.forEach((marker) => {
          if (marker.type === "sampling_point" && marker.sampleNumber) {
            existingUsed.add(marker.sampleNumber);
          }
        });
      }
      usedSampleNumbersRef.current = existingUsed;
      setUsedSampleNumbers(existingUsed);
    } catch (error) {
      console.error("Error loading samples:", error);
      setSamples([]);
      setAvailableSampleNumbers([]);
      setUsedSampleNumbers(new Set());
    }
  };

  const getNextAvailableSampleNumber = () => {
    // Find the first sample number that hasn't been used yet
    console.log(
      "Getting next sample number. Available:",
      availableSampleNumbersRef.current,
      "Used:",
      usedSampleNumbersRef.current
    );

    // If no samples available, return null
    if (availableSampleNumbersRef.current.length === 0) {
      console.log("No samples available");
      return null;
    }

    // Find the first unused sample number
    for (const sample of availableSampleNumbersRef.current) {
      if (!usedSampleNumbersRef.current.has(sample.value)) {
        console.log("Found next sample number:", sample.value);
        return sample.value;
      }
    }
    console.log("All samples have been used");
    return null; // No more samples available
  };

  const loadInitialData = () => {
    if (initialData?.sitePlanData) {
      const {
        center,
        zoom,
        markers: initialMarkers,
      } = initialData.sitePlanData;

      if (center) {
        setMapCenter(center);
        mapInstanceRef.current?.setCenter(center);
      }

      if (zoom) {
        setMapZoom(zoom);
        mapInstanceRef.current?.setZoom(zoom);
      }

      if (initialMarkers) {
        setMarkers(initialMarkers);
        initialMarkers.forEach((markerData) => {
          createMarkerOnMap(markerData);
        });
      }
    }
  };

  const createMarkerOnMap = (markerData) => {
    if (!mapInstanceRef.current) return;

    // Get the display label - use sample number if it's a sampling point with a sample number
    let displayLabel = markerData.label || "X";
    if (markerData.type === "sampling_point" && markerData.sampleNumber) {
      displayLabel = markerData.sampleNumber;
    }

    const marker = new window.google.maps.Marker({
      position: markerData.position,
      map: mapInstanceRef.current,
      title: markerData.description || `${markerData.type} - ${displayLabel}`,
      draggable: true,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 15,
        fillColor: getMarkerColor(markerData.type),
        fillOpacity: 0.8,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      label: {
        text: displayLabel,
        color: "#ffffff",
        fontSize: "12px",
        fontWeight: "bold",
      },
    });

    // Add click listener to edit marker
    marker.addListener("click", () => {
      setEditingMarker(markerData);
      setNewMarkerType(markerData.type);
      setNewMarkerDescription(markerData.description || "");
    });

    // Add drag listener to update position
    marker.addListener("dragend", () => {
      const newPosition = marker.getPosition();
      updateMarker(markerData.id, {
        position: {
          lat: newPosition.lat(),
          lng: newPosition.lng(),
        },
      });
    });

    markersRef.current.push(marker);
    return marker;
  };

  const addMarker = (position, type, description) => {
    // For sampling points, check if we can add more and automatically assign the next available sample number
    let sampleNumber = null;
    if (type === "sampling_point") {
      // Check if we have any samples available (use ref for synchronous access)
      if (availableSampleNumbersRef.current.length === 0) {
        console.log("No samples available for this shift.");
        return; // Don't add the marker if no samples are available
      }

      // Check if we've already used all available samples
      if (
        usedSampleNumbersRef.current.size >=
        availableSampleNumbersRef.current.length
      ) {
        console.log(
          "All samples have been used. Cannot add more sampling points."
        );
        return; // Don't add the marker if all samples are used
      }

      sampleNumber = getNextAvailableSampleNumber();
      if (!sampleNumber) {
        console.log("No sample number available");
        return; // Don't add the marker if no sample number is available
      }

      // Update used sample numbers synchronously using ref
      usedSampleNumbersRef.current.add(sampleNumber);
      setUsedSampleNumbers(new Set(usedSampleNumbersRef.current));
      console.log("Updated used sample numbers:", usedSampleNumbersRef.current);
    }

    const markerData = {
      id: Date.now().toString(),
      position: {
        lat: position.lat(),
        lng: position.lng(),
      },
      label: sampleNumber || "X",
      type: type,
      description: description,
      sampleNumber: sampleNumber,
    };

    console.log("Creating marker with data:", markerData);
    setMarkers((prev) => [...prev, markerData]);
    createMarkerOnMap(markerData);
  };

  const updateMarker = (markerId, updates) => {
    setMarkers((prev) =>
      prev.map((marker) =>
        marker.id === markerId ? { ...marker, ...updates } : marker
      )
    );

    // Update marker on map
    const markerIndex = markersRef.current.findIndex(
      (_, index) => markers[index]?.id === markerId
    );
    if (markerIndex !== -1) {
      const marker = markersRef.current[markerIndex];
      marker.setPosition(updates.position);

      // Get the display label for the title
      let displayLabel = updates.label || "X";
      if (updates.type === "sampling_point" && updates.sampleNumber) {
        displayLabel = updates.sampleNumber;
      }

      marker.setTitle(
        updates.description || `${updates.type} - ${displayLabel}`
      );
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 15,
        fillColor: getMarkerColor(updates.type),
        fillOpacity: 0.8,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      });

      // Update the label
      marker.setLabel({
        text: displayLabel,
        color: "#ffffff",
        fontSize: "12px",
        fontWeight: "bold",
      });
    }

    setEditingMarker(null);
  };

  const deleteMarker = (markerId) => {
    // Find the marker being deleted to free up its sample number
    const markerToDelete = markers.find((marker) => marker.id === markerId);
    if (
      markerToDelete &&
      markerToDelete.type === "sampling_point" &&
      markerToDelete.sampleNumber
    ) {
      usedSampleNumbersRef.current.delete(markerToDelete.sampleNumber);
      setUsedSampleNumbers(new Set(usedSampleNumbersRef.current));
      console.log(
        "Freed up sample number:",
        markerToDelete.sampleNumber,
        "Remaining:",
        usedSampleNumbersRef.current
      );
    }

    setMarkers((prev) => prev.filter((marker) => marker.id !== markerId));

    // Remove marker from map
    const markerIndex = markersRef.current.findIndex(
      (_, index) => markers[index]?.id === markerId
    );
    if (markerIndex !== -1) {
      markersRef.current[markerIndex].setMap(null);
      markersRef.current.splice(markerIndex, 1);
    }
  };

  const getMarkerColor = (type) => {
    const colors = {
      sampling_point: "#ff4444",
      equipment: "#4444ff",
      access_point: "#44ff44",
      other: "#ffaa44",
    };
    return colors[type] || "#ff4444";
  };

  const getMarkerTypeLabel = (type) => {
    const labels = {
      sampling_point: "Sampling Point",
      equipment: "Equipment",
      access_point: "Access Point",
      other: "Other",
    };
    return labels[type] || "Other";
  };

  const handleSave = async () => {
    // Remove the id field from markers since they don't need it in the database
    const markersForSave = markers.map(({ id, ...marker }) => marker);

    const center = mapInstanceRef.current?.getCenter()?.toJSON() || mapCenter;
    const zoom = mapInstanceRef.current?.getZoom() || mapZoom;
    const bounds = mapInstanceRef.current?.getBounds()?.toJSON();

    // Generate Google Maps Static API URL with markers
    const staticMapUrl = generateStaticMapUrl(center, zoom, markersForSave);

    const sitePlanData = {
      center: center,
      zoom: zoom,
      markers: markersForSave,
      bounds: bounds,
      staticMapUrl: staticMapUrl,
    };

    console.log("Saving site plan data:", sitePlanData);
    console.log("Center:", center);
    console.log("Zoom:", zoom);
    console.log("Bounds:", bounds);
    console.log("Markers:", markersForSave);
    console.log("Static Map URL:", staticMapUrl);

    onSave({
      sitePlan: true,
      sitePlanData: sitePlanData,
    });
  };

  const generateStaticMapUrl = (center, zoom, markers) => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key not found for static map");
      return null;
    }

    // Base URL for Google Maps Static API
    let url = `https://maps.googleapis.com/maps/api/staticmap?`;

    // Map parameters - standard size, backend will crop the footer
    url += `center=${center.lat},${center.lng}`;
    url += `&zoom=${zoom}`;
    url += `&size=800x600`; // Standard size, backend will crop footer
    url += `&maptype=satellite`;
    url += `&format=png`;

    // Add markers with letter labels (A, B, C, etc.)
    markers.forEach((marker, index) => {
      const color = getMarkerColorHex(marker.type || "other");
      const label = String.fromCharCode(65 + index); // 65 is 'A' in ASCII, so A, B, C, D...

      // Add marker with color and letter label
      url += `&markers=color:0x${color}|label:${label}|${marker.position.lat},${marker.position.lng}`;
    });

    // Add API key
    url += `&key=${apiKey}`;

    console.log("Generated static map URL:", url);

    // Return proxy URL with crop parameter
    const proxyUrl = `/api/air-monitoring-shifts/proxy-static-map?url=${encodeURIComponent(
      url
    )}&crop=true`;
    return proxyUrl;
  };

  const getMarkerColorHex = (type) => {
    const colors = {
      sampling_point: "ff4444",
      equipment: "4444ff",
      access_point: "44ff44",
      other: "ffaa44",
    };
    return colors[type] || "ff4444";
  };

  const handleClose = () => {
    setEditingMarker(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: "90vh",
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: colors.primary[500],
          color: colors.grey[100],
        }}
      >
        <Typography variant="h6">Site Plan Editor</Typography>
        <IconButton onClick={handleClose} sx={{ color: colors.grey[100] }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{ p: 0, display: "flex", flexDirection: "column", height: "100%" }}
      >
        {/* Controls */}
        <Box
          sx={{
            p: 2,
            backgroundColor: colors.grey[100],
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" sx={{ mr: 2 }}>
            Click on the map to add markers. Sampling points automatically get
            sample numbers in order ({usedSampleNumbers.size}/
            {availableSampleNumbers.length} used). Drag markers to move them.
            Click existing markers to edit them.
            {usedSampleNumbers.size >= availableSampleNumbers.length &&
              availableSampleNumbers.length > 0 && (
                <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                  All sampling points have been placed. Delete existing sampling
                  points to add new ones.
                </Typography>
              )}
          </Typography>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Marker Type</InputLabel>
            <Select
              value={newMarkerType}
              onChange={(e) => setNewMarkerType(e.target.value)}
              label="Marker Type"
              disabled={
                newMarkerType === "sampling_point" &&
                usedSampleNumbers.size >= availableSampleNumbers.length
              }
            >
              <MenuItem
                value="sampling_point"
                disabled={
                  usedSampleNumbers.size >= availableSampleNumbers.length
                }
              >
                Sampling Point{" "}
                {usedSampleNumbers.size >= availableSampleNumbers.length
                  ? "(All used)"
                  : ""}
              </MenuItem>
              <MenuItem value="equipment">Equipment</MenuItem>
              <MenuItem value="access_point">Access Point</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Description (optional)"
            value={newMarkerDescription}
            onChange={(e) => setNewMarkerDescription(e.target.value)}
            sx={{ minWidth: 200 }}
          />

          <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
            {markers.map((marker, index) => {
              const displayLabel =
                marker.type === "sampling_point" && marker.sampleNumber
                  ? `${marker.sampleNumber}`
                  : `${getMarkerTypeLabel(marker.type)} ${index + 1}`;

              return (
                <Chip
                  key={marker.id}
                  label={displayLabel}
                  size="small"
                  sx={{
                    backgroundColor: getMarkerColor(marker.type),
                    color: "white",
                    "& .MuiChip-deleteIcon": {
                      color: "white",
                    },
                  }}
                  onDelete={() => deleteMarker(marker.id)}
                  onClick={() => {
                    setEditingMarker(marker);
                    setNewMarkerType(marker.type);
                    setNewMarkerDescription(marker.description || "");
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Map */}
        <Box sx={{ flex: 1, position: "relative" }}>
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: "100%",
              minHeight: "500px",
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
                backgroundColor: colors.grey[100],
                zIndex: 1000,
              }}
            >
              <Typography>Loading map...</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Marker Edit Dialog */}
      <Dialog open={!!editingMarker} onClose={() => setEditingMarker(null)}>
        <DialogTitle>Edit Marker</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={newMarkerType}
              onChange={(e) => setNewMarkerType(e.target.value)}
              label="Type"
            >
              <MenuItem value="sampling_point">Sampling Point</MenuItem>
              <MenuItem value="equipment">Equipment</MenuItem>
              <MenuItem value="access_point">Access Point</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Description"
            value={newMarkerDescription}
            onChange={(e) => setNewMarkerDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingMarker(null)}>Cancel</Button>
          <Button
            onClick={() => {
              updateMarker(editingMarker.id, {
                type: newMarkerType,
                description: newMarkerDescription,
              });
              setEditingMarker(null);
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <DialogActions sx={{ p: 2, backgroundColor: colors.grey[100] }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          sx={{ backgroundColor: colors.primary[500] }}
        >
          Save Site Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SitePlanMap;
