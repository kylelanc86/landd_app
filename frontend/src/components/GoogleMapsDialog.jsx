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

/** Width reserved beside the phone map for Cancel / Use This Map View. */
const PHONE_ACTION_GUTTER = 120;

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
  const isPhone = useMediaQuery(PHONE_SITE_PLAN_QUERY, { noSsr: true });
  const addressZoom = isPhone ? ADDRESS_ZOOM - 1 : ADDRESS_ZOOM;
  const mapRef = useRef(null);
  const [mapFrameEl, setMapFrameEl] = useState(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const mapInstanceRef = useRef(null);
  const initializeMapRef = useRef(null);
  const resizeMapLayoutRef = useRef(() => {});
  const initTokenRef = useRef(0);
  const projectViewRef = useRef(null);
  const confirmedViewRef = useRef(null);
  const intendedViewRef = useRef(null);
  const userAdjustedRef = useRef(false);
  const applyingViewRef = useRef(false);
  const gesturesReadyRef = useRef(false);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const confirmedQueryRef = useRef("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(
    String(defaultAddress || "").trim() ? addressZoom : DEFAULT_ZOOM,
  );
  const [mapType, setMapType] = useState("satellite");
  const [addressNote, setAddressNote] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState("");
  const hasProjectAddress = Boolean(String(defaultAddress || "").trim());

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
        return false;
      }

      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not found");
        return false;
      }

      await loadGoogleMapsApi(apiKey);
      if (token !== initTokenRef.current) return false;

      // Double-check the element still exists after async operations
      if (!mapRef.current || !(mapRef.current instanceof Element)) {
        console.error(
          "Map container element is not available after loading API"
        );
        return false;
      }

      const containerRect = mapRef.current.getBoundingClientRect();
      if (containerRect.width < 20 || containerRect.height < 20) {
        return false;
      }

      const projectAddress = String(defaultAddress || "").trim();
      let center = DEFAULT_CENTER;
      let zoom = DEFAULT_ZOOM;
      let note = "";
      // Reopening the picker must not fall back to Canberra. Use the view that
      // was last placed on the plan, otherwise the project address.
      if (confirmedViewRef.current) {
        center = confirmedViewRef.current.center;
        zoom = confirmedViewRef.current.zoom;
        if (projectAddress) note = `${projectAddress}`;
      } else if (projectAddress) {
        let geocoded = null;
        if (projectViewRef.current?.address === projectAddress) {
          geocoded = projectViewRef.current.center;
        } else {
          geocoded = await geocodeAddress(projectAddress);
          if (token !== initTokenRef.current) return false;
          if (geocoded) {
            projectViewRef.current = { address: projectAddress, center: geocoded };
          }
        }
        if (geocoded) {
          center = geocoded;
          zoom = addressZoom;
          note = `${projectAddress}`;
        } else {
          note = `The project address could not be located: ${projectAddress}`;
        }
      }
      userAdjustedRef.current = false;
      gesturesReadyRef.current = false;
      intendedViewRef.current = { center, zoom };
      setAddressNote(note);

      if (
        token !== initTokenRef.current ||
        !mapRef.current ||
        !(mapRef.current instanceof Element)
      ) {
        return false;
      }

      setMapCenter(center);
      setMapZoom(zoom);

      const readyRect = mapRef.current.getBoundingClientRect();
      if (
        token !== initTokenRef.current ||
        readyRect.width < 20 ||
        readyRect.height < 20
      ) {
        return false;
      }

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom,
        minZoom: SITE_PLAN_MIN_ZOOM,
        maxZoom: SITE_PLAN_MAX_ZOOM,
        mapTypeId: window.google.maps.MapTypeId[mapType.toUpperCase()],
        mapTypeControl: !isPhone,
        streetViewControl: !isPhone,
        fullscreenControl: !isPhone,
        zoomControl: true,
        zoomControlOptions: isPhone
          ? { position: window.google.maps.ControlPosition.RIGHT_BOTTOM }
          : undefined,
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

      // Resize after the dialog layout settles, then put the intended camera back.
      // A bare resize lets Maps fall back to Canberra until the user gestures.
      setTimeout(() => {
        resizeMapLayoutRef.current();
      }, 100);

      // Add map type change listener
      map.addListener("maptypeid_changed", () => {
        const mapTypeId = map.getMapTypeId();
        setMapType(mapTypeId.toLowerCase());
      });

      const noteUserAdjustment = () => {
        if (gesturesReadyRef.current && !applyingViewRef.current) {
          userAdjustedRef.current = true;
        }
      };

      map.addListener("dragstart", noteUserAdjustment);

      // Add zoom change listener - also reset tilt/heading on zoom to prevent 3D
      map.addListener("zoom_changed", () => {
        noteUserAdjustment();
        const nextZoom = map.getZoom();
        if (nextZoom < SITE_PLAN_MIN_ZOOM || nextZoom > SITE_PLAN_MAX_ZOOM) {
          map.setZoom(
            Math.min(SITE_PLAN_MAX_ZOOM, Math.max(SITE_PLAN_MIN_ZOOM, nextZoom)),
          );
          return;
        }
        // Only re-render when the number beside the slider changes. Updating
        // on every pinch step reloads tiles while the view is still moving.
        setMapZoom((prev) =>
          mapZoomToLevel(prev) === mapZoomToLevel(nextZoom) ? prev : nextZoom,
        );
        if (map.getTilt() !== 0) {
          map.setTilt(0);
        }
        if (map.getHeading() !== 0) {
          map.setHeading(0);
        }
      });

      map.addListener("center_changed", () => {
        noteUserAdjustment();
      });

      if (token !== initTokenRef.current) return false;
      mapInstanceRef.current = map;
      setMapLoaded(true);
      window.google.maps.event.addListenerOnce(map, "idle", () => {
        applyIntendedView(map);
        gesturesReadyRef.current = true;
      });
      window.setTimeout(() => resizeMapLayoutRef.current(), 50);
      return true;
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
      return false;
    }
  };

  const applyIntendedView = (map) => {
    const view = intendedViewRef.current;
    if (!map || !view || userAdjustedRef.current) return;
    applyingViewRef.current = true;
    map.setCenter(view.center);
    map.setZoom(view.zoom);
    map.setTilt(0);
    map.setHeading(0);
    window.setTimeout(() => {
      applyingViewRef.current = false;
    }, 300);
  };

  initializeMapRef.current = initializeMap;
  resizeMapLayoutRef.current = () => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps?.event) return;
    window.google.maps.event.trigger(map, "resize");
    // Setting the camera again after a resize throws away tiles that are
    // already loading. Once the user has moved the map, leave that view alone.
    if (!userAdjustedRef.current && intendedViewRef.current) {
      applyIntendedView(map);
    }
  };

  useEffect(() => {
    if (!open || !isPhone || !mapFrameEl) return undefined;
    const update = () => {
      const rect = mapFrameEl.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setFrameSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(mapFrameEl);
    return () => observer.disconnect();
  }, [open, isPhone, mapFrameEl]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let timer = 0;
    let attempts = 0;
    let running = false;

    const tryInit = async () => {
      if (cancelled || mapInstanceRef.current || running) return;
      const el = mapRef.current;
      const rect = el?.getBoundingClientRect();
      if (!el || !rect || rect.width < 20 || rect.height < 20) {
        attempts += 1;
        if (!cancelled && attempts < 50) {
          timer = window.setTimeout(tryInit, 60);
        }
        return;
      }
      running = true;
      const token = ++initTokenRef.current;
      const ok = await initializeMapRef.current(token);
      running = false;
      if (!ok && !cancelled && !mapInstanceRef.current && attempts < 50) {
        attempts += 1;
        timer = window.setTimeout(tryInit, 150);
      }
    };

    userAdjustedRef.current = false;
    timer = window.setTimeout(tryInit, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      initTokenRef.current += 1;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mapLoaded) return undefined;
    const timeoutId = window.setTimeout(() => resizeMapLayoutRef.current(), 200);
    return () => window.clearTimeout(timeoutId);
  }, [open, mapLoaded, frameSize.width, frameSize.height]);

  const moveMapToAddress = (center, label) => {
    confirmedQueryRef.current = label;
    setAddressOptions([]);
    setMapCenter(center);
    setMapZoom(addressZoom);
    setAddressNote(label);
    setAddressSearchError("");
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setCenter(center);
    map.setZoom(addressZoom);
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

  const handlePhoneMapType = (nextType) => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;
    map.setMapTypeId(window.google.maps.MapTypeId[nextType.toUpperCase()]);
  };

  const handleZoomChange = (event, value) => {
    userAdjustedRef.current = true;
    if (mapInstanceRef.current) {
      applyingViewRef.current = true;
      mapInstanceRef.current.setZoom(levelToMapZoom(value));
      window.setTimeout(() => {
        applyingViewRef.current = false;
      }, 300);
    }
  };

  const handleSelectMap = () => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const currentCenter = map.getCenter();
      if (!currentCenter) return;
      const currentZoom = map.getZoom();
      const currentMapType = map.getMapTypeId();
      const bounds = map.getBounds()?.toJSON();
      const viewport = map.getDiv()?.getBoundingClientRect();
      const center = {
        lat: currentCenter.lat(),
        lng: currentCenter.lng(),
      };
      const zoom = currentZoom;

      const mapData = {
        center,
        zoom,
        mapType: currentMapType.toLowerCase(),
        bounds,
        viewportWidth: viewport?.width || 0,
        viewportHeight: viewport?.height || 0,
      };
      confirmedViewRef.current = {
        center,
        zoom,
        mapType: mapData.mapType,
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
    ? fitMapPreview(
        Math.max(0, frameSize.width - PHONE_ACTION_GUTTER),
        frameSize.height,
        mapAspect,
      )
    : { width: mapWidth, height: mapHeight };

  const zoomLevel = mapZoomToLevel(mapZoom);
  const zoomControl = (
    <Box sx={{ width: 200, flexShrink: 0 }}>
      <Typography variant="caption" display="block" noWrap>
        Zoom: {zoomLevel}
      </Typography>
      <Slider
        value={zoomLevel}
        onChange={handleZoomChange}
        min={1}
        max={SITE_PLAN_ZOOM_LEVELS}
        step={1}
        size="small"
      />
    </Box>
  );

  const addressSearch = !hasProjectAddress ? (
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
            label={isPhone ? undefined : "Search address"}
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
      {!isPhone && zoomControl}
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
  ) : null;

  const mapBoxStyle = isPhone
    ? fittedMap.width >= 20 && fittedMap.height >= 20
      ? {
          width: `${fittedMap.width}px`,
          height: `${fittedMap.height}px`,
          maxWidth: "100%",
          maxHeight: "100%",
        }
      : {
          width: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          minHeight: 220,
          aspectRatio: `${mapWidth} / ${mapHeight}`,
        }
    : {
        width: `${mapWidth}px`,
        height: `${mapHeight}px`,
        minHeight: "400px",
      };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen={isPhone}
      TransitionProps={{ onEntered: () => resizeMapLayoutRef.current() }}
      PaperProps={{
        sx: isPhone
          ? {
              width: "100%",
              height: "100%",
              maxHeight: "100%",
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
        {!isPhone && (
          <Box
            sx={{
              p: 2,
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
              {addressSearch}
              {hasProjectAddress && zoomControl}
            </Box>
          </Box>
        )}

        {/* Map */}
        <Box
          ref={setMapFrameEl}
          sx={{
            flex: "1 1 auto",
            minHeight: isPhone ? 220 : 0,
            position: "relative",
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            bgcolor: isPhone ? "#cfd8dc" : "transparent",
          }}
        >
          <Box
            sx={{
              flex: isPhone ? "1 1 auto" : "0 0 auto",
              alignSelf: "stretch",
              minWidth: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
            }}
          >
          <Box
            sx={{
              position: "relative",
              ...mapBoxStyle,
              boxShadow: isPhone ? "0 0 0 2px rgba(69, 90, 100, 0.75)" : "none",
              backgroundColor: "#ffffff",
            }}
          >
            <div
              ref={mapRef}
              style={{ width: "100%", height: "100%" }}
            />
            {isPhone && (addressNote || !hasProjectAddress) && (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  right: 78,
                  zIndex: 5,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 0.5,
                  pointerEvents: "auto",
                }}
              >
                {hasProjectAddress ? (
                  <Typography
                    variant="body2"
                    noWrap
                    title={addressNote}
                    sx={{
                      maxWidth: "100%",
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.94)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.28)",
                    }}
                  >
                    {addressNote}
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      alignItems: "flex-start",
                      width: "100%",
                      p: 0.5,
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.94)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.28)",
                    }}
                  >
                    {addressSearch}
                  </Box>
                )}
              </Box>
            )}
            {isPhone && (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 5,
                  display: "flex",
                  borderRadius: 1,
                  overflow: "hidden",
                  bgcolor: "rgba(255,255,255,0.94)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.28)",
                }}
              >
                {[
                  ["roadmap", "Map"],
                  ["satellite", "Sat"],
                ].map(([type, label]) => {
                  const selected =
                    type === "satellite"
                      ? mapType === "satellite" || mapType === "hybrid"
                      : mapType === type;
                  return (
                    <Button
                      key={type}
                      size="small"
                      onClick={() => handlePhoneMapType(type)}
                      sx={{
                        minWidth: 0,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0,
                        fontSize: "0.7rem",
                        lineHeight: 1.4,
                        color: selected ? "#fff" : "text.primary",
                        bgcolor: selected ? "primary.main" : "transparent",
                        "&:hover": {
                          bgcolor: selected ? "primary.dark" : "rgba(0,0,0,0.06)",
                        },
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Box>
            )}
          </Box>

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
          {isPhone && (
            <Box
              sx={{
                width: PHONE_ACTION_GUTTER,
                flexShrink: 0,
                alignSelf: "stretch",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 1,
                px: 1,
                pb: 1,
                pt: 1,
              }}
            >
              <Button
                onClick={onClose}
                variant="outlined"
                size="small"
                sx={{ whiteSpace: "normal", lineHeight: 1.2 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSelectMap}
                variant="contained"
                size="small"
                disabled={!mapLoaded}
                sx={{ whiteSpace: "normal", lineHeight: 1.2, px: 1 }}
              >
                Use This Map View
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>

      {!isPhone && (
        <DialogActions sx={{ p: 2, flexShrink: 0 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSelectMap}
            variant="contained"
            disabled={!mapLoaded}
          >
            Use This Map View
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default GoogleMapsDialog;
