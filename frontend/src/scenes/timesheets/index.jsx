import React, { useState, useEffect, useRef } from "react";
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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Chip,
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import api, { timesheetService } from "../../services/api";
import AddIcon from "@mui/icons-material/Add";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  addDays,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";
import axios from "axios";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { useLocation, useNavigate } from "react-router-dom";
import { hasPermission } from "../../config/permissions";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EventBusyIcon from "@mui/icons-material/EventBusy";

// Add custom styles for the calendar
const calendarStyles = `
  .fc-slot-label-small {
    font-size: 0.75em !important;
  }
`;

const Timesheets = () => {
  const theme = useTheme();
  const colors = tokens;
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openDialog, setOpenDialog] = useState(false);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [monthlyTimeEntries, setMonthlyTimeEntries] = useState({});
  const [monthlyProjectTimeEntries, setMonthlyProjectTimeEntries] = useState(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [entriesCache, setEntriesCache] = useState({});
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
  const calendarRef = useRef(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [timesheetStatus, setTimesheetStatus] = useState("incomplete");
  const [viewMode, setViewMode] = useState("full");
  const [dailyStatuses, setDailyStatuses] = useState({});

  // Handle URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId");
    const view = params.get("view");
    const date = params.get("date");

    console.log("Timesheet component - URL params:", { userId, view, date });

    if (userId && userId !== "undefined" && userId !== "null") {
      setSelectedUserId(userId);
      fetchUserDetails(userId);
    }

    if (view === "daily") {
      setViewMode("daily");
    }

    if (date) {
      setSelectedDate(new Date(date));
    }
  }, [location.search]);

  // Fetch user details
  const fetchUserDetails = async (userId) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/users/${userId}`,
        {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        }
      );
      console.log("User details response:", response.data);
      setSelectedUserName(
        response.data.firstName + " " + response.data.lastName
      );
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  // Fetch time entries for the month
  const fetchTimeEntries = async () => {
    try {
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");
      const userId = selectedUserId || currentUser._id;

      console.log("Fetching entries for date range:", {
        startDate,
        endDate,
        userId,
        selectedDate: format(selectedDate, "yyyy-MM-dd"),
        selectedDateUTC: selectedDate.toISOString(),
      });

      const response = await axios.get(
        `${
          process.env.REACT_APP_API_URL
        }/timesheets/range/${startDate}/${endDate}${
          userId ? `?userId=${userId}` : ""
        }`,
        {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        }
      );

      console.log("Raw response data:", response.data);
      setTimeEntries(response.data || []);

      // Calculate monthly time entries
      const monthlyEntries = {};
      const monthlyProjectEntries = {};

      (response.data || []).forEach((entry) => {
        const dateStr = format(new Date(entry.date), "yyyy-MM-dd");

        // Calculate duration in minutes
        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60; // Handle overnight entries

        // Add to total time
        monthlyEntries[dateStr] = (monthlyEntries[dateStr] || 0) + duration;

        // Add to project time if not admin work or break
        if (!entry.isAdminWork && !entry.isBreak) {
          monthlyProjectEntries[dateStr] =
            (monthlyProjectEntries[dateStr] || 0) + duration;
        }
      });

      setMonthlyTimeEntries(monthlyEntries);
      setMonthlyProjectTimeEntries(monthlyProjectEntries);
    } catch (error) {
      console.error(
        "Error fetching time entries:",
        error.response?.data || error
      );
      setTimeEntries([]);
      setMonthlyTimeEntries({});
      setMonthlyProjectTimeEntries({});
    }
  };

  // Fetch daily statuses for the month
  const fetchDailyStatuses = async () => {
    try {
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");
      const userId = selectedUserId || currentUser._id;

      console.log("Fetching daily statuses for date range:", {
        startDate,
        endDate,
        userId,
        selectedDate: format(selectedDate, "yyyy-MM-dd"),
        selectedDateUTC: selectedDate.toISOString(),
      });

      const response = await api.get(
        `/timesheets/status/range/${startDate}/${endDate}${
          userId ? `?userId=${userId}` : ""
        }`
      );

      // Convert array to object with date as key
      const statusMap = (response.data || []).reduce((acc, status) => {
        const dateStr = format(new Date(status.date), "yyyy-MM-dd");
        acc[dateStr] = status.status;
        return acc;
      }, {});

      console.log("Daily status map:", statusMap);
      setDailyStatuses(statusMap);

      // Update the timesheet status for the selected date
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      if (statusMap[selectedDateStr]) {
        setTimesheetStatus(statusMap[selectedDateStr]);
      } else {
        setTimesheetStatus("incomplete");
      }
    } catch (error) {
      console.error(
        "Error fetching daily statuses:",
        error.response?.data || error
      );
      setDailyStatuses({});
      setTimesheetStatus("incomplete");
    }
  };

  // Generate days of the current month
  const daysInMonth = selectedDate
    ? eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      })
    : [];

  // Update the useEffect to handle initial setup
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  }, []);

  // Update useEffect to fetch statuses
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!selectedDate) return;

      setIsLoading(true);
      try {
        // Fetch projects only if not already loaded
        if (projects.length === 0) {
          const projectsResponse = await api.get("/projects");
          if (isMounted) {
            setProjects(projectsResponse.data);
          }
        }

        // Fetch time entries and statuses for the selected date
        await Promise.all([fetchTimeEntries(), fetchDailyStatuses()]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Helper function to format duration
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleSelect = (info) => {
    const startTime = format(new Date(info.start), "HH:mm");
    const endTime = format(new Date(info.end), "HH:mm");

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
    const entry = timeEntries.find((e) => e._id === info.event.id);
    if (entry) {
      setFormData({
        startTime: entry.startTime,
        endTime: entry.endTime,
        projectId: entry.projectId || "",
        description: entry.description,
        isAdminWork: entry.isAdminWork,
        isBreak: entry.isBreak,
        projectInputType: entry.projectInputType,
      });
      setEditingEntryId(entry._id);
      setIsEditing(true);
      setOpenDialog(true);
    }
  };

  const handleDateSelect = (day) => {
    if (!day) return;
    const newDate = new Date(day);
    newDate.setHours(0, 0, 0, 0);
    console.log("Selecting new date:", format(newDate, "yyyy-MM-dd"));
    setSelectedDate(newDate);
    setCalendarKey((prev) => prev + 1);
  };

  // Convert time entries to calendar events
  const events = React.useMemo(() => {
    if (!selectedDate || isCalendarLoading) {
      return [];
    }

    const selectedFormattedDate = format(selectedDate, "yyyy-MM-dd");
    console.log("Creating events for selected date:", selectedFormattedDate);

    // Filter entries for the selected date only
    const entriesForSelectedDate = timeEntries.filter((entry) => {
      const entryDate = format(new Date(entry.date), "yyyy-MM-dd");
      return entryDate === selectedFormattedDate;
    });

    console.log("Filtered entries for selected date:", entriesForSelectedDate);

    return entriesForSelectedDate.map((entry) => {
      // Parse the entry's date and ensure it's in the correct timezone
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      const formattedEntryDate = format(entryDate, "yyyy-MM-dd");

      // Determine event color based on type
      let backgroundColor, borderColor;
      if (entry.isBreak) {
        backgroundColor = colors.secondary[500];
        borderColor = colors.secondary[600];
      } else if (entry.isAdminWork) {
        backgroundColor = colors.primary[500];
        borderColor = colors.primary[600];
      } else {
        backgroundColor = colors.primary[400];
        borderColor = colors.primary[500];
      }

      // Create the event with the entry's date
      const event = {
        id: entry._id,
        title: entry.isBreak
          ? "Break"
          : entry.isAdminWork
          ? "Admin Work"
          : projects.find((p) => p._id === entry.projectId)?.name ||
            "Unknown Project",
        start: `${formattedEntryDate}T${entry.startTime}:00`,
        end: `${formattedEntryDate}T${entry.endTime}:00`,
        backgroundColor,
        borderColor,
        display: "block",
        allDay: false,
        extendedProps: {
          description: entry.description,
          projectId: entry.projectId,
          isAdminWork: entry.isAdminWork,
          isBreak: entry.isBreak,
          projectInputType: entry.projectInputType,
          originalDate: formattedEntryDate,
        },
      };

      console.log("Created event:", {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        date: formattedEntryDate,
      });

      return event;
    });
  }, [timeEntries, selectedDate, projects, isCalendarLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Create a copy of formData and ensure projectInputType is included
      const timesheetData = {
        ...formData,
        date: format(selectedDate, "yyyy-MM-dd"),
        userId: selectedUserId || currentUser.id,
        // If it's admin work or break, set projectInputType to null
        projectInputType:
          formData.isAdminWork || formData.isBreak
            ? null
            : formData.projectInputType,
      };

      // Validate required fields
      if (!timesheetData.startTime || !timesheetData.endTime) {
        alert("Please select start and end times");
        return;
      }

      if (
        !timesheetData.isAdminWork &&
        !timesheetData.isBreak &&
        !timesheetData.projectId
      ) {
        alert("Please select a project");
        return;
      }

      if (
        !timesheetData.isAdminWork &&
        !timesheetData.isBreak &&
        !timesheetData.projectInputType
      ) {
        alert("Please select a project input type");
        return;
      }

      if (isEditing && editingEntryId) {
        // Update existing entry
        await axios.put(
          `${process.env.REACT_APP_API_URL}/timesheets/${editingEntryId}`,
          timesheetData,
          {
            headers: { Authorization: `Bearer ${currentUser.token}` },
          }
        );
      } else {
        // Create new entry
        await axios.post(
          `${process.env.REACT_APP_API_URL}/timesheets`,
          timesheetData,
          {
            headers: { Authorization: `Bearer ${currentUser.token}` },
          }
        );
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

      // Refresh time entries
      await fetchTimeEntries();
    } catch (error) {
      console.error("Error saving time entry:", error);
      alert(error.response?.data?.message || "Error saving time entry");
    }
  };

  const handleDelete = async (entryId) => {
    try {
      const response = await api.delete(`/timesheets/${entryId}`);
      if (response.status === 200) {
        // Clear the cache for the current date to force a fresh fetch
        const formattedDate = format(selectedDate, "yyyy-MM-dd");
        setEntriesCache((prev) => {
          const newCache = { ...prev };
          delete newCache[formattedDate];
          return newCache;
        });

        await fetchTimeEntries();
      }
    } catch (error) {
      console.error("Error deleting time entry:", error);
      alert(error.response?.data?.message || "Error deleting time entry");
    }
  };

  const handleMonthChange = (direction) => {
    const newDate =
      direction === "next"
        ? addMonths(selectedDate, 1)
        : subMonths(selectedDate, 1);
    // Set the new date to the first day of the month
    const firstDayOfMonth = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      1
    );
    handleDateSelect(firstDayOfMonth);
  };

  const handleClearDate = async () => {
    if (!selectedDate || !timeEntries.length) return;

    if (
      window.confirm(
        `Are you sure you want to delete all entries for ${format(
          selectedDate,
          "MMMM d, yyyy"
        )}?`
      )
    ) {
      try {
        // Filter entries for the selected date only
        const entriesForSelectedDate = timeEntries.filter((entry) => {
          const entryDate = format(new Date(entry.date), "yyyy-MM-dd");
          const selectedFormattedDate = format(selectedDate, "yyyy-MM-dd");
          return entryDate === selectedFormattedDate;
        });

        console.log(
          "Deleting entries for date:",
          format(selectedDate, "yyyy-MM-dd"),
          entriesForSelectedDate
        );

        // Delete each entry for the selected date
        const deletePromises = entriesForSelectedDate.map((entry) =>
          api.delete(`/timesheets/${entry._id}`)
        );

        await Promise.all(deletePromises);

        // Clear the cache for the current date
        const formattedDate = format(selectedDate, "yyyy-MM-dd");
        setEntriesCache((prev) => {
          const newCache = { ...prev };
          delete newCache[formattedDate];
          return newCache;
        });

        // Clear current entries
        setTimeEntries([]);

        // Refresh the data
        await fetchTimeEntries();
      } catch (error) {
        console.error("Error clearing date entries:", error);
        alert("Error clearing entries. Please try again.");
      }
    }
  };

  // Add function to handle timesheet approval
  const handleApproveTimesheet = async (entryId) => {
    try {
      await api.put(`/timesheets/${entryId}/approve`);
      // Refresh the timesheet entries
      await fetchTimeEntries();
    } catch (error) {
      console.error("Error approving timesheet:", error);
      alert("Failed to approve timesheet");
    }
  };

  // Add function to handle timesheet rejection
  const handleRejectTimesheet = async (entryId) => {
    try {
      await api.put(`/timesheets/${entryId}/reject`);
      // Refresh the timesheet entries
      await fetchTimeEntries();
    } catch (error) {
      console.error("Error rejecting timesheet:", error);
      alert("Failed to reject timesheet");
    }
  };

  // Add function to handle status update
  const handleStatusUpdate = async (status) => {
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      // Get user ID from currentUser
      const userId = selectedUserId || currentUser._id;

      console.log("Status update details:", {
        date: formattedDate,
        status,
        selectedUserId,
        currentUserId: currentUser._id,
        finalUserId: userId,
      });

      if (!userId) {
        console.error("No user ID available for status update", {
          selectedUserId,
          currentUser,
        });
        return;
      }

      // Update the status for the specific user
      const response = await api.put(`/timesheets/status/${formattedDate}`, {
        status,
        userId,
      });

      console.log("Status update response:", response.data);

      // Update the local state
      setTimesheetStatus(status);

      // Refresh the time entries
      await fetchTimeEntries();
    } catch (error) {
      console.error(
        "Error updating timesheet status:",
        error.response?.data || error
      );
    }
  };

  return (
    <Box m="20px">
      <style>{calendarStyles}</style>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header
          title="TIMESHEETS"
          subtitle={
            selectedUserId
              ? `Viewing timesheets for ${selectedUserName}`
              : "Manage your timesheets"
          }
        />
        {!selectedUserId && viewMode === "full" && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Add Time Entry
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Monthly Calendar - Left Side */}
        {viewMode === "full" && (
          <Grid item xs={12} md={5}>
            <Paper
              elevation={3}
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.alt,
                height: "calc(100vh - 200px)",
                overflow: "auto",
              }}
            >
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={2}
              >
                <IconButton
                  onClick={() => handleMonthChange("prev")}
                  sx={{ color: colors.grey[100] }}
                >
                  <ArrowBackIosNewIcon />
                </IconButton>
                <Typography variant="h6">
                  {format(selectedDate, "MMMM yyyy")}
                </Typography>
                <IconButton
                  onClick={() => handleMonthChange("next")}
                  sx={{ color: colors.grey[100] }}
                >
                  <ArrowForwardIosIcon />
                </IconButton>
              </Box>
              <List sx={{ width: "100%", bgcolor: "background.paper" }}>
                {daysInMonth.map((day) => {
                  const formattedDate = format(day, "yyyy-MM-dd");
                  const duration = monthlyTimeEntries[formattedDate] || 0;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const status = dailyStatuses[formattedDate];

                  return (
                    <ListItem
                      key={formattedDate}
                      disablePadding
                      sx={{
                        mb: 0.5,
                        backgroundColor: isSameDay(day, selectedDate)
                          ? colors.primary[500]
                          : isWeekend
                          ? colors.neutral[700]
                          : "transparent",
                        borderRadius: "4px",
                      }}
                    >
                      <ListItemButton
                        onClick={() => handleDateSelect(day)}
                        sx={{
                          py: 0.5,
                          "&:hover": {
                            backgroundColor: isSameDay(day, selectedDate)
                              ? colors.primary[600]
                              : colors.grey[700],
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography
                                sx={{
                                  fontSize: "0.875rem",
                                  color: isSameDay(day, selectedDate)
                                    ? colors.grey[100]
                                    : colors.grey[100],
                                  fontWeight: isSameDay(day, selectedDate)
                                    ? "bold"
                                    : "normal",
                                }}
                              >
                                {`${format(day, "EEEE")} - ${format(
                                  day,
                                  "do MMMM"
                                )}`}
                              </Typography>
                              {status && (
                                <Chip
                                  label={
                                    status.charAt(0).toUpperCase() +
                                    status.slice(1)
                                  }
                                  size="small"
                                  sx={{
                                    backgroundColor:
                                      status === "finalised"
                                        ? colors.greenAccent[500]
                                        : status === "absent"
                                        ? colors.grey[500]
                                        : "transparent",
                                    color:
                                      status === "finalised"
                                        ? colors.grey[100]
                                        : colors.grey[100],
                                    border:
                                      status === "incomplete"
                                        ? `1px solid ${colors.grey[500]}`
                                        : "none",
                                    fontSize: "0.75rem",
                                    height: "20px",
                                  }}
                                />
                              )}
                            </Box>
                          }
                        />
                        <Typography
                          sx={{
                            fontSize: "0.875rem",
                            color: colors.grey[100],
                            ml: 2,
                          }}
                        >
                          {formatDuration(duration)}
                          {monthlyProjectTimeEntries[formattedDate] > 0 && (
                            <span style={{ marginLeft: "4px", opacity: 0.7 }}>
                              (
                              {formatDuration(
                                monthlyProjectTimeEntries[formattedDate]
                              )}
                              )
                            </span>
                          )}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Day View - Right Side */}
        <Grid item xs={12} md={viewMode === "full" ? 7 : 12}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.alt,
              height: "calc(100vh - 200px)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h5">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </Typography>
              {!selectedUserId && (
                <Box display="flex" gap={1}>
                  <Button
                    variant={
                      timesheetStatus === "finalised" ? "contained" : "outlined"
                    }
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleStatusUpdate("finalised")}
                    disabled={timesheetStatus === "finalised"}
                  >
                    Finalise
                  </Button>
                  <Button
                    variant={
                      timesheetStatus === "absent" ? "contained" : "outlined"
                    }
                    sx={{
                      color:
                        timesheetStatus === "absent"
                          ? "white"
                          : colors.grey[100],
                      borderColor: colors.grey[100],
                      backgroundColor:
                        timesheetStatus === "absent"
                          ? colors.grey[500]
                          : "transparent",
                      "&:hover": {
                        borderColor: colors.grey[300],
                        backgroundColor:
                          timesheetStatus === "absent"
                            ? colors.grey[600]
                            : colors.grey[700],
                      },
                    }}
                    startIcon={<EventBusyIcon />}
                    onClick={() => handleStatusUpdate("absent")}
                    disabled={timesheetStatus === "absent"}
                  >
                    Mark Absent
                  </Button>
                  {timeEntries.length > 0 && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteSweepIcon />}
                      onClick={handleClearDate}
                      size="small"
                    >
                      Clear Date
                    </Button>
                  )}
                </Box>
              )}
            </Box>
            <Box sx={{ height: "calc(100% - 60px)", position: "relative" }}>
              {isCalendarLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 1,
                  }}
                >
                  <Typography variant="h6" color="white">
                    Loading...
                  </Typography>
                </Box>
              )}
              <FullCalendar
                key={calendarKey}
                ref={calendarRef}
                plugins={[timeGridPlugin, interactionPlugin]}
                initialView="timeGridDay"
                headerToolbar={false}
                selectable={true}
                selectMirror={true}
                select={handleSelect}
                eventClick={handleEventClick}
                nowIndicator={true}
                slotMinTime="07:00:00"
                slotMaxTime="18:00:00"
                height="100%"
                events={events}
                editable={true}
                dayMaxEvents={true}
                slotDuration="00:15:00"
                allDaySlot={false}
                slotHeight={7.5}
                timeZone="local"
                initialDate={selectedDate}
                date={selectedDate}
                loading={isCalendarLoading}
                slotLabelFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
                eventTimeFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
                forceEventDuration={true}
                eventDisplay="block"
                eventMinHeight={15}
                eventOverlap={false}
                eventConstraint={{
                  startTime: "07:00",
                  endTime: "18:00",
                  dows: [0, 1, 2, 3, 4, 5, 6],
                }}
                slotLabelClassNames="fc-slot-label-small"
                eventContent={(eventInfo) => ({
                  html: `
                    <div style="padding: 1px;">
                      <div style="font-weight: bold; font-size: 0.975em;">
                        ${eventInfo.event.title}
                        ${
                          eventInfo.event.extendedProps.projectInputType
                            ? `<span style="font-size: 0.78em; color: ${
                                colors.grey[100]
                              }; margin-left: 4px;">(${eventInfo.event.extendedProps.projectInputType
                                .replace("_", " ")
                                .replace(/\b\w/g, (l) =>
                                  l.toUpperCase()
                                )})</span>`
                            : ""
                        }
                      </div>
                      <div style="font-size: 0.78em;">${
                        eventInfo.event.extendedProps.description || ""
                      }</div>
                    </div>
                  `,
                })}
                datesSet={(dateInfo) => {
                  const newDate = dateInfo.start;
                  if (newDate && !isSameDay(newDate, selectedDate)) {
                    console.log(
                      "Calendar dates set - updating selected date:",
                      {
                        newDate: format(newDate, "yyyy-MM-dd"),
                        currentSelectedDate: format(selectedDate, "yyyy-MM-dd"),
                      }
                    );
                    handleDateSelect(newDate);
                  }
                }}
                eventDidMount={(info) => {
                  if (info.event.id) {
                    // Only log events with IDs (our actual events)
                    console.log("Event mounted:", {
                      id: info.event.id,
                      title: info.event.title,
                      start: format(info.event.start, "yyyy-MM-dd HH:mm"),
                      end: format(info.event.end, "yyyy-MM-dd HH:mm"),
                      date: format(info.event.start, "yyyy-MM-dd"),
                      selectedDate: format(selectedDate, "yyyy-MM-dd"),
                    });
                  }
                }}
                eventWillUnmount={(info) => {
                  if (info.event.id) {
                    console.log("Event will unmount:", {
                      id: info.event.id,
                      title: info.event.title,
                      date: format(info.event.start, "yyyy-MM-dd"),
                    });
                  }
                }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setIsEditing(false);
          setEditingEntryId(null);
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
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Start Time</InputLabel>
                  <Select
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    required
                  >
                    {Array.from({ length: 24 * 4 }, (_, i) => {
                      const hour = Math.floor(i / 4);
                      const minute = (i % 4) * 15;
                      const time = `${hour.toString().padStart(2, "0")}:${minute
                        .toString()
                        .padStart(2, "0")}`;
                      return (
                        <MenuItem key={time} value={time}>
                          {time}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>End Time</InputLabel>
                  <Select
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    required
                  >
                    {Array.from({ length: 24 * 4 }, (_, i) => {
                      const hour = Math.floor(i / 4);
                      const minute = (i % 4) * 15;
                      const time = `${hour.toString().padStart(2, "0")}:${minute
                        .toString()
                        .padStart(2, "0")}`;
                      return (
                        <MenuItem key={time} value={time}>
                          {time}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
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
                    <FormControl fullWidth>
                      <InputLabel>Project</InputLabel>
                      <Select
                        value={formData.projectId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            projectId: e.target.value,
                          })
                        }
                        required
                      >
                        {projects.map((project) => (
                          <MenuItem key={project._id} value={project._id}>
                            {project.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
                if (
                  window.confirm("Are you sure you want to delete this entry?")
                ) {
                  handleDelete(editingEntryId);
                  setOpenDialog(false);
                  setIsEditing(false);
                  setEditingEntryId(null);
                }
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
    </Box>
  );
};

export default Timesheets;
