import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  FormControl,
  RadioGroup,
  Radio,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { clientService } from "../../services/api";
import {
  isValidAustralianPhone,
  isValidEmailOrDash,
} from "../../utils/formatters";
import { usePermissions } from "../../hooks/usePermissions";
import loadGoogleMapsApi from "../../utils/loadGoogleMapsApi";

const ClientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isCreating = !id || id === "new";

  // Google Maps state
  const [googleMaps, setGoogleMaps] = useState(null);
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [googleMapsError, setGoogleMapsError] = useState(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  // State for tracking form changes and confirmation dialog
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const [form, setForm] = useState({
    name: "",
    invoiceEmail: "",
    address: "",
    contact1Name: "",
    contact1Number: "",
    contact1Email: "",
    contact2Name: "",
    contact2Number: "",
    contact2Email: "",
    paymentTerms: "Standard (30 days)",
    written_off: false,
  });

  useEffect(() => {
    const initializeGoogleMaps = async () => {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        console.error(
          "Google Maps API key is missing. Please check your environment configuration.",
        );
        setGoogleMapsError(
          "Google Maps API key is missing. Please check your environment configuration.",
        );
        return;
      }

      try {
        const google = await loadGoogleMapsApi(apiKey);
        setGoogleMaps(google);

        // Initialize the autocomplete service
        const autocompleteService =
          new google.maps.places.AutocompleteService();
        const placesService = new google.maps.places.PlacesService(
          document.createElement("div"),
        );

        setAutocompleteService(autocompleteService);
        setPlacesService(placesService);

        console.log("Google Maps services initialized successfully");
        setGoogleMapsError(null); // Clear any previous errors
      } catch (error) {
        console.error("Error loading Google Maps script:", error);
        setGoogleMapsError(
          "Error loading Google Maps. Please try refreshing the page.",
        );
      }
    };

    initializeGoogleMaps();
  }, []);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isCreating) {
          // For new clients, set the original form to the initial empty state
          const initialForm = {
            name: "",
            invoiceEmail: "",
            address: "",
            contact1Name: "",
            contact1Number: "",
            contact1Email: "",
            contact2Name: "",
            contact2Number: "",
            contact2Email: "",
            paymentTerms: "Standard (30 days)",
            written_off: false,
          };
          setOriginalForm(JSON.parse(JSON.stringify(initialForm)));
          setLoading(false);
        } else if (id && id !== "undefined") {
          const response = await clientService.getById(id);
          if (response.data) {
            const clientData = {
              name: response.data.name || "",
              invoiceEmail: response.data.invoiceEmail || "",
              address: response.data.address || "",
              contact1Name: response.data.contact1Name || "",
              contact1Number: response.data.contact1Number || "",
              contact1Email: response.data.contact1Email || "",
              contact2Name: response.data.contact2Name || "",
              contact2Number: response.data.contact2Number || "",
              contact2Email: response.data.contact2Email || "",
              paymentTerms: response.data.paymentTerms || "Standard (30 days)",
              written_off: response.data.written_off || false,
            };
            setForm(clientData);
            // Store original form values for change tracking
            setOriginalForm(JSON.parse(JSON.stringify(clientData)));
            // Set address input for autocomplete
            setAddressInput(response.data.address || "");
          } else {
            setError("Client not found");
          }
        } else {
          navigate("/clients");
        }
      } catch (err) {
        console.error("Error fetching client:", err);
        setError("Failed to load client data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id, navigate, isCreating]);

  // Track form changes and compare with original values
  useEffect(() => {
    if (originalForm) {
      const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

      setHasUnsavedChanges(hasChanges);

      // Set global variables for sidebar navigation
      window.hasUnsavedChanges = hasChanges;
      window.currentProjectPath = window.location.pathname;
      window.showUnsavedChangesDialog = () => {
        setUnsavedChangesDialogOpen(true);
      };
    } else {
      // Clean up global variables when not in edit mode
      window.hasUnsavedChanges = false;
      window.currentProjectPath = null;
      window.showUnsavedChangesDialog = null;
    }

    return () => {
      // Clean up global variables when component unmounts
      window.hasUnsavedChanges = false;
      window.currentProjectPath = null;
      window.showUnsavedChangesDialog = null;
    };
  }, [form, originalForm, isCreating]);

  // Intercept navigation attempts when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Override the navigate function temporarily
    const originalNavigate = navigate;

    // Create a wrapper function that checks for unsaved changes
    const navigationWrapper = (to, options) => {
      // Check if this is an external navigation (not within current client)
      const targetPath = typeof to === "string" ? to : to.pathname || "/";
      const currentPath = window.location.pathname;

      if (
        !targetPath.startsWith("/clients/") ||
        (targetPath === "/clients" && currentPath.startsWith("/clients/"))
      ) {
        console.log(
          "🚫 Blocking navigation to:",
          targetPath,
          "due to unsaved changes",
        );
        setPendingNavigation(targetPath);
        setUnsavedChangesDialogOpen(true);
        return;
      }

      // Allow internal navigation
      originalNavigate(to, options);
    };

    // Replace the navigate function
    Object.defineProperty(window, "customNavigate", {
      value: navigationWrapper,
      writable: true,
      configurable: true,
    });

    return () => {
      // Restore original navigate function
      delete window.customNavigate;
    };
  }, [hasUnsavedChanges, navigate]);

  // Intercept clicks on navigation links
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleLinkClick = (e) => {
      const target = e.target.closest("a[href]");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;

      // Check if this is an external navigation
      const currentPath = window.location.pathname;
      if (
        href.startsWith("/") &&
        !href.startsWith("/clients/") &&
        href !== "/clients" &&
        !href.startsWith("/clients")
      ) {
        console.log(
          "🚫 Blocking link navigation to:",
          href,
          "due to unsaved changes",
        );
        e.preventDefault();
        e.stopPropagation();

        setPendingNavigation(href);
        setUnsavedChangesDialogOpen(true);
        return false;
      }
    };

    // Use capture phase to intercept before React Router handles it
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

  // Handle page refresh and browser navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    // Handle browser back/forward buttons
    const handlePopState = (e) => {
      if (hasUnsavedChanges) {
        // Prevent the navigation by pushing the current state back
        window.history.pushState(null, "", window.location.pathname);
        setPendingNavigation("/clients");
        setUnsavedChangesDialogOpen(true);
      }
    };

    // Handle page refresh (Ctrl+R, F5, etc.)
    const handleKeyDown = (e) => {
      if (
        hasUnsavedChanges &&
        ((e.ctrlKey && e.key === "r") || e.key === "F5")
      ) {
        e.preventDefault();
        setRefreshDialogOpen(true);
      }
    };

    // Add a history entry when entering edit mode with unsaved changes
    if (hasUnsavedChanges) {
      window.history.pushState(null, "", window.location.pathname);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasUnsavedChanges]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle address input change for autocomplete
  const handleAddressInputChange = async (value) => {
    if (!autocompleteService || !value || value.length < 2) {
      setAddressOptions([]);
      return;
    }

    console.log("Making API call for:", value);
    setIsAddressLoading(true);
    try {
      autocompleteService.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: "au" },
        },
        (predictions, status) => {
          console.log("Address predictions callback received:", {
            predictions,
            status,
            statusText:
              window.google?.maps?.places?.PlacesServiceStatus?.[status] ||
              status,
          });

          if (
            status === window.google?.maps?.places?.PlacesServiceStatus?.OK &&
            predictions
          ) {
            console.log("Setting address options:", predictions);
            setAddressOptions(predictions);
          } else {
            console.log("No predictions found or error:", status);
            setAddressOptions([]);
            // Enhanced error handling with specific status messages
            switch (status) {
              case window.google?.maps?.places?.PlacesServiceStatus
                ?.ZERO_RESULTS:
                console.log("No address predictions found for the input");
                break;
              case window.google?.maps?.places?.PlacesServiceStatus
                ?.REQUEST_DENIED:
                console.error(
                  "Google Places API request denied. Check API key and billing.",
                );
                break;
              case window.google?.maps?.places?.PlacesServiceStatus
                ?.OVER_QUERY_LIMIT:
                console.error("Google Places API quota exceeded");
                break;
              case window.google?.maps?.places?.PlacesServiceStatus
                ?.INVALID_REQUEST:
                console.error("Invalid request to Google Places API");
                break;
              default:
                console.error("Unknown error from Google Places API:", status);
            }
          }
          setIsAddressLoading(false);
        },
      );
    } catch (error) {
      console.error("Error fetching address predictions:", error);
      setAddressOptions([]);
      setIsAddressLoading(false);
    }
  };

  // Handle address selection
  const handleAddressSelect = (placeId) => {
    if (!placesService) return;

    placesService.getDetails(
      {
        placeId: placeId,
        fields: ["formatted_address", "geometry", "address_components"],
      },
      (place, status) => {
        console.log("Selected place:", place, "Status:", status);
        if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK) {
          setForm((prev) => ({
            ...prev,
            address: place.formatted_address,
          }));
          setAddressInput(place.formatted_address);
        } else {
          console.error("Error getting place details:", status);
        }
      },
    );
  };

  // Safe navigation function that checks for unsaved changes
  const safeNavigate = (path) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      setUnsavedChangesDialogOpen(true);
    } else {
      navigate(path);
    }
  };

  // Confirm navigation and discard changes
  const confirmNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setHasUnsavedChanges(false);

    // Navigate to the pending location (either local or global)
    const targetPath = pendingNavigation || window.pendingNavigation;
    if (targetPath) {
      navigate(targetPath);
      setPendingNavigation(null);
      window.pendingNavigation = null;
    }
  };

  // Cancel navigation and stay on page
  const cancelNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setPendingNavigation(null);
    window.pendingNavigation = null;
  };

  // Confirm page refresh and discard changes
  const confirmRefresh = () => {
    setRefreshDialogOpen(false);
    setHasUnsavedChanges(false);
    window.hasUnsavedChanges = false;
    window.location.reload();
  };

  // Cancel page refresh and stay on page
  const cancelRefresh = () => {
    setRefreshDialogOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      if (isCreating) {
        await clientService.create(form);
      } else {
        await clientService.update(id, form);
      }

      // Reset unsaved changes flag and update original form
      setHasUnsavedChanges(false);
      if (!isCreating) {
        setOriginalForm(JSON.parse(JSON.stringify(form)));
      }

      navigate("/clients");
    } catch (err) {
      console.error(
        `Error ${isCreating ? "creating" : "updating"} client:`,
        err,
      );
      setError(
        `Failed to ${
          isCreating ? "create" : "update"
        } client. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Box m="20px">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => navigate("/clients")} variant="contained">
          Back to Clients
        </Button>
      </Box>
    );

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => safeNavigate("/clients")} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          {isCreating ? "Create New Client" : "Client Details"}
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Hidden fields to prevent autofill */}
          <input
            type="text"
            style={{ display: "none" }}
            autoComplete="username"
          />
          <input
            type="password"
            style={{ display: "none" }}
            autoComplete="new-password"
          />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Client Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
                autoComplete="new-password"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                value={form.invoiceEmail}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="email@example.com or '-' for no email"
                error={
                  form.invoiceEmail && !isValidEmailOrDash(form.invoiceEmail)
                }
                helperText={
                  form.invoiceEmail && !isValidEmailOrDash(form.invoiceEmail)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                freeSolo
                options={addressOptions}
                getOptionLabel={(option) =>
                  typeof option === "string" ? option : option.description
                }
                inputValue={addressInput}
                onInputChange={(_, value) => {
                  setAddressInput(value);
                  handleAddressInputChange(value);
                  // Update form immediately for manual typing
                  setForm((prev) => ({ ...prev, address: value }));
                }}
                onChange={(_, value) => {
                  if (value && value.place_id) {
                    handleAddressSelect(value.place_id);
                  } else if (typeof value === "string") {
                    // Handle manual text input
                    setForm((prev) => ({ ...prev, address: value }));
                    setAddressInput(value);
                  }
                }}
                loading={isAddressLoading}
                disabled={!!googleMapsError}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Address (Optional)"
                    name="address"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    helperText={
                      googleMapsError
                        ? "Address search is disabled due to API issues"
                        : "Start typing to search for addresses, buildings, or establishments"
                    }
                    placeholder="Address or '-' for no address"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">
                        {option.structured_formatting?.main_text ||
                          option.description}
                      </Typography>
                      {option.structured_formatting?.secondary_text && (
                        <Typography variant="caption" color="text.secondary">
                          {option.structured_formatting.secondary_text}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
              >
                Primary Contact
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={form.contact1Name}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="Contact name or '-' for no contact"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={form.contact1Number}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="04xx xxx xxx (mobile) or 02 xxxx xxxx (landline) or '-' for no phone"
                error={
                  form.contact1Number &&
                  !isValidAustralianPhone(form.contact1Number)
                }
                helperText={
                  form.contact1Number &&
                  !isValidAustralianPhone(form.contact1Number)
                    ? "Please enter a valid Australian phone number (mobile or landline) or use '-' for no phone"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Email"
                name="contact1Email"
                value={form.contact1Email}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="email@example.com or '-' for no email"
                error={
                  form.contact1Email && !isValidEmailOrDash(form.contact1Email)
                }
                helperText={
                  form.contact1Email && !isValidEmailOrDash(form.contact1Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
              >
                Secondary Contact (Optional)
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Name"
                name="contact2Name"
                value={form.contact2Name}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="Contact name or '-' for no contact"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={form.contact2Number}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="04xx xxx xxx (mobile) or 02 xxxx xxxx (landline) or '-' for no phone"
                error={
                  form.contact2Number &&
                  !isValidAustralianPhone(form.contact2Number)
                }
                helperText={
                  form.contact2Number &&
                  !isValidAustralianPhone(form.contact2Number)
                    ? "Please enter a valid Australian phone number (mobile or landline) or use '-' for no phone"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Email"
                name="contact2Email"
                value={form.contact2Email}
                onChange={handleChange}
                fullWidth
                autoComplete="new-password"
                placeholder="email@example.com or '-' for no email"
                error={
                  form.contact2Email && !isValidEmailOrDash(form.contact2Email)
                }
                helperText={
                  form.contact2Email && !isValidEmailOrDash(form.contact2Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
              >
                Payment Terms
              </Typography>
              <FormControl>
                <RadioGroup
                  row
                  name="paymentTerms"
                  value={form.paymentTerms}
                  onChange={handleChange}
                >
                  <FormControlLabel
                    value="Standard (30 days)"
                    control={<Radio />}
                    label="Standard (30 days)"
                  />
                  <FormControlLabel
                    value="Payment before Report (7 days)"
                    control={<Radio />}
                    label="Payment before Report (7 days)"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {can("clients.write_off") && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="written_off"
                      checked={form.written_off}
                      onChange={handleChange}
                      sx={{
                        color: "red",
                        "&.Mui-checked": {
                          color: "red",
                        },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ color: "red", fontWeight: "bold" }}>
                      WRITTEN OFF?
                    </Typography>
                  }
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => safeNavigate("/clients")}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving
                    ? isCreating
                      ? "Creating..."
                      : "Saving..."
                    : isCreating
                      ? "Create Client"
                      : "Save Changes"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={unsavedChangesDialogOpen}
        onClose={cancelNavigation}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "warning.main",
              color: "white",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              !
            </Typography>
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Unsaved Changes
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to leave this page
            without saving? All unsaved changes will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelNavigation}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Stay on Page
          </Button>
          <Button
            onClick={confirmNavigation}
            variant="contained"
            color="warning"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(255, 152, 0, 0.4)",
              },
            }}
          >
            Leave Without Saving
          </Button>
        </DialogActions>
      </Dialog>

      {/* Page Refresh Confirmation Dialog */}
      <Dialog
        open={refreshDialogOpen}
        onClose={cancelRefresh}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "warning.main",
              color: "white",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              !
            </Typography>
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Unsaved Changes
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to refresh this
            page? All unsaved changes will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelRefresh}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Stay on Page
          </Button>
          <Button
            onClick={confirmRefresh}
            variant="contained"
            color="warning"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(255, 152, 0, 0.4)",
              },
            }}
          >
            Refresh Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDetails;
