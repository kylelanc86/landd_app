import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  Grid,
  Chip,
  Autocomplete,
  CircularProgress,
  Alert,
  Stack,
  Checkbox,
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { projectService, clientService, userService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";
import { usePermissions } from "../../hooks/usePermissions";
import { StatusChip } from "../../components/JobStatus";
import useProjectStatuses from "../../hooks/useProjectStatuses";
import loadGoogleMapsApi from "../../utils/loadGoogleMapsApi";
import {
  formatPhoneNumber,
  isValidAustralianMobile,
  isValidEmailOrDash,
} from "../../utils/formatters";

const DEPARTMENTS = [
  "Asbestos & HAZMAT",
  "Occupational Hygiene",
  "Client Supplied",
];

const CATEGORIES = [
  "Asbestos Materials Assessment",
  "Asbestos & Lead Paint Assessment",
  "Lead Paint/Dust Assessment",
  "Air Monitoring and Clearance",
  "Clearance Certificate",
  "Commercial Asbestos Management Plan",
  "Hazardous Materials Management Plan",
  "Residential Asbestos Survey",
  "Silica Air Monitoring",
  "Mould/Moisture Assessment",
  "Other",
];

// Remove the hardcoded API key - use environment variable instead
// const GOOGLE_MAPS_API_KEY = "AIzaSyB41DRubKWUHP7t3vqphB1qVhV6x9x9x9x"; // Replace with your actual API key

const ProjectInformation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { can, isAdmin, isManager } = usePermissions();
  const canWriteOff = can("clients.write_off");
  const isEditMode = id !== "new";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [newClientForm, setNewClientForm] = useState({
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

  const [form, setForm] = useState({
    projectID: "",
    name: "",
    client: null,
    department: "",
    status: "",
    address: "",
    d_Date: "",
    workOrder: "",
    users: [],
    categories: [],
    notes: "",
    projectContact: {
      name: "",
      number: "",
      email: "",
    },
  });

  const [addressInput, setAddressInput] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  // Initialize Google Places Autocomplete
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [googleMaps, setGoogleMaps] = useState(null);
  const [googleMapsError, setGoogleMapsError] = useState(null);

  const [clientInputValue, setClientInputValue] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [isClientSearching, setIsClientSearching] = useState(false);

  // Get project statuses from custom data fields
  const { activeStatuses, inactiveStatuses, statusColors } =
    useProjectStatuses();

  // Set default status when statuses are loaded
  useEffect(() => {
    if (activeStatuses.length > 0 && !form.status) {
      setForm((prev) => ({ ...prev, status: activeStatuses[0] }));
    }
  }, [activeStatuses, form.status]);

  const generateNextProjectId = async () => {
    try {
      const response = await projectService.getAll();
      const projects = response.data;

      // Find the last project with an LDJ prefix
      const lastProject = projects
        .filter((p) => p.projectID && p.projectID.startsWith("LDX"))
        .sort((a, b) => {
          const numA = parseInt(a.projectID.slice(3));
          const numB = parseInt(b.projectID.slice(3));
          return numB - numA;
        })[0];

      const nextNum = lastProject
        ? parseInt(lastProject.projectID.slice(3)) + 1
        : 1;

      return `LDX${String(nextNum).padStart(5, "0")}`;
    } catch (error) {
      console.error("Error generating project ID:", error);
      throw new Error("Failed to generate project ID");
    }
  };

  useEffect(() => {
    console.log("ProjectInformation component mounted");
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch clients and users
        const [clientsRes, usersRes] = await Promise.all([
          clientService.getAll({ limit: 100 }),
          userService.getAll(),
        ]);

        setClients(clientsRes.data.clients || clientsRes.data);
        setUsers(usersRes.data);

        // If we're in edit mode, fetch the project data
        if (id && id !== "new" && id !== "undefined") {
          try {
            const projectRes = await projectService.getById(id);
            if (!projectRes.data) {
              throw new Error("No project data received");
            }
            // Ensure users is always an array
            const projectData = {
              ...projectRes.data,
              users: Array.isArray(projectRes.data.users)
                ? projectRes.data.users
                : [],
            };
            setForm(projectData);
          } catch (projectErr) {
            console.error("Error fetching project:", projectErr);
            if (projectErr.response) {
              console.error("Response data:", projectErr.response.data);
              console.error("Response status:", projectErr.response.status);
            }
            setError("Failed to load project data. Please try again.");
            navigate("/projects");
          }
        } else if (id === "new") {
          // Generate new project ID for new projects
          try {
            const nextId = await generateNextProjectId();
            setForm((prev) => ({ ...prev, projectID: nextId, users: [] }));
          } catch (idError) {
            console.error("Error generating project ID:", idError);
            setError("Failed to generate project ID. Please try again.");
          }
        } else {
          // Invalid ID, redirect to projects list
          navigate("/projects");
        }
      } catch (err) {
        console.error("Error in fetchData:", err);
        if (err.response) {
          console.error("Response data:", err.response.data);
          console.error("Response status:", err.response.status);
        }
        setError("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    const initializeGoogleMaps = async () => {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        console.error(
          "Google Maps API key is missing. Please check your environment configuration."
        );
        setGoogleMapsError(
          "Google Maps API key is missing. Please check your environment configuration."
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
          document.createElement("div")
        );

        setAutocompleteService(autocompleteService);
        setPlacesService(placesService);

        console.log("Google Maps services initialized successfully");
        setGoogleMapsError(null); // Clear any previous errors
      } catch (error) {
        console.error("Error loading Google Maps script:", error);
        setGoogleMapsError(
          "Error loading Google Maps. Please try refreshing the page."
        );
      }
    };

    initializeGoogleMaps();
  }, []);

  // Sync addressInput with form address when editing
  useEffect(() => {
    if (form.address && !addressInput) {
      setAddressInput(form.address);
    }
  }, [form.address, addressInput]);

  const handleAddressInputChange = async (value) => {
    console.log("handleAddressInputChange called with:", value);
    console.log("autocompleteService:", autocompleteService);
    console.log("googleMaps:", googleMaps);

    setAddressInput(value);

    if (!value || value.length < 3 || !autocompleteService || !googleMaps) {
      console.log("Early return - conditions not met:", {
        value,
        valueLength: value?.length,
        hasAutocompleteService: !!autocompleteService,
        hasGoogleMaps: !!googleMaps,
      });
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
          types: ["address"],
        },
        (predictions, status) => {
          console.log("Address predictions callback received:", {
            predictions,
            status,
            statusText: googleMaps.maps.places.PlacesServiceStatus[status],
          });

          if (
            status === googleMaps.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            console.log("Setting address options:", predictions);
            setAddressOptions(predictions);
          } else {
            console.log("No predictions found or error:", status);

            // Enhanced error handling with specific status messages
            switch (status) {
              case googleMaps.maps.places.PlacesServiceStatus.ZERO_RESULTS:
                console.log("No address predictions found for the input");
                break;
              case googleMaps.maps.places.PlacesServiceStatus.REQUEST_DENIED:
                console.error(
                  "REQUEST_DENIED: API key may be invalid or have restrictions"
                );
                console.error("Check Google Cloud Console API key settings");
                break;
              case googleMaps.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
                console.error("OVER_QUERY_LIMIT: API quota exceeded");
                break;
              case googleMaps.maps.places.PlacesServiceStatus.INVALID_REQUEST:
                console.error(
                  "INVALID_REQUEST: Request parameters are invalid"
                );
                break;
              case googleMaps.maps.places.PlacesServiceStatus.UNKNOWN_ERROR:
                console.error("UNKNOWN_ERROR: An unknown error occurred");
                break;
              default:
                console.error("Unknown status:", status);
            }

            setAddressOptions([]);
          }
          setIsAddressLoading(false);
        }
      );
    } catch (error) {
      console.error("Error fetching address predictions:", error);
      setAddressOptions([]);
      setIsAddressLoading(false);
    }
  };

  const handleAddressSelect = async (placeId) => {
    if (!placeId || !placesService || !googleMaps) return;

    try {
      placesService.getDetails(
        {
          placeId: placeId,
          fields: ["formatted_address", "geometry", "address_components"],
        },
        (place, status) => {
          console.log("Selected place:", place, "Status:", status);
          if (
            status === googleMaps.maps.places.PlacesServiceStatus.OK &&
            place
          ) {
            setForm((prev) => ({
              ...prev,
              address: place.formatted_address,
            }));
            setAddressInput(place.formatted_address);
          } else {
            console.error("Error getting place details:", status);
          }
        }
      );
    } catch (error) {
      console.error("Error getting place details:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleClientChange = (event, newValue) => {
    setForm((prev) => ({
      ...prev,
      client: newValue,
    }));
  };

  const searchClients = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length === 0) {
      setClientSearchResults([]);
      return;
    }

    try {
      setIsClientSearching(true);
      // Search the entire client database
      const response = await clientService.getAll({
        search: searchTerm.trim(),
        limit: 10,
      });

      const searchResults = response.data.clients || response.data;
      setClientSearchResults(searchResults);
    } catch (error) {
      console.error("Error searching clients:", error);
      setClientSearchResults([]);
    } finally {
      setIsClientSearching(false);
    }
  };

  const handleUsersChange = (event, newValue) => {
    setForm((prev) => ({
      ...prev,
      users: newValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await projectService.update(id, form);
      } else {
        await projectService.create(form);
      }
      navigate("/projects");
    } catch (error) {
      console.error("Error saving project:", error);
      setError("Failed to save project. Please try again.");
    }
  };

  const handleNewClientChange = (e) => {
    const { name, value } = e.target;
    if (name === "contact1Number" || name === "contact2Number") {
      setNewClientForm((prevForm) => ({
        ...prevForm,
        [name]: formatPhoneNumber(value),
      }));
    } else {
      setNewClientForm((prevForm) => ({ ...prevForm, [name]: value }));
    }
  };

  const handleNewClientSubmit = async (e) => {
    e.preventDefault();
    setCreatingClient(true);
    try {
      const response = await clientService.create(newClientForm);
      setClients((prev) => [...prev, response.data]);
      setForm((prev) => ({ ...prev, client: response.data }));
      setNewClientDialogOpen(false);
      setNewClientForm({
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
      setSnackbar({
        open: true,
        message: "Client created successfully!",
        severity: "success",
      });
    } catch (err) {
      console.error("Error creating client:", err);
      setSnackbar({
        open: true,
        message: `Error creating client: ${
          err.response?.data?.message || "Unknown error"
        }`,
        severity: "error",
      });
    } finally {
      setCreatingClient(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeleting(true);
      const response = await projectService.delete(id);

      // Check if this was a permission denied response
      if (response.data?.permissionDenied) {
        // Permission denied - don't navigate, just close the dialog
        setDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }

      // Success - navigate to projects list
      navigate("/projects");
    } catch (error) {
      console.error("Error deleting project:", error);
      setError("Failed to delete project. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Function to determine which statuses a user can access
  const getAccessibleStatuses = () => {
    if (isAdmin || isManager || can("projects.change_status")) {
      // All users with permission can access all statuses for now
      return { active: activeStatuses, inactive: inactiveStatuses };
    }
    return { active: [], inactive: [] };
  };

  const renderStatusMenuItem = (status) => (
    <MenuItem key={status} value={status}>
      <StatusChip
        status={status}
        customColor={statusColors && statusColors[status]}
      />
    </MenuItem>
  );

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate("/projects")} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Project Details</Typography>
      </Box>

      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <Paper sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="h6" color="text.secondary">
                    Project ID: {form.projectID}
                  </Typography>
                  {form.createdAt && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: "italic" }}
                    >
                      (Entered on{" "}
                      {new Date(form.createdAt).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      at{" "}
                      {new Date(form.createdAt).toLocaleTimeString("en-AU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                      )
                    </Typography>
                  )}
                </Box>
              </Grid>

              {form.d_Date && (
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const due = new Date(form.d_Date);
                      due.setHours(0, 0, 0, 0);
                      const diffTime = due.getTime() - today.getTime();
                      const diffDays = Math.ceil(
                        diffTime / (1000 * 60 * 60 * 24)
                      );

                      if (diffDays === 0) {
                        return (
                          <Chip
                            label="Due today"
                            color="warning"
                            variant="filled"
                            sx={{ fontWeight: "bold" }}
                          />
                        );
                      } else if (diffDays < 0) {
                        return (
                          <Chip
                            label={`${Math.abs(diffDays)} days overdue`}
                            color="error"
                            variant="filled"
                            sx={{ fontWeight: "bold" }}
                          />
                        );
                      } else {
                        return (
                          <Chip
                            label={`${diffDays} days left`}
                            color="success"
                            variant="filled"
                          />
                        );
                      }
                    })()}
                  </Box>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <TextField
                  label="Project Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  sx={{ width: "100%" }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box display="flex" gap={1} sx={{ width: "100%" }}>
                  <Autocomplete
                    options={clientSearchResults}
                    getOptionLabel={(option) => option.name}
                    value={form.client}
                    onChange={handleClientChange}
                    inputValue={clientInputValue}
                    onInputChange={(event, newInputValue) => {
                      setClientInputValue(newInputValue);
                      // Debounce the search to avoid too many API calls
                      const timeoutId = setTimeout(() => {
                        searchClients(newInputValue);
                      }, 300);
                      return () => clearTimeout(timeoutId);
                    }}
                    filterOptions={(options, { inputValue }) => {
                      // Don't filter locally since we're searching the database
                      return options;
                    }}
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                    loading={isClientSearching}
                    sx={{ flex: 1 }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Client"
                        required
                        placeholder="Start typing to search clients..."
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {isClientSearching ? (
                                <CircularProgress color="inherit" size={20} />
                              ) : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setNewClientDialogOpen(true)}
                    sx={{ minWidth: "120px" }}
                  >
                    New Client
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12}>
                {googleMapsError && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {googleMapsError}
                  </Alert>
                )}
                <Autocomplete
                  freeSolo
                  options={addressOptions}
                  getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.description
                  }
                  value={form.address || ""}
                  inputValue={addressInput}
                  onInputChange={(_, value) => handleAddressInputChange(value)}
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
                  ListboxProps={{
                    style: {
                      zIndex: 9999,
                      maxHeight: "200px",
                    },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Address (Optional)"
                      name="address"
                      helperText={
                        googleMapsError
                          ? "Address search is disabled due to API issues"
                          : ""
                      }
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {isAddressLoading ? (
                              <CircularProgress color="inherit" size={20} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Typography>{option.description}</Typography>
                    </li>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  name="d_Date"
                  type="date"
                  value={
                    form.d_Date
                      ? new Date(form.d_Date).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={handleChange}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Department</InputLabel>
                  <Select
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    label="Department"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <MenuItem key={dept} value={dept}>
                        {dept}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    label="Status"
                  >
                    <MenuItem disabled>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ fontSize: "0.88rem" }}
                      >
                        Active Statuses
                      </Typography>
                    </MenuItem>
                    {(() => {
                      const accessibleStatuses = getAccessibleStatuses();
                      return (
                        <>
                          {accessibleStatuses.active.map(renderStatusMenuItem)}
                          <MenuItem disabled>
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                              sx={{ fontSize: "0.88rem" }}
                            >
                              Inactive Statuses
                            </Typography>
                          </MenuItem>
                          {accessibleStatuses.inactive.map(
                            renderStatusMenuItem
                          )}
                        </>
                      );
                    })()}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={CATEGORIES}
                  value={form.categories}
                  onChange={(event, newValue) => {
                    setForm((prev) => ({ ...prev, categories: newValue }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Categories"
                      placeholder="Select categories"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const tagProps = getTagProps({ index });
                      return (
                        <Chip key={tagProps.key} label={option} {...tagProps} />
                      );
                    })
                  }
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Work Order/Job Reference"
                  name="workOrder"
                  value={form.workOrder}
                  onChange={handleChange}
                  placeholder="Enter work order or job reference number"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  multiline
                  rows={4}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography
                  variant="subtitle1"
                  sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
                >
                  Project Contact
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Name"
                  name="projectContact.name"
                  value={form.projectContact?.name || ""}
                  onChange={handleChange}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Number"
                  name="projectContact.number"
                  value={form.projectContact?.number || ""}
                  onChange={handleChange}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  name="projectContact.email"
                  type="email"
                  value={form.projectContact?.email || ""}
                  onChange={handleChange}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography
                  variant="subtitle1"
                  sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
                >
                  Project Team
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) =>
                    `${option.firstName} ${option.lastName}`
                  }
                  value={form.users}
                  onChange={handleUsersChange}
                  isOptionEqualToValue={(option, value) =>
                    option._id === value._id
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assigned Users (Optional)"
                      placeholder="Select users"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const tagProps = getTagProps({ index });
                      return (
                        <Chip
                          key={tagProps.key}
                          label={`${option.firstName} ${option.lastName}`}
                          {...tagProps}
                        />
                      );
                    })
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  {/* Delete button for admin and manager users */}
                  {isEditMode &&
                    currentUser &&
                    hasPermission(currentUser, "projects.delete") && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        Delete Project
                      </Button>
                    )}

                  {/* Action buttons */}
                  <Box display="flex" gap={2}>
                    <Button
                      variant="outlined"
                      onClick={() => navigate("/projects")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained" color="primary">
                      {isEditMode ? "Update Project" : "Create Project"}
                    </Button>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      )}

      {/* New Client Dialog */}
      <Dialog
        open={newClientDialogOpen}
        onClose={() => setNewClientDialogOpen(false)}
        maxWidth="md"
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
              bgcolor: "primary.main",
              color: "white",
            }}
          >
            <AddIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Create New Client
          </Typography>
        </DialogTitle>
        <form onSubmit={handleNewClientSubmit}>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Stack spacing={2}>
              <TextField
                label="Client Name"
                name="name"
                value={newClientForm.name}
                onChange={handleNewClientChange}
                required
                fullWidth
              />
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                type="email"
                value={newClientForm.invoiceEmail}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  newClientForm.invoiceEmail &&
                  !isValidEmailOrDash(newClientForm.invoiceEmail)
                }
                helperText={
                  newClientForm.invoiceEmail &&
                  !isValidEmailOrDash(newClientForm.invoiceEmail)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
              <TextField
                label="Address"
                name="address"
                value={newClientForm.address}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="Address or '-' for no address"
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Primary Contact
              </Typography>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={newClientForm.contact1Name}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="Contact name or '-' for no contact"
              />
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={newClientForm.contact1Number}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="04xx xxx xxx or '-' for no phone"
                error={
                  newClientForm.contact1Number &&
                  !isValidAustralianMobile(newClientForm.contact1Number)
                }
                helperText={
                  newClientForm.contact1Number &&
                  !isValidAustralianMobile(newClientForm.contact1Number)
                    ? "Please enter a valid Australian mobile number or use '-' for no phone"
                    : ""
                }
              />
              <TextField
                label="Contact Email"
                name="contact1Email"
                value={newClientForm.contact1Email}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  newClientForm.contact1Email &&
                  !isValidEmailOrDash(newClientForm.contact1Email)
                }
                helperText={
                  newClientForm.contact1Email &&
                  !isValidEmailOrDash(newClientForm.contact1Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Secondary Contact (Optional)
              </Typography>
              <TextField
                label="Contact Name"
                name="contact2Name"
                value={newClientForm.contact2Name}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="Contact name or '-' for no contact"
              />
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={newClientForm.contact2Number}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="04xx xxx xxx or '-' for no phone"
                error={
                  newClientForm.contact2Number &&
                  !isValidAustralianMobile(newClientForm.contact2Number)
                }
                helperText={
                  newClientForm.contact2Number &&
                  !isValidAustralianMobile(newClientForm.contact2Number)
                    ? "Please enter a valid Australian mobile number or use '-' for no phone"
                    : ""
                }
              />
              <TextField
                label="Contact Email"
                name="contact2Email"
                value={newClientForm.contact2Email}
                onChange={handleNewClientChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  newClientForm.contact2Email &&
                  !isValidEmailOrDash(newClientForm.contact2Email)
                }
                helperText={
                  newClientForm.contact2Email &&
                  !isValidEmailOrDash(newClientForm.contact2Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Payment Terms
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  name="paymentTerms"
                  value={newClientForm.paymentTerms}
                  onChange={handleNewClientChange}
                  row
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
              {canWriteOff && (
                <Box sx={{ mt: 2, display: "flex", alignItems: "center" }}>
                  <Checkbox
                    name="written_off"
                    checked={newClientForm.written_off}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        written_off: e.target.checked,
                      })
                    }
                    sx={{
                      color: "red",
                      "&.Mui-checked": {
                        color: "red",
                      },
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{ color: "red", fontWeight: "bold" }}
                  >
                    WRITTEN OFF?
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setNewClientDialogOpen(false)}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={creatingClient}
              startIcon={<AddIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {creatingClient ? "Creating..." : "Create Client"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
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
              bgcolor: "error.main",
              color: "white",
            }}
          >
            <DeleteIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Delete Project
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete the project "{form.name}"? This
            action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteProject}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={<DeleteIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(211, 47, 47, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(211, 47, 47, 0.4)",
              },
            }}
          >
            {deleting ? "Deleting..." : "Delete Project"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectInformation;
