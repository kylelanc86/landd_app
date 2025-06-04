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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { format, addDays, subDays, startOfDay, endOfDay } from "date-fns";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const Timesheets = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
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

  // Fetch time entries for the selected day
  const fetchTimeEntries = async () => {
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const userId = currentUser._id;

      console.log("Fetching entries for date:", {
        date: formattedDate,
        userId,
      });

      // Use the existing range endpoint but with same start and end date
      const response = await api.get(
        `/timesheets/range/${formattedDate}/${formattedDate}`
      );

      const processedEntries = (response.data || []).map((entry) => ({
        ...entry,
        date: new Date(entry.date).toISOString().split("T")[0],
      }));

      console.log("Processed entries:", processedEntries);
      setTimeEntries(processedEntries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      setTimeEntries([]);
    }
  };

  // Fetch timesheet status for the selected day
  const fetchTimesheetStatus = async () => {
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const userId = currentUser._id;

      // Use the existing status range endpoint but with same start and end date
      const response = await api.get(
        `/timesheets/status/range/${formattedDate}/${formattedDate}`
      );

      // Get the status for the current date from the response
      const status = response.data?.[0]?.status || "incomplete";
      console.log("Timesheet status:", status);
      setTimesheetStatus(status);
    } catch (error) {
      console.error("Error fetching timesheet status:", error);
      setTimesheetStatus("incomplete");
    }
  };

  // Handle status update
  const handleStatusUpdate = async (status) => {
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      // Use the existing status update endpoint
      const response = await api.put(`/timesheets/status/${formattedDate}`, {
        status,
        userId: currentUser._id,
        date: formattedDate,
      });

      console.log("Status update response:", response.data);
      setTimesheetStatus(status);
      await fetchTimeEntries();
    } catch (error) {
      console.error("Error updating timesheet status:", error);
      alert("Failed to update timesheet status. Please try again.");
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      // Check if timesheet is finalised
      if (timesheetStatus === "finalised") {
        alert(
          "Cannot modify entries for a finalised timesheet. Please unfinalise first."
        );
        return;
      }

      const timesheetData = {
        ...formData,
        date: formattedDate,
        userId: currentUser._id,
        projectId:
          formData.isAdminWork || formData.isBreak ? null : formData.projectId,
        projectInputType:
          formData.isAdminWork || formData.isBreak
            ? null
            : formData.projectInputType,
      };

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
    } catch (error) {
      console.error("Error saving time entry:", error);
      alert(error.response?.data?.message || "Error saving time entry");
    }
  };

  // Handle entry deletion
  const handleDelete = async (entryId) => {
    try {
      await api.delete(`/timesheets/${entryId}`);
      await fetchTimeEntries();
    } catch (error) {
      console.error("Error deleting time entry:", error);
      alert(error.response?.data?.message || "Error deleting time entry");
    }
  };

  // Handle day navigation
  const handleDayChange = (direction) => {
    const newDate =
      direction === "next"
        ? addDays(selectedDate, 1)
        : subDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  // Calculate total hours for the day
  const calculateTotalHours = (entries) => {
    return (
      entries.reduce((total, entry) => {
        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60;
        return total + duration;
      }, 0) / 60
    ).toFixed(2);
  };

  // Fetch initial data
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

    fetchData();
  }, [selectedDate]);

  return (
    <Box m="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header title="TIMESHEETS" subtitle="Manage your daily timesheet" />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          disabled={timesheetStatus === "finalised"}
        >
          Add Time Entry
        </Button>
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

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Start Time</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {timeEntries.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>{entry.startTime}</TableCell>
                  <TableCell>{entry.endTime}</TableCell>
                  <TableCell>
                    {entry.isBreak
                      ? "Break"
                      : entry.isAdminWork
                      ? "Admin Work"
                      : projects.find((p) => p._id === entry.projectId)?.name ||
                        "Unknown"}
                  </TableCell>
                  <TableCell>
                    {entry.projectInputType
                      ? entry.projectInputType
                          .replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())
                      : "-"}
                  </TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{calculateTotalHours([entry])}h</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => {
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
                      }}
                      disabled={timesheetStatus === "finalised"}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(entry._id)}
                      disabled={timesheetStatus === "finalised"}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {timeEntries.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="right">
                    <Typography variant="subtitle1" fontWeight="bold">
                      Total Hours:
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {calculateTotalHours(timeEntries)}h
                    </Typography>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
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
