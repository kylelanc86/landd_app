import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { projectService, clientService, userService } from "../../services/api";
import ProjectAuditService from "../../services/projectAuditService";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";
import { usePermissions } from "../../hooks/usePermissions";
import { StatusChip } from "../../components/JobStatus";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
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
  const { currentUser } = useAuth();
  const { can, isAdmin, isManager } = usePermissions();
  const canWriteOff = can("clients.write_off");
  const isEditMode = Boolean(id && id !== "new" && id !== "add-new");

  // Debug: Log the isEditMode calculation
  useEffect(() => {
    console.log("🔍 isEditMode calculation:", {
      id,
      isEditMode,
      idType: typeof id,
      idValue: id,
    });
  }, [id, isEditMode]);
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

  // Audit trail state
  const [auditTrail, setAuditTrail] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  // State for tracking form changes and confirmation dialog
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
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
    isLargeProject: false,
    projectContact: {
      name: "",
      number: "",
      email: "",
    },
  });

  // Debug: Log form state changes, especially _id and projectID
  useEffect(() => {
    console.log("🔍 Form state changed:", {
      projectID: form.projectID,
      hasProjectID: !!form.projectID,
      projectIDType: typeof form.projectID,
      _id: form._id,
      hasId: !!form._id,
      idType: typeof form._id,
      isEditMode,
      formKeys: Object.keys(form),
      formValues: form,
    });
  }, [form, isEditMode]);

  // Track form changes and compare with original values
  useEffect(() => {
    console.log("🔍 Unsaved changes check:", {
      hasOriginalForm: !!originalForm,
      isEditMode,
      formKeys: Object.keys(form),
      originalFormKeys: originalForm ? Object.keys(originalForm) : null,
    });

    // Track changes for both edit mode and add mode
    if (originalForm) {
      const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);
      console.log("🔍 Form change detection:", {
        hasChanges,
        formString: JSON.stringify(form),
        originalFormString: JSON.stringify(originalForm),
      });
      setHasUnsavedChanges(hasChanges);

      // Set global variables for sidebar navigation
      window.hasUnsavedChanges = hasChanges;
      window.currentProjectPath = window.location.pathname;
      window.showUnsavedChangesDialog = () => {
        setUnsavedChangesDialogOpen(true);
      };
    } else {
      console.log("🔍 Not tracking changes - no originalForm");
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
  }, [form, originalForm, isEditMode]);

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
        console.log(
          "🚫 Blocking navigation to:",
          targetPath,
          "due to unsaved changes"
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
        !href.startsWith("/projects/") &&
        href !== "/projects" &&
        !href.startsWith("/projects")
      ) {
        console.log(
          "🚫 Blocking link navigation to:",
          href,
          "due to unsaved changes"
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

  const [clientInputValue, setClientInputValue] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [isClientSearching, setIsClientSearching] = useState(false);
  const [isGeneratingId, setIsGeneratingId] = useState(false);
  const [idGenerated, setIdGenerated] = useState(false);

  // Get project statuses from custom data fields
  const { activeStatuses, inactiveStatuses, statusColors } =
    useProjectStatuses();

  // Debug: Log what we're getting from the hook
  useEffect(() => {
    console.log("🔍 ProjectInformation - Status data from hook:", {
      activeStatuses,
      inactiveStatuses,
      statusColors,
      activeStatusesLength: activeStatuses?.length,
      inactiveStatusesLength: inactiveStatuses?.length,
    });
  }, [activeStatuses, inactiveStatuses, statusColors]);

  // Set default status when statuses are loaded
  useEffect(() => {
    console.log("🔍 Setting default status:", {
      activeStatusesLength: activeStatuses?.length,
      currentFormStatus: form.status,
      firstActiveStatus: activeStatuses?.[0],
    });

    if (activeStatuses.length > 0 && !form.status) {
      // Extract text from status object if it's an object
      const defaultStatus =
        typeof activeStatuses[0] === "string"
          ? activeStatuses[0]
          : activeStatuses[0].text;
      console.log("🔍 Setting default status to:", defaultStatus);
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
      const restrictedStatuses = ["Job complete", "Cancelled"];

      // If user is employee (not admin or manager), filter out restricted statuses
      if (!isAdmin && !isManager) {
        const filteredActive = active.filter(
          (status) => !restrictedStatuses.includes(status)
        );
        const filteredInactive = inactive.filter(
          (status) => !restrictedStatuses.includes(status)
        );

        console.log("🔍 getAccessibleStatuses (employee filtered):", {
          activeStatuses,
          inactiveStatuses,
          extractedActive: active,
          extractedInactive: inactive,
          filteredActive,
          filteredInactive,
        });

        return { active: filteredActive, inactive: filteredInactive };
      }

      console.log("🔍 getAccessibleStatuses (admin/manager):", {
        activeStatuses,
        inactiveStatuses,
        extractedActive: active,
        extractedInactive: inactive,
      });

      return { active, inactive };
    }
    return { active: [], inactive: [] };
  }, [isAdmin, isManager, can, activeStatuses, inactiveStatuses]);

  // Memoize the status menu items to prevent recreation on every render
  const statusMenuItems = useMemo(() => {
    console.log("🔍 Creating status menu items");

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
      const restrictedStatuses = ["Job complete", "Cancelled"];

      // If user is employee (not admin or manager), filter out restricted statuses
      if (!isAdmin && !isManager) {
        const filteredActive = active.filter(
          (status) => !restrictedStatuses.includes(status)
        );
        const filteredInactive = inactive.filter(
          (status) => !restrictedStatuses.includes(status)
        );

        console.log("🔍 getAccessibleStatuses (employee filtered):", {
          activeStatuses,
          inactiveStatuses,
          extractedActive: active,
          extractedInactive: inactive,
          filteredActive,
          filteredInactive,
        });

        return { active: filteredActive, inactive: filteredInactive };
      }

      console.log("🔍 getAccessibleStatuses (admin/manager):", {
        activeStatuses,
        inactiveStatuses,
        extractedActive: active,
        extractedInactive: inactive,
      });

      return { active, inactive };
    }
    return { active: [], inactive: [] };
  };

  const generateNextProjectId = useCallback(async () => {
    console.log("🔍 generateNextProjectId called");
    console.log("🔍 form.isLargeProject:", form.isLargeProject);
    console.log("🔍 Current form state:", {
      projectID: form.projectID,
      _id: form._id,
      hasProjectID: !!form.projectID,
      hasId: !!form._id,
    });

    try {
      console.log("🔍 Fetching all projects...");
      const response = await projectService.getAll();
      console.log("🔍 Projects response:", {
        hasData: !!response.data,
        dataType: typeof response.data,
        dataLength: response.data?.length,
        responseKeys: Object.keys(response),
        fullResponse: response,
        responseDataKeys: response.data ? Object.keys(response.data) : [],
        responseDataData: response.data?.data,
        responseDataDataType: typeof response.data?.data,
        responseDataDataLength: response.data?.data?.length,
      });

      // Handle nested response structure where projects might be in response.data.data
      const projects = response.data?.data || response.data;
      console.log("🔍 Projects data:", projects);
      console.log("🔍 Number of projects:", projects?.length);
      console.log("🔍 Response structure analysis:", {
        hasData: !!response.data,
        hasNestedData: !!response.data?.data,
        responseDataType: typeof response.data,
        nestedDataType: typeof response.data?.data,
        isArray: Array.isArray(projects),
        projectsLength: projects?.length,
      });

      // Log sample project structure
      if (projects && Array.isArray(projects) && projects.length > 0) {
        console.log("🔍 Sample project structure:", {
          firstProject: projects[0],
          firstProjectKeys: Object.keys(projects[0]),
          firstProjectID: projects[0]?.projectID,
          firstProjectId: projects[0]?._id,
        });
      } else {
        console.log("🔍 No valid projects array found:", {
          projects,
          projectsType: typeof projects,
          isArray: Array.isArray(projects),
          hasLength: projects?.length !== undefined,
        });
      }

      // Ensure we have a valid projects array
      if (!Array.isArray(projects)) {
        console.error("🔍 Error: projects is not an array:", {
          projects,
          projectsType: typeof projects,
          responseData: response.data,
        });
        throw new Error("Invalid projects data structure received from API");
      }

      if (form.isLargeProject) {
        console.log("🔍 Generating HAZ prefix for large project");
        // Generate HAZ prefix for large projects
        const largeProjects = projects.filter(
          (p) => p.projectID && p.projectID.startsWith("HAZ")
        );
        console.log("🔍 Large projects found:", largeProjects);
        console.log(
          "🔍 Large project IDs:",
          largeProjects.map((p) => ({ projectID: p.projectID, _id: p._id }))
        );

        const lastLargeProject = largeProjects.sort((a, b) => {
          const numA = parseInt(a.projectID.slice(3));
          const numB = parseInt(b.projectID.slice(3));
          return numB - numA;
        })[0];

        console.log("🔍 Last large project:", lastLargeProject);

        const nextNum = lastLargeProject
          ? parseInt(lastLargeProject.projectID.slice(3)) + 1
          : 1;

        console.log("🔍 Large project ID calculation:", {
          lastLargeProject,
          lastProjectID: lastLargeProject?.projectID,
          extractedNumber: lastLargeProject
            ? parseInt(lastLargeProject.projectID.slice(3))
            : null,
          nextNum,
        });

        const nextId = `HAZ${String(nextNum).padStart(3, "0")}`;
        console.log("🔍 Generated HAZ ID:", nextId);
        return nextId;
      } else {
        console.log("🔍 Generating LDJ prefix for regular project");
        // Generate LDJ prefix for regular projects
        const regularProjects = projects.filter(
          (p) => p.projectID && p.projectID.startsWith("LDJ")
        );
        console.log("🔍 Regular projects found:", regularProjects);
        console.log(
          "🔍 Regular project IDs:",
          regularProjects.map((p) => ({ projectID: p.projectID, _id: p._id }))
        );

        const lastProject = regularProjects.sort((a, b) => {
          const numA = parseInt(a.projectID.slice(3));
          const numB = parseInt(b.projectID.slice(3));
          return numB - numA;
        })[0];

        console.log("🔍 Last regular project:", lastProject);

        const nextNum = lastProject
          ? parseInt(lastProject.projectID.slice(3)) + 1
          : 1;

        console.log("🔍 Regular project ID calculation:", {
          lastProject,
          lastProjectID: lastProject?.projectID,
          extractedNumber: lastProject
            ? parseInt(lastProject.projectID.slice(3))
            : null,
          nextNum,
        });

        const nextId = `LDJ${String(nextNum).padStart(5, "0")}`;
        console.log("🔍 Generated LDJ ID:", nextId);
        return nextId;
      }
    } catch (error) {
      console.error("🔍 Error generating project ID:", error);
      console.error("🔍 Error details:", {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error("Failed to generate project ID");
    }
  }, [form.isLargeProject]);

  // Pre-generate project ID when form becomes valid
  const preGenerateProjectId = useCallback(
    async (forceRegenerate = false) => {
      if (isEditMode || (idGenerated && !forceRegenerate) || isGeneratingId) {
        return;
      }

      // Only generate if we have basic required info
      if (!form.name || !form.client) {
        return;
      }

      try {
        setIsGeneratingId(true);
        console.log("🔍 Pre-generating project ID...");
        const nextId = await generateNextProjectId();
        console.log("🔍 Pre-generated project ID:", nextId);

        setForm((prev) => ({ ...prev, projectID: nextId }));
        setIdGenerated(true);
      } catch (error) {
        console.error("🔍 Error pre-generating project ID:", error);
        // Don't show error to user, will fall back to generation on submit
        setIdGenerated(false);
      } finally {
        setIsGeneratingId(false);
      }
    },
    [
      isEditMode,
      idGenerated,
      isGeneratingId,
      form.name,
      form.client,
      generateNextProjectId,
    ]
  );

  useEffect(() => {
    console.log("ProjectInformation component mounted");
  }, []);

  // Trigger pre-generation when form becomes valid
  useEffect(() => {
    preGenerateProjectId();
  }, [preGenerateProjectId]);

  // Regenerate ID when large project setting changes
  useEffect(() => {
    if (form.name && form.client) {
      preGenerateProjectId(true);
    }
  }, [form.isLargeProject, form.name, form.client, preGenerateProjectId]);

  // Function to fetch audit trail
  const fetchAuditTrail = async (projectId) => {
    if (!projectId) return;

    try {
      setAuditLoading(true);
      setAuditError(null);
      const response = await ProjectAuditService.getAllProjectAuditTrail(
        projectId
      );
      console.log("🔍 Audit trail response:", response);
      console.log("🔍 Audit trail entries:", response.auditTrail);
      setAuditTrail(response.auditTrail || []);
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      setAuditError("Failed to load audit trail");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const pageLoadStartTime = performance.now();
      console.log("🚀 PROJECT INFO PAGE LOAD START", {
        operation: isEditMode ? "EDIT" : "ADD",
        projectId: id,
        timestamp: new Date().toISOString(),
      });

      console.log("fetchData called with id:", id);
      console.log("isEditMode:", isEditMode);
      try {
        setLoading(true);
        setError(null);

        // Fetch clients and users
        const clientsUsersStartTime = performance.now();
        const [clientsRes, usersRes] = await Promise.all([
          clientService.getAll({ limit: 100 }),
          userService.getAll(),
        ]);
        const clientsUsersTime = performance.now() - clientsUsersStartTime;
        console.log("✅ CLIENTS & USERS FETCH COMPLETE", {
          clientsCount:
            clientsRes.data?.clients?.length || clientsRes.data?.length || 0,
          usersCount: usersRes.data?.length || 0,
          apiTime: `${clientsUsersTime.toFixed(2)}ms`,
        });

        setClients(clientsRes.data.clients || clientsRes.data);
        setUsers(usersRes.data);

        // If we're in edit mode, fetch the project data
        if (id && id !== "new" && id !== "add-new" && id !== "undefined") {
          try {
            const projectFetchStartTime = performance.now();
            console.log("🔍 Fetching project with ID:", id);
            const projectRes = await projectService.getById(id);
            const projectFetchTime = performance.now() - projectFetchStartTime;
            console.log("✅ PROJECT FETCH COMPLETE", {
              projectId: id,
              apiTime: `${projectFetchTime.toFixed(2)}ms`,
              hasData: !!projectRes.data,
            });
            console.log("🔍 Project API response:", {
              hasData: !!projectRes.data,
              dataKeys: projectRes.data ? Object.keys(projectRes.data) : [],
              projectID: projectRes.data?.projectID,
              _id: projectRes.data?._id,
              responseType: typeof projectRes.data,
              fullResponse: projectRes,
            });

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

            console.log("🔍 Processed project data:", {
              projectID: projectData.projectID,
              _id: projectData._id,
              hasProjectID: !!projectData.projectID,
              hasId: !!projectData._id,
              processedKeys: Object.keys(projectData),
            });

            console.log("🔍 About to setForm with projectData:", {
              projectID: projectData.projectID,
              _id: projectData.projectID,
              hasProjectID: !!projectData.projectID,
              hasId: !!projectData._id,
              dataKeys: Object.keys(projectData),
            });
            setForm(projectData);
            // Store original form values for change tracking
            setOriginalForm(JSON.parse(JSON.stringify(projectData)));

            // Fetch audit trail for existing projects
            const auditStartTime = performance.now();
            await fetchAuditTrail(projectData._id);
            const auditTime = performance.now() - auditStartTime;
            console.log("✅ AUDIT TRAIL FETCH COMPLETE", {
              projectId: projectData._id,
              apiTime: `${auditTime.toFixed(2)}ms`,
            });
          } catch (projectErr) {
            console.error("Error fetching project:", projectErr);
            if (projectErr.response) {
              console.error("Response data:", projectErr.response.data);
              console.error("Response status:", projectErr.response.status);
            }
            setError("Failed to load project data. Please try again.");
            navigate("/projects");
          }
        } else if (!id || id === "new" || id === "add-new") {
          // Don't generate Project ID yet - wait for form submission
          console.log("🔍 New project mode - setting empty users array");
          setForm((prev) => ({ ...prev, users: [] }));
          // Set original form for change tracking in new project mode
          setOriginalForm(
            JSON.parse(
              JSON.stringify({
                projectID: "",
                name: "",
                client: null,
                department: "Asbestos & HAZMAT",
                status: "",
                address: "",
                d_Date: "",
                startDate: "",
                endDate: "",
                description: "",
                workOrder: 1,
                users: [],
                isLargeProject: false,
                projectContact: {
                  name: "",
                  number: "",
                  email: "",
                },
                notes: "",
              })
            )
          );
        } else {
          // Invalid ID, redirect to projects list
          console.log("🔍 Invalid ID, redirecting to projects list:", id);
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
        const totalPageLoadTime = performance.now() - pageLoadStartTime;
        console.log("✅ PROJECT INFO PAGE LOAD COMPLETE", {
          operation: isEditMode ? "EDIT" : "ADD",
          projectId: id,
          totalTime: `${totalPageLoadTime.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });
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

    // Always update the form state, even for empty values
    setForm((prev) => ({ ...prev, address: value }));

    if (!value || value.length < 2 || !autocompleteService || !googleMaps) {
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

  // Handle new client address input change for autocomplete
  const handleNewClientAddressInputChange = async (value) => {
    if (!autocompleteService || !value || value.length < 2) {
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
          setNewClientForm((prev) => ({
            ...prev,
            address: place.formatted_address,
          }));
          setNewClientAddressInput(place.formatted_address);
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

  // Override navigate function to check for unsaved changes
  const safeNavigate = (path) => {
    console.log("🔍 safeNavigate called:", {
      path,
      hasUnsavedChanges,
      isEditMode,
    });
    if (hasUnsavedChanges) {
      console.log("🔍 Showing unsaved changes dialog");
      setPendingNavigation(path);
      setUnsavedChangesDialogOpen(true);
    } else {
      console.log("🔍 Navigating directly");
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
    console.log("🔍 isEditMode:", isEditMode);
    console.log("🔍 Current user:", currentUser);
    console.log("🔍 URL params id:", id);

    try {
      if (isEditMode) {
        const updateStartTime = performance.now();
        console.log("🔄 PROJECT UPDATE START", {
          projectId: id,
          timestamp: new Date().toISOString(),
        });

        console.log("🔍 Updating existing project with ID:", id);
        console.log("🔍 Update payload:", {
          id,
          form,
          formProjectID: form.projectID,
          formId: form._id,
        });

        const apiStartTime = performance.now();
        const response = await projectService.update(id, form);
        const apiEndTime = performance.now();

        console.log("✅ PROJECT UPDATE API COMPLETE", {
          projectId: id,
          apiTime: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
          totalTime: `${(apiEndTime - updateStartTime).toFixed(2)}ms`,
          responseSize: JSON.stringify(response).length,
        });
        console.log("🔍 Update response:", response);
      } else {
        const createStartTime = performance.now();
        console.log("🆕 PROJECT CREATE START", {
          timestamp: new Date().toISOString(),
          hasPreGeneratedId: !!form.projectID,
        });

        console.log("🔍 Creating new project");
        console.log("🔍 Form before Project ID generation:", form);
        console.log("🔍 Form structure before ID generation:", {
          projectID: form.projectID,
          _id: form._id,
          hasProjectID: !!form.projectID,
          hasId: !!form._id,
        });

        // Use pre-generated ID or generate one as fallback
        let projectId = form.projectID;
        let idGenerationTime = 0;

        if (!projectId) {
          console.log("🔍 No pre-generated ID, generating now...");
          const idStartTime = performance.now();
          projectId = await generateNextProjectId();
          idGenerationTime = performance.now() - idStartTime;
          console.log("🔍 Generated Project ID:", projectId);
          console.log(
            "⏱️ ID Generation Time:",
            `${idGenerationTime.toFixed(2)}ms`
          );
        } else {
          console.log("🔍 Using pre-generated Project ID:", projectId);
        }

        const formWithId = { ...form, projectID: projectId };
        console.log("🔍 Form with Project ID:", formWithId);
        console.log("🔍 Form with ID structure:", {
          projectID: formWithId.projectID,
          _id: formWithId._id,
          hasProjectID: !!formWithId.projectID,
          hasId: !!formWithId._id,
          allKeys: Object.keys(formWithId),
        });

        console.log("🔍 Calling projectService.create...");
        const apiStartTime = performance.now();
        const response = await projectService.create(formWithId);
        const apiEndTime = performance.now();

        console.log("✅ PROJECT CREATE API COMPLETE", {
          projectId: projectId,
          apiTime: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
          idGenerationTime: `${idGenerationTime.toFixed(2)}ms`,
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

        // Navigate to projects page after successful creation
        navigate("/projects");
        return; // Exit early to avoid the navigate("/projects") call
      }

      const operationEndTime = performance.now();
      const totalOperationTime = operationEndTime - operationStartTime;
      console.log("✅ PROJECT OPERATION COMPLETE", {
        operation: isEditMode ? "UPDATE" : "CREATE",
        projectId: isEditMode ? id : form.projectID,
        totalTime: `${totalOperationTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });

      console.log("🔍 Success!");

      // Show success message
      setSnackbar({
        open: true,
        message: isEditMode
          ? "Project updated successfully!"
          : "Project created successfully!",
        severity: "success",
      });

      // Reset unsaved changes flag and update original form
      setHasUnsavedChanges(false);
      if (isEditMode) {
        setOriginalForm(JSON.parse(JSON.stringify(form)));
        // Refresh audit trail after update
        await fetchAuditTrail(form._id);
        // Navigate to projects page after successful update
        navigate("/projects");
      }
    } catch (error) {
      const operationEndTime = performance.now();
      const totalOperationTime = operationEndTime - operationStartTime;
      console.log("❌ PROJECT OPERATION ERROR", {
        operation: isEditMode ? "UPDATE" : "CREATE",
        projectId: isEditMode ? id : form.projectID,
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
      // Success - navigate to projects list
      navigate("/projects");
    } catch (error) {
      console.error("❌ PROJECT DELETE ERROR", {
        projectId: id,
        error: error.message,
        totalTime: `${(performance.now() - deleteStartTime).toFixed(2)}ms`,
      });
      setError("Failed to delete project. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb={3}>
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
              <Grid item xs={12}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="h6" color="text.secondary">
                    Project ID:{" "}
                    {isEditMode
                      ? form.projectID
                      : form.projectID
                      ? form.projectID
                      : isGeneratingId
                      ? "Generating..."
                      : "Will be auto-generated"}
                  </Typography>
                  {!isEditMode && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: "italic" }}
                    >
                      {form.projectID
                        ? "(Ready)"
                        : isGeneratingId
                        ? "(Generating...)"
                        : "(Auto-generated)"}
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
                  autoComplete="new-password"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Number"
                  name="projectContact.number"
                  value={form.projectContact?.number || ""}
                  onChange={handleChange}
                  autoComplete="new-password"
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
                  autoComplete="new-password"
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
                      onClick={() => safeNavigate("/projects")}
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
                autoComplete="new-password"
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
                autoComplete="new-password"
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

      {/* Project Audit Trail */}
      {isEditMode && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Project History
          </Typography>

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
                    <TableCell sx={{ fontWeight: "bold" }}>User Name</TableCell>
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
                            <Typography variant="body2" color="text.secondary">
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
        </Paper>
      )}
    </Box>
  );
};

export default ProjectInformation;
