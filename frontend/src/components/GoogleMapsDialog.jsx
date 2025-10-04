import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Close as CloseIcon,
  MyLocation as MyLocationIcon,
} from "@mui/icons-material";
import loadGoogleMapsApi from "../utils/loadGoogleMapsApi";

const GoogleMapsDialog = ({ open, onClose, onSelectMap }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: -35.2809, lng: 149.13 });
  const [mapZoom, setMapZoom] = useState(15);
  const [mapType, setMapType] = useState("satellite");

  useEffect(() => {
    if (open && !mapLoaded) {
      initializeMap();
    }
  }, [open, mapLoaded]);

  useEffect(() => {
    if (!open) {
      setMapLoaded(false);
      mapInstanceRef.current = null;
    }
  }, [open]);

  const initializeMap = async () => {
    try {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not found");
        return;
      }

      await loadGoogleMapsApi(apiKey);

      if (mapRef.current) {
        const map = new window.google.maps.Map(mapRef.current, {
          center: mapCenter,
          zoom: mapZoom,
          mapTypeId: window.google.maps.MapTypeId[mapType.toUpperCase()],
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });

        // Add map type change listener
        map.addListener("maptypeid_changed", () => {
          const mapTypeId = map.getMapTypeId();
          setMapType(mapTypeId.toLowerCase());
        });

        // Add zoom change listener
        map.addListener("zoom_changed", () => {
          setMapZoom(map.getZoom());
        });

        // Add center change listener
        map.addListener("center_changed", () => {
          const center = map.getCenter();
          setMapCenter({
            lat: center.lat(),
            lng: center.lng(),
          });
        });

        mapInstanceRef.current = map;
        setMapLoaded(true);
      }
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  };

  const handleZoomChange = (event, value) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(value);
    }
  };

  const handleMapTypeChange = (event) => {
    const newMapType = event.target.value;
    setMapType(newMapType);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(
        window.google.maps.MapTypeId[newMapType.toUpperCase()]
      );
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMapCenter(newCenter);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(newCenter);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const handleSelectMap = () => {
    if (mapInstanceRef.current) {
      // Get current values directly from the map instance to ensure accuracy
      const currentCenter = mapInstanceRef.current.getCenter();
      const currentZoom = mapInstanceRef.current.getZoom();
      const currentMapType = mapInstanceRef.current.getMapTypeId();
      const bounds = mapInstanceRef.current.getBounds()?.toJSON();

      const mapData = {
        center: {
          lat: currentCenter.lat(),
          lng: currentCenter.lng(),
        },
        zoom: currentZoom,
        mapType: currentMapType.toLowerCase(),
        bounds: bounds,
      };

      console.log("Selected map data:", mapData);
      onSelectMap(mapData);
      onClose();
    }
  };

  const mapTypeOptions = [
    { value: "roadmap", label: "Road Map" },
    { value: "satellite", label: "Satellite" },
    { value: "hybrid", label: "Hybrid" },
    { value: "terrain", label: "Terrain" },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        }}
      >
        <Typography variant="h6">Select Google Maps View</Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column" }}>
        {/* Controls */}
        <Box
          sx={{
            p: 2,
            backgroundColor: "#f5f5f5",
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2">
            Pan and zoom to select the area for your site plan. Use the controls
            below to adjust the view.
          </Typography>

          {/* Map Type */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Map Type</InputLabel>
            <Select
              value={mapType}
              onChange={handleMapTypeChange}
              label="Map Type"
            >
              {mapTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Zoom Control */}
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption" display="block">
              Zoom Level: {mapZoom}
            </Typography>
            <Slider
              value={mapZoom}
              onChange={handleZoomChange}
              min={1}
              max={20}
              step={1}
              size="small"
            />
          </Box>

          {/* Current Location */}
          <Button
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={handleGetCurrentLocation}
            size="small"
          >
            Current Location
          </Button>
        </Box>

        {/* Map */}
        <Box sx={{ flex: 1, position: "relative" }}>
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: "100%",
              minHeight: "400px",
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
                backgroundColor: "#f5f5f5",
                zIndex: 1000,
              }}
            >
              <Typography>Loading Google Maps...</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSelectMap}
          variant="contained"
          disabled={!mapLoaded}
        >
          Use This Map View
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GoogleMapsDialog;
