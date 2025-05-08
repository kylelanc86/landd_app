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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

const PROJECTS_KEY = "ldc_projects";

const CalendarPage = ({ toggleColorMode, mode }) => {
  const calendarRef = useRef(null);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [events, setEvents] = useState([]);

  // Load active projects
  useEffect(() => {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (stored) {
      const allProjects = JSON.parse(stored);
      setProjects(allProjects.filter((p) => p.status === "Active"));
    }
  }, []);

  // Handle selection
  const handleSelect = (info) => {
    setSelectedInfo(info);
    setBookingDialogOpen(true);
    setSelectedProject(null);
    setSearch("");
  };

  // Filter projects by search
  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.users && p.users.join(", ").toLowerCase().includes(q))
    );
  });

  // Handle booking
  const handleBook = () => {
    if (!selectedProject || !selectedInfo) return;
    const event = {
      title: selectedProject.name,
      start: selectedInfo.startStr,
      end: selectedInfo.endStr,
      allDay: selectedInfo.allDay,
      extendedProps: {
        projectId: selectedProject.id,
        client: selectedProject.client,
      },
    };
    setEvents([...events, event]);
    setBookingDialogOpen(false);
    setSelectedInfo(null);
    setSelectedProject(null);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Calendar
      </Typography>
      <Paper sx={{ p: 2 }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            listPlugin,
          ]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right:
              "dayGridMonth,timeGridWeek,timeGridDay,timeGridWorkWeek,listWeek",
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
          nowIndicator={true}
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          height="auto"
          events={events}
          editable={true}
          dayMaxEvents={true}
        />
      </Paper>
      {/* Booking Dialog */}
      <Dialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Book Project</DialogTitle>
        <DialogContent>
          <TextField
            label="Search Projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <List sx={{ maxHeight: 300, overflow: "auto" }}>
            {filteredProjects.length === 0 && (
              <ListItem>
                <ListItemText primary="No active projects found." />
              </ListItem>
            )}
            {filteredProjects.map((project) => (
              <ListItem
                button
                key={project.id}
                selected={selectedProject && selectedProject.id === project.id}
                onClick={() => setSelectedProject(project)}
              >
                <ListItemText
                  primary={project.name}
                  secondary={`Client: ${project.client} | Type: ${project.type} | Address: ${project.address}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBookingDialogOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleBook}
            variant="contained"
            color="primary"
            disabled={!selectedProject}
          >
            Book Project
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarPage;
