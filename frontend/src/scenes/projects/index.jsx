import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  DialogContentText,
  Menu,
  Divider,
  Checkbox,
  ListItemText,
  InputAdornment,
  Switch,
  FormControlLabel,
  Autocomplete,
  Grid,
  Avatar,
  Tooltip,
  Alert,
  LinearProgress,
  CircularProgress,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TableSortLabel from "@mui/material/TableSortLabel";
import {
  JOB_STATUS,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  StatusChip,
  UserAvatar,
} from "../../components/JobStatus";
import { useLocation, useNavigate } from "react-router-dom";
import { Breadcrumbs, Link } from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { useTheme } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  projectService,
  clientService,
  userService,
  userPreferencesService,
} from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import AddIcon from "@mui/icons-material/Add";
import { useJobStatus } from "../../hooks/useJobStatus";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import { usePermissions } from "../../hooks/usePermissions";
import TruncatedCell from "../../components/TruncatedCell";
import { Visibility, MoreVert } from "@mui/icons-material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import performanceMonitor from "../../utils/performanceMonitor";
import { debounce } from "lodash";
import DownloadIcon from "@mui/icons-material/Download";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import loadGoogleMapsApi from "../../utils/loadGoogleMapsApi";

const PROJECTS_KEY = "ldc_projects";
const USERS_KEY = "ldc_users";

const PROJECT_TYPES = [
  "air_quality",
  "water_quality",
  "soil_analysis",
  "other",
];

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

const emptyForm = {
  name: "",
  client: "",
  department: DEPARTMENTS[0],
  categories: [],
  address: "",
  d_Date: "",
  workOrder: "",
  users: [],
  status: ACTIVE_STATUSES[0],
  notes: "",
  isLargeProject: false,
  projectContact: {
    name: "",
    number: "",
    email: "",
  },
};

const EditableStatusCell = ({ project, onStatusChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setIsEditing(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsEditing(false);
  };

  const handleStatusSelect = (newStatus) => {
    onStatusChange(project.id, newStatus);
    handleClose();
  };

  return (
    <TableCell>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          onClick={handleClick}
          sx={{
            cursor: "pointer",
            "&:hover": {
              opacity: 0.8,
            },
          }}
        >
          <StatusChip status={project.status} />
        </Box>
        <Menu
          anchorEl={anchorEl}
          open={isEditing}
          onClose={handleClose}
          PaperProps={{
            sx: {
              maxHeight: 300,
              width: 250,
            },
          }}
        >
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Active Jobs
            </Typography>
          </MenuItem>
          {ACTIVE_STATUSES.map((status) => (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              selected={project.status === status}
            >
              <StatusChip status={status} />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Inactive Jobs
            </Typography>
          </MenuItem>
          {INACTIVE_STATUSES.map((status) => (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              selected={project.status === status}
            >
              <StatusChip status={status} />
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </TableCell>
  );
};

// Update the ProjectIdDisplay component to ensure proper formatting
const ProjectIdDisplay = ({ projectId }) => {
  // Ensure projectId is a number and format it
  const formattedId =
    typeof projectId === "number" ? projectId : parseInt(projectId);
  return (
    <Typography
      variant="body1"
      sx={{
        color: "text.secondary",
        mb: 2,
        fontFamily: "monospace",
        fontSize: "1.1rem",
      }}
    >
      Project ID: {`LDJ${String(formattedId).padStart(5, "0")}`}
    </Typography>
  );
};

// Helper functions outside the component
const generateProjectId = (projects) => {
  if (projects.length === 0) return 1;

  // Find the highest existing project ID
  const highestId = Math.max(
    ...projects.map((project) => {
      // Convert any existing IDs to numbers and get the numeric part
      const idStr = String(project.id);
      const numericPart = parseInt(idStr.replace(/\D/g, ""));
      return isNaN(numericPart) ? 0 : numericPart;
    })
  );
  return highestId + 1;
};

const generateHazProjectId = (projects) => {
  // Filter projects that have HAZ prefix
  const hazProjects = projects.filter(
    (project) => project.projectID && project.projectID.startsWith("HAZ")
  );

  if (hazProjects.length === 0) {
    return "HAZ001";
  }

  // Find the highest HAZ project number
  const highestHazNumber = Math.max(
    ...hazProjects.map((project) => {
      const numericPart = parseInt(project.projectID.replace("HAZ", ""));
      return isNaN(numericPart) ? 0 : numericPart;
    })
  );

  const nextNumber = highestHazNumber + 1;
  return `HAZ${String(nextNumber).padStart(3, "0")}`;
};

const resetProjectIds = (projects) => {
  return projects.map((project, index) => ({
    ...project,
    id: index + 1, // Start fresh from 1
  }));
};

const StatusCell = ({ params, onStatusChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const { can } = usePermissions();

  const handleClick = (event) => {
    if (!can("projects.change_status")) {
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleStatusSelect = async (newStatus) => {
    if (!can("projects.change_status")) {
      return;
    }
    await onStatusChange(params.row.id, newStatus);
    handleClose();
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        onClick={handleClick}
        sx={{
          cursor: can("projects.change_status") ? "pointer" : "default",
          opacity: can("projects.change_status") ? 1 : 0.7,
          "&:hover": {
            opacity: can("projects.change_status") ? 0.8 : 0.7,
          },
        }}
      >
        <StatusChip status={params.row.status} />
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            maxHeight: 300,
            width: 250,
          },
        }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" color="text.secondary">
            Active Jobs
          </Typography>
        </MenuItem>
        {ACTIVE_STATUSES.map((status) => (
          <MenuItem
            key={status}
            onClick={() => handleStatusSelect(status)}
            selected={params.row.status === status}
          >
            <StatusChip status={status} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem disabled>
          <Typography variant="subtitle2" color="text.secondary">
            Inactive Jobs
          </Typography>
        </MenuItem>
        {INACTIVE_STATUSES.map((status) => (
          <MenuItem
            key={status}
            onClick={() => handleStatusSelect(status)}
            selected={params.row.status === status}
          >
            <StatusChip status={status} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

// Update the getInitials function
const getInitials = (user) => {
  if (!user) return "";

  let name = "";
  if (user.firstName && user.lastName) {
    name = `${user.firstName} ${user.lastName}`;
  } else if (user.name) {
    name = user.name;
  } else {
    return "";
  }

  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

// Update the getRandomColor function to be more robust
const getRandomColor = (user) => {
  // A more diverse and visually pleasing color palette
  const colors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFD93D", // golden yellow
    "#FF8B94", // soft pink
    "#6C5CE7", // purple
    "#00B894", // mint green
    "#FDCB6E", // amber
    "#E17055", // terracotta
    "#0984E3", // ocean blue
    "#6C5CE7", // royal purple
    "#00B894", // emerald
    "#FDCB6E", // marigold
    "#E17055", // rust
    "#00CEC9", // teal
    "#FF7675", // salmon
    "#74B9FF", // light blue
    "#A29BFE", // lavender
    "#55EFC4", // mint
  ];

  // Create a consistent hash from the user's name or ID
  let identifier;
  if (user.name) {
    identifier = user.name;
  } else if (user.firstName && user.lastName) {
    identifier = `${user.firstName} ${user.lastName}`;
  } else if (user._id) {
    identifier = user._id;
  } else {
    identifier = Math.random().toString();
  }

  // Create a hash from the identifier
  const hash = identifier.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  // Use the hash to select a color
  const index = Math.abs(hash) % 20;
  return colors[index];
};

// Helper to get a color for a given status
const getStatusColor = (status) => {
  switch (status) {
    case "Assigned":
      return "#1976d2"; // Blue
    case "In progress":
      return "#ed6c02"; // Orange
    case "Samples submitted":
      return "#9c27b0"; // Purple
    case "Lab Analysis Complete":
      return "#2e7d32"; // Green
    case "Report sent for review":
      return "#d32f2f"; // Red
    case "Ready for invoicing":
      return "#7b1fa2"; // Deep Purple
    case "Invoice sent":
      return "#388e3c"; // Dark Green
    case "Job complete":
      return "#424242"; // Grey
    case "On hold":
      return "#f57c00"; // Dark Orange
    case "Quote sent":
      return "#1976d2"; // Blue
    case "Cancelled":
      return "#d32f2f"; // Red
    default:
      return "#757575"; // Default grey
  }
};

// Helper function to calculate days difference
const calculateDaysDifference = (dueDate) => {
  if (!dueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0); // Reset time to start of day

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

// Main Projects component
const Projects = ({ initialFilters = {} }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { renderStatusCell, renderStatusSelect, renderEditStatusCell } =
    useJobStatus() || {};
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortModel, setSortModel] = useState([
    { field: "projectID", sort: "desc" },
  ]);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    invoiceEmail: "",
    contact1Name: "",
    contact1Number: "",
    contact1Email: "",
    contact2Name: "",
    contact2Number: "",
    contact2Email: "",
  });
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({
    projectID: true,
    name: true,
    client: true,
    d_Date: true,
    status: true,
    department: false, // Hide department column by default
    workOrder: false, // Hide work order column by default
    users: true,
    createdAt: false, // Hide by default
    updatedAt: false,
  });
  const [showInactive, setShowInactive] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    // Load selected department from filters
    const savedFilters = localStorage.getItem("projects-filters");
    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        if (
          parsedFilters.departmentFilter &&
          parsedFilters.departmentFilter !== "all"
        ) {
          return parsedFilters.departmentFilter;
        }
      } catch (error) {
        console.error("Error parsing saved department filter:", error);
      }
    }
    return "All";
  });
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 50,
    page: 0,
  });

  // Add state for column visibility dropdown
  const [columnVisibilityAnchor, setColumnVisibilityAnchor] = useState(null);

  // Use refs to track component state
  const isInitialLoadRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const pageLoadTimerRef = useRef(null);
  const renderStartTimeRef = useRef(null);

  // Add ref to track current search term to prevent unnecessary API calls
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;

  // Add ref to track search input focus
  const searchInputRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Google Places Autocomplete state
  const [addressInput, setAddressInput] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [googleMaps, setGoogleMaps] = useState(null);

  const [clientInputValue, setClientInputValue] = useState("");

  // Start page load monitoring only on initial load
  useEffect(() => {
    if (isInitialLoadRef.current) {
      pageLoadTimerRef.current =
        performanceMonitor.startPageLoad("projects-page");
      isInitialLoadRef.current = false;
    }
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error(
        "Google Maps API key is missing. Please check your environment configuration."
      );
      return;
    }

    loadGoogleMapsApi(apiKey)
      .then((google) => {
        setGoogleMaps(google);
        // Initialize the autocomplete service
        const autocompleteService =
          new google.maps.places.AutocompleteService();
        const placesService = new google.maps.places.PlacesService(
          document.createElement("div")
        );
        setAutocompleteService(autocompleteService);
        setPlacesService(placesService);
      })
      .catch((error) => {
        console.error("Error loading Google Maps script:", error);
      });
  }, []);

  // Google Places Autocomplete handlers
  const handleAddressInputChange = async (value) => {
    setAddressInput(value);

    if (!value || value.length < 3 || !autocompleteService || !googleMaps) {
      setAddressOptions([]);
      return;
    }

    setIsAddressLoading(true);
    try {
      autocompleteService.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: "au" },
          types: ["address"],
        },
        (predictions, status) => {
          console.log(
            "Projects - Address predictions:",
            predictions,
            "Status:",
            status
          );
          if (
            status === googleMaps.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setAddressOptions(predictions);
          } else {
            console.log("Projects - No predictions found or error:", status);
            setAddressOptions([]);
          }
          setIsAddressLoading(false);
        }
      );
    } catch (error) {
      console.error("Projects - Error fetching address predictions:", error);
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
          console.log("Projects - Selected place:", place, "Status:", status);
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
            console.error("Projects - Error getting place details:", status);
          }
        }
      );
    } catch (error) {
      console.error("Projects - Error getting place details:", error);
    }
  };

  // Monitor data rendering
  useEffect(() => {
    if (!loading && projects.length > 0) {
      renderStartTimeRef.current = performance.now();
      performanceMonitor.startTimer("data-render");
    }
  }, [loading, projects]);

  const handleRenderComplete = useCallback(() => {
    if (renderStartTimeRef.current) {
      performanceMonitor.endTimer("data-render");
      renderStartTimeRef.current = null;
    }
  }, []);

  // Combine all filters into a single state object to prevent multiple useEffect triggers
  const [filters, setFilters] = useState(() => {
    // Load filters from localStorage and URL parameters
    const savedFilters = localStorage.getItem("projects-filters");
    const urlParams = new URLSearchParams(window.location.search);

    const defaultFilters = {
      searchTerm: "",
      departmentFilter: "all",
      statusFilter: "all",
      sortModel: [{ field: "projectID", sort: "desc" }],
    };

    // Read status and active from URL
    const urlStatus = urlParams.get("status");
    const urlActive = urlParams.get("active");

    // Apply initial filters from props (from databases page)
    const appliedFilters = {
      ...defaultFilters,
      searchTerm: initialFilters.search || "",
      departmentFilter: initialFilters.department || "all",
      statusFilter: initialFilters.status || "all",
    };

    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        return {
          ...appliedFilters,
          ...parsedFilters,
          // Override with URL parameters if they exist
          searchTerm:
            urlParams.get("search") ||
            initialFilters.search ||
            parsedFilters.searchTerm ||
            "",
          departmentFilter:
            urlParams.get("department") ||
            initialFilters.department ||
            parsedFilters.departmentFilter ||
            "all",
          statusFilter:
            urlStatus ||
            urlParams.get("status") ||
            initialFilters.status ||
            parsedFilters.statusFilter ||
            "all",
        };
      } catch (error) {
        console.error("Error parsing saved filters:", error);
        return {
          ...appliedFilters,
          statusFilter:
            urlStatus || initialFilters.status || defaultFilters.statusFilter,
        };
      }
    }
    return {
      ...appliedFilters,
      statusFilter:
        urlStatus || initialFilters.status || defaultFilters.statusFilter,
    };
  });

  // Add ref to track current filters state to avoid stale closures
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Function to save filters to localStorage and update URL
  const saveFilters = useCallback((newFilters) => {
    localStorage.setItem("projects-filters", JSON.stringify(newFilters));

    // Update URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (newFilters.searchTerm) {
      urlParams.set("search", newFilters.searchTerm);
    } else {
      urlParams.delete("search");
    }
    if (newFilters.departmentFilter !== "all") {
      urlParams.set("department", newFilters.departmentFilter);
    } else {
      urlParams.delete("department");
    }
    if (newFilters.statusFilter !== "all") {
      urlParams.set("status", newFilters.statusFilter);
    } else {
      urlParams.delete("status");
    }

    // Update URL without reloading the page
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${
        urlParams.toString() ? "?" + urlParams.toString() : ""
      }`
    );
  }, []);

  // Update individual filter functions to use the combined state
  const updateFilter = useCallback(
    (filterType, value) => {
      console.log("🔍 updateFilter called with:", filterType, value);
      setFilters((prev) => {
        const newFilters = {
          ...prev,
          [filterType]: value,
        };
        console.log("🔍 New filters state:", newFilters);
        // Save filters whenever they change
        saveFilters(newFilters);
        return newFilters;
      });
    },
    [saveFilters]
  );

  // Function to fetch projects with pagination
  const fetchProjectsWithPagination = useCallback(
    async (
      paginationModel,
      searchValue = filtersRef.current.searchTerm,
      isSearch = false,
      currentFilters = null
    ) => {
      console.log("🔍 fetchProjectsWithPagination called with:");
      console.log("  - searchValue:", searchValue);
      console.log("  - isSearch:", isSearch);
      console.log("  - currentFilters:", currentFilters);
      console.log("  - current filters state:", filtersRef.current);

      // Use current filters state if currentFilters is null (for search operations)
      const filtersToUse = currentFilters || filtersRef.current;
      console.log("🔍 filtersToUse:", filtersToUse);
      try {
        if (isSearch) {
          setSearchLoading(true);
        } else {
          setLoading(true);
        }

        const params = {
          page: paginationModel.page + 1,
          limit: paginationModel.pageSize,
          sortBy: filtersToUse.sortModel[0]?.field || "createdAt",
          sortOrder: filtersToUse.sortModel[0]?.sort || "desc",
        };

        // Add search term if provided
        if (searchValue) {
          params.search = searchValue;
          console.log("🔍 Added search param:", searchValue);
        }

        // Add department filter
        if (filtersToUse.departmentFilter !== "all") {
          params.department = filtersToUse.departmentFilter;
        }

        // Add status filter
        if (filtersToUse.statusFilter !== "all") {
          params.status = filtersToUse.statusFilter;
        }

        console.log("🔍 API call params:", params);
        const response = await projectService.getAll(params);
        console.log("🔍 API response:", response);

        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];
        console.log("🔍 Processed projectsData length:", projectsData.length);

        setProjects(projectsData);
        setPagination({
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 0,
          page: paginationModel.page,
          limit: paginationModel.pageSize,
        });
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err.message);
        setProjects([]);
      } finally {
        setLoading(false);
        setSearchLoading(false);
      }
    },
    [] // Remove filters dependency since we now use ref to get current state
  );

  // Move fetchProjects here so it is defined after fetchProjectsWithPagination
  const fetchProjects = useCallback(
    async (isSearch = false) => {
      // Use fetchProjectsWithPagination with current pagination model
      return fetchProjectsWithPagination(
        paginationModel,
        filtersRef.current.searchTerm,
        isSearch,
        filtersRef.current
      );
    },
    [fetchProjectsWithPagination, paginationModel]
  );

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      console.log("🔍 debouncedSearch triggered with value:", value);
      console.log("🔍 Current paginationModel:", paginationModel);

      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      // Use the new function with reset pagination
      fetchProjectsWithPagination(
        { page: 0, pageSize: paginationModel.pageSize },
        value,
        true,
        null // Pass null to use current filters state inside fetchProjectsWithPagination
      );
    }, 150), // Reduced from 300ms to 150ms for better responsiveness
    [fetchProjectsWithPagination, paginationModel.pageSize]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (filterType, value) => {
      // Create a new function to fetch with updated filter values
      const fetchWithUpdatedFilters = async () => {
        try {
          performanceMonitor.startTimer("fetch-projects");
          setSearchLoading(true);

          // Create updated filters object with the new value
          const updatedFilters = { ...filters };
          switch (filterType) {
            case "department":
              updatedFilters.departmentFilter = value;
              break;
            case "status":
              updatedFilters.statusFilter = value;
              break;
            default:
              break;
          }

          const params = {
            page: 1, // Reset to first page
            limit: paginationModel.pageSize,
            sortBy: updatedFilters.sortModel[0]?.field || "createdAt",
            sortOrder: updatedFilters.sortModel[0]?.sort || "desc",
          };

          // Add search term if provided
          if (updatedFilters.searchTerm) {
            params.search = updatedFilters.searchTerm;
          }

          // Add department filter
          if (updatedFilters.departmentFilter !== "all") {
            params.department = updatedFilters.departmentFilter;
          }

          // Add status filter
          if (updatedFilters.statusFilter !== "all") {
            params.status = updatedFilters.statusFilter;
          }

          const response = await projectService.getAll(params);

          const projectsData = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];

          setProjects(projectsData);
          setPagination((prev) => ({
            ...prev,
            total: response.data.pagination?.total || 0,
            pages: response.data.pagination?.pages || 0,
          }));
        } catch (err) {
          console.error("Error fetching projects:", err);
          setError(err.message);
          setProjects([]);
        } finally {
          setSearchLoading(false);
          performanceMonitor.endTimer("fetch-projects");
        }
      };

      // Update the appropriate filter
      switch (filterType) {
        case "department":
          updateFilter("departmentFilter", value);
          break;
        case "status":
          updateFilter("statusFilter", value);
          break;
        default:
          break;
      }

      setPaginationModel((prev) => ({ ...prev, page: 0 }));

      // Use the new function with updated filters
      fetchWithUpdatedFilters();
    },
    [updateFilter, filters, paginationModel, fetchProjectsWithPagination]
  );

  // Function to clear all filters
  const clearFilters = useCallback(() => {
    const defaultFilters = {
      searchTerm: "",
      departmentFilter: "all",
      statusFilter: "all",
      sortModel: [{ field: "projectID", sort: "desc" }],
    };

    setFilters(defaultFilters);
    setSelectedDepartment("All");
    setPaginationModel((prev) => ({ ...prev, page: 0 }));

    // Clear localStorage and URL parameters
    localStorage.removeItem("projects-filters");
    localStorage.removeItem("projects-column-visibility");
    window.history.replaceState({}, "", window.location.pathname);

    // Reset column visibility to default
    const defaultColumnVisibility = {
      projectID: true,
      name: true,
      client: true,
      d_Date: true,
      status: true,
      department: true,
      users: true,
      createdAt: false, // Hide by default
      updatedAt: false,
    };
    setColumnVisibilityModel(defaultColumnVisibility);

    // Trigger fetch with cleared filters
    fetchProjectsWithPagination(
      { page: 0, pageSize: paginationModel.pageSize },
      "",
      false,
      defaultFilters
    );
  }, [fetchProjectsWithPagination, paginationModel.pageSize]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (event) => {
      const value = event.target.value;
      console.log("🔍 handleSearchChange called with value:", value);

      // Immediately update the search term in state for better UX
      updateFilter("searchTerm", value);
      console.log(
        "🔍 After updateFilter, calling debouncedSearch with:",
        value
      );

      // Then trigger the debounced search with the current value
      debouncedSearch(value);
    },
    [debouncedSearch, updateFilter]
  );

  // Fetch projects when pagination changes only
  useEffect(() => {
    // Removed automatic fetch to prevent double API calls
    // All fetches are now triggered manually in search and filter handlers
  }, [paginationModel]);

  // Clear search term when component unmounts or when navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear search term from localStorage when leaving the page
      const currentFilters = localStorage.getItem("projects-filters");
      if (currentFilters) {
        try {
          const parsedFilters = JSON.parse(currentFilters);
          if (parsedFilters.searchTerm) {
            parsedFilters.searchTerm = "";
            localStorage.setItem(
              "projects-filters",
              JSON.stringify(parsedFilters)
            );
          }
        } catch (error) {
          console.error("Error clearing search term:", error);
        }
      }
    };

    // Listen for page unload/refresh
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function to clear search term when component unmounts
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Clear search term from state and localStorage
      const currentFilters = localStorage.getItem("projects-filters");
      if (currentFilters) {
        try {
          const parsedFilters = JSON.parse(currentFilters);
          if (parsedFilters.searchTerm) {
            parsedFilters.searchTerm = "";
            localStorage.setItem(
              "projects-filters",
              JSON.stringify(parsedFilters)
            );
          }
        } catch (error) {
          console.error("Error clearing search term on unmount:", error);
        }
      }
    };
  }, []);

  // Restore focus to search input when search loading completes
  useEffect(() => {
    if (!searchLoading && searchFocused && searchInputRef.current) {
      // Small delay to ensure the component has re-rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [searchLoading, searchFocused]);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      limit: newPageSize,
      page: 1, // Reset to first page when changing page size
    }));
  }, []);

  // Handle sort change
  const handleSortModelChange = useCallback(
    (newSortModel) => {
      updateFilter("sortModel", newSortModel);
    },
    [updateFilter]
  );

  // Fetch clients and users when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const clientsResponse = await clientService.getAll();
        console.log("Clients response:", clientsResponse);
        console.log("Clients data:", clientsResponse.data);
        const clientsData =
          clientsResponse.data.clients || clientsResponse.data;
        console.log("Final clients array:", clientsData);
        console.log("Number of clients fetched:", clientsData.length);
        setClients(clientsData);
      } catch (err) {
        console.error("Error fetching clients:", err);
      }
    };
    fetchData();
  }, []);

  // Add useEffect to fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("No authentication token found");
          setLoadingUsers(false);
          return;
        }

        const response = await userService.getAll();

        // Filter out inactive users and transform the data
        const activeUsers = response.data.filter(
          (user) => user.isActive === true
        );

        const transformedUsers = activeUsers.map((user) => ({
          ...user,
          name: `${user.firstName} ${user.lastName}`,
        }));

        setUsers(transformedUsers);
        setLoadingUsers(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Initial fetch for projects when component mounts
  useEffect(() => {
    fetchProjects(false);
  }, []); // Empty dependency array for initial load only

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const projectId = selectedProject?._id || selectedProject?.id;
      if (!projectId) {
        console.error("No project ID found for update");
        setError("Cannot update project: No project ID found");
        return;
      }

      const response = await projectService.update(projectId, form);
      setProjects(
        projects.map((p) => ((p._id || p.id) === projectId ? response.data : p))
      );
      setDialogOpen(false);
      setSelectedProject(null);
      setForm(emptyForm);
    } catch (error) {
      console.error("Error updating project:", error);
      setError("Failed to update project");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log("=== SUBMITTING PROJECT FORM ===");
      console.log("Form data being sent:", form);
      console.log("Form data type:", typeof form);
      console.log("Client value:", form.client);
      console.log("Department value:", form.department);
      console.log("Users value:", form.users);
      console.log("===============================");

      const response = await projectService.create(form);
      setProjects([...projects, response.data]);
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (error) {
      console.error("Error creating project:", error);
      console.error("Error response:", error.response?.data);
      setError("Failed to create project");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name.includes("projectContact")) {
        const [_, field] = name.split(".");
        return {
          ...prev,
          projectContact: {
            ...prev.projectContact,
            [field]: value,
          },
        };
      }
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleUsersChange = (event, newValue) => {
    setForm((prev) => ({
      ...prev,
      users: newValue,
    }));
  };

  const handleClientChange = (event, newValue) => {
    setForm((prev) => ({
      ...prev,
      client: newValue ? newValue._id : "",
    }));
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      const project = projects.find((p) => (p._id || p.id) === projectId);
      if (!project) return;

      const response = await projectService.update(projectId, {
        ...project,
        status: newStatus,
      });

      setProjects(
        projects.map((p) => ((p._id || p.id) === projectId ? response.data : p))
      );
    } catch (error) {
      console.error("Error updating project status:", error);
      setError("Failed to update project status");
    }
  };

  const handleRemoveUser = async (projectId, userId) => {
    try {
      const project = projects.find((p) => (p._id || p.id) === projectId);
      if (!project) {
        console.error("Project not found:", projectId);
        return;
      }

      const updatedUsers = project.users.filter((id) => id !== userId);
      const response = await projectService.update(projectId, {
        ...project,
        users: updatedUsers,
      });

      setProjects(
        projects.map((p) => ((p._id || p.id) === projectId ? response.data : p))
      );
    } catch (error) {
      console.error("Error removing user:", error);
      setError("Failed to remove user from project");
    }
  };

  const handleDeleteProject = async () => {
    try {
      console.log("=== DELETING PROJECT ===");
      console.log("Selected project:", selectedProject);
      console.log(
        "Project ID to delete:",
        selectedProject?._id || selectedProject?.id
      );
      console.log("=========================");

      const projectId = selectedProject?._id || selectedProject?.id;
      if (!projectId) {
        console.error("No project ID found for deletion");
        setError("Cannot delete project: No project ID found");
        return;
      }

      await projectService.delete(projectId);
      setProjects(projects.filter((p) => (p._id || p.id) !== projectId));
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      console.error("Error response:", error.response?.data);
      setError("Failed to delete project");
    }
  };

  // UsersCell component for rendering user avatars
  const UsersCell = ({ users }) => {
    if (!users || users.length === 0) {
      return <span>-</span>;
    }

    return (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {users.map((user, index) => (
          <Tooltip
            key={user._id || index}
            title={`${user.firstName} ${user.lastName}`}
          >
            <Avatar
              sx={{
                width: 24,
                height: 24,
                fontSize: "0.75rem",
                bgcolor: getRandomColor(user),
              }}
            >
              {getInitials(user)}
            </Avatar>
          </Tooltip>
        ))}
      </Box>
    );
  };

  // Update the renderUsersSelect function
  const renderUsersSelect = (value, onChange, name) => {
    // console.log("Rendering users select with:", { value, users });

    // Ensure value is always an array of user IDs
    const selectedUserIds = Array.isArray(value) ? value : [];

    // Filter out any inactive users from the selected values
    const activeSelectedIds = selectedUserIds.filter((userId) =>
      users.some((user) => user._id === userId && user.isActive === true)
    );

    return (
      <FormControl fullWidth>
        <InputLabel>Assigned Users</InputLabel>
        <Select
          multiple
          name={name}
          value={activeSelectedIds}
          onChange={onChange}
          label="Assigned Users"
          disabled={loadingUsers}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selected.map((userId) => {
                const user = users.find((u) => u._id === userId);
                if (!user) return null;
                const displayName =
                  user.name || `${user.firstName} ${user.lastName}`.trim();
                return <Chip key={userId} label={displayName} size="small" />;
              })}
            </Box>
          )}
        >
          {users.map((user) => {
            const displayName =
              user.name || `${user.firstName} ${user.lastName}`.trim();
            return (
              <MenuItem key={user._id} value={user._id}>
                {displayName}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    );
  };

  // Add function to handle new client creation
  const handleNewClientSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await clientService.create(newClient);
      setClients([...clients, response.data]);
      setForm({ ...form, client: response.data._id });
      setClientDialogOpen(false);
      setNewClient({
        name: "",
        email: "",
        phone: "",
        address: "",
        invoiceEmail: "",
        contact1Name: "",
        contact1Number: "",
        contact1Email: "",
        contact2Name: "",
        contact2Number: "",
        contact2Email: "",
      });
    } catch (err) {
      if (err.response) {
        alert(
          `Error creating client: ${
            err.response.data.message || "Unknown error"
          }`
        );
      }
    }
  };

  const handleMenuOpen = (event, data) => {
    setMenuAnchor(event.currentTarget);
    setSelectedProject(data);
  };

  // Handler for edit action
  const handleEditClick = (project) => {
    setSelectedProject(project);
    setDialogOpen(true);
  };

  // Handler for delete action
  const handleDeleteClick = (project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleColumnVisibilityModelChange = useCallback((newModel) => {
    setColumnVisibilityModel(newModel);
  }, []);

  // Add handlers for column visibility dropdown
  const handleColumnVisibilityClick = (event) => {
    setColumnVisibilityAnchor(event.currentTarget);
  };

  const handleColumnVisibilityClose = () => {
    setColumnVisibilityAnchor(null);
  };

  const handleColumnToggle = async (field) => {
    const newModel = {
      ...columnVisibilityModel,
      [field]: !columnVisibilityModel[field],
    };

    setColumnVisibilityModel(newModel);

    try {
      // Save to database
      await userPreferencesService.updatePreferences({
        columnVisibility: {
          projects: newModel,
        },
      });
    } catch (error) {
      console.error("Error saving column visibility preferences:", error);
      // Fallback to localStorage if API fails
      localStorage.setItem(
        "projects-column-visibility",
        JSON.stringify(newModel)
      );
    }
  };

  const handleDepartmentClick = (department) => {
    // console.log("Department filter clicked:", department);
    setSelectedDepartment(department);

    // Convert department name to filter value
    const departmentValue = department === "All" ? "all" : department;

    // Update the department filter using the existing filter update mechanism
    updateFilter("departmentFilter", departmentValue);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));

    // Use the new function with reset pagination and updated department filter
    // We need to create a temporary filters object with the new department value
    const tempFilters = {
      ...filters,
      departmentFilter: departmentValue,
    };

    // Create a temporary fetch function that uses the updated department
    const fetchWithUpdatedDepartment = async () => {
      try {
        performanceMonitor.startTimer("fetch-projects");
        setSearchLoading(true);

        const params = {
          page: 1, // Reset to first page
          limit: paginationModel.pageSize,
          sortBy: tempFilters.sortModel[0]?.field || "createdAt",
          sortOrder: tempFilters.sortModel[0]?.sort || "desc",
        };

        // Add search term if provided
        if (tempFilters.searchTerm) {
          params.search = tempFilters.searchTerm;
        }

        // Add department filter
        if (departmentValue !== "all") {
          params.department = departmentValue;
        }

        // Handle status filters
        if (tempFilters.statusFilter !== "all") {
          params.status = tempFilters.statusFilter;
        }

        const response = await projectService.getAll(params);

        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        setProjects(projectsData);
        setPagination((prev) => ({
          ...prev,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0,
        }));
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err.message);
        setProjects([]);
      } finally {
        setSearchLoading(false);
        performanceMonitor.endTimer("fetch-projects");
      }
    };

    // Execute the fetch immediately
    fetchWithUpdatedDepartment();
  };

  // Handle pagination model change
  const handlePaginationModelChange = useCallback(
    (newModel) => {
      setPaginationModel(newModel);
      // Use the new function with the updated pagination model
      fetchProjectsWithPagination(newModel, filters.searchTerm, false);
    },
    [fetchProjectsWithPagination, filters.searchTerm]
  );

  // Load user preferences from database
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await userPreferencesService.getPreferences();
        if (response.data?.columnVisibility?.projects) {
          setColumnVisibilityModel(response.data.columnVisibility.projects);
        }
      } catch (error) {
        console.error("Error loading user preferences:", error);
        // Fallback to localStorage if API fails
        const savedColumnVisibility = localStorage.getItem(
          "projects-column-visibility"
        );
        if (savedColumnVisibility) {
          try {
            const parsed = JSON.parse(savedColumnVisibility);
            setColumnVisibilityModel(parsed);
          } catch (parseError) {
            console.error("Error parsing saved column visibility:", parseError);
          }
        }
      }
    };

    loadUserPreferences();
  }, []);

  // Memoize columns configuration
  const columns = useMemo(
    () => [
      {
        field: "projectID",
        headerName: "Project ID",
        flex: 0,
        width: 105,
        minWidth: 105,
        maxWidth: 105,
        renderCell: (params) => (
          <Box
            onClick={() => navigate(`/projects/${params.row._id}`)}
            sx={{ cursor: "pointer" }}
          >
            {params.value}
          </Box>
        ),
      },
      {
        field: "name",
        headerName: "Project Name",
        flex: 2,
        minWidth: 190,
        maxWidth: 400,

        renderCell: ({ row }) => (
          <Box
            onClick={() => navigate(`/projects/${row._id}`)}
            sx={{
              cursor: "pointer",
              "&:hover": { color: theme.palette.primary.main },
              whiteSpace: "normal",
              wordWrap: "break-word",
              lineHeight: 1.2,
              height: "100%",
              display: "flex",
              alignItems: "center",
            }}
          >
            {row.name}
          </Box>
        ),
      },
      {
        field: "workOrder",
        headerName: "Work Order/Job Reference",
        flex: 1,
        minWidth: 150,
        hide: true, // Hidden by default
      },
      {
        field: "client",
        headerName: "Client",
        flex: 1,
        minWidth: 140,
        maxWidth: 220,
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "normal",
              wordWrap: "break-word",
              lineHeight: 1.2,
              maxHeight: "2.4em", // 2 lines * 1.2 line height
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              width: "100%",
            }}
          >
            {row.client?.name || row.client || ""}
          </Typography>
        ),
      },
      {
        field: "d_Date",
        headerName: "Due Date",
        flex: 1,
        minWidth: 100,
        maxWidth: 120,
        renderCell: ({ row }) => {
          const daysDiff = calculateDaysDifference(row.d_Date);

          if (!row.d_Date) {
            return (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                  lineHeight: 1.2,
                  maxHeight: "2.4em", // 2 lines * 1.2 line height
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  width: "100%",
                }}
              >
                No due date
              </Typography>
            );
          }

          if (daysDiff === 0) {
            return (
              <Typography
                variant="body2"
                sx={{
                  color: "#f57c00",
                  fontWeight: "bold",
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                  lineHeight: 1.2,
                  maxHeight: "2.4em",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  width: "100%",
                }}
              >
                Due today
              </Typography>
            );
          } else if (daysDiff < 0) {
            return (
              <Typography
                variant="body2"
                sx={{
                  color: "#d32f2f",
                  fontWeight: "bold",
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                  lineHeight: 1.2,
                  maxHeight: "2.4em",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  width: "100%",
                }}
              >
                {Math.abs(daysDiff)} days overdue
              </Typography>
            );
          } else {
            return (
              <Typography
                variant="body2"
                sx={{
                  color: "#2e7d32",
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                  lineHeight: 1.2,
                  maxHeight: "2.4em",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  width: "100%",
                }}
              >
                {daysDiff} days left
              </Typography>
            );
          }
        },
      },
      {
        field: "department",
        headerName: "Department",
        flex: 1,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        minWidth: 60,
        maxWidth: 165,
        renderCell: (params) => (
          <Box
            sx={{
              backgroundColor: getStatusColor(params.value),
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.75rem",
            }}
          >
            {params.value}
          </Box>
        ),
      },
      {
        field: "users",
        headerName: "Users",
        flex: 1,
        minWidth: 60,
        maxWidth: 120,
        renderCell: (params) => {
          // Safety check to ensure UsersCell component is available
          if (typeof UsersCell !== "function") {
            return <span>-</span>;
          }
          return <UsersCell users={params.row.users} />;
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        flex: 1,
        minWidth: 120,
        maxWidth: 160,
        renderCell: (params) => (
          <Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<VisibilityIcon />}
              onClick={() => navigate(`/projects/${params.row._id}`)}
              sx={{ mr: 1 }}
            >
              Details
            </Button>
            <IconButton
              onClick={() => handleDeleteClick(params.row)}
              size="small"
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        ),
      },
    ],
    [navigate]
  );

  // Fallback renderStatusSelect function in case the hook doesn't return it
  const safeRenderStatusSelect =
    renderStatusSelect ||
    ((value, onChange, label = "Status") => (
      <FormControl fullWidth required>
        <InputLabel>{label}</InputLabel>
        <Select name="status" value={value} onChange={onChange} label={label}>
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Active Jobs
            </Typography>
          </MenuItem>
          {ACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
          <Divider />
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Inactive Jobs
            </Typography>
          </MenuItem>
          {INACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    ));

  // Fallback renderStatusCell function
  const safeRenderStatusCell =
    renderStatusCell ||
    ((params) => (
      <Box
        sx={{
          backgroundColor: getStatusColor(params.value),
          color: "white",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "0.75rem",
        }}
      >
        {params.value}
      </Box>
    ));

  // Fallback renderEditStatusCell function
  const safeRenderEditStatusCell =
    renderEditStatusCell ||
    ((params) => (
      <Box sx={{ width: "100%" }}>
        <Select
          value={params.value}
          onChange={(e) => {
            params.api.setEditCellValue(
              {
                id: params.id,
                field: params.field,
                value: e.target.value,
              },
              true
            );
          }}
          sx={{ width: "100%" }}
          size="small"
        >
          {ACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
          {INACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
        </Select>
      </Box>
    ));

  if (loading) return <Typography>Loading projects...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  // Ensure columns are properly defined before rendering
  if (!columns || columns.length === 0) {
    return <Typography>Loading columns...</Typography>;
  }

  const handleBackToDatabases = () => {
    navigate("/databases");
  };

  return (
    <Box m="5px 0px 20px 20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Projects
      </Typography>{" "}
      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToDatabases}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Databases Home
          </Link>
          <Typography color="text.primary">Projects</Typography>
        </Breadcrumbs>
      </Box>
      {/* Search Loading Animation - Only shows during searches */}
      {searchLoading && (
        <Box sx={{ width: "100%", mb: 2 }}>
          <LinearProgress
            sx={{
              height: 3,
              borderRadius: 1.5,
              backgroundColor: "rgba(25, 118, 210, 0.1)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: "#1976d2",
              },
            }}
          />
        </Box>
      )}
      {/* Search and Filter Section */}
      {/* Add Project Button - Full Width */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setDialogOpen(true)}
          fullWidth
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": { backgroundColor: theme.palette.primary.dark },
            height: 60,
            fontSize: "1.2rem",
            fontWeight: "bold",
            border: "2px solid rgb(83, 84, 85)",
            py: 2,
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          ADD PROJECT
        </Button>
      </Box>
      <Box
        mt="5px"
        mb="20px"
        sx={{
          backgroundColor: "background.paper",
          borderRadius: "4px",
          boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
          p: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Search Input */}
            <TextField
              label="Search Projects"
              variant="outlined"
              size="small"
              placeholder="Enter search term"
              value={filters.searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
              ref={searchInputRef}
              onFocus={() => {
                setSearchFocused(true);
              }}
              onBlur={() => {
                setSearchFocused(false);
              }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.statusFilter}
                label="Status"
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="all_active">Active</MenuItem>
                <MenuItem value="all_inactive">Inactive</MenuItem>
                <Divider />
                <MenuItem disabled>
                  <Typography variant="subtitle2" color="text.secondary">
                    Active Statuses
                  </Typography>
                </MenuItem>
                {ACTIVE_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem disabled>
                  <Typography variant="subtitle2" color="text.secondary">
                    Inactive Statuses
                  </Typography>
                </MenuItem>
                {INACTIVE_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Column Visibility Button */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<ViewColumnIcon />}
              onClick={handleColumnVisibilityClick}
              sx={{
                height: 40, // Match the height of other components
                minWidth: 140,
                color: theme.palette.primary.main,
                borderColor: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: theme.palette.primary.main,
                  color: "white",
                  borderColor: theme.palette.primary.main,
                },
              }}
            >
              Columns
            </Button>
          </Stack>
        </Stack>
      </Box>
      {/* Column Visibility Dropdown */}
      <Popover
        open={Boolean(columnVisibilityAnchor)}
        anchorEl={columnVisibilityAnchor}
        onClose={handleColumnVisibilityClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        PaperProps={{
          sx: {
            minWidth: 200,
            maxHeight: 400,
          },
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ p: 1, fontWeight: "bold" }}>
            Show/Hide Columns
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <List dense>
            {columns.map((column) => (
              <ListItem key={column.field} disablePadding>
                <ListItemButton
                  dense
                  onClick={() => handleColumnToggle(column.field)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={columnVisibilityModel[column.field] !== false}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={column.headerName}
                    primaryTypographyProps={{ fontSize: "0.875rem" }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
      {/* Department Filter Buttons */}
      <Box
        display="flex"
        justifyContent="flex-start"
        alignItems="center"
        gap={1}
        mb={2}
      >
        <Button
          variant={selectedDepartment === "All" ? "contained" : "outlined"}
          onClick={() => handleDepartmentClick("All")}
          sx={{
            backgroundColor:
              selectedDepartment === "All" ? "#1976d2" : "transparent",
            color: selectedDepartment === "All" ? "#fff" : "#1976d2",
            borderColor: "#1976d2",
            "&:hover": {
              backgroundColor: "#1976d2",
              color: "#fff",
            },
          }}
        >
          All Departments
        </Button>
        {DEPARTMENTS.map((department) => (
          <Button
            key={department}
            variant={
              selectedDepartment === department ? "contained" : "outlined"
            }
            onClick={() => handleDepartmentClick(department)}
            sx={{
              backgroundColor:
                selectedDepartment === department
                  ? department === "Asbestos & HAZMAT"
                    ? "#2e7d32"
                    : department === "Occupational Hygiene"
                    ? "#ed6c02"
                    : "#9c27b0"
                  : "transparent",
              color:
                selectedDepartment === department
                  ? "#fff"
                  : department === "Asbestos & HAZMAT"
                  ? "#2e7d32"
                  : department === "Occupational Hygiene"
                  ? "#ed6c02"
                  : "#9c27b0",
              borderColor:
                department === "Asbestos & HAZMAT"
                  ? "#2e7d32"
                  : department === "Occupational Hygiene"
                  ? "#ed6c02"
                  : "#9c27b0",
              "&:hover": {
                backgroundColor:
                  department === "Asbestos & HAZMAT"
                    ? "#2e7d32"
                    : department === "Occupational Hygiene"
                    ? "#ed6c02"
                    : "#9c27b0",
                color: "#fff",
              },
            }}
          >
            {department}
          </Button>
        ))}
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box
        m="40px 0 0 0"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: `1px solid ${theme.palette.divider}`,
            color: "#000000",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.main,
            borderBottom: "none",
            color: "#FFFFFF",
          },
          "& .MuiDataGrid-columnHeader": {
            color: "#FFFFFF",
            fontWeight: 600,
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: "#FFFFFF",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: theme.palette.primary.main,
            color: "#FFFFFF",
          },
          "& .MuiCheckbox-root": {
            color: `${theme.palette.secondary.main} !important`,
          },
        }}
      >
        <DataGrid
          rows={projects}
          columns={columns}
          getRowId={(row) => row._id || row.id}
          loading={loading && !searchLoading}
          error={error}
          checkboxSelection
          disableRowSelectionOnClick
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={handleColumnVisibilityModelChange}
          paginationMode="server"
          rowCount={pagination.total}
          paginationModel={paginationModel}
          onPaginationModelChange={(newModel) => {
            setPaginationModel(newModel);
            fetchProjectsWithPagination(newModel);
          }}
          pageSizeOptions={[25, 50, 100]}
          onSortModelChange={handleSortModelChange}
          sortModel={filters.sortModel}
          autoHeight
          disableColumnMenu={false}
          disableSelectionOnClick
          disableColumnFilter={false}
          disableMultipleColumnsFiltering={true}
          disableColumnSelector={false}
          disableDensitySelector={false}
          disableColumnReorder={false}
          disableMultipleColumnsSorting={true}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 50, page: 0 },
            },
          }}
          sx={{
            "& .MuiDataGrid-row:nth-of-type(even)": {
              backgroundColor: "#f8f9fa",
            },
            "& .MuiDataGrid-row:nth-of-type(odd)": {
              backgroundColor: "#ffffff",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "#e3f2fd",
            },
          }}
        />
      </Box>
      {/* Project Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setForm(emptyForm);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedProject ? "Edit Project" : "Add New Project"}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Project ID"
                    value={
                      form.isLargeProject
                        ? generateHazProjectId(projects)
                        : "Will be auto-generated"
                    }
                    disabled
                    fullWidth
                    sx={{
                      "& .MuiInputBase-input.Mui-disabled": {
                        WebkitTextFillColor: form.isLargeProject
                          ? "#000"
                          : "#666",
                        fontStyle: form.isLargeProject ? "normal" : "italic",
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.isLargeProject || false}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            isLargeProject: e.target.checked,
                          }));
                        }}
                        color="primary"
                      />
                    }
                    label="Large Project (HAZ prefix)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Project Name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box>
                    <Autocomplete
                      options={clients}
                      getOptionLabel={(option) => option.name || ""}
                      value={
                        clients.find((client) => client._id === form.client) ||
                        null
                      }
                      onChange={handleClientChange}
                      inputValue={clientInputValue}
                      onInputChange={(event, newInputValue) =>
                        setClientInputValue(newInputValue)
                      }
                      filterOptions={(options, { inputValue }) => {
                        if (inputValue.length < 3) return [];
                        const filterValue = inputValue.toLowerCase();
                        return options.filter((option) =>
                          option.name.toLowerCase().includes(filterValue)
                        );
                      }}
                      includeInputInList
                      filterSelectedOptions
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Client"
                          required
                          fullWidth
                          helperText={
                            clientInputValue.length < 3
                              ? "Type at least 3 characters to search clients"
                              : ""
                          }
                        />
                      )}
                      isOptionEqualToValue={(option, value) =>
                        option._id === value._id
                      }
                    />
                    <Button
                      startIcon={<AddIcon />}
                      onClick={() => setClientDialogOpen(true)}
                      sx={{ mt: 1 }}
                    >
                      Add New Client
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Department</InputLabel>
                    <Select
                      name="department"
                      value={form.department}
                      onChange={handleChange}
                      label="Department"
                    >
                      {DEPARTMENTS.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
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
                        value.map((option, index) => (
                          <Chip label={option} {...getTagProps({ index })} />
                        ))
                      }
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    {safeRenderStatusSelect(form.status, handleChange)}
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    freeSolo
                    options={addressOptions}
                    getOptionLabel={(option) =>
                      typeof option === "string" ? option : option.description
                    }
                    inputValue={addressInput}
                    onInputChange={(_, value) =>
                      handleAddressInputChange(value)
                    }
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
                <Grid item xs={12}>
                  <TextField
                    label="Due Date"
                    name="d_Date"
                    type="date"
                    value={form.d_Date || ""}
                    onChange={handleChange}
                    fullWidth
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Work Order/Job Reference"
                    name="workOrder"
                    value={form.workOrder}
                    onChange={handleChange}
                    fullWidth
                    variant="outlined"
                    size="small"
                    placeholder="Enter work order or job reference number"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="Enter any additional notes about the project"
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
                        label="Users (Optional)"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the project "{selectedProject?.name}
            "? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteProject}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      {/* New Client Dialog */}
      <Dialog
        open={clientDialogOpen}
        onClose={() => setClientDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Client</DialogTitle>
        <form onSubmit={handleNewClientSubmit}>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Client Name"
                    name="name"
                    value={newClient.name}
                    onChange={(e) =>
                      setNewClient({ ...newClient, name: e.target.value })
                    }
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Email"
                    name="email"
                    value={newClient.email}
                    onChange={(e) =>
                      setNewClient({ ...newClient, email: e.target.value })
                    }
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Phone"
                    name="phone"
                    value={newClient.phone}
                    onChange={(e) =>
                      setNewClient({ ...newClient, phone: e.target.value })
                    }
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Address"
                    name="address"
                    value={newClient.address}
                    onChange={(e) =>
                      setNewClient({ ...newClient, address: e.target.value })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Invoice Email"
                    name="invoiceEmail"
                    value={newClient.invoiceEmail}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        invoiceEmail: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                    Primary Contact
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Name"
                    name="contact1Name"
                    value={newClient.contact1Name}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact1Name: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Phone"
                    name="contact1Number"
                    value={newClient.contact1Number}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact1Number: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Email"
                    name="contact1Email"
                    value={newClient.contact1Email}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact1Email: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                    Secondary Contact (Optional)
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Name"
                    name="contact2Name"
                    value={newClient.contact2Name}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact2Name: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Phone"
                    name="contact2Number"
                    value={newClient.contact2Number}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact2Number: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Email"
                    name="contact2Email"
                    value={newClient.contact2Email}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact2Email: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClientDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Add Client
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Projects;
