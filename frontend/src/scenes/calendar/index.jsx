import React, { useRef, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  InputAdornment,
  CircularProgress,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Header from "../../components/Header";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { projectService } from "../../services/api";
import api from "../../services/api";
import userService from "../../services/userService";

const CalendarPage = ({ toggleColorMode, mode }) => {
  const calendarRef = useRef(null);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Color palette for users
  const userColors = {
    default: "#3788d8", // Default blue color
    colors: [
      "#3788d8", // Blue
      "#e74c3c", // Red
      "#2ecc71", // Green
      "#f1c40f", // Yellow
      "#9b59b6", // Purple
      "#e67e22", // Orange
      "#1abc9c", // Turquoise
      "#34495e", // Dark Blue
      "#d35400", // Dark Orange
      "#16a085", // Dark Green
    ],
  };

  // Get color for a user
  const getUserColor = (userId) => {
    if (!userId) return userColors.default;
    const userIndex = users.findIndex((user) => user._id === userId);
    if (userIndex === -1) return userColors.default;
    return userColors.colors[userIndex % userColors.colors.length];
  };

  // Load active projects and calendar entries
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectsRes, calendarRes, usersRes] = await Promise.all([
          projectService.getAll(),
          api.get("/calendar-entries"),
          userService.getAll(),
        ]);

        const activeProjects = projectsRes.data.filter(
          (p) => p.status !== "Cancelled" && p.status !== "Job complete"
        );
        setProjects(activeProjects);
        setUsers(usersRes.data);

        // Transform calendar entries to include _id in extendedProps and add color
        const calendarEvents = calendarRes.data.map((event) => {
          const userColor = getUserColor(event.userId);
          return {
            ...event,
            backgroundColor: userColor,
            borderColor: userColor,
            extendedProps: {
              ...event.extendedProps,
              _id: event._id,
              projectId: event.projectId,
              client: event.client,
              userId: event.userId,
              userName: event.userName,
            },
          };
        });
        setEvents(calendarEvents);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle selection
  const handleSelect = (info) => {
    setSelectedInfo(info);
    setBookingDialogOpen(true);
    setSelectedProject(null);
    setSelectedUser(null);
    setSearch("");
  };

  // Filter projects by search
  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.client && p.client.name && p.client.name.toLowerCase().includes(q)) ||
      p.department.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.users &&
        p.users.some((user) =>
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(q)
        ))
    );
  });

  // Handle booking
  const handleBook = async () => {
    if (!selectedProject || !selectedInfo || !selectedUser) return;
    const userColor = getUserColor(selectedUser._id);
    const event = {
      title: `${selectedProject.projectID}: ${selectedProject.name} - ${selectedUser.firstName} ${selectedUser.lastName}`,
      start: selectedInfo.startStr,
      end: selectedInfo.endStr,
      allDay: selectedInfo.allDay,
      backgroundColor: userColor,
      borderColor: userColor,
      userId: selectedUser._id,
      userName: `${selectedUser.firstName} ${selectedUser.lastName}`,
      extendedProps: {
        projectId: selectedProject._id,
        client: selectedProject.client?.name || "Unknown Client",
        userId: selectedUser._id,
        userName: `${selectedUser.firstName} ${selectedUser.lastName}`,
      },
    };

    try {
      const response = await api.post("/calendar-entries", event);
      setEvents([...events, response.data]);
      setBookingDialogOpen(false);
      setSelectedInfo(null);
      setSelectedProject(null);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error creating calendar entry:", error);
      if (error.response) {
        console.error("Error details:", error.response.data);
      }
    }
  };

  // Handle event click
  const handleEventClick = (info) => {
    console.log("Event clicked:", info.event); // Debug log
    // Extract the actual event data from FullCalendar's event object
    const eventData = {
      _id: info.event.extendedProps._id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      allDay: info.event.allDay,
      extendedProps: info.event.extendedProps,
    };
    console.log("Extracted event data:", eventData); // Debug log
    setSelectedEvent(eventData);
    setEditDialogOpen(true);
  };

  // Handle event edit
  const handleEventEdit = async () => {
    if (!selectedEvent) return;
    setEditDialogOpen(false);
    setBookingDialogOpen(true);
    setSelectedInfo({
      startStr: selectedEvent.startStr,
      endStr: selectedEvent.endStr,
      allDay: selectedEvent.allDay,
    });
    setSelectedProject(
      projects.find((p) => p._id === selectedEvent.extendedProps.projectId)
    );
  };

  // Handle event delete
  const handleEventDelete = async () => {
    if (!selectedEvent) return;
    try {
      console.log("Deleting event:", selectedEvent); // Debug log
      const eventId = selectedEvent._id;
      if (!eventId) {
        throw new Error("No event ID found");
      }
      const response = await api.delete(`/calendar-entries/${eventId}`);
      console.log("Delete response:", response); // Debug log
      setEvents(events.filter((e) => e._id !== eventId));
      setDeleteDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error deleting calendar entry:", error);
      if (error.response) {
        console.error("Error details:", error.response.data);
      }
      // Show error to user
      alert("Failed to delete calendar entry. Please try again.");
    }
  };

  // Handle event update
  const handleEventUpdate = async (info) => {
    try {
      const userColor = getUserColor(info.event.extendedProps.userId);
      const updatedEvent = {
        title: info.event.title,
        start: info.event.startStr,
        end: info.event.endStr,
        allDay: info.event.allDay,
        backgroundColor: userColor,
        borderColor: userColor,
        userId: info.event.extendedProps.userId,
        userName: info.event.extendedProps.userName,
        extendedProps: {
          projectId: info.event.extendedProps.projectId,
          client: info.event.extendedProps.client,
          userId: info.event.extendedProps.userId,
          userName: info.event.extendedProps.userName,
        },
      };
      await api.put(`/calendar-entries/${info.event._id}`, updatedEvent);
    } catch (error) {
      console.error("Error updating calendar entry:", error);
      if (error.response) {
        console.error("Error details:", error.response.data);
      }
      // Revert the change in the UI
      info.revert();
    }
  };

  return (
    <Box m="20px" position="relative">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="CALENDAR" subtitle="Manage your project schedule" />
      </Box>
      <Box
        mt="20px"
        height="75vh"
        position="relative"
        sx={{
          "& .fc": {
            backgroundColor: "background.paper",
            borderRadius: "4px",
            boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
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
          "& .fc-daygrid-day": {
            borderColor: "divider",
          },
          "& .fc-event": {
            cursor: "pointer",
            "&:hover": {
              opacity: 0.9,
            },
          },
          "& .fc-event-title": {
            fontWeight: "bold",
          },
        }}
      >
        {/* Under Construction Watermark */}
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
            pointerEvents: "none",
            zIndex: 99999,
            backgroundColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              opacity: 0.3,
              userSelect: "none",
              transform: "rotate(-45deg)",
              width: "100%",
              maxWidth: "800px",
            }}
          >
            <WarningAmberIcon sx={{ fontSize: 120, color: "orange", mb: 2 }} />
            <Typography
              variant="h1"
              sx={{
                color: "orange",
                fontSize: "4rem",
                fontWeight: 900,
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)",
                textAlign: "center",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                lineHeight: 1.2,
              }}
            >
              Under Construction
            </Typography>
          </Box>
        </Box>

        {/* Interaction Blocker */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            // zIndex: -1, cursor: "not-allowed"
          }}
        />
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,timeGridWorkWeek",
          }}
          views={{
            timeGridWorkWeek: {
              type: "timeGrid",
              duration: { days: 5 },
              buttonText: "work week",
              hiddenDays: [0, 6],
            },
          }}
          selectable={true}
          selectMirror={true}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventUpdate}
          eventResize={handleEventUpdate}
          nowIndicator={true}
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          height="100%"
          events={events}
          editable={true}
          dayMaxEvents={true}
          eventContent={(eventInfo) => {
            return (
              <div style={{ padding: "2px 4px" }}>
                <div style={{ fontWeight: "bold" }}>
                  {eventInfo.event.title}
                </div>
                <div style={{ fontSize: "0.8em", opacity: 0.8 }}>
                  {eventInfo.event.extendedProps.userName}
                </div>
              </div>
            );
          }}
        />
      </Box>

      {/* Edit Event Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedEvent(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Calendar Entry</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Project: {selectedEvent?.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start:{" "}
            {selectedEvent?.start
              ? new Date(selectedEvent.start).toLocaleString()
              : "N/A"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            End:{" "}
            {selectedEvent?.end
              ? new Date(selectedEvent.end).toLocaleString()
              : "N/A"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(true);
              setEditDialogOpen(false);
            }}
            color="error"
            startIcon={<DeleteIcon />}
          >
            Delete
          </Button>
          <Button
            onClick={handleEventEdit}
            color="primary"
            startIcon={<EditIcon />}
          >
            Edit
          </Button>
          <Button
            onClick={() => {
              setEditDialogOpen(false);
              setSelectedEvent(null);
            }}
            color="secondary"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedEvent(null);
        }}
      >
        <DialogTitle>Delete Calendar Entry</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this calendar entry?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setSelectedEvent(null);
            }}
            color="secondary"
          >
            Cancel
          </Button>
          <Button onClick={handleEventDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog
        open={bookingDialogOpen}
        onClose={() => {
          setBookingDialogOpen(false);
          setSelectedInfo(null);
          setSelectedProject(null);
          setSelectedUser(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Book Calendar Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
              Selected Time
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start:{" "}
              {selectedInfo?.startStr
                ? new Date(selectedInfo.startStr).toLocaleString()
                : "N/A"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              End:{" "}
              {selectedInfo?.endStr
                ? new Date(selectedInfo.endStr).toLocaleString()
                : "N/A"}
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
              Select Project
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <List
              sx={{
                maxHeight: 200,
                overflow: "auto",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              {filteredProjects.map((project) => (
                <ListItem
                  key={project._id}
                  button
                  onClick={() => setSelectedProject(project)}
                  selected={selectedProject?._id === project._id}
                >
                  <ListItemText
                    primary={`${project.projectID} - ${project.name}`}
                    secondary={project.client?.name || "No client"}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
              Select User
            </Typography>
            <TextField
              select
              fullWidth
              variant="outlined"
              value={selectedUser ? selectedUser._id : ""}
              onChange={(e) => {
                const user = users.find((u) => u._id === e.target.value);
                setSelectedUser(user);
              }}
              SelectProps={{
                native: true,
              }}
            >
              <option value="" disabled>
                Select a user
              </option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName} - {user.role}
                </option>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBookingDialogOpen(false);
              setSelectedInfo(null);
              setSelectedProject(null);
              setSelectedUser(null);
            }}
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleBook}
            color="primary"
            variant="contained"
            disabled={!selectedProject || !selectedUser}
          >
            Book
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarPage;
