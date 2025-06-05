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
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { projectService, clientService, userService } from "../../services/api";
import {
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  StatusChip,
} from "../../components/JobStatus";
import debounce from "lodash/debounce";

const DEPARTMENTS = ["Asbestos & HAZMAT", "Occupational Hygiene"];

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

// Temporary API key for testing - REMOVE THIS IN PRODUCTION
const GOOGLE_MAPS_API_KEY = "AIzaSyB41DRubKWUHP7t3vqphB1qVhV6x9x9x9x"; // Replace with your actual API key

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
    description: "",
    users: [],
    category: "",
    notes: "",
  });

  const [addressInput, setAddressInput] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  // Initialize Google Places Autocomplete
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);

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
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch clients and users
        const [clientsRes, usersRes] = await Promise.all([
          clientService.getAll(),
          userService.getAll(),
        ]);

        setClients(clientsRes.data);
        setUsers(usersRes.data);

        // If we're in edit mode, fetch the project data
        if (id && id !== "new") {
          try {
            const projectRes = await projectService.getById(id);
            if (!projectRes.data) {
              throw new Error("No project data received");
            }
            setForm(projectRes.data);
          } catch (projectErr) {
            console.error("Error fetching project:", projectErr);
            if (projectErr.response) {
              console.error("Response data:", projectErr.response.data);
              console.error("Response status:", projectErr.response.status);
            }
            setError("Failed to load project data. Please try again.");
            navigate("/projects");
          }
        } else {
          // Generate new project ID for new projects
          try {
            const nextId = await generateNextProjectId();
            setForm((prev) => ({ ...prev, projectID: nextId }));
          } catch (idError) {
            console.error("Error generating project ID:", idError);
            setError("Failed to generate project ID. Please try again.");
          }
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
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    console.log("Environment variables:", {
      REACT_APP_GOOGLE_MAPS_API_KEY: apiKey,
      NODE_ENV: process.env.NODE_ENV,
      all: process.env,
    });

    if (!apiKey) {
      console.error(
        "Google Maps API key is missing. Please check your .env file."
      );
      return;
    }

    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log("Google Maps script loaded successfully");
        const autocomplete =
          new window.google.maps.places.AutocompleteService();
        const places = new window.google.maps.places.PlacesService(
          document.createElement("div")
        );
        setAutocompleteService(autocomplete);
        setPlacesService(places);
      };

      script.onerror = (error) => {
        console.error("Error loading Google Maps script:", error);
      };

      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    } else {
      const autocomplete = new window.google.maps.places.AutocompleteService();
      const places = new window.google.maps.places.PlacesService(
        document.createElement("div")
      );
      setAutocompleteService(autocomplete);
      setPlacesService(places);
    }
  }, []);

  const handleAddressInputChange = async (value) => {
    setAddressInput(value);

    if (!value || value.length < 3 || !autocompleteService) {
      setAddressOptions([]);
      return;
    }

    setIsAddressLoading(true);
    try {
      const response = await autocompleteService.getPlacePredictions({
        input: value,
        componentRestrictions: { country: "au" },
        types: ["address"],
      });
      console.log("Address predictions:", response);
      setAddressOptions(response.predictions || []);
    } catch (error) {
      console.error("Error fetching address predictions:", error);
      setAddressOptions([]);
    } finally {
      setIsAddressLoading(false);
    }
  };

  const handleAddressSelect = (placeId) => {
    if (!placeId || !placesService) return;

    placesService.getDetails(
      {
        placeId,
        fields: ["formatted_address", "geometry", "address_components"],
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          console.log("Selected place:", place);
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
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClientChange = (event, newValue) => {
    setForm((prev) => ({ ...prev, client: newValue }));
  };

  const handleUsersChange = (event, newValue) => {
    setForm((prev) => ({ ...prev, users: newValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!form.name || !form.client || !form.department || !form.status) {
        throw new Error("Please fill in all required fields");
      }

      // Format project data
      const projectData = {
        name: form.name,
        client: form.client._id,
        department: form.department,
        category: form.category || undefined,
        status: form.status,
        address: form.address || undefined,
        description: form.description || undefined,
        users: form.users?.map((user) => user._id) || [],
        notes: form.notes || undefined,
      };

      let response;
      if (isEditMode && id) {
        response = await projectService.update(id, projectData);
      } else {
        response = await projectService.create(projectData);
      }

      if (!response.data) {
        throw new Error("Failed to save project");
      }

      navigate("/projects");
    } catch (err) {
      console.error("Error saving project:", err);
      setError(err.message || "Failed to save project. Please try again.");
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
    const newStatus = e.target.value;
    setForm((prev) => ({ ...prev, status: newStatus }));
  };

  const renderStatusMenuItem = (status) => (
    <MenuItem key={status} value={status}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <StatusChip status={status} />
        <Typography>{status}</Typography>
      </Box>
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
        <Typography variant="h4">
          {isEditMode ? "Edit Project" : "New Project"}
        </Typography>
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

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Project Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={clients}
                  getOptionLabel={(option) => option.name}
                  value={form.client}
                  onChange={handleClientChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Client"
                      required
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            <Button
                              onClick={() => setNewClientDialogOpen(true)}
                              sx={{ ml: 1 }}
                            >
                              New Client
                            </Button>
                          </>
                        ),
                      }}
                    />
                  )}
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
                <FormControl fullWidth>
                  <InputLabel>Category (Optional)</InputLabel>
                  <Select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    label="Category (Optional)"
                  >
                    {CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel> </InputLabel>
                  <Select
                    name="status"
                    value={form.status}
                    onChange={handleStatusChange}
                    label=" "
                  >
                    <MenuItem disabled>
                      <Typography variant="subtitle2" color="text.secondary">
                        Active Jobs
                      </Typography>
                    </MenuItem>
                    {ACTIVE_STATUSES.map(renderStatusMenuItem)}
                    <MenuItem disabled>
                      <Typography variant="subtitle2" color="text.secondary">
                        Inactive Jobs
                      </Typography>
                    </MenuItem>
                    {INACTIVE_STATUSES.map(renderStatusMenuItem)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
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
                    }
                  }}
                  loading={isAddressLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Address (Optional)"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
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

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  value={form.notes || ""}
                  onChange={handleChange}
                  multiline
                  rows={4}
                  placeholder="Add any additional notes or comments about the project..."
                />
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
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assigned Users"
                      placeholder="Select users"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={`${option.firstName} ${option.lastName}`}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  multiline
                  rows={4}
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
    </Box>
  );
};

export default ProjectInformation;
