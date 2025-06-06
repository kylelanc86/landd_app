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
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?._id) {
      setTargetUserId(currentUser?._id);
      return;
    }

    setTargetUserId(currentUser._id);
  }, [currentUser]);

  useEffect(() => {
    if (!targetUserId) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const dateParam = searchParams.get("date");
    const userIdParam = searchParams.get("userId");

    if (dateParam) {
      setSelectedDate(new Date(dateParam));
    }
    if (userIdParam && userIdParam !== targetUserId) {
      setTargetUserId(userIdParam);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("date", format(selectedDate, "yyyy-MM-dd"));
    searchParams.set("userId", targetUserId);
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${searchParams.toString()}`
    );
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

      if (!Array.isArray(response.data)) {
        setTimeEntries([]);
        return;
      }

      const processedEntries = response.data.map((entry) => {
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

      const status = response.data?.[0]?.status || "incomplete";
      setTimesheetStatus(status);
    } catch (error) {
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

      const timesheetData = {
        date: selectedDate,
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
      alert(error.response?.data?.message || "Error saving time entry");
    }
  };

  const handleDelete = async (entryId) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        await api.delete(`/timesheets/${entryId}`);
        await fetchTimeEntries();
        await fetchTimesheetStatus();
      } catch (error) {
        alert(error.response?.data?.message || "Error deleting time entry");
      }
    }
  };

  const handleDayChange = (direction) => {
    const newDate =
      direction === "next"
        ? addDays(selectedDate, 1)
        : subDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [projectsResponse] = await Promise.all([
          api.get("/projects"),
          fetchTimeEntries(),
          fetchTimesheetStatus(),
        ]);
        setProjects(projectsResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (targetUserId) {
      fetchData();
    }
  }, [selectedDate, targetUserId]);

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

      if (entry.isBreak) {
        title = `Break${entry.description ? ` - ${entry.description}` : ""}`;
        backgroundColor = theme.palette.warning.main;
        borderColor = theme.palette.warning.dark;
      } else if (entry.isAdminWork) {
        title = `Admin Work${
          entry.description ? ` - ${entry.description}` : ""
        }`;
        backgroundColor = theme.palette.info.main;
        borderColor = theme.palette.info.dark;
      } else {
        title = `${projectName} - ${
          entry.projectInputType?.replace("_", " ") || ""
        }${entry.description ? `, ${entry.description}` : ""}`;
        backgroundColor = theme.palette.primary.main;
        borderColor = theme.palette.primary.dark;
      }

      const event = {
        id: entry._id,
        title,
        start: startDateTime,
        end: endDateTime,
        backgroundColor,
        borderColor,
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
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header
          title="Daily Timesheet"
          subtitle={`${format(selectedDate, "MMMM d, yyyy")}`}
        />
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            onClick={() => navigate("/timesheets/monthly")}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.common.white,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Monthly View
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            disabled={timesheetStatus === "finalised"}
          >
            Add Time Entry
          </Button>
        </Box>
      </Box>

      <Paper
        elevation={3}
        sx={{ p: 2, backgroundColor: theme.palette.background.alt }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => handleDayChange("prev")}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography variant="h5">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </Typography>
            <IconButton onClick={() => handleDayChange("next")}>
              <ArrowForwardIosIcon />
            </IconButton>
          </Box>
          <Box display="flex" gap={1}>
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
            >
              {timesheetStatus === "finalised" ? "Unfinalise" : "Finalise"}
            </Button>
            <Button
              variant={timesheetStatus === "absent" ? "contained" : "outlined"}
              startIcon={<EventBusyIcon />}
              onClick={() =>
                handleStatusUpdate(
                  timesheetStatus === "absent" ? "incomplete" : "absent"
                )
              }
            >
              {timesheetStatus === "absent" ? "Mark Present" : "Mark Absent"}
            </Button>
          </Box>
        </Box>

        <Box sx={{ height: "600px" }}>
          <FullCalendar
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
                <Box sx={{ p: 0.5 }}>
                  <Typography variant="body2" noWrap>
                    {formatEventContent()}
                  </Typography>
                </Box>
              );
            }}
            sx={{
              "& .fc": {
                backgroundColor: "background.paper",
                borderRadius: "4px",
              },
              "& .fc-toolbar": {
                padding: "16px",
              },
              "& .fc-toolbar-title": {
                fontSize: "1.2rem !important",
                fontWeight: "bold",
              },
              "& .fc-button": {
                backgroundColor: "primary.main !important",
                borderColor: "primary.main !important",
                "&:hover": {
                  backgroundColor: "primary.dark !important",
                  borderColor: "primary.dark !important",
                },
              },
              "& .fc-timegrid-slot": {
                borderColor: "divider",
              },
              "& .fc-event": {
                cursor: "pointer",
                "&:hover": {
                  opacity: 0.9,
                },
              },
              "& .weekend-day": {
                backgroundColor: theme.palette.grey[100],
              },
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
                            {project.projectID}: {project.name}
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
