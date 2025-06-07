import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Autocomplete,
  ListItem,
  ListItemText,
  InputAdornment,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Header from "../../components/Header";

const AsbestosAssessment = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeJobs, setActiveJobs] = useState([
    {
      id: 1,
      jobId: "12345",
      siteAddress: "123 Main St, City",
      assessor: "John Doe",
    },
    {
      id: 2,
      jobId: "67890",
      siteAddress: "456 Oak St, Town",
      assessor: "Jane Smith",
    },
  ]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableProjects, setAvailableProjects] = useState([
    { id: 1, name: "Project A" },
    { id: 2, name: "Project B" },
  ]);

  const handleAddJob = () => {
    if (selectedProject) {
      // Add the selected project to active jobs
      const newJob = {
        id: activeJobs.length + 1,
        jobId: selectedProject.name,
        siteAddress: "New Address",
        assessor: "New Assessor",
      };
      setActiveJobs([...activeJobs, newJob]);
      setOpenDialog(false);
      setSelectedProject(null);
      setSearchQuery("");
    }
  };

  const handleDeleteJob = (jobId) => {
    if (window.confirm("Are you sure you want to delete this job?")) {
      setActiveJobs(activeJobs.filter((job) => job.id !== jobId));
    }
  };

  const getProjectClient = (projectId) => {
    // Simulate fetching client data for a project
    const clients = {
      1: { name: "Client A" },
      2: { name: "Client B" },
    };
    return clients[projectId];
  };

  return (
    <Box m="20px" position="relative">
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
          zIndex: 99998,
          cursor: "not-allowed",
        }}
      />

      <Header
        title="Asbestos Assessment"
        subtitle="Manage asbestos assessments"
      />

      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 4 }}>
          Asbestos Assessment
        </Typography>
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Add Job
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{
              backgroundColor:
                theme.palette.mode === "dark"
                  ? theme.palette.primary[500]
                  : theme.palette.primary[700],
              color: "#fff",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? theme.palette.primary[600]
                    : theme.palette.primary[800],
              },
            }}
          >
            Add Job
          </Button>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Active Jobs
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Job ID</TableCell>
                  <TableCell>Site Address</TableCell>
                  <TableCell>Assessor</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.jobId}</TableCell>
                    <TableCell>{job.siteAddress}</TableCell>
                    <TableCell>{job.assessor}</TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        onClick={() =>
                          navigate(`/asbestos-assessment/details/${job.id}`)
                        }
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteJob(job.id)}
                        sx={{ ml: 1 }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setSelectedProject(null);
            setSearchQuery("");
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6">Select Project</Typography>
              <IconButton
                onClick={() => {
                  setOpenDialog(false);
                  setSelectedProject(null);
                  setSearchQuery("");
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Autocomplete
                options={availableProjects}
                getOptionLabel={(option) => option.name}
                value={selectedProject}
                onChange={(event, newValue) => {
                  setSelectedProject(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Projects"
                    variant="outlined"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <ListItem {...props}>
                    <ListItemText
                      primary={option.name}
                      secondary={`Client: ${
                        getProjectClient(option.id)?.name || "N/A"
                      }`}
                    />
                  </ListItem>
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setOpenDialog(false);
                setSelectedProject(null);
                setSearchQuery("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddJob}
              variant="contained"
              disabled={!selectedProject}
            >
              Create Job
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default AsbestosAssessment;
