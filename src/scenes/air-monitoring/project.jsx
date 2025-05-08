import {
  Box,
  Typography,
  useTheme,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from "@mui/material";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

const AirMonitoringProject = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [openDialog, setOpenDialog] = useState(false);
  const [newShift, setNewShift] = useState({
    date: null,
    removalist: "",
    description: "",
    sampler: "",
  });

  // Mock data - replace with actual data from your backend
  const project = {
    id: projectId,
    name: "Project Alpha",
    client: "Client A",
    clientContact: "John Doe",
    clientPhone: "123-456-7890",
  };

  const removalists = [
    "ABC Asbestos Removal",
    "Safe Air Solutions",
    "Clean Air Professionals",
    "Hazard Control Services",
    "Environmental Safety Group",
    "Air Quality Experts",
  ];

  const samplers = [
    "Jane Smith",
    "Mike Johnson",
    "Sarah Williams",
    "David Brown",
    "Lisa Davis",
  ];

  // Mock shifts data - replace with actual data from your backend
  const [shifts, setShifts] = useState([
    {
      id: "S001",
      date: "2024-03-15",
      removalist: "ABC Asbestos Removal",
      description: "Initial air monitoring",
      sampler: "Jane Smith",
    },
    {
      id: "S002",
      date: "2024-03-16",
      removalist: "Safe Air Solutions",
      description: "Follow-up monitoring",
      sampler: "Mike Johnson",
    },
  ]);

  const handleAddShift = () => {
    if (
      newShift.date &&
      newShift.removalist &&
      newShift.description &&
      newShift.sampler
    ) {
      const shift = {
        id: `S${String(shifts.length + 1).padStart(3, "0")}`,
        ...newShift,
        date: newShift.date.toISOString().split("T")[0],
      };
      setShifts([...shifts, shift]);
      setOpenDialog(false);
      setNewShift({
        date: null,
        removalist: "",
        description: "",
        sampler: "",
      });
    }
  };

  const handleDeleteShift = (shiftId) => {
    setShifts(shifts.filter((shift) => shift.id !== shiftId));
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/air-monitoring")}
        sx={{
          mb: 3,
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
        }}
      >
        Back to Air Monitoring
      </Button>

      <Paper
        sx={{ p: 3, mb: 4, backgroundColor: theme.palette.background.paper }}
      >
        <Typography
          variant="h4"
          sx={{
            color:
              theme.palette.mode === "dark"
                ? "#fff"
                : theme.palette.secondary[200],
            mb: 2,
          }}
        >
          {project.name}
        </Typography>
        <Typography
          sx={{ color: theme.palette.mode === "dark" ? "#fff" : "inherit" }}
        >
          Project ID: {project.id}
        </Typography>
        <Typography
          sx={{ color: theme.palette.mode === "dark" ? "#fff" : "inherit" }}
        >
          Client: {project.client}
        </Typography>
        <Typography
          sx={{ color: theme.palette.mode === "dark" ? "#fff" : "inherit" }}
        >
          Contact: {project.clientContact}
        </Typography>
        <Typography
          sx={{ color: theme.palette.mode === "dark" ? "#fff" : "inherit" }}
        >
          Phone: {project.clientPhone}
        </Typography>
      </Paper>

      <Box sx={{ mb: 4 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            backgroundColor: theme.palette.primary[500],
            "&:hover": {
              backgroundColor: theme.palette.primary[600],
            },
          }}
        >
          Add Shift
        </Button>
      </Box>

      <List>
        {shifts.map((shift) => (
          <ListItem
            key={shift.id}
            sx={{
              bgcolor: theme.palette.background.paper,
              mb: 2,
              borderRadius: 1,
            }}
          >
            <ListItemText
              primary={
                <Typography
                  sx={{
                    color: theme.palette.mode === "dark" ? "#fff" : "inherit",
                  }}
                >
                  {shift.date} - {shift.removalist}
                </Typography>
              }
              secondary={
                <Typography
                  sx={{
                    color:
                      theme.palette.mode === "dark"
                        ? theme.palette.grey[300]
                        : "inherit",
                  }}
                >
                  {shift.description} | Sampler: {shift.sampler}
                </Typography>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                aria-label="edit"
                sx={{ color: theme.palette.info.light, mr: 1 }}
              >
                <EditIcon />
              </IconButton>
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => handleDeleteShift(shift.id)}
                sx={{ color: theme.palette.error.light }}
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            color:
              theme.palette.mode === "dark"
                ? "#fff"
                : theme.palette.secondary[200],
          }}
        >
          Add New Shift
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date"
                value={newShift.date}
                onChange={(newValue) =>
                  setNewShift({ ...newShift, date: newValue })
                }
                sx={{
                  width: "100%",
                  "& .MuiInputLabel-root": {
                    color:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                  },
                  "& .MuiOutlinedInput-root": {
                    color:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                    "& fieldset": {
                      borderColor:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                    },
                  },
                }}
              />
            </LocalizationProvider>

            <Autocomplete
              options={removalists}
              value={newShift.removalist}
              onChange={(event, newValue) =>
                setNewShift({ ...newShift, removalist: newValue })
              }
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Asbestos Removalist"
                  sx={{
                    "& .MuiInputLabel-root": {
                      color:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                    },
                    "& .MuiOutlinedInput-root": {
                      color:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                      "& fieldset": {
                        borderColor:
                          theme.palette.mode === "dark"
                            ? "#fff"
                            : theme.palette.secondary[200],
                      },
                    },
                  }}
                />
              )}
            />

            <TextField
              label="Job Description"
              value={newShift.description}
              onChange={(e) =>
                setNewShift({ ...newShift, description: e.target.value })
              }
              multiline
              rows={3}
              sx={{
                "& .MuiInputLabel-root": {
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                },
                "& .MuiOutlinedInput-root": {
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  "& fieldset": {
                    borderColor:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                  },
                },
              }}
            />

            <Autocomplete
              options={samplers}
              value={newShift.sampler}
              onChange={(event, newValue) =>
                setNewShift({ ...newShift, sampler: newValue })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sampler"
                  sx={{
                    "& .MuiInputLabel-root": {
                      color:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                    },
                    "& .MuiOutlinedInput-root": {
                      color:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                      "& fieldset": {
                        borderColor:
                          theme.palette.mode === "dark"
                            ? "#fff"
                            : theme.palette.secondary[200],
                      },
                    },
                  }}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenDialog(false)}
            sx={{
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddShift}
            variant="contained"
            disabled={
              !newShift.date ||
              !newShift.removalist ||
              !newShift.description ||
              !newShift.sampler
            }
            sx={{
              backgroundColor: theme.palette.primary[500],
              "&:hover": {
                backgroundColor: theme.palette.primary[600],
              },
            }}
          >
            Add Shift
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirMonitoringProject;
