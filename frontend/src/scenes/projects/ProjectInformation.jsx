import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import { projectService, clientService, userService } from "../../services/api";
import {
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  StatusChip,
} from "../../components/JobStatus";
import debounce from "lodash/debounce";
import loadGoogleMapsApi from "../../utils/loadGoogleMapsApi";

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
  const isEditMode = id !== "new";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [form, setForm] = useState({
    projectID: "",
    name: "",
    client: null,
    department: "",
    status: "Pending",
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

  const [timeLogsOpen, setTimeLogsOpen] = useState(false);
  const [timeLogs, setTimeLogs] = useState([]);
  const [loadingTimeLogs, setLoadingTimeLogs] = useState(false);

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
          clientService.getAll(),
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
    console.log("Google Maps useEffect triggered");
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    console.log("Environment variables:", {
      REACT_APP_GOOGLE_MAPS_API_KEY: apiKey
        ? "API Key Found"
        : "API Key Missing",
      NODE_ENV: process.env.NODE_ENV,
    });

    if (!apiKey) {
      console.error(
        "Google Maps API key is missing. Please check your .env file."
      );
      return;
    }

    console.log("Loading Google Maps API...");
    loadGoogleMapsApi(apiKey)
      .then((google) => {
        console.log("Google Maps loaded successfully:", google);
        console.log("Google Maps version:", google.maps.version);
        console.log("Places API available:", !!google.maps.places);
        setGoogleMaps(google);
        // Initialize the autocomplete service
        const autocompleteService =
          new google.maps.places.AutocompleteService();
        const placesService = new google.maps.places.PlacesService(
          document.createElement("div")
        );
        console.log("Autocomplete service created:", autocompleteService);
        console.log("Places service created:", placesService);
        setAutocompleteService(autocompleteService);
        setPlacesService(placesService);
      })
      .catch((error) => {
        console.error("Error loading Google Maps script:", error);
      });
  }, []);

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
    setNewClientForm({ ...newClientForm, [e.target.name]: e.target.value });
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
        email: "",
        phone: "",
      });
    } catch (err) {
      console.error("Error creating client:", err);
      setError("Failed to create client");
    } finally {
      setCreatingClient(false);
    }
  };

  const handleStatusChange = (e) => {
    setForm((prev) => ({
      ...prev,
      status: e.target.value,
    }));
  };

  const renderStatusMenuItem = (status) => (
    <MenuItem key={status} value={status}>
      <StatusChip status={status} />
    </MenuItem>
  );

  // Add function to fetch time logs
  const fetchTimeLogs = async () => {
    try {
      setLoadingTimeLogs(true);
      const response = await projectService.getTimeLogs(id);
      setTimeLogs(response.data);
    } catch (error) {
      console.error("Error fetching time logs:", error);
      setError("Failed to fetch time logs");
    } finally {
      setLoadingTimeLogs(false);
    }
  };

  // Add function to handle time logs button click
  const handleTimeLogsClick = () => {
    setTimeLogsOpen(true);
    fetchTimeLogs();
  };

  // Function to convert time logs to CSV
  const downloadTimeLogsCSV = () => {
    if (!timeLogs.length) return;

    // Define CSV headers
    const headers = [
      "Date",
      "User",
      "Start Time",
      "End Time",
      "Duration",
      "Description",
    ];

    // Convert time logs to CSV rows
    const rows = timeLogs.map((log) => {
      const [startHours, startMinutes] = log.startTime.split(":").map(Number);
      const [endHours, endMinutes] = log.endTime.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      let duration = endTotalMinutes - startTotalMinutes;
      if (duration < 0) duration += 24 * 60;
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const durationStr = `${hours}h ${minutes}m`;

      return [
        new Date(log.date).toLocaleDateString(),
        `${log.userId.firstName} ${log.userId.lastName}`,
        log.startTime,
        log.endTime,
        durationStr,
        log.description || "",
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `time_logs_${form.projectID}_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate("/projects")} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Project Details</Typography>
        <Button
          variant="outlined"
          onClick={handleTimeLogsClick}
          sx={{ ml: "auto" }}
        >
          Time Logs
        </Button>
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
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Project ID: {form.projectID}
                </Typography>
              </Grid>

              {form.d_Date && (
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                      Due Date:{" "}
                      {new Date(form.d_Date).toLocaleDateString("en-AU", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Typography>
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
                    options={clients}
                    getOptionLabel={(option) => option.name}
                    value={form.client}
                    onChange={handleClientChange}
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                    sx={{ flex: 1 }}
                    renderInput={(params) => (
                      <TextField {...params} label="Client" required />
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
                <Autocomplete
                  freeSolo
                  options={addressOptions}
                  getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.description
                  }
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
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Address (Optional)"
                      name="address"
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
                    {ACTIVE_STATUSES.map(renderStatusMenuItem)}
                    {INACTIVE_STATUSES.map(renderStatusMenuItem)}
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
                <Box display="flex" justifyContent="flex-end" gap={2}>
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
              </Grid>
            </Grid>
          </form>
        </Paper>
      )}

      {/* New Client Dialog */}
      <Dialog
        open={newClientDialogOpen}
        onClose={() => setNewClientDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Client</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Client Name"
                  name="name"
                  value={newClientForm.name}
                  onChange={handleNewClientChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  value={newClientForm.email}
                  onChange={handleNewClientChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={newClientForm.phone}
                  onChange={handleNewClientChange}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewClientDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleNewClientSubmit}
            variant="contained"
            disabled={creatingClient}
          >
            {creatingClient ? "Creating..." : "Create Client"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Time Logs Dialog */}
      <Dialog
        open={timeLogsOpen}
        onClose={() => setTimeLogsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Time Logs</Typography>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadTimeLogsCSV}
              disabled={!timeLogs.length}
            >
              Download CSV
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingTimeLogs ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {timeLogs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell>
                        {new Date(log.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{`${log.userId.firstName} ${log.userId.lastName}`}</TableCell>
                      <TableCell>{log.startTime}</TableCell>
                      <TableCell>{log.endTime}</TableCell>
                      <TableCell>
                        {(() => {
                          const [startHours, startMinutes] = log.startTime
                            .split(":")
                            .map(Number);
                          const [endHours, endMinutes] = log.endTime
                            .split(":")
                            .map(Number);
                          const startTotalMinutes =
                            startHours * 60 + startMinutes;
                          const endTotalMinutes = endHours * 60 + endMinutes;
                          let duration = endTotalMinutes - startTotalMinutes;
                          if (duration < 0) duration += 24 * 60;
                          const hours = Math.floor(duration / 60);
                          const minutes = duration % 60;
                          return `${hours}h ${minutes}m`;
                        })()}
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                    </TableRow>
                  ))}
                  {timeLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No time logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimeLogsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectInformation;
