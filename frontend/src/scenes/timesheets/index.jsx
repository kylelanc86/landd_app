import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Autocomplete,
  InputAdornment,
  Stack,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
import LoadingSpinner from "../../components/LoadingSpinner";
import api from "../../services/api";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import SearchIcon from "@mui/icons-material/Search";
import WorkIcon from "@mui/icons-material/Work";
import { format, addDays, subDays, parseISO } from "date-fns";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useNavigate, useSearchParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { debounce } from "lodash";

const Timesheets = () => {
  const theme = useTheme();
  const { currentUser, loading: authLoading } = useAuth();
  const { activeStatuses } = useProjectStatuses();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get("date");
    return dateParam ? parseISO(dateParam) : new Date();
  });
  const [targetUserId, setTargetUserId] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [formData, setFormData] = useState({
    startTime: "",
    endTime: "",
    projectId: "",
    description: "",
    isAdminWork: false,
    isBreak: false,
    projectInputType: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [timesheetStatus, setTimesheetStatus] = useState("incomplete");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingEntries, setProcessingEntries] = useState(new Set());
  const [successEntries, setSuccessEntries] = useState(new Set());
  const [show24HourView, setShow24HourView] = useState(false);
  const calendarRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?._id) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const dateParam = searchParams.get("date");
    const userIdParam = searchParams.get("userId");

    // Set the target user ID - prioritize URL parameter over current user
    const newTargetUserId = userIdParam || currentUser._id;
    setTargetUserId(newTargetUserId);

    // Set the selected date if provided in URL
    if (dateParam) {
      setSelectedDate(new Date(dateParam));
    }
  }, [currentUser?._id, window.location.search]);

  // Update URL when state changes (but don't trigger infinite loop)
  useEffect(() => {
    if (!targetUserId) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const currentDate = searchParams.get("date");
    const currentUserId = searchParams.get("userId");

    const newDate = format(selectedDate, "yyyy-MM-dd");

    // Only update URL if values have actually changed
    if (currentDate !== newDate || currentUserId !== targetUserId) {
      searchParams.set("date", newDate);
      searchParams.set("userId", targetUserId);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${searchParams.toString()}`
      );
    }
  }, [selectedDate, targetUserId]);

  const fetchTimeEntries = async () => {
    if (!targetUserId) {
      return;
    }

    try {
      setIsLoading(true);
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const response = await api.get(
        `/timesheets/range/${formattedDate}/${formattedDate}?userId=${targetUserId}`
      );

      // Handle both response structures
      const entries = Array.isArray(response.data)
        ? response.data
        : response.data.entries || response.data.data || [];

      if (!Array.isArray(entries)) {
        setTimeEntries([]);
        return;
      }

      const processedEntries = entries.map((entry) => {
        const entryDate = entry.date
          ? format(new Date(entry.date), "yyyy-MM-dd")
          : formattedDate;

        const processedEntry = {
          ...entry,
          date: entryDate,
          startTime: entry.startTime || "00:00",
          endTime: entry.endTime || "00:00",
          projectId: entry.projectId?._id || entry.projectId,
          projectInputType: entry.projectInputType || "",
          description: entry.description || "",
          isAdminWork: entry.isAdminWork || false,
          isBreak: entry.isBreak || false,
        };

        return processedEntry;
      });

      setTimeEntries(processedEntries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      setTimeEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTimesheetStatus = async () => {
    if (!targetUserId) {
      return;
    }

    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const response = await api.get(
        `/timesheets/status/range/${formattedDate}/${formattedDate}?userId=${targetUserId}`
      );

      // Handle both response structures
      const statusData = Array.isArray(response.data)
        ? response.data
        : response.data.entries || response.data.data || [];

      const status = statusData?.[0]?.status || "incomplete";
      setTimesheetStatus(status);
    } catch (error) {
      console.error("Error fetching timesheet status:", error);
      setTimesheetStatus("incomplete");
    }
  };

  const handleStatusUpdate = async (status) => {
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      const response = await api.put(`/timesheets/status/${formattedDate}`, {
        status,
        userId: targetUserId,
        date: formattedDate,
      });

      setTimesheetStatus(status);
      await fetchTimeEntries();
    } catch (error) {
      setErrorMessage("Failed to update timesheet status. Please try again.");
      setErrorDialogOpen(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!targetUserId) {
      setErrorMessage(
        "Error: No user ID available. Please try logging in again."
      );
      setErrorDialogOpen(true);
      return;
    }

    try {
      if (timesheetStatus === "finalised") {
        setErrorMessage(
          "Cannot modify entries for a finalised timesheet. Please unfinalise first."
        );
        setErrorDialogOpen(true);
        return;
      }

      if (formData.isAdminWork || formData.isBreak) {
        if (!formData.description) {
          formData.description = "";
        }
      } else {
        if (!formData.projectId) {
          setErrorMessage("Please select a project");
          setErrorDialogOpen(true);
          return;
        }
        if (!formData.projectInputType) {
          setErrorMessage("Please select a project input type");
          setErrorDialogOpen(true);
          return;
        }
      }

      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      const timesheetData = {
        date: formattedDate,
        userId: targetUserId,
        startTime: formData.startTime,
        endTime: formData.endTime,
        description: formData.description || "",
        isAdminWork: formData.isAdminWork,
        isBreak: formData.isBreak,
      };

      if (!formData.isAdminWork && !formData.isBreak) {
        timesheetData.projectId = formData.projectId;
        timesheetData.projectInputType = formData.projectInputType;
      }

      // Optimistically update UI immediately
      const optimisticEntry = {
        _id: isEditing ? editingEntryId : `temp_${Date.now()}`,
        ...timesheetData,
        projectId:
          isEditing && editingEntryId
            ? timeEntries.find((entry) => entry._id === editingEntryId)
                ?.projectId
            : formData.projectId,
        projectInputType: formData.projectInputType || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mark entry as processing
      setProcessingEntries((prev) => new Set(prev).add(optimisticEntry._id));

      if (isEditing && editingEntryId) {
        // Update existing entry optimistically
        setTimeEntries((prev) =>
          prev.map((entry) =>
            entry._id === editingEntryId ? optimisticEntry : entry
          )
        );
      } else {
        // Add new entry optimistically
        setTimeEntries((prev) => [...prev, optimisticEntry]);
      }

      // Close dialog and reset form immediately
      setOpenDialog(false);
      setFormData({
        startTime: "",
        endTime: "",
        projectId: "",
        description: "",
        isAdminWork: false,
        isBreak: false,
        projectInputType: "",
      });
      setIsEditing(false);
      setEditingEntryId(null);

      // Make API call in background
      try {
        if (isEditing && editingEntryId) {
          await api.put(`/timesheets/${editingEntryId}`, timesheetData);
        } else {
          const response = await api.post("/timesheets", timesheetData);
          // Update the temporary ID with the real one from the server
          setTimeEntries((prev) =>
            prev.map((entry) =>
              entry._id === optimisticEntry._id ? response.data : entry
            )
          );
        }

        // Show brief success state
        setSuccessEntries((prev) => new Set(prev).add(optimisticEntry._id));
        setTimeout(() => {
          setSuccessEntries((prev) => {
            const newSet = new Set(prev);
            newSet.delete(optimisticEntry._id);
            return newSet;
          });
        }, 2000);

        // Only fetch timesheet status, not entries (we already have them)
        fetchTimesheetStatus();
      } catch (apiError) {
        console.error("Error saving timesheet entry:", apiError);

        // Revert optimistic update on error
        if (isEditing && editingEntryId) {
          setTimeEntries((prev) =>
            prev.map((entry) =>
              entry._id === editingEntryId
                ? timeEntries.find((e) => e._id === editingEntryId)
                : entry
            )
          );
        } else {
          setTimeEntries((prev) =>
            prev.filter((entry) => entry._id !== optimisticEntry._id)
          );
        }

        setErrorMessage(
          apiError.response?.data?.message || "Error saving time entry"
        );
        setErrorDialogOpen(true);
      } finally {
        // Remove processing state
        setProcessingEntries((prev) => {
          const newSet = new Set(prev);
          newSet.delete(optimisticEntry._id);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setErrorMessage(
        error.response?.data?.message || "Error saving time entry"
      );
      setErrorDialogOpen(true);
    }
  };

  const handleDelete = async (entryId) => {
    try {
      // Store the entry to restore if deletion fails
      const entryToRestore = timeEntries.find((entry) => entry._id === entryId);

      // Mark entry as processing
      setProcessingEntries((prev) => new Set(prev).add(entryId));

      // Optimistically remove from UI immediately
      setTimeEntries((prev) => prev.filter((entry) => entry._id !== entryId));
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);

      // Make API call in background
      try {
        await api.delete(`/timesheets/${entryId}`);

        // Show brief success state
        setSuccessEntries((prev) => new Set(prev).add(entryId));
        setTimeout(() => {
          setSuccessEntries((prev) => {
            const newSet = new Set(prev);
            newSet.delete(entryId);
            return newSet;
          });
        }, 2000);

        // Only fetch timesheet status, not entries (we already removed it from state)
        fetchTimesheetStatus();
      } catch (apiError) {
        console.error("Error deleting time entry:", apiError);

        // Revert optimistic update on error
        if (entryToRestore) {
          setTimeEntries((prev) => [...prev, entryToRestore]);
        }

        setErrorMessage(
          apiError.response?.data?.message || "Error deleting time entry"
        );
        setErrorDialogOpen(true);
      } finally {
        // Remove processing state
        setProcessingEntries((prev) => {
          const newSet = new Set(prev);
          newSet.delete(entryId);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error in handleDelete:", error);
      setErrorMessage(
        error.response?.data?.message || "Error deleting time entry"
      );
      setErrorDialogOpen(true);

      // Remove processing state
      setProcessingEntries((prev) => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const handleDeleteClick = (entryId) => {
    setEntryToDelete(entryId);
    setDeleteConfirmOpen(true);
  };

  const handleDayChange = (direction) => {
    const newDate =
      direction === "next"
        ? addDays(selectedDate, 1)
        : subDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  // Helper function to sort projects by projectID descending
  const sortProjectsByID = (projectsList) => {
    return [...projectsList].sort((a, b) => {
      // Handle cases where projectID might be undefined
      const aProjectID = a.projectID || "";
      const bProjectID = b.projectID || "";

      // Extract numeric part from projectID (e.g., "LDJ00001" -> 1)
      const aNum = parseInt(aProjectID.replace(/\D/g, ""), 10) || 0;
      const bNum = parseInt(bProjectID.replace(/\D/g, ""), 10) || 0;
      return bNum - aNum; // Descending order
    });
  };

  // Fetch data when targetUserId or selectedDate changes
  useEffect(() => {
    if (!targetUserId) {
      return;
    }

    const fetchData = async () => {
      try {
        await Promise.all([fetchTimeEntries(), fetchTimesheetStatus()]);
      } catch (error) {
        console.error("Error fetching timesheet data:", error);
      }
    };

    fetchData();
  }, [targetUserId, selectedDate]);

  // Fetch projects separately to avoid infinite loop
  useEffect(() => {
    const fetchProjects = async () => {
      // Don't fetch if we don't have active statuses yet
      if (!activeStatuses || activeStatuses.length === 0) {
        return;
      }

      try {
        // Build status parameter from active statuses
        const statusParam = activeStatuses.join(",");
        const projectsResponse = await api.get(
          `/projects?status=${statusParam}&limit=1000`
        );
        const projectsData = Array.isArray(projectsResponse.data)
          ? projectsResponse.data
          : projectsResponse.data.projects || projectsResponse.data.data || [];
        const sortedProjects = sortProjectsByID(projectsData);
        setProjects(sortedProjects);
        setFilteredProjects(sortedProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    fetchProjects();
  }, [activeStatuses]); // Run when activeStatuses change

  // Update filtered projects when projects change
  useEffect(() => {
    setFilteredProjects(projects);
  }, [projects]);

  // Debounced project search
  const debouncedProjectSearch = debounce((searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredProjects(projects);
      return;
    }

    const filtered = projects.filter(
      (project) =>
        (project.name &&
          project.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.projectID &&
          project.projectID.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const sortedFiltered = sortProjectsByID(filtered);
    setFilteredProjects(sortedFiltered);
  }, 300);

  // Handle project search input change
  const handleProjectSearchChange = (event, newValue) => {
    setProjectSearch(newValue);
    debouncedProjectSearch(newValue);
  };

  const getCalendarEvents = useCallback(() => {
    return timeEntries.map((entry) => {
      const startDateTime = new Date(entry.date);
      const [startHours, startMinutes] = entry.startTime.split(":").map(Number);
      startDateTime.setHours(startHours, startMinutes, 0);

      const endDateTime = new Date(entry.date);
      const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
      endDateTime.setHours(endHours, endMinutes, 0);

      const projectId = entry.projectId?._id || entry.projectId;
      const project = projects.find((p) => p._id === projectId);
      const projectName = project?.name || "Unknown Project";

      let title = "";
      let backgroundColor = "";
      let borderColor = "";
      let textColor = "";
      let className = "";

      if (entry.isBreak) {
        title = `Break${entry.description ? ` - ${entry.description}` : ""}`;
        backgroundColor = `linear-gradient(135deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[700]} 100%)`;
        borderColor = theme.palette.grey[700];
        textColor = theme.palette.grey[500];
        className = "break-event";
      } else if (entry.isAdminWork) {
        title = `Admin Work${
          entry.description ? ` - ${entry.description}` : ""
        }`;
        backgroundColor = `linear-gradient(135deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[700]} 100%)`;
        borderColor = theme.palette.grey[700];
        textColor = theme.palette.grey[500];
        className = "admin-event";
      } else {
        title = `${projectName} - ${
          entry.projectInputType?.replace("_", " ") || ""
        }${entry.description ? `, ${entry.description}` : ""}`;
        backgroundColor = `linear-gradient(135deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[700]} 100%)`;
        borderColor = theme.palette.grey[700];
        textColor = theme.palette.grey[500];
        className = "project-event";
      }

      const event = {
        id: entry._id,
        title,
        start: startDateTime,
        end: endDateTime,
        backgroundColor,
        borderColor,
        textColor,
        className,
        extendedProps: {
          description: entry.description,
          projectId: projectId,
          projectName,
          isAdminWork: entry.isAdminWork,
          isBreak: entry.isBreak,
          projectInputType: entry.projectInputType,
        },
      };

      return event;
    });
  }, [timeEntries, projects, theme.palette.grey]);

  // Memoize the events array to prevent unnecessary recalculations
  const calendarEvents = useMemo(
    () => getCalendarEvents(),
    [getCalendarEvents]
  );

  // Generate a key to force FullCalendar re-render when events change
  const calendarKey = useMemo(() => {
    return `${format(selectedDate, "yyyy-MM-dd")}-${
      timeEntries.length
    }-${Date.now()}`;
  }, [selectedDate, timeEntries.length]);

  const handleSelect = (info) => {
    if (timesheetStatus === "finalised") {
      setErrorMessage(
        "Cannot add entries to a finalised timesheet. Please unfinalise first."
      );
      setErrorDialogOpen(true);
      return;
    }

    const startTime = format(info.start, "HH:mm");
    const endTime = format(info.end, "HH:mm");

    setProjectSearch("");
    setFormData({
      startTime,
      endTime,
      projectId: "",
      description: "",
      isAdminWork: false,
      isBreak: false,
      projectInputType: "",
    });
    setOpenDialog(true);
  };

  const handleEventClick = (info) => {
    if (timesheetStatus === "finalised") return;

    const entry = timeEntries.find((e) => e._id === info.event.id);
    if (entry) {
      setFormData({
        startTime: entry.startTime,
        endTime: entry.endTime,
        projectId: entry.projectId || "",
        description: entry.description || "",
        isAdminWork: entry.isAdminWork || false,
        isBreak: entry.isBreak || false,
        projectInputType: entry.projectInputType || "",
      });
      setEditingEntryId(entry._id);
      setIsEditing(true);
      setOpenDialog(true);
    }
  };

  const handleEventDrop = async (info) => {
    if (timesheetStatus === "finalised") {
      info.revert();
      setErrorMessage(
        "Cannot modify entries for a finalised timesheet. Please unfinalise first."
      );
      setErrorDialogOpen(true);
      return;
    }

    const entry = timeEntries.find((e) => e._id === info.event.id);
    if (!entry) return;

    try {
      const startTime = format(info.event.start, "HH:mm");
      const endTime = format(info.event.end, "HH:mm");

      const timesheetData = {
        ...entry,
        startTime,
        endTime,
      };

      // Optimistically update the UI immediately
      setTimeEntries((prev) =>
        prev.map((e) =>
          e._id === entry._id ? { ...e, startTime, endTime } : e
        )
      );

      // Make API call in background
      await api.put(`/timesheets/${entry._id}`, timesheetData);
    } catch (error) {
      // Revert the optimistic update on error
      setTimeEntries((prev) =>
        prev.map((e) => (e._id === entry._id ? entry : e))
      );
      info.revert();
      setErrorMessage("Failed to update time entry. Please try again.");
      setErrorDialogOpen(true);
    }
  };

  const handleEventResize = async (info) => {
    if (timesheetStatus === "finalised") {
      info.revert();
      setErrorMessage(
        "Cannot modify entries for a finalised timesheet. Please unfinalise first."
      );
      setErrorDialogOpen(true);
      return;
    }

    const entry = timeEntries.find((e) => e._id === info.event.id);
    if (!entry) return;

    try {
      const startTime = format(info.event.start, "HH:mm");
      const endTime = format(info.event.end, "HH:mm");

      const timesheetData = {
        ...entry,
        startTime,
        endTime,
      };

      // Optimistically update the UI immediately
      setTimeEntries((prev) =>
        prev.map((e) =>
          e._id === entry._id ? { ...e, startTime, endTime } : e
        )
      );

      // Make API call in background
      await api.put(`/timesheets/${entry._id}`, timesheetData);
    } catch (error) {
      // Revert the optimistic update on error
      setTimeEntries((prev) =>
        prev.map((e) => (e._id === entry._id ? entry : e))
      );
      info.revert();
      setErrorMessage("Failed to update time entry. Please try again.");
      setErrorDialogOpen(true);
    }
  };

  if (authLoading || !targetUserId) {
    return <LoadingSpinner />;
  }

  return (
    <Box m="20px">
      {/* Custom CSS for FullCalendar styling */}
      <style>
        {`
           /* Time column styling - target the actual rendered elements */
           .fc .fc-timegrid-axis {
             background: linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main}) !important;
             color: ${theme.palette.success.contrastText} !important;
           }
           
           .fc .fc-timegrid-axis-frame {
             background: linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main}) !important;
           }
           
           .fc .fc-timegrid-axis-cushion {
             color: ${theme.palette.success.contrastText} !important;
             font-size: 0.8rem !important;
             line-height: 1.2 !important;
             padding: 2px 4px !important;
           }
           
                       /* Aggressive row height reduction - target everything */
            .fc .fc-timegrid-slot,
            .fc .fc-timegrid-slot-lane,
            .fc .fc-timegrid-slot-minor,
            .fc .fc-timegrid-slot td,
            .fc .fc-timegrid-slot-lane td,
            .fc .fc-timegrid-slot-minor td,
            .fc .fc-timegrid tbody tr,
            .fc .fc-timegrid tbody tr td {
              height: 60% !important;
              min-height: 60% !important;
              max-height: 60% !important;
              line-height: 1.3 !important;
            }
            
            /* Force the entire timegrid to respect our height */
            .fc .fc-timegrid-body {
              height: auto !important;
            }
            
            /* Target the actual rendered elements with higher specificity */
            .fc .fc-timegrid-slot-label {
              height: 60% !important;
              min-height: 60% !important;
              max-height: 60% !important;
              line-height: 1.2 !important;
              padding: 1px 4px !important;
            }
            
            /* Override any inline styles */
            .fc .fc-timegrid-slot *,
            .fc .fc-timegrid-slot-lane *,
            .fc .fc-timegrid-slot-minor * {
              height: 60% !important;
              min-height: 60% !important;
              max-height: 60% !important;
            }
           
                       /* Custom classes for alternating colors */
           .fc-slot-green {
             background-color: ${theme.palette.success.light}80 !important;
           }
           
           .fc-slot-white {
             background-color: ${theme.palette.background.paper} !important;
           }
            
            /* Ensure the custom classes override FullCalendar's defaults */
            .fc .fc-timegrid-slot.fc-slot-green,
            .fc .fc-timegrid-slot-lane.fc-slot-green {
              background-color: ${theme.palette.success.light}80 !important;
            }
            
            .fc .fc-timegrid-slot.fc-slot-white,
            .fc .fc-timegrid-slot-lane.fc-slot-white {
              background-color: ${theme.palette.background.paper} !important;
            }
         `}
      </style>
      {/* Standard Page Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h3" component="h1">
          Daily Timesheet
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/timesheets/monthly")}
          startIcon={<WorkIcon />}
        >
          Monthly View
        </Button>
      </Box>

      {/* Enhanced Main content with alternating shading */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          borderRadius: 4,
          boxShadow: "0 16px 48px rgba(0,0,0,0.08)",
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.success.main})`,
          },
        }}
      >
        {/* Enhanced Date Navigation and Status Controls */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.primary.light}05 100%)`,
            p: 4,
            borderBottom: `2px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={3}
          >
            {/* Date Navigation */}
            <Box
              display="flex"
              alignItems="center"
              gap={2}
              sx={{
                background: theme.palette.background.paper,
                p: 2,
                borderRadius: 3,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <IconButton
                onClick={() => handleDayChange("prev")}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  color: theme.palette.primary.contrastText,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                    transform: "scale(1.05)",
                  },
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                }}
              >
                <ArrowBackIosNewIcon />
              </IconButton>
              <Box textAlign="center" minWidth="280px">
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    textShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    mb: 0.5,
                  }}
                >
                  {format(selectedDate, "EEEE")}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: theme.palette.text.secondary,
                  }}
                >
                  {format(selectedDate, "d MMMM yyyy")}
                </Typography>
              </Box>
              <IconButton
                onClick={() => handleDayChange("next")}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  color: theme.palette.primary.contrastText,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                    transform: "scale(1.05)",
                  },
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                }}
              >
                <ArrowForwardIosIcon />
              </IconButton>
            </Box>

            {/* Status Controls */}
            <Stack
              direction="row"
              spacing={2}
              flexWrap="wrap"
              alignItems="center"
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={show24HourView}
                    onChange={(e) => setShow24HourView(e.target.checked)}
                    sx={{
                      color: theme.palette.primary.main,
                      "&.Mui-checked": {
                        color: theme.palette.primary.main,
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      fontSize: "0.9rem",
                    }}
                  >
                    Show 24 Hours
                  </Typography>
                }
                sx={{
                  mr: 2,
                  "& .MuiFormControlLabel-label": {
                    fontSize: "0.9rem",
                  },
                }}
              />
              <Button
                variant={
                  timesheetStatus === "finalised" ? "contained" : "outlined"
                }
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() =>
                  handleStatusUpdate(
                    timesheetStatus === "finalised" ? "incomplete" : "finalised"
                  )
                }
                sx={{
                  borderRadius: "16px",
                  fontWeight: 600,
                  textTransform: "none",
                  px: 4,
                  py: 1.5,
                  fontSize: "1rem",
                  boxShadow:
                    timesheetStatus === "finalised"
                      ? "0 8px 24px rgba(76, 175, 80, 0.3)"
                      : "0 4px 12px rgba(0,0,0,0.1)",
                  "&:hover": {
                    boxShadow:
                      timesheetStatus === "finalised"
                        ? "0 12px 32px rgba(76, 175, 80, 0.4)"
                        : "0 6px 16px rgba(0,0,0,0.15)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {timesheetStatus === "finalised" ? "Unfinalise" : "Finalise"}
              </Button>
              <Button
                variant={
                  timesheetStatus === "absent" ? "contained" : "outlined"
                }
                color="error"
                startIcon={<EventBusyIcon />}
                onClick={() =>
                  handleStatusUpdate(
                    timesheetStatus === "absent" ? "incomplete" : "absent"
                  )
                }
                sx={{
                  borderRadius: "16px",
                  fontWeight: 600,
                  textTransform: "none",
                  px: 4,
                  py: 1.5,
                  fontSize: "1rem",
                  boxShadow:
                    timesheetStatus === "absent"
                      ? "0 8px 24px rgba(244, 67, 54, 0.3)"
                      : "0 4px 12px rgba(0,0,0,0.1)",
                  "&:hover": {
                    boxShadow:
                      timesheetStatus === "absent"
                        ? "0 12px 32px rgba(244, 67, 54, 0.4)"
                        : "0 6px 16px rgba(0,0,0,0.15)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {timesheetStatus === "absent" ? "Mark Present" : "Mark Absent"}
              </Button>
            </Stack>
          </Box>
        </Box>

        {/* Enhanced Calendar Container with alternating shading */}
        <Box
          sx={{
            height: "625px", // Reduced by 10% from 850px
            p: 3,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
            "& .fc": {
              fontFamily: theme.typography.fontFamily,
              backgroundColor: "transparent",
              borderRadius: 3,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              border: `2px solid ${theme.palette.divider}`,
            },
            "& .fc-toolbar": {
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              color: theme.palette.primary.contrastText,
              padding: "16px 20px",
              borderBottom: `3px solid ${theme.palette.primary.dark}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            },
            "& .fc-toolbar-title": {
              fontSize: "1.5rem",
              fontWeight: 700,
              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            },
            "& .fc-button": {
              background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
              borderColor: theme.palette.secondary.main,
              color: theme.palette.secondary.contrastText,
              fontWeight: 600,
              textTransform: "none",
              borderRadius: "12px",
              padding: "10px 20px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              "&:hover": {
                background: `linear-gradient(135deg, ${theme.palette.secondary.dark}, ${theme.palette.secondary.main})`,
                boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.3s ease",
            },
            "& .fc-timegrid-slot": {
              borderColor: theme.palette.divider,
              backgroundColor: theme.palette.background.paper,
            },
            "& .fc-timegrid-slot-lane": {
              borderColor: theme.palette.divider,
            },
            "& .fc-timegrid-slot-minor": {
              borderColor: theme.palette.divider,
            },
            "& .fc-timegrid-slot-minor .fc-timegrid-slot-label": {
              backgroundColor: theme.palette.grey[100],
              color: theme.palette.text.secondary,
              fontSize: "0.8rem",
              fontWeight: 500,
            },
            "& .fc-timegrid-slot-label": {
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              color: theme.palette.primary.contrastText,
              fontWeight: 700,
              fontSize: "1rem",
              borderColor: theme.palette.primary.dark,
              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
              padding: "8px 12px",
            },
            "& .fc-timegrid-axis": {
              fontWeight: 700,
              borderColor: theme.palette.success.dark,
              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
              padding: "8px 12px",
            },
            "& .fc-timegrid-col-events": {
              backgroundColor: "transparent",
            },
            "& .fc-event": {
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                transform: "translateY(-2px) scale(1.02)",
              },
            },
            "& .fc-event-main": {
              padding: "8px 12px",
              fontSize: "0.9rem",
              fontWeight: 600,
            },
            "& .fc-event-time": {
              fontWeight: 700,
              fontSize: "0.8rem",
            },
            "& .fc-event-title": {
              fontSize: "0.9rem",
              fontWeight: 600,
            },
            "& .fc-now-indicator-line": {
              borderColor: theme.palette.error.main,
              borderWidth: "3px",
              boxShadow: `0 0 8px ${theme.palette.error.main}40`,
            },
            "& .fc-now-indicator-arrow": {
              borderColor: theme.palette.error.main,
              borderWidth: "6px",
              boxShadow: `0 0 8px ${theme.palette.error.main}40`,
            },
            "& .fc-highlight": {
              background: `linear-gradient(135deg, ${theme.palette.primary.light}40, ${theme.palette.primary.main}20)`,
              borderRadius: "8px",
              border: `2px dashed ${theme.palette.primary.main}`,
            },
            "& .weekend-day": {
              background: `linear-gradient(135deg, ${theme.palette.grey[100]}, ${theme.palette.grey[50]})`,
            },
            "& .fc-timegrid-slot-minor": {
              borderColor: theme.palette.divider,
              backgroundColor: theme.palette.grey[25],
            },
            "& .fc-timegrid-slot-minor .fc-timegrid-slot-label": {
              backgroundColor: theme.palette.grey[100],
              color: theme.palette.text.secondary,
              fontSize: "0.8rem",
              fontWeight: 500,
            },
            "& .fc-col-header": {
              display: "none !important", // Hide the day header
            },
            "& .break-event": {
              background: `linear-gradient(135deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[700]} 100%) !important`,
              borderLeft: `6px solid ${theme.palette.grey[700]} !important`,
              boxShadow: `0 6px 20px ${theme.palette.grey[500]}40 !important`,
              borderRadius: "12px !important",
            },
            "& .admin-event": {
              background: `linear-gradient(135deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[700]} 100%) !important`,
              borderLeft: `6px solid ${theme.palette.grey[700]} !important`,
              boxShadow: `0 6px 20px ${theme.palette.grey[500]}40 !important`,
              borderRadius: "12px !important",
            },
            "& .project-event": {
              background: `linear-gradient(135deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[700]} 100%) !important`,
              borderLeft: `6px solid ${theme.palette.grey[700]} !important`,
              boxShadow: `0 6px 20px ${theme.palette.grey[500]}40 !important`,
              borderRadius: "12px !important",
            },
            "@keyframes spin": {
              "0%": { transform: "translate(-50%, -50%) rotate(0deg)" },
              "100%": { transform: "translate(-50%, -50%) rotate(360deg)" },
            },
          }}
        >
          <FullCalendar
            ref={calendarRef}
            key={calendarKey}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridDay"
            initialDate={selectedDate}
            selectable={true}
            selectMirror={true}
            unselectAuto={false}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            nowIndicator={true}
            slotMinTime={show24HourView ? "00:00:00" : "06:00:00"}
            slotMaxTime={show24HourView ? "24:00:00" : "18:00:00"}
            slotDuration="00:15:00"
            height="100%"
            events={calendarEvents}
            editable={timesheetStatus !== "finalised"}
            droppable={timesheetStatus !== "finalised"}
            eventOverlap={false}
            firstDay={1}
            headerToolbar={false}
            allDaySlot={false}
            selectMinDistance={15}
            slotLaneClassNames={(arg) => {
              // Calculate slot index based on the current time range
              const startHour = show24HourView ? 0 : 6;
              const slotIndex = Math.floor(
                (arg.date.getHours() - startHour) * 4 +
                  arg.date.getMinutes() / 15
              );
              if (slotIndex % 4 === 0 || slotIndex % 4 === 1) {
                return "fc-slot-green";
              }
              return "fc-slot-white";
            }}
            dayCellClassNames={(arg) => {
              return arg.date.getDay() === 0 || arg.date.getDay() === 6
                ? "weekend-day"
                : "";
            }}
            eventContent={(eventInfo) => {
              const duration = eventInfo.event.end - eventInfo.event.start;
              const isShortEntry = duration <= 30 * 60 * 1000; // 30 minutes or less
              const project = eventInfo.event.extendedProps.projectId
                ? projects.find(
                    (p) => p._id === eventInfo.event.extendedProps.projectId
                  )
                : null;
              const isProcessing = processingEntries.has(eventInfo.event.id);
              const isSuccess = successEntries.has(eventInfo.event.id);

              const formatEventContent = () => {
                if (eventInfo.event.extendedProps.isBreak) {
                  return `Break${
                    eventInfo.event.extendedProps.description
                      ? ` - ${eventInfo.event.extendedProps.description}`
                      : ""
                  }`;
                }
                if (eventInfo.event.extendedProps.isAdminWork) {
                  return `Admin Work${
                    eventInfo.event.extendedProps.description
                      ? ` - ${eventInfo.event.extendedProps.description}`
                      : ""
                  }`;
                }
                if (!project) {
                  return "Unknown Project";
                }
                return `${project.projectID}: ${project.name} - ${
                  eventInfo.event.extendedProps.projectInputType?.replace(
                    "_",
                    " "
                  ) || ""
                }${
                  eventInfo.event.extendedProps.description
                    ? `, ${eventInfo.event.extendedProps.description}`
                    : ""
                }`;
              };

              // For short entries, display content and time on one line
              if (isShortEntry) {
                return (
                  <Box
                    sx={{
                      p: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      position: "relative",
                      opacity: isProcessing ? 0.7 : 1,
                      transition: "opacity 0.2s ease-in-out",
                      "& .event-content": {
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        lineHeight: 1.2,
                        color: theme.palette.common.white,
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                      "& .event-time": {
                        fontSize: "0.9rem",
                        opacity: 0.9,
                        fontWeight: 500,
                        color: theme.palette.common.white,
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        marginLeft: "8px",
                        flexShrink: 0,
                      },
                    }}
                  >
                    {isProcessing && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          width: 0,
                          height: 0,
                          borderStyle: "solid",
                          borderWidth: "0 20px 20px 0",
                          borderColor: `transparent ${theme.palette.warning.main} transparent transparent`,
                          zIndex: 1,
                        }}
                      />
                    )}
                    <Typography className="event-content">
                      {formatEventContent()}
                    </Typography>
                    <Typography className="event-time">
                      {format(eventInfo.event.start, "HH:mm")} -{" "}
                      {format(eventInfo.event.end, "HH:mm")}
                    </Typography>
                    {isProcessing && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          width: "16px",
                          height: "16px",
                          border: `2px solid ${theme.palette.warning.main}`,
                          borderTop: `2px solid transparent`,
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          zIndex: 2,
                        }}
                      />
                    )}
                    {isSuccess && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: `${theme.palette.success.main}20`,
                          border: `2px solid ${theme.palette.success.main}`,
                          borderRadius: "12px",
                          zIndex: 1,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </Box>
                );
              }

              // For longer entries, use the original multi-line layout
              return (
                <Box
                  sx={{
                    p: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    position: "relative",
                    opacity: isProcessing ? 0.7 : 1,
                    transition: "opacity 0.2s ease-in-out",
                    "& .event-title": {
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: theme.palette.common.white,
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    },
                    "& .event-subtitle": {
                      fontSize: "0.7rem",
                      opacity: 0.9,
                      marginTop: "2px",
                    },
                    "& .event-time": {
                      fontSize: "0.85rem",
                      opacity: 0.8,
                      marginTop: "2px",
                      fontWeight: 500,
                    },
                  }}
                >
                  {isProcessing && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 0,
                        height: 0,
                        borderStyle: "solid",
                        borderWidth: "0 20px 20px 0",
                        borderColor: `transparent ${theme.palette.warning.main} transparent transparent`,
                        zIndex: 1,
                      }}
                    />
                  )}
                  <Typography className="event-title" noWrap>
                    {formatEventContent()}
                  </Typography>
                  {eventInfo.event.extendedProps.description && (
                    <Typography className="event-subtitle" noWrap>
                      {eventInfo.event.extendedProps.description}
                    </Typography>
                  )}
                  <Typography className="event-time">
                    {format(eventInfo.event.start, "HH:mm")} -{" "}
                    {format(eventInfo.event.end, "HH:mm")}
                  </Typography>
                  {isProcessing && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "16px",
                        height: "16px",
                        border: `2px solid ${theme.palette.warning.main}`,
                        borderTop: `2px solid transparent`,
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        zIndex: 2,
                      }}
                    />
                  )}
                  {isSuccess && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: `${theme.palette.success.main}20`,
                        border: `2px solid ${theme.palette.success.main}`,
                        borderRadius: "12px",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </Box>
              );
            }}
          />
        </Box>
      </Paper>

      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setIsEditing(false);
          setEditingEntryId(null);
          setProjectSearch("");
          setFormData({
            startTime: "",
            endTime: "",
            projectId: "",
            description: "",
            isAdminWork: false,
            isBreak: false,
            projectInputType: "",
          });
          // Clear the FullCalendar selection when closing
          if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.unselect();
          }
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
              bgcolor: isEditing ? "warning.main" : "primary.main",
              color: "white",
            }}
          >
            {isEditing ? (
              <EditIcon sx={{ fontSize: 20 }} />
            ) : (
              <AddIcon sx={{ fontSize: 20 }} />
            )}
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {isEditing ? "Edit Time Entry" : "Add Time Entry"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Work Type"
                  value={
                    formData.isBreak
                      ? "break"
                      : formData.isAdminWork
                      ? "admin"
                      : "project"
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isAdminWork: e.target.value === "admin",
                      isBreak: e.target.value === "break",
                      projectId:
                        e.target.value === "admin" || e.target.value === "break"
                          ? ""
                          : formData.projectId,
                      projectInputType:
                        e.target.value === "admin" || e.target.value === "break"
                          ? ""
                          : formData.projectInputType,
                    })
                  }
                  required
                >
                  <MenuItem value="project">Project Work</MenuItem>
                  <MenuItem value="admin">Admin Work</MenuItem>
                  <MenuItem value="break">Break</MenuItem>
                </TextField>
              </Grid>
              {!formData.isAdminWork && !formData.isBreak && (
                <>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={filteredProjects || []}
                      getOptionLabel={(option) =>
                        `${option.projectID}: ${option.name}`
                      }
                      value={
                        projects.find((p) => p._id === formData.projectId) ||
                        null
                      }
                      onChange={(event, newValue) => {
                        setFormData({
                          ...formData,
                          projectId: newValue ? newValue._id : "",
                        });
                      }}
                      onInputChange={handleProjectSearchChange}
                      inputValue={projectSearch}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Search Projects"
                          required
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon />
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                      filterOptions={(x) => x} // Disable built-in filtering since we handle it manually
                      noOptionsText={`No projects found${
                        projectSearch ? ` for "${projectSearch}"` : ""
                      }`}
                      loading={isLoading}
                      isOptionEqualToValue={(option, value) =>
                        option._id === value._id
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      select
                      fullWidth
                      label="Project Input Type"
                      value={formData.projectInputType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          projectInputType: e.target.value,
                        })
                      }
                    >
                      <MenuItem value="site_work">Site Work/Travel</MenuItem>
                      <MenuItem value="reporting">Reporting</MenuItem>
                      <MenuItem value="project_admin">Project Admin</MenuItem>
                    </TextField>
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required={false}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => {
              setOpenDialog(false);
              setIsEditing(false);
              setEditingEntryId(null);
              setProjectSearch("");
              setFormData({
                startTime: "",
                endTime: "",
                projectId: "",
                description: "",
                isAdminWork: false,
                isBreak: false,
                projectInputType: "",
              });
              // Clear the FullCalendar selection when cancelling
              if (calendarRef.current) {
                const calendarApi = calendarRef.current.getApi();
                calendarApi.unselect();
              }
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
          {isEditing && (
            <Button
              onClick={() => {
                handleDeleteClick(editingEntryId);
                setOpenDialog(false);
                setIsEditing(false);
                setEditingEntryId(null);
              }}
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Delete
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            variant="contained"
            startIcon={isEditing ? <EditIcon /> : <AddIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            {isEditing ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setEntryToDelete(null);
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
            Confirm Delete
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete this time entry? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setEntryToDelete(null);
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
            onClick={() => handleDelete(entryToDelete)}
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
            Delete Entry
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
            <DeleteIcon sx={{ fontSize: 20 }} />
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
            variant="outlined"
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
    </Box>
  );
};

export default Timesheets;
