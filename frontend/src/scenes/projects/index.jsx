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
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { projectService, clientService, userService } from "../../services/api";
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
  department: PROJECT_TYPES[0],
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
    useJobStatus();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [columnVisibilityModel, setColumnVisibilityModel] = useState(() => {
    try {
      const savedVisibility = localStorage.getItem("projectsColumnVisibility");
      return savedVisibility ? JSON.parse(savedVisibility) : {};
    } catch (error) {
      console.error("Error loading column visibility:", error);
      return {};
    }
  });
  const [showInactive, setShowInactive] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 50,
    page: 0,
  });

  // Use refs to track component state
  const isInitialLoadRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const pageLoadTimerRef = useRef(null);
  const renderStartTimeRef = useRef(null);

  // Start page load monitoring only on initial mount
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

  const fetchProjects = useCallback(async () => {
    try {
      performanceMonitor.startTimer("fetch-projects");
      setLoading(true);

      const params = {
        page: paginationModel.page + 1, // Convert to 1-based index
        limit: paginationModel.pageSize,
        sortBy: sortModel[0]?.field || "createdAt",
        sortOrder: sortModel[0]?.sort || "desc",
      };

      // Add filters if they're not set to 'all'
      if (searchTerm) params.search = searchTerm;
      if (departmentFilter !== "all") params.department = departmentFilter;

      // Handle status filters
      if (activeFilter !== "all") {
        // If active filter is set, use the appropriate status array
        const statusArray =
          activeFilter === "active" ? ACTIVE_STATUSES : INACTIVE_STATUSES;
        params.status = statusArray.join(","); // Convert array to comma-separated string
        console.log("Using status array:", statusArray);
      } else if (statusFilter !== "all") {
        // If specific status is selected, use that
        params.status = statusFilter;
        console.log("Using single status:", params.status);
      }

      console.log("Fetching projects with params:", params);
      const response = await projectService.getAll(params);
      console.log("API Response:", response);

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
      setLoading(false);
      performanceMonitor.endTimer("fetch-projects");
    }
  }, [
    paginationModel,
    searchTerm,
    departmentFilter,
    statusFilter,
    activeFilter,
    sortModel,
  ]);

  // Handle pagination model change
  const handlePaginationModelChange = useCallback((newModel) => {
    console.log("Pagination model changed:", newModel);
    setPaginationModel(newModel);
  }, []);

  // Fetch projects when filters or pagination change
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback(
    (newPageSize) => {
      console.log("Page size changed to:", newPageSize);
      setPagination((prev) => ({
        ...prev,
        limit: newPageSize,
        page: 1, // Reset to first page when changing page size
      }));
      // Force a fetch with the new page size
      fetchProjects();
    },
    [fetchProjects]
  );

  // Handle sort change
  const handleSortModelChange = useCallback((newSortModel) => {
    setSortModel(newSortModel);
  }, []);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300),
    []
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (event) => {
      debouncedSearch(event.target.value);
    },
    [debouncedSearch]
  );

  // Handle filter changes
  const handleFilterChange = useCallback((filterType, value) => {
    console.log("Filter changed:", filterType, value);
    switch (filterType) {
      case "department":
        setDepartmentFilter(value);
        break;
      case "status":
        setStatusFilter(value);
        // Reset active filter when specific status is selected
        setActiveFilter("all");
        break;
      case "active":
        setActiveFilter(value);
        // Reset status filter when active/inactive is selected
        setStatusFilter("all");
        break;
      default:
        break;
    }
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

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

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await projectService.update(selectedProject.id, form);
      setProjects(
        projects.map((p) => (p.id === selectedProject.id ? response.data : p))
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
      const response = await projectService.create(form);
      setProjects([...projects, response.data]);
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (error) {
      console.error("Error creating project:", error);
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
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const response = await projectService.update(projectId, {
        ...project,
        status: newStatus,
      });

      setProjects(
        projects.map((p) => (p.id === projectId ? response.data : p))
      );
    } catch (error) {
      console.error("Error updating project status:", error);
      setError("Failed to update project status");
    }
  };

  const handleRemoveUser = async (projectId, userId) => {
    try {
      const project = projects.find((p) => p.id === projectId);
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
        projects.map((p) => (p.id === projectId ? response.data : p))
      );
    } catch (error) {
      console.error("Error removing user:", error);
      setError("Failed to remove user from project");
    }
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.delete(selectedProject.id);
      setProjects(projects.filter((p) => p.id !== selectedProject.id));
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      setError("Failed to delete project");
    }
  };

  // UsersCell component for rendering user avatars
  const UsersCell = ({ users }) => {
    if (!users || users.length === 0) {
      return (
        <Typography variant="body2" color="textSecondary">
          No users assigned
        </Typography>
      );
    }

    return (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {users.map((user, idx) => (
          <Tooltip
            key={user._id || idx}
            title={`${user.firstName} ${user.lastName}`}
          >
            <Avatar sx={{ width: 24, height: 24, fontSize: "0.75rem" }}>
              {user.firstName?.[0]}
              {user.lastName?.[0]}
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

  const handleDepartmentClick = (department) => {
    console.log("Department filter clicked:", department);
    setSelectedDepartment(department);
  };

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

  if (loading) return <Typography>Loading projects...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px 0px 20px 20px">
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
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <MenuItem value="all">All Statuses</MenuItem>
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
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Active Status</InputLabel>
            <Select
              value={activeFilter}
              label="Active Status"
              onChange={(e) => handleFilterChange("active", e.target.value)}
            >
              <MenuItem value="all">All Projects</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

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
          components={{
            Toolbar: GridToolbar,
          }}
          componentsProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}
          loading={loading}
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
          sortModel={sortModel}
          autoHeight
          disableColumnMenu
          disableSelectionOnClick
          disableColumnFilter
          disableColumnSelector
          disableDensitySelector
          disableColumnReorder
          disableMultipleColumnsFiltering
          disableMultipleColumnsSorting
          disableMultipleSelection
          disableExtendRowFullWidth
          disableVirtualization={false}
          rowBuffer={10}
          rowThreshold={100}
          columnBuffer={2}
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
                    {renderStatusSelect(form.status, handleChange)}
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
    </Box>
  );
};

export default Projects;
