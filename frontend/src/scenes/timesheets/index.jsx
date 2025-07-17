import React, { useState, useEffect } from "react";
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
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Chip,
  Autocomplete,
  InputAdornment,
} from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import SearchIcon from "@mui/icons-material/Search";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
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
      alert("Failed to update timesheet status. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("=== TIMESHEET SUBMIT DEBUG ===");
    console.log("Current selectedDate:", selectedDate);
    console.log("Current selectedDate type:", typeof selectedDate);
    console.log("Current selectedDate value:", selectedDate?.toISOString());

    if (!targetUserId) {
      alert("Error: No user ID available. Please try logging in again.");
      return;
    }

    try {
      if (timesheetStatus === "finalised") {
        alert(
          "Cannot modify entries for a finalised timesheet. Please unfinalise first."
        );
        return;
      }

      if (formData.isAdminWork || formData.isBreak) {
        if (!formData.description) {
          formData.description = "";
        }
      } else {
        if (!formData.projectId) {
          alert("Please select a project");
          return;
        }
        if (!formData.projectInputType) {
          alert("Please select a project input type");
          return;
        }
      }

      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      console.log("Formatted date being sent to backend:", formattedDate);

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

      console.log("Full timesheet data being sent:", timesheetData);
      console.log("=== END TIMESHEET SUBMIT DEBUG ===");

      if (isEditing && editingEntryId) {
        await api.put(`/timesheets/${editingEntryId}`, timesheetData);
      } else {
        await api.post("/timesheets", timesheetData);
      }

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

      await fetchTimeEntries();
      await fetchTimesheetStatus();
    } catch (error) {
      console.error("Error creating/updating timesheet entry:", error);
      alert(error.response?.data?.message || "Error saving time entry");
    }
  };

  const handleDelete = async (entryId) => {
    try {
      await api.delete(`/timesheets/${entryId}`);
      await fetchTimeEntries();
      await fetchTimesheetStatus();
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      console.error("Error deleting time entry:", error);
      // You could add a snackbar or toast notification here instead of alert
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
    console.log("=== DATE NAVIGATION DEBUG ===");
    console.log("Direction:", direction);
    console.log("Old selectedDate:", selectedDate);
    console.log("New selectedDate:", newDate);
    console.log("New formatted date:", format(newDate, "yyyy-MM-dd"));
    console.log("=== END DATE NAVIGATION DEBUG ===");
    setSelectedDate(newDate);
  };

  // Helper function to sort projects by projectID descending
  const sortProjectsByID = (projectsList) => {
    return [...projectsList].sort((a, b) => {
      // Extract numeric part from projectID (e.g., "LDJ00001" -> 1)
      const aNum = parseInt(a.projectID.replace(/\D/g, ""), 10);
      const bNum = parseInt(b.projectID.replace(/\D/g, ""), 10);
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
      try {
        const projectsResponse = await api.get(
          "/projects?status=Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent&limit=1000"
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
  }, []); // Only run once on mount

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
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.projectID.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const sortedFiltered = sortProjectsByID(filtered);
    setFilteredProjects(sortedFiltered);
  }, 300);

  // Handle project search input change
  const handleProjectSearchChange = (event, newValue) => {
    setProjectSearch(newValue);
    debouncedProjectSearch(newValue);
  };

  const getCalendarEvents = () => {
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
        backgroundColor = `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`;
        borderColor = theme.palette.warning.dark;
        textColor = theme.palette.warning.contrastText;
        className = "break-event";
      } else if (entry.isAdminWork) {
        title = `Admin Work${
          entry.description ? ` - ${entry.description}` : ""
        }`;
        backgroundColor = `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`;
        borderColor = theme.palette.info.dark;
        textColor = theme.palette.info.contrastText;
        className = "admin-event";
      } else {
        title = `${projectName} - ${
          entry.projectInputType?.replace("_", " ") || ""
        }${entry.description ? `, ${entry.description}` : ""}`;
        backgroundColor = `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`;
        borderColor = theme.palette.primary.dark;
        textColor = theme.palette.primary.contrastText;
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
  };

  const handleSelect = (info) => {
    if (timesheetStatus === "finalised") {
      alert(
        "Cannot add entries to a finalised timesheet. Please unfinalise first."
      );
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
      alert(
        "Cannot modify entries for a finalised timesheet. Please unfinalise first."
      );
      return;
    }

    try {
      const entry = timeEntries.find((e) => e._id === info.event.id);
      if (!entry) return;

      const startTime = format(info.event.start, "HH:mm");
      const endTime = format(info.event.end, "HH:mm");

      const timesheetData = {
        ...entry,
        startTime,
        endTime,
      };

      await api.put(`/timesheets/${entry._id}`, timesheetData);
      await fetchTimeEntries();
    } catch (error) {
      info.revert();
      alert("Failed to update time entry. Please try again.");
    }
  };

  const handleEventResize = async (info) => {
    if (timesheetStatus === "finalised") {
      info.revert();
      alert(
        "Cannot modify entries for a finalised timesheet. Please unfinalise first."
      );
      return;
    }

    try {
      const entry = timeEntries.find((e) => e._id === info.event.id);
      if (!entry) return;

      const startTime = format(info.event.start, "HH:mm");
      const endTime = format(info.event.end, "HH:mm");

      const timesheetData = {
        ...entry,
        startTime,
        endTime,
      };

      await api.put(`/timesheets/${entry._id}`, timesheetData);
      await fetchTimeEntries();
    } catch (error) {
      info.revert();
      alert("Failed to update time entry. Please try again.");
    }
  };

  if (authLoading || !targetUserId) {
    return (
      <Box
        m="20px"
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography variant="h4">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      {/* Header and Monthly View button OUTSIDE of styled container */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Daily Timesheet
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/timesheets/monthly")}
          sx={{
            backgroundColor: theme.palette.primary.dark,
            color: theme.palette.primary.contrastText,
            borderRadius: "12px",
            fontWeight: 600,
            textTransform: "none",
            px: 3,
            py: 1.5,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            "&:hover": {
              backgroundColor: theme.palette.primary.main,
              boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
              transform: "translateY(-1px)",
            },
          }}
        >
          Monthly View
        </Button>
      </Box>

      {/* Main content in Paper */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.alt,
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              onClick={() => handleDayChange("prev")}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
                minWidth: "300px",
                textAlign: "center",
              }}
            >
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </Typography>
            <IconButton
              onClick={() => handleDayChange("next")}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <ArrowForwardIosIcon />
            </IconButton>
          </Box>
          <Box display="flex" gap={2}>
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
                borderRadius: "12px",
                fontWeight: 600,
                textTransform: "none",
                px: 3,
                py: 1,
                boxShadow:
                  timesheetStatus === "finalised"
                    ? "0 4px 12px rgba(76, 175, 80, 0.3)"
                    : "none",
                "&:hover": {
                  boxShadow:
                    timesheetStatus === "finalised"
                      ? "0 6px 16px rgba(76, 175, 80, 0.4)"
                      : "0 2px 8px rgba(0,0,0,0.1)",
                },
              }}
            >
              {timesheetStatus === "finalised" ? "Unfinalise" : "Finalise"}
            </Button>
            <Button
              variant={timesheetStatus === "absent" ? "contained" : "outlined"}
              color="error"
              startIcon={<EventBusyIcon />}
              onClick={() =>
                handleStatusUpdate(
                  timesheetStatus === "absent" ? "incomplete" : "absent"
                )
              }
              sx={{
                borderRadius: "12px",
                fontWeight: 600,
                textTransform: "none",
                px: 3,
                py: 1,
                boxShadow:
                  timesheetStatus === "absent"
                    ? "0 4px 12px rgba(244, 67, 54, 0.3)"
                    : "none",
                "&:hover": {
                  boxShadow:
                    timesheetStatus === "absent"
                      ? "0 6px 16px rgba(244, 67, 54, 0.4)"
                      : "0 2px 8px rgba(0,0,0,0.1)",
                },
              }}
            >
              {timesheetStatus === "absent" ? "Mark Present" : "Mark Absent"}
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            height: "850px",
            "& .fc": {
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            },
            "& .fc-toolbar": {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              padding: "12px 16px",
              borderBottom: `2px solid ${theme.palette.primary.dark}`,
            },
            "& .fc-toolbar-title": {
              fontSize: "1.25rem",
              fontWeight: 600,
            },
            "& .fc-button": {
              backgroundColor: theme.palette.secondary.main,
              borderColor: theme.palette.secondary.main,
              color: theme.palette.secondary.contrastText,
              fontWeight: 500,
              textTransform: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              "&:hover": {
                backgroundColor: theme.palette.secondary.dark,
                borderColor: theme.palette.secondary.dark,
              },
              "&:focus": {
                boxShadow: `0 0 0 2px ${theme.palette.secondary.light}`,
              },
            },
            "& .fc-timegrid-slot": {
              borderColor: theme.palette.divider,
              backgroundColor: theme.palette.background.default,
            },
            "& .fc-timegrid-slot-label": {
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.primary.contrastText,
              fontWeight: 600,
              fontSize: "0.875rem",
              borderColor: theme.palette.primary.main,
            },
            "& .fc-timegrid-axis": {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              fontWeight: 600,
              borderColor: theme.palette.primary.dark,
            },
            "& .fc-timegrid-col-events": {
              backgroundColor: theme.palette.background.paper,
            },
            "& .fc-event": {
              borderRadius: "6px",
              border: "none",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                transform: "translateY(-1px)",
              },
            },
            "& .fc-event-main": {
              padding: "4px 8px",
              fontSize: "0.875rem",
              fontWeight: 500,
            },
            "& .fc-event-time": {
              fontWeight: 600,
              fontSize: "0.75rem",
            },
            "& .fc-event-title": {
              fontSize: "0.875rem",
            },
            "& .fc-now-indicator-line": {
              borderColor: theme.palette.error.main,
              borderWidth: "2px",
            },
            "& .fc-now-indicator-arrow": {
              borderColor: theme.palette.error.main,
              borderWidth: "4px",
            },
            "& .fc-highlight": {
              backgroundColor: theme.palette.primary.light,
              opacity: 0.3,
              borderRadius: "4px",
            },
            "& .weekend-day": {
              backgroundColor: theme.palette.grey[50],
            },
            "& .fc-timegrid-slot-minor": {
              borderColor: theme.palette.divider,
            },
            "& .fc-timegrid-slot-minor .fc-timegrid-slot-label": {
              backgroundColor: theme.palette.grey[100],
              color: theme.palette.text.secondary,
              fontSize: "0.75rem",
            },
            "& .break-event": {
              background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%) !important`,
              borderLeft: `4px solid ${theme.palette.warning.dark} !important`,
              boxShadow: `0 2px 8px ${theme.palette.warning.main}40 !important`,
            },
            "& .admin-event": {
              background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%) !important`,
              borderLeft: `4px solid ${theme.palette.info.dark} !important`,
              boxShadow: `0 2px 8px ${theme.palette.info.main}40 !important`,
            },
            "& .project-event": {
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%) !important`,
              borderLeft: `4px solid ${theme.palette.primary.dark} !important`,
              boxShadow: `0 2px 8px ${theme.palette.primary.main}40 !important`,
            },
          }}
        >
          <FullCalendar
            key={format(selectedDate, "yyyy-MM-dd")}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridDay"
            initialDate={selectedDate}
            selectable={true}
            selectMirror={true}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            nowIndicator={true}
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:15:00"
            height="100%"
            events={getCalendarEvents()}
            editable={timesheetStatus !== "finalised"}
            droppable={timesheetStatus !== "finalised"}
            eventOverlap={false}
            firstDay={1}
            headerToolbar={false}
            allDaySlot={false}
            dayCellClassNames={(arg) => {
              return arg.date.getDay() === 0 || arg.date.getDay() === 6
                ? "weekend-day"
                : "";
            }}
            eventContent={(eventInfo) => {
              const duration = eventInfo.event.end - eventInfo.event.start;
              const isShortEntry = duration <= 15 * 60 * 1000;
              const project = eventInfo.event.extendedProps.projectId
                ? projects.find(
                    (p) => p._id === eventInfo.event.extendedProps.projectId
                  )
                : null;

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

              return (
                <Box
                  sx={{
                    p: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    "& .event-title": {
                      fontSize: "0.8rem",
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
                      fontSize: "0.65rem",
                      opacity: 0.8,
                      marginTop: "2px",
                      fontWeight: 500,
                    },
                  }}
                >
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
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isEditing ? "Edit Time Entry" : "Add Time Entry"}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Work Type</InputLabel>
                  <Select
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
                          e.target.value === "admin" ||
                          e.target.value === "break"
                            ? ""
                            : formData.projectId,
                        projectInputType:
                          e.target.value === "admin" ||
                          e.target.value === "break"
                            ? ""
                            : formData.projectInputType,
                      })
                    }
                    required
                  >
                    <MenuItem value="project">Project Work</MenuItem>
                    <MenuItem value="admin">Admin Work</MenuItem>
                    <MenuItem value="break">Break</MenuItem>
                  </Select>
                </FormControl>
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
                    <FormControl fullWidth>
                      <InputLabel>Project Input Type</InputLabel>
                      <Select
                        value={formData.projectInputType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            projectInputType: e.target.value,
                          })
                        }
                        required
                      >
                        <MenuItem value="site_work">Site Work/Travel</MenuItem>
                        <MenuItem value="reporting">Reporting</MenuItem>
                        <MenuItem value="project_admin">Project Admin</MenuItem>
                      </Select>
                    </FormControl>
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
        <DialogActions>
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
              color="error"
            >
              Delete
            </Button>
          )}
          <Button onClick={handleSubmit} variant="contained">
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
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this time entry? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setEntryToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleDelete(entryToDelete)}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Timesheets;
