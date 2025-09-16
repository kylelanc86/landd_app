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
  IconButton,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  Divider,
  Checkbox,
  ListItemButton,
  ListItemText,
  InputAdornment,
  Alert,
  LinearProgress,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  Tooltip,
  Avatar,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import { StatusChip } from "../../components/JobStatus";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useTheme } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  projectService,
  clientService,
  userService,
  userPreferencesService,
} from "../../services/api";
import { useJobStatus } from "../../hooks/useJobStatus";
import SearchIcon from "@mui/icons-material/Search";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../context/AuthContext";
import { Visibility, Visibility as VisibilityIcon } from "@mui/icons-material";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import AddIcon from "@mui/icons-material/Add";

import { debounce } from "lodash";

const DEPARTMENTS = [
  "Asbestos & HAZMAT",
  "Occupational Hygiene",
  "Client Supplied",
];

// This will be defined inside the component to access the hook

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
  const { isAdmin, isManager, can } = usePermissions();
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get project statuses from custom data fields
  const {
    activeStatuses,
    inactiveStatuses,
    statusColors,
    loading: statusesLoading,
  } = useProjectStatuses();

  // Debug logging for status colors
  useEffect(() => {
    if (statusColors && Object.keys(statusColors).length > 0) {
    } else {
    }
  }, [statusColors]);

  // Memoize unique statuses to prevent recalculation on every render
  const uniqueStatuses = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    return [...new Set(projects.map((p) => p.status))];
  }, [projects]);

  // Debug logging for projects to see what status values exist
  useEffect(() => {
    if (projects && projects.length > 0) {
      // Check which statuses have matching colors
      if (statusColors) {
      }
    }
  }, [projects, statusColors, uniqueStatuses]);

  // Helper to get a color for a given status - memoized to prevent recreation
  const getStatusColor = useCallback(
    (status) => {
      // Use custom colors from the database if available
      if (statusColors && statusColors[status]) {
        return statusColors[status];
      }

      // Fallback to hardcoded colors for backward compatibility
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
          return "#1976d2"; // Default Material-UI primary blue
      }
    },
    [statusColors]
  );

  // Memoized status color cache to avoid recalculating colors for the same status
  const statusColorCache = useMemo(() => {
    const cache = new Map();
    return (status) => {
      if (cache.has(status)) {
        return cache.get(status);
      }
      const color = getStatusColor(status);
      cache.set(status, color);
      return color;
    };
  }, [getStatusColor]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [dependencyInfo, setDependencyInfo] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 0,
  });

  const [columnVisibilityModel, setColumnVisibilityModel] = useState({
    projectID: true,
    name: true,
    d_Date: true,
    status: true,
    department: false, // Hide department column by default
    workOrder: false, // Hide work order column by default
    users: true,
    createdAt: false, // Hide by default
    updatedAt: false,
  });

  // Memoize column visibility model to prevent unnecessary re-renders
  const memoizedColumnVisibilityModel = useMemo(
    () => columnVisibilityModel,
    [columnVisibilityModel]
  );
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
      } catch (error) {}
    }
    return "All";
  });
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 50,
    page: 0,
  });

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

    // Apply initial filters from props
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

  // Memoize filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(
    () => filters,
    [
      filters.searchTerm,
      filters.departmentFilter,
      filters.statusFilter,
      filters.sortModel,
    ]
  );

  // Add state for column visibility dropdown
  const [columnVisibilityAnchor, setColumnVisibilityAnchor] = useState(null);

  // Add ref to track current search term to prevent unnecessary API calls
  const searchTermRef = useRef(filters.searchTerm);
  searchTermRef.current = filters.searchTerm;

  // Add ref to track search input focus
  const searchInputRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const [clientInputValue, setClientInputValue] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [isClientSearching, setIsClientSearching] = useState(false);

  // Editable status state
  const [statusDropdownAnchor, setStatusDropdownAnchor] = useState(null);

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

  // Function to fetch all projects (for client-side sorting and pagination)
  const fetchAllProjects = useCallback(
    async (
      searchValue = filtersRef.current.searchTerm,
      isSearch = false,
      currentFilters = null
    ) => {
      const fetchStartTime = performance.now();

      // Use current filters state if currentFilters is null (for search operations)
      const filtersToUse = currentFilters || filtersRef.current;
      try {
        if (isSearch) {
          setSearchLoading(true);
        } else {
          setLoading(true);
        }

        const params = {
          page: 1,
          limit: 50000, // Large limit to load all projects for status filtering
          sortBy: filtersToUse.sortModel[0]?.field || "createdAt",
          sortOrder: filtersToUse.sortModel[0]?.sort || "desc",
        };

        // Add search term if provided
        if (searchValue) {
          params.search = searchValue;
        }

        // Add department filter
        if (filtersToUse.departmentFilter !== "all") {
          params.department = filtersToUse.departmentFilter;
        }

        // Note: Status filtering is handled client-side, not on the backend

        const apiStartTime = performance.now();
        const response = await projectService.getAll(params);
        const apiEndTime = performance.now();

        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        const processingEndTime = performance.now();

        setProjects(projectsData);
        setPagination({
          total: projectsData.length,
          pages: Math.ceil(projectsData.length / paginationModel.pageSize),
          page: 0,
          limit: paginationModel.pageSize,
        });

        // Status counts will be updated when the component re-renders with new projects
      } catch (err) {
        setError(err.message);
        setProjects([]);
      } finally {
        setLoading(false);
        setSearchLoading(false);
      }
    },
    [] // Remove filters dependency since we now use ref to get current state
  );

  // Move fetchProjects here so it is defined after fetchAllProjects
  const fetchProjects = useCallback(
    async (isSearch = false) => {
      // Use fetchAllProjects with current pagination model
      return fetchAllProjects(
        filtersRef.current.searchTerm,
        isSearch,
        filtersRef.current
      );
    },
    [fetchAllProjects]
  );

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      // Use the new function with reset pagination
      fetchAllProjects(
        value,
        true,
        null // Pass null to use current filters state inside fetchAllProjects
      );
    }, 150), // Reduced from 300ms to 150ms for better responsiveness
    [fetchAllProjects]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (filterType, value) => {
      // Create a new function to fetch with updated filter values
      const fetchWithUpdatedFilters = async () => {
        try {
          setSearchLoading(true);

          // Create updated filters object with the new value
          const updatedFilters = { ...memoizedFilters };
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
            limit: 50000, // Load all projects for proper filtering
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

          // Note: Status filtering is handled client-side, not on the backend

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

          // Status counts will be updated when the component re-renders with new projects
        } catch (err) {
          setError(err.message);
          setProjects([]);
        } finally {
          setSearchLoading(false);
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
    [updateFilter, memoizedFilters, paginationModel.pageSize]
  );

  // Function to fetch status counts for ALL projects (not just current page)
  const fetchStatusCounts = useCallback(async () => {
    try {
      // Use the new efficient status counts endpoint
      const response = await projectService.getStatusCounts();
      const statusCounts = response.data?.statusCounts || {};

      // Calculate active and inactive totals
      let all_active = 0;
      let all_inactive = 0;

      for (const status of activeStatuses) {
        all_active += statusCounts[status] || 0;
      }

      for (const status of inactiveStatuses) {
        all_inactive += statusCounts[status] || 0;
      }

      const counts = {
        ...statusCounts,
        all_active,
        all_inactive,
      };

      setStatusCounts(counts);
    } catch (err) {
      // Fallback to local calculation if backend fails
      const counts = {
        all: projects.length,
        all_active: projects.filter((project) =>
          activeStatuses.includes(project.status)
        ).length,
        all_inactive: projects.filter((project) =>
          inactiveStatuses.includes(project.status)
        ).length,
      };

      for (const status of activeStatuses) {
        counts[status] = projects.filter(
          (project) => project.status === status
        ).length;
      }

      for (const status of inactiveStatuses) {
        counts[status] = projects.filter(
          (project) => project.status === status
        ).length;
      }

      setStatusCounts(counts);
    }
  }, [activeStatuses, inactiveStatuses, projects]);

  // Memoize the status counts calculation to prevent unnecessary recalculations
  const memoizedStatusCounts = useMemo(() => {
    if (Object.keys(statusCounts).length === 0) return {};

    return statusCounts;
  }, [statusCounts]);

  // Function to refresh status counts when projects change (after filtering, searching, etc.)
  const refreshStatusCounts = useCallback(() => {
    if (activeStatuses.length > 0 || inactiveStatuses.length > 0) {
      fetchStatusCounts();
    }
  }, [activeStatuses, inactiveStatuses, fetchStatusCounts]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (event) => {
      const value = event.target.value;

      // Immediately update the search term in state for better UX
      updateFilter("searchTerm", value);

      // Then trigger the debounced search with the current value
      debouncedSearch(value);
    },
    [debouncedSearch, updateFilter]
  );

  // Memoize pagination model to prevent unnecessary re-renders
  const memoizedPaginationModel = useMemo(
    () => paginationModel,
    [paginationModel.page, paginationModel.pageSize]
  );

  // Fetch projects when pagination changes only
  useEffect(() => {
    // Removed automatic fetch to prevent double API calls
    // All fetches are now triggered manually in search and filter handlers
  }, [memoizedPaginationModel]);

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
        } catch (error) {}
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
        } catch (error) {}
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

  // Fetch clients and users when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only fetch clients if we need them for dropdowns/forms
        // Limit to first 100 clients to avoid performance issues
        const clientsResponse = await clientService.getAll({ limit: 100 });
        const clientsData =
          clientsResponse.data.clients || clientsResponse.data;
        setClients(clientsData);
      } catch (err) {}
    };
    fetchData();
  }, []);

  // Add useEffect to fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
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
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Initial fetch for projects when component mounts
  useEffect(() => {
    fetchProjects(false);
  }, []); // Empty dependency array for initial load only

  // Fetch status counts when component mounts and when statuses change
  useEffect(() => {
    if (activeStatuses.length > 0 || inactiveStatuses.length > 0) {
      fetchStatusCounts();
    }
  }, [fetchStatusCounts]);

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
      setClientSearchResults([]);
    } finally {
      setIsClientSearching(false);
    }
  };

  const handleDeleteProject = async () => {
    const deleteStartTime = performance.now();

    try {
      const projectId = selectedProject?._id || selectedProject?.id;
      if (!projectId) {
        setError("Cannot delete project: No project ID found");
        return;
      }

      // First check for dependencies
      let dependencyCheckTime = 0;
      try {
        const dependencyStartTime = performance.now();
        const dependencyResponse = await projectService.checkDependencies(
          projectId
        );
        dependencyCheckTime = performance.now() - dependencyStartTime;

        if (!dependencyResponse.data.canDelete) {
          // Has dependencies, show dependency dialog instead of deleting
          setDependencyInfo({
            project: selectedProject,
            dependencies: dependencyResponse.data.dependencies,
            message: dependencyResponse.data.message,
          });
          setDeleteDialogOpen(false);
          setDependencyDialogOpen(true);
          return;
        }
      } catch (dependencyError) {
        // Continue with deletion attempt - let the backend handle it
      }

      // Proceed with deletion
      const deleteApiStartTime = performance.now();
      const response = await projectService.delete(projectId);
      const deleteApiEndTime = performance.now();

      // Check if this was a permission denied response
      if (response.data?.permissionDenied) {
        // Permission denied - don't update the state, just close the dialog
        setDeleteDialogOpen(false);
        setSelectedProject(null);
        return;
      }

      // Success - update the state
      const deletedProject = projects.find(
        (p) => (p._id || p.id) === projectId
      );
      const updatedProjects = projects.filter(
        (p) => (p._id || p.id) !== projectId
      );
      setProjects(updatedProjects);

      // Update status counts locally instead of making API call
      if (deletedProject && deletedProject.status) {
        setStatusCounts((prevCounts) => {
          const newCounts = { ...prevCounts };
          if (newCounts[deletedProject.status] > 0) {
            newCounts[deletedProject.status] -= 1;
          }

          // Update active/inactive totals
          if (activeStatuses.includes(deletedProject.status)) {
            newCounts.all_active = Math.max(0, (newCounts.all_active || 0) - 1);
          } else if (inactiveStatuses.includes(deletedProject.status)) {
            newCounts.all_inactive = Math.max(
              0,
              (newCounts.all_inactive || 0) - 1
            );
          }

          return newCounts;
        });
      }

      setDeleteDialogOpen(false);
      setSelectedProject(null);
    } catch (error) {
      // Check if this is a dependency error (400 with dependencies)
      if (
        error.response?.status === 400 &&
        error.response?.data?.dependencies
      ) {
        setDependencyInfo({
          project: selectedProject,
          dependencies: error.response.data.dependencies,
          message: error.response.data.message,
        });
        setDeleteDialogOpen(false);
        setDependencyDialogOpen(true);
      } else {
        setError("Failed to delete project");
      }
    }
  };

  // Memoized UsersCell component for rendering user avatars
  const UsersCell = React.memo(({ users }) => {
    if (!users || users.length === 0) {
      return <span>-</span>;
    }

    return (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {users.map((user, index) => {
          return (
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
          );
        })}
      </Box>
    );
  });

  // Update the renderUsersSelect function

  // Handler for delete action - show dialog immediately, check dependencies on confirm
  const handleDeleteClick = (project) => {
    const dialogStartTime = performance.now();

    setSelectedProject(project);
    setDeleteDialogOpen(true); // Show dialog immediately

    // Log dialog open time
    requestAnimationFrame(() => {
      const dialogOpenTime = performance.now() - dialogStartTime;
    });
  };

  // Handler for export action
  const handleExportClick = () => {
    setExportDialogOpen(true);
  };

  const handleExportConfirm = () => {
    exportProjectsToCSV();
    setExportDialogOpen(false);
  };

  const handleExportCancel = () => {
    setExportDialogOpen(false);
  };

  // Function to export projects to CSV
  const exportProjectsToCSV = () => {
    if (!filteredProjects || filteredProjects.length === 0) {
      alert("No projects to export");
      return;
    }

    // Define CSV headers with all project fields
    const headers = [
      "Project ID",
      "Project Name",
      "Client",
      "Department",
      "Status",
      "Address",
      "Due Date",
      "Work Order/Job Reference",
      "Categories",
      "Description",
      "Notes",
      "Project Contact Name",
      "Project Contact Number",
      "Project Contact Email",
      "Assigned Users",
      "Is Large Project",
      "Reports Present",
      "Created Date",
      "Updated Date",
    ];

    // Helper function to format users array
    const formatUsers = (users) => {
      if (!users || !Array.isArray(users)) return "";
      return users
        .map((user) => {
          if (typeof user === "string") return user;
          if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`;
          }
          if (user.name) return user.name;
          return user.email || user._id || "";
        })
        .join("; ");
    };

    // Helper function to format categories array
    const formatCategories = (categories) => {
      if (!categories || !Array.isArray(categories)) return "";
      return categories.join("; ");
    };

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...filteredProjects.map((project) =>
        [
          `"${project.projectID || ""}"`,
          `"${project.name || ""}"`,
          `"${project.client?.name || project.client || ""}"`,
          `"${project.department || ""}"`,
          `"${project.status || ""}"`,
          `"${project.address || ""}"`,
          `"${
            project.d_Date ? new Date(project.d_Date).toLocaleDateString() : ""
          }"`,
          `"${project.workOrder || ""}"`,
          `"${formatCategories(project.categories)}"`,
          `"${project.description || ""}"`,
          `"${project.notes || ""}"`,
          `"${project.projectContact?.name || ""}"`,
          `"${project.projectContact?.number || ""}"`,
          `"${project.projectContact?.email || ""}"`,
          `"${formatUsers(project.users)}"`,
          `"${project.isLargeProject ? "Yes" : "No"}"`,
          `"${project.reports_present ? "Yes" : "No"}"`,
          `"${
            project.createdAt
              ? new Date(project.createdAt).toLocaleDateString()
              : ""
          }"`,
          `"${
            project.updatedAt
              ? new Date(project.updatedAt).toLocaleDateString()
              : ""
          }"`,
        ].join(",")
      ),
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `projects_export_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      // Fallback to localStorage if API fails
      localStorage.setItem(
        "projects-column-visibility",
        JSON.stringify(newModel)
      );
    }
  };

  const handleDepartmentClick = (department) => {
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
        setSearchLoading(true);

        const params = {
          page: 1, // Reset to first page
          limit: 50000, // Load all projects for proper filtering
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

        // Note: Status filtering is handled client-side, not on the backend

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
        setError(err.message);
        setProjects([]);
      } finally {
        setSearchLoading(false);
      }
    };

    // Execute the fetch immediately
    fetchWithUpdatedDepartment();
  };

  // Handle pagination model change
  const handlePaginationModelChange = useCallback((newModel) => {
    setPaginationModel(newModel);
    // No need to fetch again since we have all projects loaded
  }, []);

  // Function to determine which statuses a user can access
  const getAccessibleStatuses = () => {
    if (isAdmin || isManager || can("projects.change_status")) {
      // Filter out restricted statuses for employee users
      const restrictedStatuses = ["Cancelled"];

      // If user is employee (not admin or manager), filter out restricted statuses
      if (!isAdmin && !isManager) {
        let filteredActive = activeStatuses.filter(
          (status) => !restrictedStatuses.includes(status)
        );
        let filteredInactive = inactiveStatuses.filter(
          (status) => !restrictedStatuses.includes(status)
        );

        // Check if user can set "Job complete" status
        if (!currentUser.canSetJobComplete) {
          filteredActive = filteredActive.filter(
            (status) => status !== "Job complete"
          );
          filteredInactive = filteredInactive.filter(
            (status) => status !== "Job complete"
          );
        }

        return { active: filteredActive, inactive: filteredInactive };
      }

      // Admin and manager users can access all statuses
      return { active: activeStatuses, inactive: inactiveStatuses };
    }
    return { active: [], inactive: [] };
  };

  // Status editing handlers
  const handleStatusClick = (projectId, event) => {
    const dropdownOpenStartTime = performance.now();

    if (isAdmin || isManager || can("projects.change_status")) {
      // Store the project ID in the anchor element's dataset
      event.currentTarget.dataset.projectId = projectId;
      setStatusDropdownAnchor(event.currentTarget);

      const dropdownOpenTime = performance.now() - dropdownOpenStartTime;
    } else {
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    const statusChangeStartTime = performance.now();

    try {
      // Find the current project to preserve its users
      const currentProject = projects.find((p) => p._id === projectId);
      const updatePayload = {
        status: newStatus,
        // Preserve existing users to prevent them from being cleared
        users: currentProject?.users || [],
      };

      const apiStartTime = performance.now();
      const response = await projectService.update(projectId, updatePayload);
      const apiEndTime = performance.now();

      // Update the local state with the full updated project data from the API response
      const stateUpdateStartTime = performance.now();
      setProjects((prevProjects) =>
        prevProjects.map((project) =>
          project._id === projectId
            ? response.data // Use the full updated project data from the API response
            : project
        )
      );
      const stateUpdateTime = performance.now() - stateUpdateStartTime;

      // Refresh status counts after updating project status
      const statusCountsStartTime = performance.now();
      fetchStatusCounts();
      const statusCountsTime = performance.now() - statusCountsStartTime;

      // Close the dropdown
      setStatusDropdownAnchor(null);

      const totalTime = performance.now() - statusChangeStartTime;
    } catch (error) {
      const totalTime = performance.now() - statusChangeStartTime;

      // You might want to show an error message to the user here
    }
  };

  const handleStatusClose = () => {
    const dropdownCloseStartTime = performance.now();

    setStatusDropdownAnchor(null);

    const dropdownCloseTime = performance.now() - dropdownCloseStartTime;
  };

  // Load user preferences from database
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await userPreferencesService.getPreferences();
        if (response.data?.columnVisibility?.projects) {
          setColumnVisibilityModel(response.data.columnVisibility.projects);
        }
      } catch (error) {
        // Fallback to localStorage if API fails
        const savedColumnVisibility = localStorage.getItem(
          "projects-column-visibility"
        );
        if (savedColumnVisibility) {
          try {
            const parsed = JSON.parse(savedColumnVisibility);
            setColumnVisibilityModel(parsed);
          } catch (parseError) {}
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
        renderCell: (params) => <Box>{params.value}</Box>,
      },
      {
        field: "name",
        headerName: "Project",
        flex: 3,
        minWidth: 250,
        maxWidth: 500,
        renderCell: ({ row }) => {
          const clientName = row.client?.name || row.client || "";
          const projectName = row.name || "";
          const displayText = clientName
            ? `${clientName} - ${projectName}`
            : projectName;

          return (
            <Box
              sx={{
                whiteSpace: "normal",
                wordWrap: "break-word",
                lineHeight: 1.2,
                height: "100%",
                display: "flex",
                alignItems: "center",
                maxHeight: "2.4em", // 2 lines * 1.2 line height
                overflow: "hidden",
                width: "100%",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                  lineHeight: 1.2,
                  width: "100%",
                  color: "black",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {displayText}
              </Typography>
            </Box>
          );
        },
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
        field: "workOrder",
        headerName: "Work Order/Job Reference",
        flex: 1,
        minWidth: 150,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        minWidth: 60,
        maxWidth: 165,
        renderCell: (params) => (
          <Box sx={{ position: "relative", width: "100%", zIndex: 5 }}>
            {/* Status display - no click functionality */}
            <Box
              sx={{
                backgroundColor: statusColorCache(params.value),
                color: "white",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                userSelect: "none",
                position: "relative",
              }}
            >
              {params.value}
            </Box>
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
          // Debug logging to see what data we're getting

          // Safety check to ensure UsersCell component is available
          if (!UsersCell) {
            return <span>-</span>;
          }
          return <UsersCell users={params.row.users} />;
        },
      },
      {
        field: "actions",
        headerName: "Actions & Status",
        flex: 1,
        minWidth: 120,
        maxWidth: 160,
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            {/* Delete button - only show for admin and manager users */}
            {(isAdmin || isManager) && (
              <Tooltip title="Delete Project">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(params.row);
                  }}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* 3-dot menu for status updates */}
            {(isAdmin || isManager || can("projects.change_status")) && (
              <Tooltip title="Update Status">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusClick(params.row._id, e);
                  }}
                  size="small"
                  sx={{
                    color: "text.secondary",
                    "&:hover": {
                      backgroundColor: "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                >
                  <MoreHorizIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [navigate]
  );

  // Client-side filtering for live status updates
  const filteredProjects = useMemo(() => {
    console.log("Filtering projects:", {
      totalProjects: projects.length,
      statusFilter: filters.statusFilter,
      activeStatuses: activeStatuses,
      inactiveStatuses: inactiveStatuses,
    });

    if (filters.statusFilter === "all") {
      console.log("Showing all projects:", projects.length);
      return projects;
    }

    const filtered = projects.filter((project) => {
      const projectStatus = project.status;

      // Handle active/inactive filter categories
      if (filters.statusFilter === "all_active") {
        return activeStatuses.includes(projectStatus);
      }

      if (filters.statusFilter === "all_inactive") {
        return inactiveStatuses.includes(projectStatus);
      }

      // Handle specific status filters
      return projectStatus === filters.statusFilter;
    });

    console.log("Filtered projects:", {
      statusFilter: filters.statusFilter,
      filteredCount: filtered.length,
      totalCount: projects.length,
    });

    return filtered;
  }, [projects, filters.statusFilter, activeStatuses, inactiveStatuses]);

  // Show UI immediately, data will load in background
  if (error) return <Typography color="error">{error}</Typography>;

  // Ensure columns are properly defined before rendering
  if (!columns || columns.length === 0) {
    return <Typography>Loading columns...</Typography>;
  }

  return (
    <Box m="5px 0px 20px 20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Projects
      </Typography>
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
      {/* Add Project Buttons */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => {
            navigate("/projects/add-new");
          }}
          fullWidth
          sx={{
            height: 50,
            fontSize: "1.1rem",
            fontWeight: "500",
            border: "2px solid",
            py: 1.5,
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
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ flex: 1 }}
          >
            {/* Search Input */}
            <TextField
              label="Search Projects"
              variant="outlined"
              size="small"
              sx={{ flex: 1 }}
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
                <MenuItem value="all" sx={{ fontSize: "0.88rem" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        marginRight: "8px",
                      }}
                    >
                      All Statuses
                    </span>
                    <Box
                      sx={{
                        backgroundColor: "#666",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.77rem",
                        fontWeight: "bold",
                        minWidth: "20px",
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {statusCounts.all || 0}
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="all_active" sx={{ fontSize: "0.88rem" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        marginRight: "8px",
                      }}
                    >
                      Active
                    </span>
                    <Box
                      sx={{
                        backgroundColor: "#2e7d32",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.77rem",
                        fontWeight: "bold",
                        minWidth: "20px",
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {statusCounts.all_active || 0}
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="all_inactive" sx={{ fontSize: "0.88rem" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        marginRight: "8px",
                      }}
                    >
                      Inactive
                    </span>
                    <Box
                      sx={{
                        backgroundColor: "#666",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.77rem",
                        fontWeight: "bold",
                        minWidth: "20px",
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {statusCounts.all_inactive || 0}
                    </Box>
                  </Box>
                </MenuItem>
                <Divider />
                <MenuItem disabled>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ fontSize: "0.88rem" }}
                  >
                    Active Statuses
                  </Typography>
                </MenuItem>
                {activeStatuses.map((status) => {
                  const count = statusCounts[status] || 0;
                  return (
                    <MenuItem
                      key={status}
                      value={status}
                      sx={{ fontSize: "0.88rem" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            marginRight: "8px",
                          }}
                        >
                          {status}
                        </span>
                        <Box
                          sx={{
                            backgroundColor: statusColors[status] || "#1976d2",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "0.77rem",
                            fontWeight: "bold",
                            minWidth: "20px",
                            textAlign: "center",
                            flexShrink: 0,
                          }}
                        >
                          {count}
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })}
                <Divider />
                <MenuItem disabled>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ fontSize: "0.88rem" }}
                  >
                    Inactive Statuses
                  </Typography>
                </MenuItem>
                {inactiveStatuses.map((status) => {
                  const count = statusCounts[status] || 0;
                  return (
                    <MenuItem
                      key={status}
                      value={status}
                      sx={{ fontSize: "0.88rem" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            marginRight: "8px",
                          }}
                        >
                          {status}
                        </span>
                        <Box
                          sx={{
                            backgroundColor: statusColors[status] || "#1976d2",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "0.77rem",
                            fontWeight: "bold",
                            minWidth: "20px",
                            textAlign: "center",
                            flexShrink: 0,
                          }}
                        >
                          {count}
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })}
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

          {/* Export Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportClick}
            sx={{
              height: 40, // Match the height of other components
              minWidth: 140,
              backgroundColor: "#2e7d32",
              color: "white",
              borderColor: "#2e7d32",
              "&:hover": {
                backgroundColor: "#1b5e20",
                borderColor: "#1b5e20",
              },
            }}
          >
            Export to CSV
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
            "& .MuiTablePagination-root": {
              color: "#FFFFFF",
            },
            "& .MuiTablePagination-selectLabel": {
              color: "#FFFFFF",
            },
            "& .MuiTablePagination-displayedRows": {
              color: "#FFFFFF",
            },
            "& .MuiTablePagination-select": {
              color: "#FFFFFF",
            },
            "& .MuiTablePagination-actions": {
              color: "#FFFFFF",
            },
            "& .MuiIconButton-root": {
              color: "#FFFFFF",
            },
          },
          "& .MuiCheckbox-root": {
            color: `${theme.palette.secondary.main} !important`,
          },
        }}
      >
        <DataGrid
          rows={filteredProjects}
          sortingOrder={["desc", "asc"]}
          columns={columns}
          disableColumnUnsort={true}
          getRowId={(row) => row._id || row.id}
          loading={loading && !searchLoading}
          error={error}
          // checkboxSelection
          onRowClick={(params) => navigate(`/projects/${params.row._id}`)}
          columnVisibilityModel={memoizedColumnVisibilityModel}
          onColumnVisibilityModelChange={handleColumnVisibilityModelChange}
          paginationMode="client"
          sortingMode="client"
          paginationModel={paginationModel}
          onPaginationModelChange={(newModel) => {
            setPaginationModel(newModel);
          }}
          pageSizeOptions={[25, 50, 100]}
          autoHeight
          disableColumnMenu={false}
          disableSelectionOnClick
          disableColumnFilter={false}
          disableMultipleColumnsFiltering={true}
          disableColumnSelector={false}
          disableDensitySelector={false}
          // disableColumnReorder={false}
          // disableMultipleColumnsSorting={true}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 50, page: 0 },
            },
            sorting: {
              sortModel: [
                {
                  field: "projectID",
                  sort: "desc",
                },
              ],
            },
          }}
          sx={{
            cursor: "pointer",
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

      {/* Status Update Menu */}
      <Menu
        anchorEl={statusDropdownAnchor}
        open={Boolean(statusDropdownAnchor)}
        onClose={handleStatusClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        sx={{
          "& .MuiPaper-root": {
            minWidth: "220px",
            padding: "4px",
          },
          zIndex: 9999,
        }}
      >
        <MenuItem
          disabled
          sx={{ cursor: "default", padding: "8px 12px", minHeight: "auto" }}
        >
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ fontSize: "0.75rem" }}
          >
            Update Project Status
          </Typography>
        </MenuItem>

        <Divider sx={{ margin: "4px 0" }} />
        {(() => {
          const accessibleStatuses = getAccessibleStatuses();
          return (
            <>
              {accessibleStatuses.active.map((status) => (
                <MenuItem
                  key={status}
                  onClick={() =>
                    handleStatusChange(
                      statusDropdownAnchor?.dataset?.projectId,
                      status
                    )
                  }
                  sx={{
                    padding: "6px 12px",
                    minHeight: "36px",
                    justifyContent: "flex-start",
                    "&:hover": {
                      backgroundColor: "rgba(0, 0, 0, 0.04)",
                      transition: "all 0.15s ease",
                    },
                  }}
                >
                  <Box
                    sx={{
                      backgroundColor: statusColors[status],
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "16px",
                      fontSize: "0.67rem",
                      fontWeight: "400",
                      display: "inline-block",
                      whiteSpace: "nowrap",
                      "&:hover": {
                        opacity: 0.9,
                        transform: "scale(1.02)",
                        transition: "all 0.15s ease",
                      },
                    }}
                  >
                    {status}
                  </Box>
                </MenuItem>
              ))}
              <Divider sx={{ margin: "8px 0" }} />
              {accessibleStatuses.inactive.map((status) => (
                <MenuItem
                  key={status}
                  onClick={() =>
                    handleStatusChange(
                      statusDropdownAnchor?.dataset?.projectId,
                      status
                    )
                  }
                  sx={{
                    padding: "6px 12px",
                    minHeight: "36px",
                    justifyContent: "flex-start",
                    "&:hover": {
                      backgroundColor: "rgba(0, 0, 0, 0.04)",
                      transition: "all 0.15s ease",
                    },
                  }}
                >
                  <Box
                    sx={{
                      backgroundColor: getStatusColor(status),
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "16px",
                      fontSize: "0.67rem",
                      fontWeight: "400",
                      display: "inline-block",
                      whiteSpace: "nowrap",
                      "&:hover": {
                        opacity: 0.9,
                        transform: "scale(1.02)",
                        transition: "all 0.15s ease",
                      },
                    }}
                  >
                    {status}
                  </Box>
                </MenuItem>
              ))}
            </>
          );
        })()}
      </Menu>

      {/* Delete Confirmation Dialog */}
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
            "& .MuiDialogTitle-root": {
              border: "none",
            },
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
            <CloseIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Confirm Delete
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete the project "{selectedProject?.name}
            "? This action cannot be undone.
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
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dependency Error Dialog */}
      <Dialog
        open={dependencyDialogOpen}
        onClose={() => setDependencyDialogOpen(false)}
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
              bgcolor: "warning.main",
              color: "white",
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Cannot Delete Project
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary", mb: 2 }}>
            The project "{dependencyInfo?.project?.name}" cannot be deleted
            because it has linked records:
          </Typography>

          <Box
            sx={{
              bgcolor: "grey.50",
              borderRadius: 2,
              p: 2,
              mb: 2,
              border: "1px solid",
              borderColor: "grey.200",
            }}
          >
            {dependencyInfo?.dependencies && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {dependencyInfo.dependencies.invoices > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.invoices} Invoice
                      {dependencyInfo.dependencies.invoices !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.jobs > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "info.main",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.jobs} Job
                      {dependencyInfo.dependencies.jobs !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.asbestosRemovalJobs > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.asbestosRemovalJobs} Asbestos
                      Removal Job
                      {dependencyInfo.dependencies.asbestosRemovalJobs !== 1
                        ? "s"
                        : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.clientSuppliedJobs > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "secondary.main",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.clientSuppliedJobs} Client
                      Supplied Job
                      {dependencyInfo.dependencies.clientSuppliedJobs !== 1
                        ? "s"
                        : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.timesheets > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "success.main",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.timesheets} Timesheet
                      {dependencyInfo.dependencies.timesheets !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.sampleItems > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "error.main",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.sampleItems} Sample Item
                      {dependencyInfo.dependencies.sampleItems !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.assessments > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "info.dark",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.assessments} Assessment
                      {dependencyInfo.dependencies.assessments !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                )}
                {dependencyInfo.dependencies.clearances > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "primary.dark",
                      }}
                    />
                    <Typography variant="body2">
                      {dependencyInfo.dependencies.clearances} Clearance
                      {dependencyInfo.dependencies.clearances !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            To delete this project, you must first remove or reassign all linked
            records above.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => setDependencyDialogOpen(false)}
            variant="contained"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Confirmation Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={handleExportCancel}
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
            "& .MuiDialogTitle-root": {
              border: "none",
            },
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
              bgcolor: "success.main",
              color: "white",
            }}
          >
            <FileDownloadIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Export Projects
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary", mb: 2 }}>
            Would you like to download a CSV file containing the current
            filtered projects data?
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            The export will include {filteredProjects.length} project
            {filteredProjects.length !== 1 ? "s" : ""}.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={handleExportCancel}
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
            onClick={handleExportConfirm}
            variant="contained"
            color="success"
            startIcon={<FileDownloadIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(46, 125, 50, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(46, 125, 50, 0.4)",
              },
            }}
          >
            Download CSV
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Projects;
