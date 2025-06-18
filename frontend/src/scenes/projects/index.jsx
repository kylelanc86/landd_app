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
import { colors } from "../../theme";
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
  workOrder: "",
  users: [],
  status: ACTIVE_STATUSES[0],
  notes: "",
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
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Helper to get a color for a given status
const getStatusColor = (status) => {
  switch (status) {
    case "Assigned":
      return "#2196f3"; // Blue
    case "In progress":
      return "#ff9800"; // Orange
    case "Samples submitted":
      return "#9c27b0"; // Purple
    case "Lab Analysis Complete":
      return "#4caf50"; // Green
    case "Report sent for review":
      return "#f44336"; // Red
    case "Ready for invoicing":
      return "#795548"; // Brown
    case "Invoice sent":
      return "#607d8b"; // Blue Grey
    case "Job complete":
      return "#4caf50"; // Green
    case "On hold":
      return "#ffeb3b"; // Yellow
    case "Quote sent":
      return "#00bcd4"; // Cyan
    case "Cancelled":
      return "#f44336"; // Red
    default:
      return "#bdbdbd"; // Grey
  }
};

// Main Projects component
const Projects = () => {
  const theme = useTheme();
  const colors = tokens;
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
  const [activeFilter, setActiveFilter] = useState("active");
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
    status: true,
    department: true,
    users: true,
    createdAt: true,
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

  // Start page load monitoring only on initial load
  useEffect(() => {
    if (isInitialLoadRef.current) {
      pageLoadTimerRef.current =
        performanceMonitor.startPageLoad("projects-page");
      isInitialLoadRef.current = false;
    }

    // Cleanup function to handle navigation
    return () => {
      if (pageLoadTimerRef.current) {
        performanceMonitor.endPageLoad("projects-page");
        pageLoadTimerRef.current = null;
      }
    };
  }, []);

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
      activeFilter: "active",
      sortModel: [{ field: "projectID", sort: "desc" }],
    };

    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        return {
          ...defaultFilters,
          ...parsedFilters,
          // Override with URL parameters if they exist
          searchTerm: urlParams.get("search") || parsedFilters.searchTerm || "",
          departmentFilter:
            urlParams.get("department") ||
            parsedFilters.departmentFilter ||
            "all",
          statusFilter:
            urlParams.get("status") || parsedFilters.statusFilter || "all",
          activeFilter:
            urlParams.get("active") || parsedFilters.activeFilter || "active",
        };
      } catch (error) {
        console.error("Error parsing saved filters:", error);
        return defaultFilters;
      }
    }

    // Use URL parameters if no localStorage data
    return {
      ...defaultFilters,
      searchTerm: urlParams.get("search") || "",
      departmentFilter: urlParams.get("department") || "all",
      statusFilter: urlParams.get("status") || "all",
      activeFilter: urlParams.get("active") || "active",
    };
  });

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
    if (newFilters.activeFilter !== "active") {
      urlParams.set("active", newFilters.activeFilter);
    } else {
      urlParams.delete("active");
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
      setFilters((prev) => {
        const newFilters = {
          ...prev,
          [filterType]: value,
        };
        // Save filters whenever they change
        saveFilters(newFilters);
        return newFilters;
      });
    },
    [saveFilters]
  );

  // Separate function to fetch projects with a specific search term
  const fetchProjectsWithSearch = useCallback(
    async (searchValue, isSearch = false) => {
      try {
        performanceMonitor.startTimer("fetch-projects");

        // Use searchLoading for searches, main loading for initial load
        if (isSearch) {
          setSearchLoading(true);
        } else {
          setLoading(true);
        }

        const params = {
          page: paginationModel.page + 1, // Convert to 1-based index
          limit: paginationModel.pageSize,
          sortBy: filters.sortModel[0]?.field || "createdAt",
          sortOrder: filters.sortModel[0]?.sort || "desc",
        };

        // Add search term if provided
        if (searchValue) {
          params.search = searchValue;
        }

        if (filters.departmentFilter !== "all")
          params.department = filters.departmentFilter;

        // Handle status filters
        if (filters.activeFilter !== "all") {
          // If active filter is set, use the appropriate status array
          const statusArray =
            filters.activeFilter === "active"
              ? ACTIVE_STATUSES
              : INACTIVE_STATUSES;
          params.status = statusArray.join(","); // Convert array to comma-separated string
        } else if (filters.statusFilter !== "all") {
          // If specific status is selected, use that
          params.status = filters.statusFilter;
        }

        const response = await projectService.getAll(params);

        // Handle both response structures
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        setProjects(projectsData);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination?.total || 0,
          pages: response.pagination?.pages || 0,
        }));
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err.message);
        setProjects([]);
      } finally {
        if (isSearch) {
          setSearchLoading(false);
        } else {
          setLoading(false);
        }
        performanceMonitor.endTimer("fetch-projects");
      }
    },
    [filters, paginationModel]
  );

  // Create a new function that accepts pagination model as parameter
  const fetchProjectsWithPagination = useCallback(
    async (
      paginationModelParam,
      searchValue = filters.searchTerm,
      isSearch = false
    ) => {
      try {
        performanceMonitor.startTimer("fetch-projects");

        // Use searchLoading for searches, main loading for initial load
        if (isSearch) {
          setSearchLoading(true);
        } else {
          setLoading(true);
        }

        const params = {
          page: paginationModelParam.page + 1, // Convert to 1-based index
          limit: paginationModelParam.pageSize,
          sortBy: filters.sortModel[0]?.field || "createdAt",
          sortOrder: filters.sortModel[0]?.sort || "desc",
        };

        // Add search term if provided
        if (searchValue) {
          params.search = searchValue;
        }

        if (filters.departmentFilter !== "all")
          params.department = filters.departmentFilter;

        // Handle status filters
        if (filters.activeFilter !== "all") {
          // If active filter is set, use the appropriate status array
          const statusArray =
            filters.activeFilter === "active"
              ? ACTIVE_STATUSES
              : INACTIVE_STATUSES;
          params.status = statusArray.join(","); // Convert array to comma-separated string
        } else if (filters.statusFilter !== "all") {
          // If specific status is selected, use that
          params.status = filters.statusFilter;
        }

        const response = await projectService.getAll(params);

        // Handle both response structures
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        setProjects(projectsData);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination?.total || 0,
          pages: response.pagination?.pages || 0,
        }));
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err.message);
        setProjects([]);
      } finally {
        if (isSearch) {
          setSearchLoading(false);
        } else {
          setLoading(false);
        }
        performanceMonitor.endTimer("fetch-projects");
      }
    },
    [filters]
  );

  // Move fetchProjects here so it is defined after fetchProjectsWithSearch
  const fetchProjects = useCallback(
    async (isSearch = false) => {
      // Use the new function with the current search term from filters
      return fetchProjectsWithSearch(filters.searchTerm, isSearch);
    },
    [filters.searchTerm, fetchProjectsWithSearch]
  );

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      // Use the new function with reset pagination
      fetchProjectsWithPagination(
        { page: 0, pageSize: paginationModel.pageSize },
        value,
        true
      );
    }, 150), // Reduced from 300ms to 150ms for better responsiveness
    [fetchProjectsWithPagination, paginationModel.pageSize]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (filterType, value) => {
      // Create a new function to fetch with current filter values
      const fetchWithFilters = async () => {
        try {
          performanceMonitor.startTimer("fetch-projects");
          setSearchLoading(true);

          const params = {
            page: 1, // Reset to first page
            limit: paginationModel.pageSize,
            sortBy: filters.sortModel[0]?.field || "createdAt",
            sortOrder: filters.sortModel[0]?.sort || "desc",
          };

          // Add search term if provided
          if (filters.searchTerm) {
            params.search = filters.searchTerm;
          }

          // Add department filter
          if (filters.departmentFilter !== "all") {
            params.department = filters.departmentFilter;
          }

          // Handle status filters based on the filter type being changed
          if (filterType === "active") {
            // If active filter is being changed, use the new value
            if (value !== "all") {
              const statusArray =
                value === "active" ? ACTIVE_STATUSES : INACTIVE_STATUSES;
              params.status = statusArray.join(",");
            }
          } else if (filterType === "status") {
            // If status filter is being changed, use the new value
            if (value !== "all") {
              params.status = value;
            }
          } else {
            // For other filter types, use current filter values
            if (filters.activeFilter !== "all") {
              const statusArray =
                filters.activeFilter === "active"
                  ? ACTIVE_STATUSES
                  : INACTIVE_STATUSES;
              params.status = statusArray.join(",");
            } else if (filters.statusFilter !== "all") {
              params.status = filters.statusFilter;
            }
          }

          const response = await projectService.getAll(params);

          const projectsData = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];

          setProjects(projectsData);
          setPagination((prev) => ({
            ...prev,
            total: response.pagination?.total || 0,
            pages: response.pagination?.pages || 0,
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
          // Reset active filter when specific status is selected
          updateFilter("activeFilter", "all");
          break;
        case "active":
          updateFilter("activeFilter", value);
          // Reset status filter when active/inactive is selected to avoid invalid selections
          updateFilter("statusFilter", "all");
          break;
        default:
          break;
      }

      setPaginationModel((prev) => ({ ...prev, page: 0 }));

      // Use the new function with reset pagination
      fetchProjectsWithPagination({
        page: 0,
        pageSize: paginationModel.pageSize,
      });
    },
    [updateFilter, filters, paginationModel, fetchProjectsWithPagination]
  );

  // Function to clear all filters
  const clearFilters = useCallback(() => {
    const defaultFilters = {
      searchTerm: "",
      departmentFilter: "all",
      statusFilter: "all",
      activeFilter: "active",
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
      status: true,
      department: true,
      users: true,
      createdAt: true,
      updatedAt: false,
    };
    setColumnVisibilityModel(defaultColumnVisibility);

    // Trigger fetch with cleared filters
    fetchProjectsWithPagination(
      { page: 0, pageSize: paginationModel.pageSize },
      "",
      false
    );
  }, [fetchProjectsWithPagination, paginationModel.pageSize]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (event) => {
      const value = event.target.value;
      // Immediately update the search term in state for better UX
      updateFilter("searchTerm", value);
      // Then trigger the debounced search
      debouncedSearch(value);
    },
    [debouncedSearch, updateFilter]
  );

  // Fetch projects when pagination changes only
  useEffect(() => {
    // Removed automatic fetch to prevent double API calls
    // All fetches are now triggered manually in search and filter handlers
  }, [paginationModel]);

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
        setClients(clientsResponse.data);
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
    console.log("Rendering users select with:", { value, users });

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
    console.log("Department filter clicked:", department);
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
        if (tempFilters.activeFilter !== "all") {
          const statusArray =
            tempFilters.activeFilter === "active"
              ? ACTIVE_STATUSES
              : INACTIVE_STATUSES;
          params.status = statusArray.join(",");
        } else if (tempFilters.statusFilter !== "all") {
          params.status = tempFilters.statusFilter;
        }

        const response = await projectService.getAll(params);

        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        setProjects(projectsData);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination?.total || 0,
          pages: response.pagination?.pages || 0,
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
        minWidth: 300,
        renderCell: ({ row }) => (
          <Box
            onClick={() => navigate(`/projects/${row._id}`)}
            sx={{
              cursor: "pointer",
              "&:hover": { color: colors.blueAccent[500] },
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
        renderCell: ({ row }) => (
          <span>{row.client?.name || row.client || ""}</span>
        ),
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
        width: 165,
        minWidth: 165,
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
        width: 120,
        minWidth: 120,
        maxWidth: 120,
        renderCell: (params) => <UsersCell users={params.row.users} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        flex: 1,
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

  return (
    <Box m="20px 0px 20px 20px">
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

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="PROJECTS" subtitle="Managing your projects" />
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.secondary.main,
            "&:hover": { backgroundColor: theme.palette.secondary.dark },
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          Add Project
        </Button>
      </Box>

      {/* Search and Filter Section */}
      <Box
        mt="20px"
        mb="20px"
        sx={{
          backgroundColor: "background.paper",
          borderRadius: "4px",
          boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
          p: 2,
        }}
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
            <InputLabel>Active Status</InputLabel>
            <Select
              value={filters.activeFilter}
              label="Active Status"
              onChange={(e) => handleFilterChange("active", e.target.value)}
            >
              <MenuItem value="all">All Projects</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.statusFilter}
              label="Status"
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="unknown">Unknown Status (Debug)</MenuItem>
              {filters.activeFilter === "active" && (
                <>
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
                </>
              )}
              {filters.activeFilter === "inactive" && (
                <>
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
                </>
              )}
              {filters.activeFilter === "all" && (
                <>
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
                </>
              )}
            </Select>
          </FormControl>

          {/* Clear Filters Button */}
          <Button
            variant="outlined"
            size="small"
            onClick={clearFilters}
            sx={{
              height: 40, // Match the height of other components
              minWidth: 120,
            }}
          >
            Clear Filters
          </Button>

          {/* Column Visibility Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<ViewColumnIcon />}
            onClick={handleColumnVisibilityClick}
            sx={{
              height: 40, // Match the height of other components
              minWidth: 140,
              color: colors.blueAccent[500],
              borderColor: colors.blueAccent[500],
              "&:hover": {
                backgroundColor: colors.blueAccent[500],
                color: "white",
                borderColor: colors.blueAccent[500],
              },
            }}
          >
            Columns
          </Button>
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
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.dark,
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.background.default,
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: theme.palette.primary.dark,
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
          onPaginationModelChange={handlePaginationModelChange}
          pageSizeOptions={[25, 50, 100]}
          onSortModelChange={handleSortModelChange}
          sortModel={filters.sortModel}
          autoHeight
          disableColumnMenu={true}
          disableSelectionOnClick
          disableColumnFilter={true}
          disableMultipleColumnsFiltering={true}
          disableColumnSelector={true}
          disableDensitySelector
          disableColumnReorder
          disableMultipleColumnsSorting
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
                    value="Will be auto-generated"
                    disabled
                    fullWidth
                    sx={{
                      "& .MuiInputBase-input.Mui-disabled": {
                        WebkitTextFillColor: "#666",
                        fontStyle: "italic",
                      },
                    }}
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
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Client"
                          required
                          fullWidth
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
                  <TextField
                    label="Address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    fullWidth
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
