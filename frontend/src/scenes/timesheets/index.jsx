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
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
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

const Timesheets = () => {
  const theme = useTheme();
  const colors = tokens;
  const { currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date("2025-05-01"));
  const [selectedDate, setSelectedDate] = useState(new Date("2025-05-01"));
  const [openDialog, setOpenDialog] = useState(false);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [monthlyTimeEntries, setMonthlyTimeEntries] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [entriesCache, setEntriesCache] = useState({});
  const [formData, setFormData] = useState({
    startTime: "",
    endTime: "",
    projectId: "",
    description: "",
    isAdminWork: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const calendarRef = useRef(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);

  // Generate days of the current month
  const daysInMonth = selectedDate
    ? eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      })
    : [];

  // Update the useEffect to handle initial setup
  useEffect(() => {
    const defaultDate = new Date("2025-05-01");
    defaultDate.setHours(0, 0, 0, 0);
    setSelectedDate(defaultDate);
  }, []);

  // Separate useEffect for data fetching
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

        // Fetch time entries for the selected date
        await fetchTimeEntries();
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

  const fetchTimeEntries = async () => {
    if (!selectedDate) return;

    try {
      setIsCalendarLoading(true);
      const selectedFormattedDate = format(selectedDate, "yyyy-MM-dd");
      console.log("Fetching entries for date:", selectedFormattedDate);

      // Get the first and last day of the month
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);

      // Fetch all entries for the month
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/timesheets/range/${format(
          startDate,
          "yyyy-MM-dd"
        )}/${format(endDate, "yyyy-MM-dd")}`,
        {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        }
      );

      console.log(
        "Raw response data:",
        response.data.map((entry) => ({
          id: entry._id,
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
        }))
      );

      // Keep all entries for the month
      setTimeEntries(response.data);

      // Process monthly entries for the sidebar
      const newMonthlyTimeEntries = {};
      let currentDate = new Date(startDate);
      while (
        isBefore(currentDate, endDate) ||
        isSameDay(currentDate, endDate)
      ) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        newMonthlyTimeEntries[dateStr] = 0;
        currentDate = addDays(currentDate, 1);
      }

      // Calculate durations for each day
      response.data.forEach((entry) => {
        const entryDate = format(new Date(entry.date), "yyyy-MM-dd");
        if (newMonthlyTimeEntries[entryDate] !== undefined) {
          const [startHours, startMinutes] = entry.startTime
            .split(":")
            .map(Number);
          const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
          const startTotalMinutes = startHours * 60 + startMinutes;
          const endTotalMinutes = endHours * 60 + endMinutes;
          let duration = endTotalMinutes - startTotalMinutes;

          if (duration < 0) {
            duration += 24 * 60;
          }

          newMonthlyTimeEntries[entryDate] += duration;
        }
      });

      setMonthlyTimeEntries(newMonthlyTimeEntries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      setTimeEntries([]);
    } finally {
      setIsCalendarLoading(false);
    }
  };

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

      // Create the event with the entry's date
      const event = {
        id: entry._id,
        title: entry.isAdminWork
          ? "Admin Work"
          : projects.find((p) => p._id === entry.projectId)?.name ||
            "Unknown Project",
        start: `${formattedEntryDate}T${entry.startTime}:00`,
        end: `${formattedEntryDate}T${entry.endTime}:00`,
        backgroundColor: entry.isAdminWork
          ? colors.primary[500]
          : colors.primary[400],
        borderColor: entry.isAdminWork
          ? colors.primary[600]
          : colors.primary[500],
        display: "block",
        allDay: false,
        extendedProps: {
          description: entry.description,
          projectId: entry.projectId,
          isAdminWork: entry.isAdminWork,
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
      const timesheetData = {
        ...formData,
        date: format(selectedDate, "yyyy-MM-dd"),
      };

      await axios.post(
        `${process.env.REACT_APP_API_URL}/timesheets`,
        timesheetData,
        {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        }
      );

      setOpenDialog(false);
      setFormData({
        startTime: "",
        endTime: "",
        projectId: "",
        description: "",
        isAdminWork: false,
      });

      // Refresh time entries using the range endpoint instead of date endpoint
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/timesheets/range/${format(
          startDate,
          "yyyy-MM-dd"
        )}/${format(endDate, "yyyy-MM-dd")}`,
        {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        }
      );
      setTimeEntries(response.data);
    } catch (error) {
      console.error("Error creating time entry:", error);
      alert(error.response?.data?.message || "Error creating time entry");
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
        // Delete each entry for the selected date
        const deletePromises = timeEntries.map((entry) =>
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

  return (
    <Box m="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header title="TIMESHEETS" subtitle="Manage your timesheets" />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Time Entry
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Monthly Calendar - Left Side */}
        <Grid item xs={12} md={4}>
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

                return (
                  <ListItem
                    key={formattedDate}
                    disablePadding
                    sx={{
                      mb: 0.5,
                      backgroundColor: isSameDay(day, selectedDate)
                        ? colors.primary[500]
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
                        primary={`${format(day, "EEEE")} - ${format(
                          day,
                          "do MMMM"
                        )}`}
                        primaryTypographyProps={{
                          fontSize: "0.875rem",
                          color: isSameDay(day, selectedDate)
                            ? colors.grey[100]
                            : colors.grey[100],
                          fontWeight: isSameDay(day, selectedDate)
                            ? "bold"
                            : "normal",
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          color: colors.grey[100],
                          ml: 2,
                        }}
                      >
                        {formatDuration(duration)}
                      </Typography>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* Day View - Right Side */}
        <Grid item xs={12} md={8}>
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
            <Typography
              variant="h5"
              mb={2}
              sx={{ display: "flex", alignItems: "center", gap: 2 }}
            >
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
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
            </Typography>
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
                slotHeight={10}
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
                eventMinHeight={20}
                eventOverlap={false}
                eventConstraint={{
                  startTime: "07:00",
                  endTime: "18:00",
                  dows: [0, 1, 2, 3, 4, 5, 6],
                }}
                eventContent={(eventInfo) => ({
                  html: `
                    <div style="padding: 2px;">
                      <div style="font-weight: bold;">${
                        eventInfo.event.title
                      }</div>
                      <div style="font-size: 0.8em;">${
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
                    {Array.from({ length: 12 * 4 }, (_, i) => {
                      const hour = Math.floor(i / 4) + 7;
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
                    {Array.from({ length: 12 * 4 }, (_, i) => {
                      const hour = Math.floor(i / 4) + 7;
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
                    value={formData.isAdminWork ? "admin" : "project"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isAdminWork: e.target.value === "admin",
                        projectId:
                          e.target.value === "admin" ? "" : formData.projectId,
                      })
                    }
                    required
                  >
                    <MenuItem value="project">Project Work</MenuItem>
                    <MenuItem value="admin">Admin Work</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {!formData.isAdminWork && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Project</InputLabel>
                    <Select
                      value={formData.projectId}
                      onChange={(e) =>
                        setFormData({ ...formData, projectId: e.target.value })
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
                  required
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
