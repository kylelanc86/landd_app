import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSnackbar } from "../../context/SnackbarContext";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
} from "@mui/material";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { projectService, clientService, userService } from "../../services/api";
import ProjectAuditService from "../../services/projectAuditService";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";
import { usePermissions } from "../../hooks/usePermissions";
import ProjectLogModalWrapper from "../reports/ProjectLogModalWrapper";
import { StatusChip } from "../../components/JobStatus";
import {
  addProjectToCache,
  removeProjectFromCache,
} from "../../utils/reportsCache";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
import loadGoogleMapsApi from "../../utils/loadGoogleMapsApi";
import {
  formatPhoneNumber,
  isValidAustralianMobile,
  isValidAustralianPhone,
  isValidEmailOrDash,
} from "../../utils/formatters";

const DEPARTMENTS = [
  "Asbestos & HAZMAT",
  "Occupational Hygiene",
  "Client Supplied",
];

const CATEGORIES = [
  "Asbestos Management Plan",
  "Air Monitoring and Clearance",
  "Asbestos Materials Assessment",
  "Asbestos & Lead Paint Assessment",
  "Clearance Certificate",
  "Client Supplied - Bulk ID",
  "Client Supplied - Soil/dust (AS4964)",
  "Client Supplied - WA Guidelines",
  "Client Supplied - Fibre Count",
  "Hazardous Materials Management Plan",
  "Intrusive Asbestos Assessment",
  "Intrusive Hazardous Materials Assessment",
  "Lead Dust Assessment",
  "Lead Paint Assessment",
  "Lead Paint/Dust Assessment",
  "Mould/Moisture Assessment",
  "Mould/Moisture Validation",
  "Residential Asbestos Assessment",
  "Silica Air Monitoring",
  "Other",
];

// Move renderStatusMenuItem outside the component to prevent recreation on every render
const renderStatusMenuItem = (status, statusColors, onStatusSelect) => {
  // Handle case where status might be an object with text property
  const statusText = typeof status === "string" ? status : status.text;
  const statusKey =
    typeof status === "string" ? status : status._id || status.text;

  return (
    <MenuItem
      key={statusKey}
      value={statusText}
      onClick={() => onStatusSelect(statusText)}
    >
      <StatusChip
        status={statusText}
        customColor={statusColors && statusColors[statusText]}
      />
    </MenuItem>
  );
};

const ProjectInformation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { can, isAdmin, isManager } = usePermissions();
  const canWriteOff = can("clients.write_off");
  const isEditMode = Boolean(id && id !== "new" && id !== "add-new");

  // Debug: Log the isEditMode calculation
  useEffect(() => {}, [id, isEditMode]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientDetailsDialogOpen, setClientDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showSnackbar } = useSnackbar();

  // Error dialog state
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Audit trail state
  const [auditTrail, setAuditTrail] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditTrailExpanded, setAuditTrailExpanded] = useState(false);
  const auditTrailRef = useRef(null);

  // Function to handle audit trail expand/collapse
  const handleAuditTrailToggle = () => {
    setAuditTrailExpanded(!auditTrailExpanded);
  };

  // State for tracking form changes and confirmation dialog
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);

  // Project log modal state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [changeDetectionEnabled, setChangeDetectionEnabled] = useState(false);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

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
    department: "Asbestos & HAZMAT",
    status: "",
    address: "",
    d_Date: "",
    workOrder: "",
    users: [],
    categories: [],
    notes: "",
    budget: 0,
    isLargeProject: false,
    projectContact: {
      name: "",
      number: "",
      email: "",
    },
  });

  // Keep formRef in sync
  useEffect(() => {
    formRef.current = form;
  }, [form, isEditMode]);

  // Track form changes and compare with original values
  useEffect(() => {
    // Only track changes if change detection is enabled
    if (!changeDetectionEnabled) {
      return;
    }

    // Track changes for both edit mode and add mode
    if (originalForm) {
      // For add mode, exclude projectID from change detection since it's auto-generated
      // This prevents the initial project ID generation from being considered a "form change"
      let formToCompare = form;
      let originalFormToCompare = originalForm;

      if (!isEditMode) {
        // Create copies without projectID for comparison
        const { projectID: _, ...formWithoutProjectID } = form;
        const { projectID: __, ...originalFormWithoutProjectID } = originalForm;
        formToCompare = formWithoutProjectID;
        originalFormToCompare = originalFormWithoutProjectID;
      }

      const hasChanges =
        JSON.stringify(formToCompare) !== JSON.stringify(originalFormToCompare);

      // Debug: Find the specific differences
      if (hasChanges) {
        const formKeys = Object.keys(formToCompare);
        const originalKeys = Object.keys(originalFormToCompare);
        const differences = [];

        // Check for missing or extra keys
        const allKeys = new Set([...formKeys, ...originalKeys]);
        for (const key of allKeys) {
          if (formToCompare[key] !== originalFormToCompare[key]) {
            differences.push({
              key,
              formValue: formToCompare[key],
              originalValue: originalFormToCompare[key],
              formHasKey: key in formToCompare,
              originalHasKey: key in originalFormToCompare,
            });
          }
        }
      }

      setHasUnsavedChanges(hasChanges);

      // Set global variables for sidebar navigation
      window.hasUnsavedChanges = hasChanges;
      window.currentProjectPath = window.location.pathname;
      window.showUnsavedChangesDialog = () => {
        setUnsavedChangesDialogOpen(true);
      };
    } else {
      // Clean up global variables when no original form
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
  }, [form, originalForm, isEditMode, changeDetectionEnabled]);

  // Intercept navigation attempts when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Override the navigate function temporarily
    const originalNavigate = navigate;

    // Create a wrapper function that checks for unsaved changes
    const navigationWrapper = (to, options) => {
      // Check if this is an external navigation (not within current project)
      const targetPath = typeof to === "string" ? to : to.pathname || "/";
      const currentPath = window.location.pathname;

      if (
        !targetPath.startsWith("/projects/") ||
        (targetPath === "/projects" && currentPath.startsWith("/projects/"))
      ) {
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
        !href.startsWith("/projects/") &&
        href !== "/projects" &&
        !href.startsWith("/projects")
      ) {
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
        // Prevent the navigation
        window.history.pushState(null, "", window.location.pathname);
        setPendingNavigation("/projects");
        setUnsavedChangesDialogOpen(true);
      }
    };

    // Handle refresh button clicks and F5 key
    const handleRefreshClick = (e) => {
      // Check if it's a refresh button click or F5 key
      const isRefreshButton = e.target.closest(
        'button[aria-label*="refresh"], button[title*="refresh"], .refresh-button'
      );
      const isF5Key = e.key === "F5";

      if ((isRefreshButton || isF5Key) && hasUnsavedChanges) {
        e.preventDefault();
        e.stopPropagation();
        setRefreshDialogOpen(true);
        return false;
      }
    };

    // Add a history entry when entering with unsaved changes
    if (hasUnsavedChanges) {
      window.history.pushState(null, "", window.location.pathname);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleRefreshClick, true);
    document.addEventListener("keydown", handleRefreshClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleRefreshClick, true);
      document.removeEventListener("keydown", handleRefreshClick, true);
    };
  }, [hasUnsavedChanges]);

  // Add state to control the status dropdown
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const [addressInput, setAddressInput] = useState("");
  const [addressOptions, setAddressOptions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  // New client form address autocomplete state
  const [newClientAddressInput, setNewClientAddressInput] = useState("");
  const [newClientAddressOptions, setNewClientAddressOptions] = useState([]);
  const [isNewClientAddressLoading, setIsNewClientAddressLoading] =
    useState(false);

  // Initialize Google Places Autocomplete
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [googleMaps, setGoogleMaps] = useState(null);
  const [googleMapsError, setGoogleMapsError] = useState(null);
  const placesServiceDivRef = useRef(null);
  const formElementRef = useRef(null); // Ref for the form element to trigger validation

  const [clientInputValue, setClientInputValue] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [isClientSearching, setIsClientSearching] = useState(false);
  // Removed: Frontend project ID generation
  // Project IDs are now generated on the backend during save
  const formRef = useRef(form);

  // Get project statuses from custom data fields
  const { activeStatuses, inactiveStatuses, statusColors } =
    useProjectStatuses();

  // Debug: Log what we're getting from the hook
  useEffect(() => {}, [activeStatuses, inactiveStatuses, statusColors]);

  // Set default status when statuses are loaded
  useEffect(() => {
    if (activeStatuses.length > 0 && !form.status) {
      // Extract text from status object if it's an object
      const defaultStatus =
        typeof activeStatuses[0] === "string"
          ? activeStatuses[0]
          : activeStatuses[0].text;
      setForm((prev) => ({ ...prev, status: defaultStatus }));
    }
  }, [activeStatuses, form.status]);

  // Memoize the accessible statuses to prevent recalculation on every render
  const accessibleStatuses = useMemo(() => {
    if (isAdmin || isManager || can("projects.change_status")) {
      // Extract text from status objects if they are objects
      const active = Array.isArray(activeStatuses)
        ? activeStatuses.map((s) => (typeof s === "string" ? s : s.text))
        : [];
      const inactive = Array.isArray(inactiveStatuses)
        ? inactiveStatuses.map((s) => (typeof s === "string" ? s : s.text))
        : [];

      // Filter out restricted statuses for employee users
      const restrictedStatuses = ["Cancelled"];

      // If user is employee (not admin or manager), filter out restricted statuses
      if (!isAdmin && !isManager) {
        let filteredActive = active.filter(
          (status) => !restrictedStatuses.includes(status)
        );
        let filteredInactive = inactive.filter(
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

      return { active, inactive };
    }
    return { active: [], inactive: [] };
  }, [isAdmin, isManager, can, activeStatuses, inactiveStatuses, currentUser]);

  // Memoize the status menu items to prevent recreation on every render
  const statusMenuItems = useMemo(() => {
    const activeItems = accessibleStatuses.active.map((status) =>
      renderStatusMenuItem(status, statusColors, (selectedStatus) => {
        setForm((prev) => ({
          ...prev,
          status: selectedStatus,
        }));
        // Close the dropdown after selection
        setStatusDropdownOpen(false);
      })
    );

    const inactiveItems = accessibleStatuses.inactive.map((status) =>
      renderStatusMenuItem(status, statusColors, (selectedStatus) => {
        setForm((prev) => ({
          ...prev,
          status: selectedStatus,
        }));
        // Close the dropdown after selection
        setStatusDropdownOpen(false);
      })
    );

    return { activeItems, inactiveItems };
  }, [accessibleStatuses, statusColors, setForm, setStatusDropdownOpen]);

  // Function to determine which statuses a user can access
  const getAccessibleStatuses = () => {
    if (isAdmin || isManager || can("projects.change_status")) {
      // Extract text from status objects if they are objects
      const active = Array.isArray(activeStatuses)
        ? activeStatuses.map((s) => (typeof s === "string" ? s : s.text))
        : [];
      const inactive = Array.isArray(inactiveStatuses)
        ? inactiveStatuses.map((s) => (typeof s === "string" ? s : s.text))
        : [];

      // Filter out restricted statuses for employee users
      const restrictedStatuses = ["Cancelled"];

      // If user is employee (not admin or manager), filter out restricted statuses
      if (!isAdmin && !isManager) {
        let filteredActive = active.filter(
          (status) => !restrictedStatuses.includes(status)
        );
        let filteredInactive = inactive.filter(
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

      return { active, inactive };
    }
    return { active: [], inactive: [] };
  };

  // Removed: Frontend project ID generation
  // Project IDs are now generated by the backend during save

  // Enable change detection after a delay to allow initial form setup
  useEffect(() => {
    if (isEditMode) {
      // For edit mode, enable immediately since data is already loaded
      setChangeDetectionEnabled(true);
    } else {
      // For add mode, delay to allow default values to be set
      const timer = setTimeout(() => {
        // Set original form now that initialization is complete
        setOriginalForm(JSON.parse(JSON.stringify(formRef.current)));
        setChangeDetectionEnabled(true);
      }, 1000); // 1 second delay (reduced since we're not generating IDs)

      return () => clearTimeout(timer);
    }
  }, [isEditMode]); // Removed form dependency to prevent multiple original form updates

  // Function to fetch audit trail
  const fetchAuditTrail = async (projectId) => {
    if (!projectId) return;

    try {
      const auditStartTime = performance.now();
      setAuditLoading(true);
      setAuditError(null);

      const response = await ProjectAuditService.getAllProjectAuditTrail(
        projectId
      );
      const auditTime = performance.now() - auditStartTime;

      setAuditTrail(response.auditTrail || []);
    } catch (error) {
      setAuditError("Failed to load audit trail");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const pageLoadStartTime = performance.now();

      try {
        setLoading(true);
        setError(null);

        // Fetch clients and users
        const clientsUsersStartTime = performance.now();
        const [clientsRes, usersRes] = await Promise.all([
          clientService.getAll({ limit: 20 }),
          userService.getAll(),
        ]);
        const clientsUsersTime = performance.now() - clientsUsersStartTime;

        setClients(clientsRes.data.clients || clientsRes.data);
        setUsers(usersRes.data);

        // If we're in edit mode, fetch the project data
        if (id && id !== "new" && id !== "add-new" && id !== "undefined") {
          try {
            const projectFetchStartTime = performance.now();
            const projectRes = await projectService.getById(id);
            const projectFetchTime = performance.now() - projectFetchStartTime;

            if (!projectRes.data) {
              throw new Error("No project data received");
            }

            // Ensure users is always an array and remove backend-managed fields
            const { updatedAt, ...projectDataWithoutTimestamps } =
              projectRes.data;
            const projectData = {
              ...projectDataWithoutTimestamps,
              users: Array.isArray(projectRes.data.users)
                ? projectRes.data.users
                : [],
            };

            setForm(projectData);
            // Store original form values for change tracking
            setOriginalForm(JSON.parse(JSON.stringify(projectData)));

            // Fetch audit trail for existing projects (non-blocking)
            fetchAuditTrail(projectData._id);
          } catch (projectErr) {
            setErrorMessage("Failed to load project data. Please try again.");
            setErrorDialogOpen(true);
          }
        } else if (!id || id === "new" || id === "add-new") {
          // Don't generate Project ID yet - wait for form submission
          setForm((prev) => ({ ...prev, users: [] }));
          // Don't set original form yet - wait for initialization to complete
          // This will be set after project ID generation and status setting
        } else {
          // Invalid ID, redirect to projects list
          navigate("/projects");
        }
      } catch (err) {
        setErrorMessage("Failed to load data. Please try again.");
        setErrorDialogOpen(true);
      } finally {
        const totalPageLoadTime = performance.now() - pageLoadStartTime;
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, isEditMode]);

  useEffect(() => {
    const initializeGoogleMaps = async () => {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setGoogleMapsError(
          "Google Maps API key is missing. Please check your environment configuration."
        );
        return;
      }

      try {
        const google = await loadGoogleMapsApi(apiKey);

        // Verify Google Maps API is fully loaded
        if (!google || !google.maps || !google.maps.places) {
          throw new Error("Google Maps Places API is not available");
        }

        setGoogleMaps(google);

        // Create a proper DOM element for PlacesService that's attached to the document
        // This is required for PlacesService to work properly
        if (!placesServiceDivRef.current) {
          const div = document.createElement("div");
          div.style.display = "none";
          div.style.visibility = "hidden";
          div.style.position = "absolute";
          div.style.top = "-9999px";
          document.body.appendChild(div);
          placesServiceDivRef.current = div;
        }

        // Initialize the autocomplete service
        const autocompleteService =
          new google.maps.places.AutocompleteService();
        const placesService = new google.maps.places.PlacesService(
          placesServiceDivRef.current
        );

        setAutocompleteService(autocompleteService);
        setPlacesService(placesService);

        setGoogleMapsError(null); // Clear any previous errors
      } catch (error) {
        console.error("Error initializing Google Maps Places API:", error);
        setGoogleMapsError(
          `Error loading Google Maps: ${
            error.message || "Please try refreshing the page."
          }`
        );
      }
    };

    initializeGoogleMaps();

    // Cleanup: remove the PlacesService div when component unmounts
    return () => {
      if (
        placesServiceDivRef.current &&
        placesServiceDivRef.current.parentNode
      ) {
        placesServiceDivRef.current.parentNode.removeChild(
          placesServiceDivRef.current
        );
        placesServiceDivRef.current = null;
      }
    };
  }, []);

  // Sync addressInput with form address when editing
  useEffect(() => {
    if (form.address && !addressInput) {
      setAddressInput(form.address);
    }
  }, [form.address, addressInput]);

  const handleAddressInputChange = async (value) => {
    setAddressInput(value);

    // Always update the form state, even for empty values
    setForm((prev) => ({ ...prev, address: value }));

    if (!value || value.length < 2) {
      setAddressOptions([]);
      return;
    }

    // Verify services are available
    if (
      !autocompleteService ||
      !googleMaps ||
      !googleMaps.maps ||
      !googleMaps.maps.places
    ) {
      console.warn("Google Maps Places API is not available");
      setAddressOptions([]);
      return;
    }

    setIsAddressLoading(true);
    try {
      autocompleteService.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: "au" },
        },
        (predictions, status) => {
          if (
            status === googleMaps.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setAddressOptions(predictions);
          } else {
            // Enhanced error handling with specific status messages
            switch (status) {
              case googleMaps.maps.places.PlacesServiceStatus.ZERO_RESULTS:
                // No results found - this is normal, not an error
                break;
              case googleMaps.maps.places.PlacesServiceStatus.REQUEST_DENIED:
                console.error(
                  "REQUEST_DENIED: API key may be invalid or have restrictions"
                );
                console.error("Check Google Cloud Console API key settings:");
                console.error("1. Verify API key is correct");
                console.error("2. Ensure Places API is enabled");
                console.error(
                  "3. Check API key restrictions (HTTP referrers, IP addresses)"
                );
                console.error("4. Verify billing is enabled");
                setGoogleMapsError(
                  "Address search is unavailable. Please check API configuration."
                );
                break;
              case googleMaps.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
                console.error("OVER_QUERY_LIMIT: API quota exceeded");
                setGoogleMapsError(
                  "Address search quota exceeded. Please try again later."
                );
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
      setGoogleMapsError(
        "Error fetching address suggestions. Please try again."
      );
    }
  };

  // Helper function to strip "Australia" from the end of an address
  const stripAustraliaFromAddress = (address) => {
    if (!address) return address;
    // Remove "Australia" from the end, handling commas and spaces
    return address.replace(/,\s*Australia\s*$/i, "").trim();
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
            const cleanedAddress = stripAustraliaFromAddress(place.formatted_address);
            setForm((prev) => ({
              ...prev,
              address: cleanedAddress,
            }));
            setAddressInput(cleanedAddress);
          } else {
            console.error("Error getting place details:", status);
          }
        }
      );
    } catch (error) {
      console.error("Error getting place details:", error);
    }
  };

  // Handle new client address input change for autocomplete
  const handleNewClientAddressInputChange = async (value) => {
    if (!value || value.length < 2) {
      setNewClientAddressOptions([]);
      return;
    }

    // Verify services are available
    if (
      !autocompleteService ||
      !googleMaps ||
      !googleMaps.maps ||
      !googleMaps.maps.places
    ) {
      console.warn("Google Maps Places API is not available");
      setNewClientAddressOptions([]);
      return;
    }

    console.log("Making API call for new client address:", value);
    setIsNewClientAddressLoading(true);
    try {
      autocompleteService.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: "au" },
        },
        (predictions, status) => {
          console.log("New client address predictions callback received:", {
            predictions,
            status,
            statusText: googleMaps.maps.places.PlacesServiceStatus[status],
          });

          if (
            status === googleMaps.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            console.log("Setting new client address options:", predictions);
            setNewClientAddressOptions(predictions);
          } else {
            // Handle errors similar to main address handler
            if (
              status ===
              googleMaps.maps.places.PlacesServiceStatus.REQUEST_DENIED
            ) {
              console.error("REQUEST_DENIED for new client address");
              setGoogleMapsError(
                "Address search is unavailable. Please check API configuration."
              );
            }
            console.log(
              "No new client address predictions found or error:",
              status
            );
            setNewClientAddressOptions([]);
          }
          setIsNewClientAddressLoading(false);
        }
      );
    } catch (error) {
      console.error("Error fetching new client address predictions:", error);
      setNewClientAddressOptions([]);
      setIsNewClientAddressLoading(false);
      setGoogleMapsError(
        "Error fetching address suggestions. Please try again."
      );
    }
  };

  // Handle new client address selection
  const handleNewClientAddressSelect = (placeId) => {
    if (!placesService) return;

    placesService.getDetails(
      {
        placeId: placeId,
        fields: ["formatted_address", "geometry", "address_components"],
      },
      (place, status) => {
        console.log("Selected new client place:", place, "Status:", status);
        if (status === googleMaps.maps.places.PlacesServiceStatus.OK) {
          const cleanedAddress = stripAustraliaFromAddress(place.formatted_address);
          setNewClientForm((prev) => ({
            ...prev,
            address: cleanedAddress,
          }));
          setNewClientAddressInput(cleanedAddress);
        } else {
          console.error("Error getting new client place details:", status);
        }
      }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log("🔍 handleChange called:", { name, value, target: e.target });

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setForm((prev) => {
        console.log("🔍 Setting nested form field:", {
          parent,
          child,
          value,
          previousValue: prev[parent]?.[child],
          fullParent: prev[parent],
        });
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value,
          },
        };
      });
    } else {
      setForm((prev) => {
        console.log("🔍 Setting form field:", {
          field: name,
          value,
          previousValue: prev[name],
          isProjectID: name === "projectID",
          isId: name === "_id",
          formState: {
            projectID: prev.projectID,
            _id: prev._id,
            hasProjectID: !!prev.projectID,
            hasId: !!prev._id,
          },
        });
        return {
          ...prev,
          [name]: value,
        };
      });
    }
  };

  const handleClientChange = (event, newValue) => {
    setForm((prev) => ({
      ...prev,
      client: newValue,
    }));
  };

  const handleClientClick = async (client) => {
    if (!client || !client._id) return;

    setSelectedClient(client);
    setClientDetailsDialogOpen(true);
    setLoadingClientDetails(true);

    try {
      const response = await clientService.getById(client._id);
      setClientDetails(response.data);
    } catch (error) {
      console.error("Error fetching client details:", error);
      showSnackbar("Failed to load client details", "error");
    } finally {
      setLoadingClientDetails(false);
    }
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

  // Helper function to determine return path based on navigation source
  const getReturnPath = () => {
    // Check if user came from dashboard
    if (location.state?.from === "dashboard") {
      return "/";
    }
    // Default to projects list
    return "/projects";
  };

  // Override navigate function to check for unsaved changes
  const safeNavigate = (path) => {
    // If path is "/projects", use conditional return path
    const targetPath = path === "/projects" ? getReturnPath() : path;

    console.log("🔍 safeNavigate called:", {
      path,
      targetPath,
      hasUnsavedChanges,
      isEditMode,
      from: location.state?.from,
    });
    if (hasUnsavedChanges) {
      console.log("🔍 Showing unsaved changes dialog");
      setPendingNavigation(targetPath);
      setUnsavedChangesDialogOpen(true);
    } else {
      console.log("🔍 Navigating directly");
      navigate(targetPath);
    }
  };

  // Confirm navigation and discard changes
  const confirmNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setHasUnsavedChanges(false);

    // Navigate to the pending location (either local or global)
    // If pending navigation is "/projects", use conditional return path
    let targetPath = pendingNavigation || window.pendingNavigation;
    if (targetPath === "/projects") {
      targetPath = getReturnPath();
    }
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

  const handleSaveAndContinue = async (e) => {
    e.preventDefault();
    
    // Trigger HTML5 form validation before proceeding
    if (formElementRef.current && !formElementRef.current.checkValidity()) {
      // If validation fails, show validation messages
      formElementRef.current.reportValidity();
      return;
    }
    
    // Additional custom validation for email fields
    if (form.projectContact?.email && !form.projectContact.email.includes("@")) {
      showSnackbar("Please enter a valid email address for project contact", "error");
      return;
    }
    
    await handleSubmit(e, false); // Pass false to indicate don't navigate away
  };

  const handleSubmit = async (e, shouldNavigate = true) => {
    e.preventDefault();

    // Prevent multiple submissions - set saving flag immediately to prevent race condition
    if (saving) {
      console.log("🚫 SUBMISSION BLOCKED - Already saving");
      return;
    }
    
    // Set saving flag immediately to prevent duplicate submissions
    setSaving(true);

    const operationStartTime = performance.now();
    console.log("🚀 PROJECT OPERATION START", {
      operation: isEditMode ? "UPDATE" : "CREATE",
      timestamp: new Date().toISOString(),
      projectID: form.projectID,
      projectId: form._id,
      isEditMode,
    });

    console.log("🔍 handleSubmit called");
    console.log("🔍 Form data:", form);
    console.log("🔍 Form data details:", {
      projectID: form.projectID,
      _id: form._id,
      hasProjectID: !!form.projectID,
      hasId: !!form._id,
      projectIDType: typeof form.projectID,
      idType: typeof form._id,
      formKeys: Object.keys(form),
      formValues: JSON.stringify(form, null, 2),
    });

    console.log("🔍 FORM DATA BEFORE CLEANING", {
      projectId: id,
      formKeys: Object.keys(form),
      hasUpdatedAt: "updatedAt" in form,
      hasId: "_id" in form,
      updatedAt: form.updatedAt,
      _id: form._id,
      updatedAtType: typeof form.updatedAt,
      _idType: typeof form._id,
    });
    console.log("🔍 isEditMode:", isEditMode);
    console.log("🔍 Current user:", currentUser);
    console.log("🔍 URL params id:", id);

    try {
      // Check if this is an edit operation (either by URL param or by having an _id after creation)
      const isUpdateOperation = isEditMode || form._id;
      
      if (isUpdateOperation) {
        const updateStartTime = performance.now();
        const projectIdToUpdate = id || form._id;
        console.log("🔄 PROJECT UPDATE START", {
          projectId: projectIdToUpdate,
          timestamp: new Date().toISOString(),
        });

        console.log("🔍 Updating existing project with ID:", projectIdToUpdate);
        console.log("🔍 Update payload:", {
          id: projectIdToUpdate,
          form,
          formProjectID: form.projectID,
          formId: form._id,
        });

        console.log("🔍 FORM DATA BREAKDOWN", {
          projectId: id,
          formKeys: Object.keys(form),
          formValues: {
            projectID: form.projectID,
            name: form.name,
            department: form.department,
            status: form.status,
            categories: form.categories,
            categoriesType: typeof form.categories,
            isCategoriesArray: Array.isArray(form.categories),
            client: form.client,
            workOrder: form.workOrder,
            users: form.users,
            address: form.address,
            d_Date: form.d_Date,
            startDate: form.startDate,
            endDate: form.endDate,
            description: form.description,
            notes: form.notes,
            isLargeProject: form.isLargeProject,
            reports_present: form.reports_present,
          },
        });

        // Remove fields that should not be sent in updates
        const { updatedAt, _id, ...updateData } = form;

        console.log("🔍 CLEANED UPDATE DATA", {
          projectId: id,
          removedFields: ["updatedAt", "_id"],
          updateDataKeys: Object.keys(updateData),
          updateData,
        });

        console.log("🔍 CLEANED UPDATE DATA DETAILS", {
          projectId: id,
          updateDataValues: {
            projectID: updateData.projectID,
            name: updateData.name,
            department: updateData.department,
            status: updateData.status,
            categories: updateData.categories,
            categoriesType: typeof updateData.categories,
            isCategoriesArray: Array.isArray(updateData.categories),
            client: updateData.client,
            workOrder: updateData.workOrder,
            users: updateData.users,
            address: updateData.address,
            d_Date: updateData.d_Date,
            startDate: updateData.startDate,
            endDate: updateData.endDate,
            description: updateData.description,
            notes: updateData.notes,
            isLargeProject: updateData.isLargeProject,
            reports_present: updateData.reports_present,
          },
        });

        const apiStartTime = performance.now();
        const response = await projectService.update(projectIdToUpdate, updateData);
        const apiEndTime = performance.now();

        console.log("✅ PROJECT UPDATE API COMPLETE", {
          projectId: projectIdToUpdate,
          apiTime: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
          totalTime: `${(apiEndTime - updateStartTime).toFixed(2)}ms`,
          responseSize: JSON.stringify(response).length,
        });
        console.log("🔍 Update response:", response);
      } else {
        const createStartTime = performance.now();
        console.log("🆕 PROJECT CREATE START", {
          timestamp: new Date().toISOString(),
        });

        console.log(
          "🔍 Creating new project (ID will be generated by backend)"
        );

        // Remove projectID from form if it exists (shouldn't for new projects)
        const { projectID, ...formToSubmit } = form;

        console.log("🔍 Calling projectService.create...");
        const apiStartTime = performance.now();
        const response = await projectService.create(formToSubmit);
        const apiEndTime = performance.now();

        console.log("✅ PROJECT CREATE API COMPLETE", {
          projectId: response.data?.projectID,
          apiTime: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
          totalTime: `${(apiEndTime - createStartTime).toFixed(2)}ms`,
          responseSize: JSON.stringify(response).length,
        });

        console.log("🔍 Create response:", response);
        console.log("🔍 Create response details:", {
          hasData: !!response.data,
          responseKeys: response.data ? Object.keys(response.data) : [],
          responseProjectID: response.data?.projectID,
          responseId: response.data?._id,
        });

        // Update form with returned project ID and _id so it's displayed immediately
        // Setting _id ensures subsequent "Save and Continue" clicks will update instead of create
        if (response.data?.projectID) {
          setForm((prev) => ({ 
            ...prev, 
            projectID: response.data.projectID,
            _id: response.data._id // Set _id to mark this as an existing project
          }));

          // Update reports cache with new project (pass full project object)
          addProjectToCache(response.data);
        }

        // Navigate to projects page after successful creation if shouldNavigate is true
        if (shouldNavigate) {
          navigate("/projects");
        }
        return; // Exit early
      }

      const operationEndTime = performance.now();
      const totalOperationTime = operationEndTime - operationStartTime;
      console.log("✅ PROJECT OPERATION COMPLETE", {
        operation: isUpdateOperation ? "UPDATE" : "CREATE",
        projectId: isUpdateOperation ? (id || form._id) : form.projectID,
        totalTime: `${totalOperationTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });

      console.log("🔍 Success!");

      // Show success message
      showSnackbar(
        isUpdateOperation
          ? "Project updated successfully!"
          : "Project created successfully!",
        "success"
      );

      // Reset unsaved changes flag and update original form
      setHasUnsavedChanges(false);
      if (isUpdateOperation) {
        // Update original form after any update operation (whether from edit mode or after creation)
        setOriginalForm(JSON.parse(JSON.stringify(form)));
        // Refresh audit trail after update (only if we have an _id)
        if (form._id) {
          await fetchAuditTrail(form._id);
        }
        // Navigate to projects page or dashboard after successful update if shouldNavigate is true
        if (shouldNavigate) {
          navigate(getReturnPath());
        }
      }
    } catch (error) {
      const operationEndTime = performance.now();
      const totalOperationTime = operationEndTime - operationStartTime;
      // Determine operation type for error logging (isUpdateOperation may not be in scope if error occurred early)
      const errorOperationType = (isEditMode || form._id) ? "UPDATE" : "CREATE";
      const errorProjectId = (isEditMode || form._id) ? (id || form._id) : form.projectID;
      
      console.log("❌ PROJECT OPERATION ERROR", {
        operation: errorOperationType,
        projectId: errorProjectId,
        totalTime: `${totalOperationTime.toFixed(2)}ms`,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      console.error("🔍 Error saving project:", error);
      console.error("🔍 Error details:", {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      console.error("🔍 Error context:", {
        isEditMode,
        formProjectID: form.projectID,
        formId: form._id,
        urlId: id,
        currentUser: currentUser?.email || "unknown",
      });
      setErrorMessage("Failed to save project. Please try again.");
      setErrorDialogOpen(true);
    } finally {
      setSaving(false);
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
      showSnackbar("Client created successfully!", "success");
    } catch (err) {
      console.error("Error creating client:", err);
      showSnackbar(
        `Error creating client: ${
          err.response?.data?.message || "Unknown error"
        }`,
        "error"
      );
    } finally {
      setCreatingClient(false);
    }
  };

  const handleDeleteProject = async () => {
    const deleteStartTime = performance.now();
    console.log("🗑️ PROJECT DELETE START", {
      projectId: id,
      timestamp: new Date().toISOString(),
    });

    try {
      setDeleting(true);

      const apiStartTime = performance.now();
      const response = await projectService.delete(id);
      const apiEndTime = performance.now();

      console.log("✅ PROJECT DELETE API COMPLETE", {
        projectId: id,
        apiTime: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
        totalTime: `${(apiEndTime - deleteStartTime).toFixed(2)}ms`,
        responseSize: JSON.stringify(response).length,
      });

      // Check if this was a permission denied response
      if (response.data?.permissionDenied) {
        console.log("❌ PROJECT DELETE PERMISSION DENIED", { projectId: id });
        // Permission denied - don't navigate, just close the dialog
        setDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }

      console.log("✅ PROJECT DELETE SUCCESS", { projectId: id });

      // Update reports cache - remove deleted project
      try {
        const project = await projectService.getById(id);
        if (project.data?.projectID) {
          removeProjectFromCache(project.data.projectID);
        }
      } catch (cacheError) {
        console.error("Error updating cache after delete:", cacheError);
      }

      // Success - navigate to projects list or dashboard depending on source
      navigate(getReturnPath());
    } catch (error) {
      console.error("❌ PROJECT DELETE ERROR", {
        projectId: id,
        error: error.message,
        totalTime: `${(performance.now() - deleteStartTime).toFixed(2)}ms`,
      });
      setErrorMessage("Failed to delete project. Please try again.");
      setErrorDialogOpen(true);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box m="20px">
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => safeNavigate("/projects")} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h4">
              {isEditMode ? "Project Details" : "Add New Project"}
            </Typography>
            {isEditMode && hasUnsavedChanges && (
              <Chip
                label="Unsaved Changes"
                color="warning"
                size="small"
                sx={{ fontSize: "0.75rem" }}
              />
            )}
          </Box>
        </Box>
        {isEditMode && (
          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={() => setLogModalOpen(true)}
          >
            View Project Log
          </Button>
        )}
        {!isEditMode && id === "new" && (
          <Button
            variant="outlined"
            onClick={() => safeNavigate("/projects/add-new")}
            sx={{ ml: "auto" }}
            startIcon={<AddIcon />}
          >
            Use Full Page Form
          </Button>
        )}
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
        <Paper sx={{ p: 3, position: "relative" }}>
          {/* Loading overlay */}
          {saving && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                borderRadius: 1,
              }}
            >
              <CircularProgress size={60} />
              <Typography variant="h6" sx={{ mt: 2, color: "text.primary" }}>
                {isEditMode ? "Updating Project..." : "Creating Project..."}
              </Typography>
            </Box>
          )}

          <form ref={formElementRef} onSubmit={handleSubmit} autoComplete="off">
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
              <Grid item xs={12}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: "1.56rem",
                      color: "#2e7d32",
                      fontWeight: 500,
                    }}
                  >
                    Project ID:{" "}
                    {isEditMode
                      ? form.projectID
                      : form.projectID
                      ? form.projectID
                      : "Generated on Save"}
                  </Typography>
                  {!isEditMode && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: "italic" }}
                    >
                      {form.projectID
                        ? "(Ready)"
                        : "(Will be generated on save)"}
                    </Typography>
                  )}
                  {isEditMode && form.createdAt && (
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

              {!isEditMode && (
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
              )}

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
                  autoComplete="new-password"
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
                        onClick={() => {
                          if (form.client) {
                            handleClientClick(form.client);
                          }
                        }}
                        sx={{
                          cursor: form.client ? "pointer" : "default",
                          "& .MuiInputBase-input": {
                            cursor: form.client ? "pointer" : "default",
                          },
                        }}
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
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Typography variant="body2">{option.name}</Typography>
                      </Box>
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
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-form-type="other"
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

              {/* Due Date, Status, and Work Order on same line */}
              <Grid item xs={12} md={4}>
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

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={form.status || ""}
                    onChange={handleChange}
                    label="Status"
                    displayEmpty
                    open={statusDropdownOpen}
                    onOpen={() => setStatusDropdownOpen(true)}
                    onClose={() => setStatusDropdownOpen(false)}
                    renderValue={(value) => {
                      if (!value) return <em>Select a status</em>;
                      return (
                        <StatusChip
                          status={value}
                          customColor={statusColors && statusColors[value]}
                        />
                      );
                    }}
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
                    {statusMenuItems.activeItems}
                    <MenuItem disabled>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ fontSize: "0.88rem" }}
                      >
                        Inactive Statuses
                      </Typography>
                    </MenuItem>
                    {statusMenuItems.inactiveItems}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Work Order/Job Reference"
                  name="workOrder"
                  value={form.workOrder}
                  onChange={handleChange}
                  placeholder="Enter work order or job reference number"
                />
              </Grid>

              {/* Department and Categories on next line */}
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
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip key={key} label={option} {...tagProps} />
                      );
                    })
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Project Budget ($)"
                  name="budget"
                  type="number"
                  value={form.budget || 0}
                  onChange={handleChange}
                  inputProps={{ min: 0, step: 0.01 }}
                  helperText="Budget amount for project cost tracking and reporting"
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
                  rows={6}
                  InputProps={{
                    sx: {
                      fontSize: "0.875rem",
                      lineHeight: 1.3,
                    },
                  }}
                  InputLabelProps={{
                    sx: {
                      fontSize: "0.875rem",
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography
                  variant="subtitle1"
                  sx={{ mt: 1, mb: 0, fontWeight: "bold" }}
                >
                  Project Contact
                </Typography>
              </Grid>

              <Grid item xs={12} md={4} sx={{ pt: 0.5 }}>
                <TextField
                  fullWidth
                  label="Contact Name"
                  name="projectContact.name"
                  value={form.projectContact?.name || ""}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </Grid>

              <Grid item xs={12} md={4} sx={{ pt: 0.5 }}>
                <TextField
                  fullWidth
                  label="Contact Number"
                  name="projectContact.number"
                  value={form.projectContact?.number || ""}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </Grid>

              <Grid item xs={12} md={4} sx={{ pt: 0.5 }}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  name="projectContact.email"
                  type="email"
                  value={form.projectContact?.email || ""}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography
                  variant="subtitle1"
                  sx={{ mt: 1, mb: 0, fontWeight: "bold" }}
                >
                  Project Team
                </Typography>
              </Grid>

              <Grid item xs={12} sx={{ pt: 0.5 }}>
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
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
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
                      onClick={() => safeNavigate("/projects")}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleSaveAndContinue}
                      disabled={saving}
                    >
                      Save and Continue
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={saving}
                    >
                      {isEditMode ? "Update and Exit" : "Create and Exit"}
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
        <form onSubmit={handleNewClientSubmit} autoComplete="off">
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
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Stack spacing={2}>
              <TextField
                label="Client Name"
                name="name"
                value={newClientForm.name}
                onChange={handleNewClientChange}
                required
                fullWidth
                autoComplete="new-password"
              />
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                type="email"
                value={newClientForm.invoiceEmail}
                onChange={handleNewClientChange}
                fullWidth
                autoComplete="new-password"
                placeholder="email@example.com or '-' for no email"
                error={
                  !!(
                    newClientForm.invoiceEmail &&
                    !isValidEmailOrDash(newClientForm.invoiceEmail)
                  )
                }
                helperText={
                  newClientForm.invoiceEmail &&
                  !isValidEmailOrDash(newClientForm.invoiceEmail)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
              <Autocomplete
                freeSolo
                options={newClientAddressOptions}
                getOptionLabel={(option) =>
                  typeof option === "string" ? option : option.description
                }
                value={newClientForm.address || ""}
                inputValue={newClientAddressInput}
                onInputChange={(_, value) =>
                  handleNewClientAddressInputChange(value)
                }
                onChange={(_, value) => {
                  if (value && value.place_id) {
                    handleNewClientAddressSelect(value.place_id);
                  } else if (typeof value === "string") {
                    // Handle manual text input
                    setNewClientForm((prev) => ({ ...prev, address: value }));
                    setNewClientAddressInput(value);
                  }
                }}
                loading={isNewClientAddressLoading}
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
              <Typography variant="h6" sx={{ mt: 2 }}>
                Primary Contact
              </Typography>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={newClientForm.contact1Name}
                onChange={handleNewClientChange}
                fullWidth
                autoComplete="new-password"
                placeholder="Contact name or '-' for no contact"
              />
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={newClientForm.contact1Number}
                onChange={handleNewClientChange}
                fullWidth
                autoComplete="new-password"
                placeholder="04xx xxx xxx (mobile) or 02 xxxx xxxx (landline) or '-' for no phone"
                error={
                  !!(
                    newClientForm.contact1Number &&
                    !isValidAustralianPhone(newClientForm.contact1Number)
                  )
                }
                helperText={
                  newClientForm.contact1Number &&
                  !isValidAustralianPhone(newClientForm.contact1Number)
                    ? "Please enter a valid Australian phone number (mobile or landline) or use '-' for no phone"
                    : ""
                }
              />
              <TextField
                label="Contact Email"
                name="contact1Email"
                value={newClientForm.contact1Email}
                onChange={handleNewClientChange}
                fullWidth
                autoComplete="new-password"
                placeholder="email@example.com or '-' for no email"
                error={
                  !!(
                    newClientForm.contact1Email &&
                    !isValidEmailOrDash(newClientForm.contact1Email)
                  )
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
                autoComplete="new-password"
                placeholder="Contact name or '-' for no contact"
              />
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={newClientForm.contact2Number}
                onChange={handleNewClientChange}
                fullWidth
                autoComplete="new-password"
                placeholder="04xx xxx xxx (mobile) or 02 xxxx xxxx (landline) or '-' for no phone"
                error={
                  !!(
                    newClientForm.contact2Number &&
                    !isValidAustralianPhone(newClientForm.contact2Number)
                  )
                }
                helperText={
                  newClientForm.contact2Number &&
                  !isValidAustralianPhone(newClientForm.contact2Number)
                    ? "Please enter a valid Australian phone number (mobile or landline) or use '-' for no phone"
                    : ""
                }
              />
              <TextField
                label="Contact Email"
                name="contact2Email"
                value={newClientForm.contact2Email}
                onChange={handleNewClientChange}
                fullWidth
                autoComplete="new-password"
                placeholder="email@example.com or '-' for no email"
                error={
                  !!(
                    newClientForm.contact2Email &&
                    !isValidEmailOrDash(newClientForm.contact2Email)
                  )
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
            Refresh Page
          </Button>
        </DialogActions>
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

      {/* Error Dialog */}
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
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
            <ErrorIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Error
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            {errorMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => setErrorDialogOpen(false)}
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

      {/* Project Audit Trail */}
      {isEditMode && (
        <Box
          ref={auditTrailRef}
          sx={{
            p: 3,
            mt: 3,
            backgroundColor: "#e8f5e8",
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            sx={{ cursor: "pointer" }}
            onClick={handleAuditTrailToggle}
          >
            <Typography variant="h6" gutterBottom sx={{ flexGrow: 1, mb: 0 }}>
              Project History
            </Typography>
            <IconButton size="small">
              {auditTrailExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={auditTrailExpanded}>
            {auditLoading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress />
              </Box>
            ) : auditError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {auditError}
              </Alert>
            ) : auditTrail.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No history available for this project.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>Event</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        User Name
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditTrail
                      .sort(
                        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
                      )
                      .map((entry, index) => {
                        // Format the event name
                        const getEventName = () => {
                          if (entry.action === "created")
                            return "Project Created";
                          if (entry.action === "status_changed")
                            return "Status Changed";
                          if (entry.action === "updated")
                            return `${entry.field} Updated`;
                          return entry.action || "Unknown Event";
                        };

                        // Format the details
                        const getDetails = () => {
                          if (entry.action === "status_changed") {
                            return `${entry.oldValue || "Not set"} → ${
                              entry.newValue
                            }`;
                          }
                          if (entry.action === "updated") {
                            return `${entry.oldValue || "Not set"} → ${
                              entry.newValue
                            }`;
                          }
                          if (entry.action === "created") {
                            return "Project was created";
                          }
                          return entry.newValue || "No details available";
                        };

                        // Format the user name
                        const getUserName = () => {
                          if (entry.changedBy) {
                            return `${entry.changedBy.firstName} ${entry.changedBy.lastName}`;
                          }
                          return "System";
                        };

                        return (
                          <TableRow key={entry._id || index} hover>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: "medium" }}
                              >
                                {getEventName()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(entry.timestamp).toLocaleDateString(
                                  "en-AU",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  }
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {getDetails()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {getUserName()}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Collapse>
        </Box>
      )}

      {/* Project Log Modal */}
      {logModalOpen && (
        <ProjectLogModalWrapper
          open={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          project={form}
        />
      )}

      {/* Client Details Dialog */}
      <Dialog
        open={clientDetailsDialogOpen}
        onClose={() => setClientDetailsDialogOpen(false)}
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
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              {selectedClient?.name?.charAt(0) || "C"}
            </Typography>
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Client Details
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          {loadingClientDetails ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : clientDetails ? (
            <Stack spacing={3}>
              {/* Basic Information */}
              <Box>
                <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                  Basic Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Client Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {clientDetails.name || "Not specified"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Invoice Email
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {clientDetails.invoiceEmail || "Not specified"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Terms
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {clientDetails.paymentTerms || "Not specified"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={clientDetails.isActive ? "Active" : "Inactive"}
                      color={clientDetails.isActive ? "success" : "default"}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Primary Contact */}
              {(clientDetails.contact1Name ||
                clientDetails.contact1Phone ||
                clientDetails.contact1Email) && (
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, color: "primary.main" }}
                  >
                    Primary Contact
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {clientDetails.contact1Name || "Not specified"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {clientDetails.contact1Phone || "Not specified"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {clientDetails.contact1Email || "Not specified"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Secondary Contact */}
              {(clientDetails.contact2Name ||
                clientDetails.contact2Phone ||
                clientDetails.contact2Email) && (
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, color: "primary.main" }}
                  >
                    Secondary Contact
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {clientDetails.contact2Name || "Not specified"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {clientDetails.contact2Phone || "Not specified"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {clientDetails.contact2Email || "Not specified"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Additional Information */}
              <Box>
                <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                  Additional Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      ABN
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {clientDetails.abn || "Not specified"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {clientDetails.address || "Not specified"}
                    </Typography>
                  </Grid>
                  {clientDetails.written_off && (
                    <Grid item xs={12}>
                      <Chip
                        label="WRITTEN OFF"
                        color="error"
                        variant="filled"
                        sx={{ fontWeight: "bold" }}
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            </Stack>
          ) : (
            <Alert severity="error">
              Failed to load client details. Please try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            component={Link}
            to={`/clients/${selectedClient?._id}`}
            variant="contained"
            color="primary"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
            onClick={() => setClientDetailsDialogOpen(false)}
          >
            Full Client Details Page
          </Button>
          <Button
            onClick={() => setClientDetailsDialogOpen(false)}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectInformation;
