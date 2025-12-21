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
  Alert,
  Divider,
  Checkbox,
  ListItemButton,
  ListItemText,
  InputAdornment,
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
import InfoIcon from "@mui/icons-material/Info";
import ClearIcon from "@mui/icons-material/Clear";

import { StatusChip } from "../../components/JobStatus";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
import { useSnackbar } from "../../context/SnackbarContext";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useTheme, useMediaQuery } from "@mui/material";
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
import { removeProjectFromCache } from "../../utils/reportsCache";

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

  // Detect tablet screens for responsive table adjustments (600px - 1024px)
  const isTablet = useMediaQuery("(min-width: 600px) and (max-width: 1024px)");
  // Detect desktop and tablet (>= 600px) for showing Details button
  const isDesktopOrTablet = useMediaQuery("(min-width: 600px)");
  const [projects, setProjects] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showSnackbar } = useSnackbar();

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

  // Helper to get a color for a given status - uses hardcoded colors for fast loading
  const getStatusColor = useCallback(
    (status) => {
      // Use hardcoded colors (these are synced with database)
      if (statusColors && statusColors[status]) {
        return statusColors[status];
      }

      // Fallback to default color if status not found
      return "#1976d2"; // Default Material-UI primary blue
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
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
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

  // Column width model for resizing
  const [columnWidthModel, setColumnWidthModel] = useState({});

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
      statusFilter: "all_active", // Default to active projects
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
            "all_active",
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

  // Add ref to track request ID to prevent stale responses from updating state
  const requestIdRef = useRef(0);

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
    if (newFilters.statusFilter !== "all_active") {
      // Only set status in URL if it's not the default (all_active)
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

      // Increment request ID to track the latest request
      const currentRequestId = ++requestIdRef.current;

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

        // Load projects based on status filter
        if (filtersToUse.statusFilter === "all") {
          // Show all projects (both active and inactive)
          params.status = "all";
        } else if (filtersToUse.statusFilter === "all_active") {
          params.status = "all_active";
        } else if (
          filtersToUse.statusFilter === "Cancelled" ||
          filtersToUse.statusFilter === "Job Complete" ||
          filtersToUse.statusFilter === "Job complete" ||
          inactiveStatuses.includes(filtersToUse.statusFilter)
        ) {
          // If filtering by a specific inactive status (Cancelled, Job Complete, or others), load all inactive projects
          // Client-side filtering will handle the specific status
          params.status = "all_inactive";
        } else {
          // Default to active projects for specific active statuses or any other case
          params.status = "all_active";
        }

        const response = await projectService.getAll(params);

        // Check if a newer request has started - if so, ignore this response
        if (currentRequestId !== requestIdRef.current) {
          return; // Don't update state if this request is stale
        }

        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        // Double-check that this is still the latest request before updating state
        if (currentRequestId === requestIdRef.current) {
          setProjects(projectsData);
          setPagination((prev) => ({
            total: projectsData.length,
            pages: Math.ceil(projectsData.length / prev.pageSize),
            page: 0,
            limit: prev.pageSize,
          }));
        }

        // Status counts will be updated when the component re-renders with new projects
      } catch (err) {
        // Don't update state if a newer request has started
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Only set error if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setError(err.message);
          setProjects([]);
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setSearchLoading(false);
        }
      }
    },
    [activeStatuses, inactiveStatuses] // Depend on both active and inactive statuses
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
        // Increment request ID to track the latest request
        const currentRequestId = ++requestIdRef.current;

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

          // Load projects based on status filter
          if (updatedFilters.statusFilter === "all") {
            // Show all projects (both active and inactive)
            params.status = "all";
          } else if (updatedFilters.statusFilter === "all_active") {
            params.status = "all_active";
          } else if (
            updatedFilters.statusFilter === "Cancelled" ||
            updatedFilters.statusFilter === "Job Complete" ||
            updatedFilters.statusFilter === "Job complete" ||
            inactiveStatuses.includes(updatedFilters.statusFilter)
          ) {
            // If filtering by a specific inactive status (Cancelled, Job Complete, or others), load all inactive projects
            // Client-side filtering will handle the specific status
            params.status = "all_inactive";
          } else {
            // Default to active projects for specific active statuses or any other case
            params.status = "all_active";
          }

          const response = await projectService.getAll(params);

          // Check if a newer request has started - if so, ignore this response
          if (currentRequestId !== requestIdRef.current) {
            return; // Don't update state if this request is stale
          }

          const projectsData = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];

          // Double-check that this is still the latest request before updating state
          if (currentRequestId === requestIdRef.current) {
            setProjects(projectsData);
            setPagination((prev) => ({
              ...prev,
              total: response.data.pagination?.total || 0,
              pages: response.data.pagination?.pages || 0,
            }));
          }

          // Status counts will be updated when the component re-renders with new projects
        } catch (err) {
          // Don't update state if a newer request has started
          if (currentRequestId !== requestIdRef.current) {
            return;
          }

          // Only set error if this is still the latest request
          if (currentRequestId === requestIdRef.current) {
            setError(err.message);
            setProjects([]);
          }
        } finally {
          // Only update loading state if this is still the latest request
          if (currentRequestId === requestIdRef.current) {
            setSearchLoading(false);
          }
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
    [updateFilter, memoizedFilters, paginationModel.pageSize, inactiveStatuses]
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
      // Use current projects state via functional update to avoid dependency
      setStatusCounts((prevCounts) => {
        // Get current projects from state (we'll use a ref to access it)
        // Actually, since we can't access projects here, just use prevCounts as fallback
        // or return empty counts
        return prevCounts; // Keep previous counts on error
      });

      // Log error but don't break the UI
      console.error(
        "Error fetching status counts, keeping previous values:",
        err
      );
    }
  }, [activeStatuses, inactiveStatuses]); // Removed 'projects' dependency to prevent infinite loop

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

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    updateFilter("searchTerm", "");
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    // Trigger search with empty value immediately (no debounce needed)
    fetchAllProjects("", false, {
      ...filtersRef.current,
      searchTerm: "",
    });
  }, [updateFilter, fetchAllProjects]);

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

  // Note: Search term is now persisted in localStorage and will be restored
  // when the component mounts again. No need to clear it on unmount.

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

  // Track if initial fetch has been done to prevent infinite loops
  const hasInitialFetchRef = useRef(false);

  // Initial fetch for projects and status counts when component mounts and statuses are loaded
  // Fetch them in parallel for faster data loading
  useEffect(() => {
    // Only fetch if we have active statuses loaded and haven't fetched yet
    if (activeStatuses.length > 0 && !hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;
      // Fetch projects and status counts in parallel (they're independent)
      Promise.all([fetchAllProjects(), fetchStatusCounts()]).catch((err) => {
        console.error("Error loading initial data:", err);
        hasInitialFetchRef.current = false; // Reset on error so we can retry
      });
    }
    // Only depend on activeStatuses to prevent infinite loops
    // The fetch functions are stable (useCallback) and don't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatuses.length]); // Only depend on activeStatuses length to prevent infinite loops

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

      // Validate confirmation text
      const expectedText = `delete${selectedProject?.projectID || ""}`;
      if (deleteConfirmationText !== expectedText) {
        setError("Confirmation text does not match. Please type 'delete' followed by the project ID.");
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
          setDeleteConfirmationText(""); // Clear confirmation text
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
        setDeleteConfirmationText(""); // Clear confirmation text
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

      // Update reports cache - remove deleted project
      if (deletedProject?.projectID) {
        try {
          removeProjectFromCache(deletedProject.projectID);
        } catch (cacheError) {
          console.error("Error updating cache after delete:", cacheError);
        }
      }

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
      setDeleteConfirmationText(""); // Clear confirmation text after successful deletion
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
        setDeleteConfirmationText(""); // Clear confirmation text
        setDependencyDialogOpen(true);
      } else {
        setError("Failed to delete project");
        setDeleteConfirmationText(""); // Clear confirmation text on error
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
    setDeleteConfirmationText(""); // Clear confirmation text when opening dialog
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

  // Handle column width changes with debouncing for performance
  const debouncedSaveWidths = useCallback(
    debounce((widthModel) => {
      // Save to localStorage
      localStorage.setItem("projects-column-width", JSON.stringify(widthModel));
      // Optionally save to database
      userPreferencesService
        .updatePreferences({
          columnWidth: {
            projects: widthModel,
          },
        })
        .catch(() => {
          // Silently fail if API call fails
        });
    }, 300),
    []
  );

  const handleColumnWidthChange = useCallback(
    (newModel) => {
      setColumnWidthModel(newModel);
      debouncedSaveWidths(newModel);
    },
    [debouncedSaveWidths]
  );

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
      // Increment request ID to track the latest request
      const currentRequestId = ++requestIdRef.current;

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

        // Load projects based on status filter
        if (tempFilters.statusFilter === "all") {
          // Show all projects (both active and inactive)
          params.status = "all";
        } else if (tempFilters.statusFilter === "all_active") {
          params.status = "all_active";
        } else if (
          tempFilters.statusFilter === "Cancelled" ||
          tempFilters.statusFilter === "Job Complete" ||
          tempFilters.statusFilter === "Job complete" ||
          inactiveStatuses.includes(tempFilters.statusFilter)
        ) {
          // If filtering by a specific inactive status (Cancelled, Job Complete, or others), load all inactive projects
          // Client-side filtering will handle the specific status
          params.status = "all_inactive";
        } else {
          // Default to active projects for specific active statuses or any other case
          params.status = "all_active";
        }

        const response = await projectService.getAll(params);

        // Check if a newer request has started - if so, ignore this response
        if (currentRequestId !== requestIdRef.current) {
          return; // Don't update state if this request is stale
        }

        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        // Double-check that this is still the latest request before updating state
        if (currentRequestId === requestIdRef.current) {
          setProjects(projectsData);
          setPagination((prev) => ({
            ...prev,
            total: response.data?.pagination?.total || 0,
            pages: response.data?.pagination?.pages || 0,
          }));
        }
      } catch (err) {
        // Don't update state if a newer request has started
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Only set error if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setError(err.message);
          setProjects([]);
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setSearchLoading(false);
        }
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

      // Get old status before making the API call
      const oldProject = projects.find((p) => p._id === projectId);
      const oldStatus = oldProject?.status;

      const apiStartTime = performance.now();
      const response = await projectService.update(projectId, updatePayload);
      const apiEndTime = performance.now();

      // Get new status from response (use updatePayload.status as fallback)
      const updatedStatus = response.data?.status || updatePayload.status;

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

      // Update status counts locally instead of refetching (much faster)
      if (oldStatus && updatedStatus && oldStatus !== updatedStatus) {
        setStatusCounts((prevCounts) => {
          const newCounts = { ...prevCounts };

          // Decrement old status
          if (newCounts[oldStatus] > 0) {
            newCounts[oldStatus] = (newCounts[oldStatus] || 0) - 1;
          }

          // Increment new status
          newCounts[updatedStatus] = (newCounts[updatedStatus] || 0) + 1;

          // Update active/inactive totals if needed
          if (
            activeStatuses.includes(oldStatus) &&
            !activeStatuses.includes(updatedStatus)
          ) {
            // Moved from active to inactive
            newCounts.all_active = Math.max(0, (newCounts.all_active || 0) - 1);
            newCounts.all_inactive = (newCounts.all_inactive || 0) + 1;
          } else if (
            !activeStatuses.includes(oldStatus) &&
            activeStatuses.includes(updatedStatus)
          ) {
            // Moved from inactive to active
            newCounts.all_active = (newCounts.all_active || 0) + 1;
            newCounts.all_inactive = Math.max(
              0,
              (newCounts.all_inactive || 0) - 1
            );
          } else if (
            activeStatuses.includes(oldStatus) &&
            activeStatuses.includes(updatedStatus)
          ) {
            // Both active - totals stay the same, just status counts change
          }

          return newCounts;
        });
      }

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
        if (response.data?.columnWidth?.projects) {
          setColumnWidthModel(response.data.columnWidth.projects);
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
        const savedColumnWidth = localStorage.getItem("projects-column-width");
        if (savedColumnWidth) {
          try {
            const parsed = JSON.parse(savedColumnWidth);
            setColumnWidthModel(parsed);
          } catch (parseError) {}
        }
      }
    };

    loadUserPreferences();
  }, []);

  // Memoize columns configuration with responsive widths for tablets
  const columns = useMemo(
    () => [
      {
        field: "projectID",
        headerName: "Project ID",
        width: isTablet ? 90 : 105,
        minWidth: isTablet ? 80 : 80,
        maxWidth: 300,
        sortable: true,
        renderCell: (params) => <Box>{params.value}</Box>,
      },
      {
        field: "name",
        headerName: "Project",
        width: isTablet ? 280 : 350,
        minWidth: isTablet ? 160 : 220,
        maxWidth: 800,
        sortable: true,
        renderCell: ({ row }) => {
          const clientName = row.client?.name || row.client || "";
          const projectName = row.name || "";

          return (
            <Box
              sx={{
                whiteSpace: "normal",
                wordWrap: "break-word",
                lineHeight: 1.2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: "100%",
                py: 0.5,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  color: "black",
                }}
              >
                {projectName}
              </Typography>
              {clientName && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "inline-block",
                    maxWidth: "fit-content",
                    mt: 0.25,
                    cursor: "pointer",
                    "&:hover": {
                      color: "primary.main",
                      textDecoration: "underline",
                    },
                  }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      // Search for client by name to get the ID
                      const response = await clientService.getAll({
                        search: clientName,
                        limit: 1,
                      });
                      const clients = response.data.clients || response.data;
                      const client = clients.find((c) => c.name === clientName);
                      if (client && client._id) {
                        navigate(`/clients/${client._id}`);
                      } else {
                        showSnackbar("Client not found", "warning");
                      }
                    } catch (error) {
                      console.error("Error finding client:", error);
                      showSnackbar("Failed to find client", "error");
                    }
                  }}
                >
                  Client: {clientName}
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        field: "d_Date",
        headerName: "Due Date",
        width: isTablet ? 90 : 110,
        minWidth: isTablet ? 80 : 80,
        maxWidth: 200,
        sortable: true,
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
                -
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
                {Math.abs(daysDiff)} days
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
                {daysDiff} days
              </Typography>
            );
          }
        },
      },
      // {
      //   field: "department",
      //   headerName: "Department",
      //   flex: 1,
      // },
      {
        field: "workOrder",
        headerName: "Work Order/Job Reference",
        width: isTablet ? 120 : 150,
        minWidth: isTablet ? 100 : 100,
        maxWidth: 400,
        sortable: true,
      },
      {
        field: "status",
        headerName: "Status",
        width: isTablet ? 110 : 180,
        minWidth: isTablet ? 100 : 100,
        maxWidth: 300,
        sortable: true,
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
                whiteSpace: "normal",
                wordBreak: "break-word",
                lineHeight: 1.2,
                textAlign: "left",
                width: "100%",
                boxSizing: "border-box",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
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
        width: isTablet ? 70 : 100,
        minWidth: isTablet ? 60 : 60,
        maxWidth: 200,
        sortable: false,
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
        headerName: "Actions",
        width: isTablet ? 140 : 200,
        minWidth: isTablet ? 130 : 130,
        maxWidth: 300,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            {/* Project Details button */}
            {isDesktopOrTablet ? (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/${params.row._id}`);
                }}
                size="small"
                variant="outlined"
                color="primary"
                sx={{
                  minWidth: "auto",
                  px: 1.5,
                  fontSize: "0.75rem",
                }}
              >
                Details
              </Button>
            ) : (
              <Tooltip title="View Project Details">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${params.row._id}`);
                  }}
                  size="small"
                  color="primary"
                >
                  <InfoIcon />
                </IconButton>
              </Tooltip>
            )}

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
    [
      navigate,
      isAdmin,
      isManager,
      can,
      handleDeleteClick,
      handleStatusClick,
      isTablet,
      isDesktopOrTablet,
    ]
  );

  // Client-side filtering for live status updates
  const filteredProjects = useMemo(() => {
    // "all" shows all projects (both active and inactive)
    if (filters.statusFilter === "all") {
      return projects;
    }

    // "all_active" shows all active projects
    if (filters.statusFilter === "all_active") {
      return projects;
    }

    // Handle specific status filters (including Cancelled and Job Complete)
    const filtered = projects.filter((project) => {
      const projectStatus = project.status;
      return projectStatus === filters.statusFilter;
    });

    return filtered;
  }, [projects, filters.statusFilter]);

  // Show UI immediately, data will load in background
  if (error) return <Typography color="error">{error}</Typography>;

  // Ensure columns are properly defined before rendering
  if (!columns || columns.length === 0) {
    return <Typography>Loading columns...</Typography>;
  }

  return (
    <Box m="5px 0px 20px 20px">
      <Typography
        variant="h3"
        component="h1"
        marginTop="20px"
        marginBottom="20px"
      >
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
                endAdornment: filters.searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleSearchClear}
                      sx={{
                        padding: "4px",
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                      aria-label="Clear search"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
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
                      All Reports
                    </span>
                    <Box
                      sx={{
                        backgroundColor: "#1976d2",
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
                      {(statusCounts.all_active || 0) +
                        (statusCounts.all_inactive || 0)}
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
                      Active Projects
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
                <Divider />
                <MenuItem disabled></MenuItem>
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
                <MenuItem disabled></MenuItem>
                {/* Add Cancelled and Job Complete filters - check both active and inactive statuses */}
                {[...activeStatuses, ...inactiveStatuses]
                  .filter(
                    (status) =>
                      status === "Cancelled" ||
                      status === "Job Complete" ||
                      status === "Job complete"
                  )
                  .map((status) => {
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
                              backgroundColor:
                                statusColors[status] || "#757575",
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
          width: "100%",
          minWidth: 0,
          overflowX: "auto",
          maxWidth: "100%",
          "& .MuiDataGrid-root": {
            border: "none",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
          },
          "& .MuiDataGrid-main": {
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
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
            "& .MuiDataGrid-menuIcon": {
              display: "none !important",
            },
            "& .MuiDataGrid-sortIcon": {
              color: "#FFFFFF",
            },
            "& .MuiDataGrid-iconButtonContainer": {
              "& .MuiIconButton-root": {
                color: "#FFFFFF",
              },
            },
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: "#FFFFFF",
            overflowX: "auto",
            width: "100%",
            maxWidth: "100%",
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
          columns={columns}
          getRowId={(row) => row._id || row.id}
          loading={loading && !searchLoading}
          error={error}
          // checkboxSelection
          onRowClick={(params) =>
            navigate(`/reports/project/${params.row._id}`, {
              state: { from: "projects" },
            })
          }
          columnVisibilityModel={memoizedColumnVisibilityModel}
          onColumnVisibilityModelChange={handleColumnVisibilityModelChange}
          columnWidthModel={columnWidthModel}
          onColumnWidthChange={handleColumnWidthChange}
          paginationMode="client"
          paginationModel={paginationModel}
          onPaginationModelChange={(newModel) => {
            setPaginationModel(newModel);
          }}
          pageSizeOptions={[25, 50, 100]}
          autoHeight
          disableColumnMenu={true}
          disableSelectionOnClick
          disableColumnFilter={true}
          disableSorting={false}
          disableColumnResize={false}
          columnResizeMode="onChange"
          slotProps={{
            columnResize: {
              minWidth: 50,
            },
          }}
          disableColumnSelector={false}
          disableDensitySelector={false}
          // disableColumnReorder={false}
          // disableMultipleColumnsSorting={true}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 50, page: 0 },
            },
          }}
          sx={{
            cursor: "pointer",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "auto",
            "& .MuiDataGrid-row:nth-of-type(even)": {
              backgroundColor: "#f8f9fa",
            },
            "& .MuiDataGrid-row:nth-of-type(odd)": {
              backgroundColor: "#ffffff",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "#e3f2fd",
            },
            "& .MuiDataGrid-row": {
              minHeight: "44px !important",
            },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
              padding: isTablet ? "4px 8px" : "4px 16px",
            },
            "& .MuiDataGrid-columnHeader": {
              padding: isTablet ? "8px" : "16px",
              "& .MuiDataGrid-sortIcon": {
                color: "#FFFFFF",
              },
            },
            "& .MuiDataGrid-virtualScroller": {
              overflowX: "auto",
            },
            "& .MuiDataGrid-container--top": {
              overflowX: "auto",
            },
            "& .MuiDataGrid-container--bottom": {
              overflowX: "auto",
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
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmationText(""); // Clear confirmation text when closing
        }}
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
          <Typography variant="body1" sx={{ color: "text.primary", mb: 2 }}>
            Are you sure you want to delete the project "{selectedProject?.name}
            "? This action cannot be undone.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            To confirm deletion, please type <strong>delete{selectedProject?.projectID || ""}</strong> below:
          </Typography>
          <TextField
            fullWidth
            value={deleteConfirmationText}
            onChange={(e) => {
              setDeleteConfirmationText(e.target.value);
              // Clear any previous error when user starts typing
              if (error) setError(null);
            }}
            placeholder={`delete${selectedProject?.projectID || ""}`}
            autoFocus
            error={
              deleteConfirmationText !== "" &&
              deleteConfirmationText !== `delete${selectedProject?.projectID || ""}`
            }
            helperText={
              deleteConfirmationText !== "" &&
              deleteConfirmationText !== `delete${selectedProject?.projectID || ""}`
                ? "Confirmation text does not match"
                : ""
            }
            sx={{ mt: 1 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmationText(""); // Clear confirmation text when canceling
            }}
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
            disabled={
              deleteConfirmationText !== `delete${selectedProject?.projectID || ""}`
            }
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(211, 47, 47, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(211, 47, 47, 0.4)",
              },
              "&:disabled": {
                boxShadow: "none",
                opacity: 0.5,
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
