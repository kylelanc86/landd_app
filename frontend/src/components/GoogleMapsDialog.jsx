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
  Autocomplete,
  TextField,
  CircularProgress,
  useMediaQuery,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import loadGoogleMapsApi from "../utils/loadGoogleMapsApi";
import {
  applySitePlanMapZoomRange,
  levelToMapZoom,
  mapZoomToLevel,
  SITE_PLAN_MAX_ZOOM,
  SITE_PLAN_MIN_ZOOM,
  SITE_PLAN_ZOOM_LEVELS,
} from "../utils/sitePlanMapZoom";

/** Phones in portrait, and short landscape phone screens. */
const PHONE_SITE_PLAN_QUERY =
  "(max-width: 600px), ((max-height: 500px) and (max-width: 932px))";

/** Largest rectangle of `aspect` (width / height) that fits in the frame. */
const fitMapPreview = (frameWidth, frameHeight, aspect) => {
  const pad = 8;
  const availableWidth = Math.max(0, frameWidth - pad * 2);
  const availableHeight = Math.max(0, frameHeight - pad * 2);
  if (availableWidth < 20 || availableHeight < 20 || !aspect) {
    return { width: 0, height: 0 };
  }
  let width = availableWidth;
  let height = width / aspect;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * aspect;
  }
  return { width: Math.floor(width), height: Math.floor(height) };
};

const DEFAULT_CENTER = { lat: -35.2809, lng: 149.13 };
const DEFAULT_ZOOM = levelToMapZoom(3);
const ADDRESS_ZOOM = levelToMapZoom(7);

const stripAustraliaFromAddress = (address) => {
  if (!address) return "";
  return String(address).replace(/,\s*Australia\s*$/i, "").trim();
};

const geocodeAddress = (address) =>
  new Promise((resolve) => {
    const query = String(address || "").trim();
    if (!query || !window.google?.maps?.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { address: query, componentRestrictions: { country: "AU" } },
      (results, status) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
          return;
        }
        resolve(null);
      },
    );
  });

const GoogleMapsDialog = ({
  open,
  onClose,
  onSelectMap,
  canvasWidth,
  canvasHeight,
  defaultAddress = "",
}) => {
  const isPhone = useMediaQuery(PHONE_SITE_PLAN_QUERY);
  const mapRef = useRef(null);
  const mapFrameRef = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const mapInstanceRef = useRef(null);
  const initTokenRef = useRef(0);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const confirmedQueryRef = useRef("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(
    String(defaultAddress || "").trim() ? ADDRESS_ZOOM : DEFAULT_ZOOM,
  );
  const [mapType, setMapType] = useState("satellite");
  const [addressNote, setAddressNote] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState("");
  const hasProjectAddress = Boolean(String(defaultAddress || "").trim());

  useEffect(() => {
    if (!open || !isPhone) return undefined;
    const el = mapFrameRef.current;
    if (!el) return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setFrameSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, isPhone]);

  useEffect(() => {
    if (!open || mapLoaded) return undefined;
    if (isPhone && (frameSize.width < 20 || frameSize.height < 20)) return undefined;
    const token = ++initTokenRef.current;
    // Use setTimeout to ensure the Dialog is fully rendered and the map container element exists
    const timeoutId = setTimeout(() => {
      initializeMap(token);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [open, mapLoaded, isPhone, frameSize.width, frameSize.height]);

  useEffect(() => {
    if (!open || !mapLoaded) return undefined;
    const timeoutId = setTimeout(() => {
      if (mapInstanceRef.current && window.google?.maps?.event) {
        window.google.maps.event.trigger(mapInstanceRef.current, "resize");
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [open, mapLoaded, isPhone, frameSize.width, frameSize.height]);

  useEffect(() => {
    if (!open) {
      initTokenRef.current += 1;
      setMapLoaded(false);
      setAddressNote("");
      setAddressQuery("");
      setAddressOptions([]);
      setAddressSearchLoading(false);
      setAddressSearchError("");
      autocompleteServiceRef.current = null;
      placesServiceRef.current = null;
      confirmedQueryRef.current = "";
      mapInstanceRef.current = null;
      setFrameSize({ width: 0, height: 0 });
    }
  }, [open]);

  const initializeMap = async (token) => {
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
      if (token !== initTokenRef.current) return;

      // Double-check the element still exists after async operations
      if (!mapRef.current || !(mapRef.current instanceof Element)) {
        console.error(
          "Map container element is not available after loading API"
        );
        return;
      }

      const projectAddress = String(defaultAddress || "").trim();
      let center = DEFAULT_CENTER;
      let zoom = DEFAULT_ZOOM;
      if (projectAddress) {
        const geocoded = await geocodeAddress(projectAddress);
        if (token !== initTokenRef.current) return;
        if (geocoded) {
          center = geocoded;
          zoom = ADDRESS_ZOOM;
          setAddressNote(`Project address: ${projectAddress}`);
        } else {
          setAddressNote(
            `The project address could not be located: ${projectAddress}`,
          );
        }
      } else {
        setAddressNote("");
      }

      if (
        token !== initTokenRef.current ||
        !mapRef.current ||
        !(mapRef.current instanceof Element)
      ) {
        return;
      }

      setMapCenter(center);
      setMapZoom(zoom);

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom,
        minZoom: SITE_PLAN_MIN_ZOOM,
        maxZoom: SITE_PLAN_MAX_ZOOM,
        mapTypeId: window.google.maps.MapTypeId[mapType.toUpperCase()],
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: "greedy",
        tilt: 0, // Force 2D overhead view - no tilt
        heading: 0, // Force north-up orientation
      });

      applySitePlanMapZoomRange(map);
      map.setZoom(zoom);

      if (window.google.maps.places) {
        autocompleteServiceRef.current =
          new window.google.maps.places.AutocompleteService();
        placesServiceRef.current = new window.google.maps.places.PlacesService(
          map,
        );
      }

      // Prevent 3D view by resetting tilt and heading whenever they change
      map.addListener("tilt_changed", () => {
        if (map.getTilt() !== 0) {
          map.setTilt(0);
        }
      });

      map.addListener("heading_changed", () => {
        if (map.getHeading() !== 0) {
          map.setHeading(0);
        }
      });

      // Trigger resize event to ensure map renders correctly in the Dialog
      setTimeout(() => {
        if (mapInstanceRef.current) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize");
        }
      }, 100);

      // Add map type change listener
      map.addListener("maptypeid_changed", () => {
        const mapTypeId = map.getMapTypeId();
        setMapType(mapTypeId.toLowerCase());
      });

      // Add zoom change listener - also reset tilt/heading on zoom to prevent 3D
      map.addListener("zoom_changed", () => {
        const nextZoom = map.getZoom();
        if (nextZoom < SITE_PLAN_MIN_ZOOM || nextZoom > SITE_PLAN_MAX_ZOOM) {
          map.setZoom(
            Math.min(SITE_PLAN_MAX_ZOOM, Math.max(SITE_PLAN_MIN_ZOOM, nextZoom)),
          );
          return;
        }
        setMapZoom(nextZoom);
        // Reset tilt and heading when zooming to prevent automatic 3D switching
        if (map.getTilt() !== 0) {
          map.setTilt(0);
        }
        if (map.getHeading() !== 0) {
          map.setHeading(0);
        }
      });

      // Add center change listener
      map.addListener("center_changed", () => {
        const center = map.getCenter();
        setMapCenter({
          lat: center.lat(),
          lng: center.lng(),
        });
      });

      if (token !== initTokenRef.current) return;
      mapInstanceRef.current = map;
      setMapLoaded(true);
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  };

  const moveMapToAddress = (center, label) => {
    confirmedQueryRef.current = label;
    setAddressOptions([]);
    setMapCenter(center);
    setMapZoom(ADDRESS_ZOOM);
    setAddressNote(label);
    setAddressSearchError("");
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setCenter(center);
    map.setZoom(ADDRESS_ZOOM);
    map.setTilt(0);
    map.setHeading(0);
  };

  const confirmTypedAddress = async (query) => {
    const trimmed = String(query || "").trim();
    if (!trimmed) return;
    setAddressSearchLoading(true);
    const center = await geocodeAddress(trimmed);
    setAddressSearchLoading(false);
    if (!center) {
      setAddressSearchError("That address could not be located.");
      return;
    }
    setAddressQuery(trimmed);
    moveMapToAddress(center, trimmed);
  };

  const confirmPlace = (placeId, fallbackLabel) => {
    const service = placesServiceRef.current;
    if (!service || !placeId) {
      confirmTypedAddress(fallbackLabel);
      return;
    }
    setAddressSearchLoading(true);
    service.getDetails(
      { placeId, fields: ["formatted_address", "geometry"] },
      (place, status) => {
        setAddressSearchLoading(false);
        const location = place?.geometry?.location;
        if (
          status !== window.google?.maps?.places?.PlacesServiceStatus?.OK ||
          !location
        ) {
          confirmTypedAddress(fallbackLabel);
          return;
        }
        const label = stripAustraliaFromAddress(
          place.formatted_address || fallbackLabel,
        );
        setAddressQuery(label);
        moveMapToAddress(
          { lat: location.lat(), lng: location.lng() },
          label,
        );
      },
    );
  };

  const handleConfirmAddress = () => {
    const query = addressQuery.trim();
    if (!query) return;
    const match = addressOptions.find(
      (option) =>
        String(option.description || "").toLowerCase() === query.toLowerCase(),
    );
    if (match?.place_id) {
      confirmPlace(match.place_id, match.description);
      return;
    }
    confirmTypedAddress(query);
  };

  useEffect(() => {
    if (!open || hasProjectAddress || !mapLoaded) return undefined;
    const query = addressQuery.trim();
    if (query.length < 2 || query === confirmedQueryRef.current) {
      setAddressOptions([]);
      return undefined;
    }
    const service = autocompleteServiceRef.current;
    if (!service || !window.google?.maps?.places) return undefined;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setAddressSearchLoading(true);
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "au" },
        },
        (predictions, status) => {
          if (cancelled) return;
          setAddressSearchLoading(false);
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setAddressOptions(predictions);
            setAddressSearchError("");
            return;
          }
          setAddressOptions([]);
          if (
            status ===
            window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED
          ) {
            setAddressSearchError("Address search is unavailable.");
          }
        },
      );
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [addressQuery, open, hasProjectAddress, mapLoaded]);

  const handleZoomChange = (event, value) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(levelToMapZoom(value));
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

  // Use canvas dimensions if provided, otherwise use default
  const dialogWidth = canvasWidth ? `${canvasWidth + 100}px` : "90vw";
  const dialogHeight = canvasHeight ? `${canvasHeight + 150}px` : "90vh";
  const mapWidth = canvasWidth || 800;
  const mapHeight = canvasHeight || 600;
  const mapAspect = mapWidth / mapHeight;
  const fittedMap = isPhone
    ? fitMapPreview(frameSize.width, frameSize.height, mapAspect)
    : { width: mapWidth, height: mapHeight };

  const zoomControl = (
    <Box sx={{ width: isPhone ? 128 : 200, flexShrink: 0 }}>
      <Typography variant="caption" display="block" noWrap>
        Zoom: {mapZoomToLevel(mapZoom)}
      </Typography>
      <Slider
        value={mapZoomToLevel(mapZoom)}
        onChange={handleZoomChange}
        min={1}
        max={SITE_PLAN_ZOOM_LEVELS}
        step={1}
        size="small"
      />
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen={isPhone}
      PaperProps={{
        sx: isPhone
          ? {
              width: "100%",
              height: "100dvh",
              maxHeight: "100dvh",
              m: 0,
              display: "flex",
              flexDirection: "column",
              pt: "env(safe-area-inset-top)",
              pb: "env(safe-area-inset-bottom)",
            }
          : {
              width: dialogWidth,
              height: dialogHeight,
              maxWidth: dialogWidth,
              maxHeight: dialogHeight,
            },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          ...(isPhone ? { py: 1, px: 1.5 } : {}),
        }}
      >
        <Typography variant={isPhone ? "subtitle1" : "h6"}>
          Select Google Maps View
        </Typography>
        <IconButton onClick={onClose} size={isPhone ? "small" : "medium"}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Controls */}
        <Box
          sx={{
            p: isPhone ? 1 : 2,
            backgroundColor: "#f5f5f5",
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            flexShrink: 0,
          }}
        >
          {addressNote ? (
            <Typography variant="body2">{addressNote}</Typography>
          ) : null}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              width: "100%",
            }}
          >
            {!hasProjectAddress && (
              <>
                <Autocomplete
                  freeSolo
                  filterOptions={(options) => options}
                  options={addressOptions}
                  getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.description || ""
                  }
                  inputValue={addressQuery}
                  onInputChange={(_, value, reason) => {
                    if (reason === "reset") return;
                    if (value !== confirmedQueryRef.current) {
                      confirmedQueryRef.current = "";
                    }
                    setAddressQuery(value);
                  }}
                  onChange={(_, value) => {
                    if (value && typeof value === "object" && value.place_id) {
                      confirmPlace(value.place_id, value.description);
                      return;
                    }
                    if (typeof value === "string") {
                      confirmTypedAddress(value);
                    }
                  }}
                  loading={addressSearchLoading}
                  sx={{ flex: 1, minWidth: 0 }}
                  componentsProps={{
                    popper: { sx: { zIndex: 1600 } },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Search address"
                      placeholder="Start typing an address"
                      error={Boolean(addressSearchError)}
                      helperText={addressSearchError || undefined}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {addressSearchLoading ? (
                              <CircularProgress color="inherit" size={16} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                {zoomControl}
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleConfirmAddress}
                  disabled={!addressQuery.trim() || !mapLoaded}
                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  Show on map
                </Button>
              </>
            )}
            {hasProjectAddress && zoomControl}
          </Box>
        </Box>

        {/* Map */}
        <Box
          ref={mapFrameRef}
          sx={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            bgcolor: isPhone ? "#cfd8dc" : "transparent",
          }}
        >
          <div
            ref={mapRef}
            style={
              isPhone
                ? {
                    width: `${fittedMap.width}px`,
                    height: `${fittedMap.height}px`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                    boxShadow: "0 0 0 2px rgba(69, 90, 100, 0.75)",
                    backgroundColor: "#ffffff",
                  }
                : {
                    width: `${mapWidth}px`,
                    height: `${mapHeight}px`,
                    minHeight: "400px",
                  }
            }
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

      <DialogActions sx={{ p: isPhone ? 1 : 2, flexShrink: 0 }}>
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
