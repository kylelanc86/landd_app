import React, { useState, useEffect, useCallback } from "react";
import Header from "../../components/Header";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { tokens } from "../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import { jobService, shiftService, projectService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";

const AsbestosRemoval = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();

  const [asbestosRemovalJobs, setAsbestosRemovalJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedRemovalist, setSelectedRemovalist] = useState("");

  const fetchAsbestosRemovalJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await asbestosRemovalJobService.getAll();
      console.log(
        "Raw response from asbestosRemovalJobService.getAll():",
        response
      );

      // Handle different response structures
      let jobs = [];
      if (response && response.jobs && Array.isArray(response.jobs)) {
        // Paginated response structure
        jobs = response.jobs;
      } else if (response && response.data && Array.isArray(response.data)) {
        // Standard response.data structure
        jobs = response.data;
      } else if (Array.isArray(response)) {
        // Direct array response
        jobs = response;
      } else {
        console.log("Unexpected response structure:", response);
        jobs = [];
      }

      console.log("Extracted jobs array:", jobs);
      console.log("Is jobs an array?", Array.isArray(jobs));

      // Ensure jobs is an array before processing
      if (!Array.isArray(jobs)) {
        console.error("Jobs is not an array:", jobs);
        setAsbestosRemovalJobs([]);
        return;
      }

      // Process jobs to include project details
      const processedJobs = jobs.map((job) => {
        console.log("Processing job:", job);

        // Determine job type based on what's available
        let jobType = "None";
        if (job.hasAirMonitoring && job.hasClearance) {
          jobType = "Air Monitoring and Clearance";
        } else if (job.hasAirMonitoring) {
          jobType = "Air Monitoring";
        } else if (job.hasClearance) {
          jobType = "Clearance";
        }

        return {
          id: job._id,
          projectID: job.projectId?.projectID || job.projectID || "Unknown",
          projectName:
            job.projectId?.name || job.projectName || "Unknown Project",
          asbestosRemovalist: job.asbestosRemovalist || "Not assigned",
          status: job.status || "Active",
          jobType: jobType,
          hasAirMonitoring: job.hasAirMonitoring || false,
          hasClearance: job.hasClearance || false,
          originalData: job,
        };
      });

      console.log("Processed jobs:", processedJobs);

      // Sort by project ID
      const sortedJobs = processedJobs.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum; // Descending order (highest first)
      });

      console.log("Final sorted jobs:", sortedJobs);
      setAsbestosRemovalJobs(sortedJobs);
    } catch (err) {
      console.error("Error fetching asbestos removal jobs:", err);
      setError(err.message || "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectService.getAll({
        limit: 1000,
        status:
          "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent, Quote sent",
      });

      if (response && response.data) {
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data.data || [];

        const sortedProjects = projectsData.sort((a, b) => {
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
          return bNum - aNum;
        });

        setProjects(sortedProjects);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  }, []);

  const fetchAsbestosRemovalists = useCallback(async () => {
    try {
      const data = await customDataFieldGroupService.getFieldsByType(
        "asbestos_removalist"
      );
      // Sort alphabetically by text field
      const sortedData = (data || []).sort((a, b) =>
        (a.text || "").localeCompare(b.text || "")
      );
      setAsbestosRemovalists(sortedData);
    } catch (error) {
      console.error("Error fetching asbestos removalists:", error);
      setAsbestosRemovalists([]);
    }
  }, []);

  useEffect(() => {
    fetchAsbestosRemovalJobs();
    fetchProjects();
    fetchAsbestosRemovalists();
  }, [fetchAsbestosRemovalJobs, fetchProjects, fetchAsbestosRemovalists]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Complete":
        return theme.palette.success.main;
      case "In Progress":
        return theme.palette.warning.main;
      case "Active":
        return theme.palette.primary.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getJobTypeColor = (jobType) => {
    switch (jobType) {
      case "Air Monitoring":
        return theme.palette.primary.main;
      case "Clearance":
        return theme.palette.secondary.main;
      case "Air Monitoring and Clearance":
        return theme.palette.info.main;
      case "None":
        return theme.palette.grey[500];
      default:
        return theme.palette.grey[500];
    }
  };

  const handleCreateAsbestosRemovalJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setSelectedRemovalist("");
    setModalError(null);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
    setSelectedRemovalist("");
    setModalError(null);
  };

  const handleSubmitModal = async () => {
    if (!selectedProject || !selectedRemovalist) {
      setModalError("Please select both a project and asbestos removalist");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const newJobData = {
        projectId: selectedProject._id,
        projectName: selectedProject.name,
        client:
          typeof selectedProject.client === "string"
            ? selectedProject.client
            : selectedProject.client?.name || "Not specified",
        asbestosRemovalist: selectedRemovalist,
        status: "Active",
        hasAirMonitoring: false,
        hasClearance: false,
      };

      const response = await asbestosRemovalJobService.create(newJobData);

      if (response.data) {
        // Refresh the jobs list
        await fetchAsbestosRemovalJobs();
        handleCloseModal();
      }
    } catch (err) {
      console.error("Error creating asbestos removal job:", err);
      setModalError(
        err.response?.data?.message || err.message || "Failed to create job"
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (job) => {
    // Navigate to job details page
    navigate(`/asbestos-removal/jobs/${job.id}/details`);
  };

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Asbestos Removal
      </Typography>

      {/* Action Button */}
      <Box display="flex" gap={2} mb={3}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateAsbestosRemovalJob}
          sx={{
            backgroundColor: colors.primary[700],
            color: colors.grey[100],
            "&:hover": {
              backgroundColor: colors.primary[800],
            },
          }}
        >
          New Asbestos Removal Job
        </Button>
      </Box>

      {/* Asbestos Removal Jobs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Asbestos Removal Jobs
          </Typography>

          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : asbestosRemovalJobs.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ p: 3 }}>
              No active asbestos removal jobs found.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.primary.dark }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Project ID
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Site Name (Project)
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Asbestos Removalist
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Job Type
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asbestosRemovalJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      onClick={() => handleRowClick(job)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{job.projectID}</TableCell>
                      <TableCell>{job.projectName}</TableCell>
                      <TableCell>{job.asbestosRemovalist}</TableCell>
                      <TableCell>
                        <Chip
                          label={job.status}
                          size="small"
                          sx={{
                            backgroundColor: getStatusColor(job.status),
                            color: "white",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.jobType}
                          size="small"
                          sx={{
                            backgroundColor: getJobTypeColor(job.jobType),
                            color: "white",
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Asbestos Removal Job Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">New Asbestos Removal Job</Typography>
            <IconButton onClick={handleCloseModal}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {modalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {modalError}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
            <Autocomplete
              options={Array.isArray(projects) ? projects : []}
              getOptionLabel={(option) =>
                `${option.projectID} - ${option.name}`
              }
              value={selectedProject}
              onChange={(event, newValue) => {
                setSelectedProject(newValue);
                setModalError(null);
              }}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              renderInput={(params) => (
                <TextField {...params} label="Select Project" required />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.projectID} - {option.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Client:{" "}
                      {typeof option.client === "string"
                        ? option.client
                        : option.client?.name || "Not specified"}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </FormControl>

          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel>Asbestos Removalist</InputLabel>
            <Select
              value={selectedRemovalist}
              onChange={(e) => {
                setSelectedRemovalist(e.target.value);
                setModalError(null);
              }}
              label="Asbestos Removalist"
            >
              {asbestosRemovalists.map((removalist) => (
                <MenuItem key={removalist._id} value={removalist.text}>
                  {removalist.text}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSubmitModal}
            variant="contained"
            disabled={!selectedProject || !selectedRemovalist || modalLoading}
            sx={{
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            {modalLoading ? "Creating..." : "Create Job"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AsbestosRemoval;
