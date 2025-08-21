import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import {
  clientSuppliedJobsService,
  sampleItemsService,
  projectService,
} from "../../services/api";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const ClientSuppliedJobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [sampleCounts, setSampleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [creatingJob, setCreatingJob] = useState(false);

  useEffect(() => {
    fetchClientSuppliedJobs();
    fetchProjects();
  }, []);

  // Refresh data when component comes into focus (e.g., when returning from samples page)
  useEffect(() => {
    const handleFocus = () => {
      if (jobs.length > 0) {
        fetchSampleCounts(jobs);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [jobs]);

  const fetchClientSuppliedJobs = async () => {
    try {
      setLoading(true);
      // Fetch all client supplied jobs
      const response = await clientSuppliedJobsService.getAll();

      const jobsData = response.data || [];
      const jobsArray = Array.isArray(jobsData) ? jobsData : [];
      setJobs(jobsArray);

      // Fetch sample counts for each job
      await fetchSampleCounts(jobsArray);
    } catch (error) {
      console.error("Error fetching client supplied jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      // Try different approaches to get projects
      let response;
      let projectsData = [];

      // First try: getAll with parameters (this should get ALL active projects)
      try {
        response = await projectService.getAll({
          limit: 1000,
          status:
            "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
        });

        if (response && response.data) {
          projectsData = Array.isArray(response.data)
            ? response.data
            : response.data.data || [];
        }
      } catch (error) {
        // Second try: getAssignedToMe (fallback to user's projects)
        try {
          response = await projectService.getAssignedToMe({
            limit: 1000,
            status:
              "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
          });

          if (response && response.data) {
            projectsData = Array.isArray(response.data)
              ? response.data
              : response.data.data || [];
          }
        } catch (error2) {
          // Third try: simple getAll without parameters
          try {
            response = await projectService.getAll();

            if (response && response.data) {
              projectsData = Array.isArray(response.data)
                ? response.data
                : response.data.data || [];
            }
          } catch (error3) {
            console.error("All project fetching methods failed:", error3);
            throw error3;
          }
        }
      }

      // Sort projects by projectID in descending order (same as air monitoring)
      const sortedProjects = projectsData.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum; // Descending order (highest first)
      });

      setProjects(sortedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  };

  const fetchSampleCounts = async (jobsArray) => {
    const counts = {};
    for (const job of jobsArray) {
      try {
        const response = await sampleItemsService.getAll({
          projectId: job.projectId._id || job.projectId,
        });
        counts[job._id] = response.data?.length || 0;
      } catch (error) {
        console.error(`Error fetching sample count for job ${job._id}:`, error);
        counts[job._id] = 0;
      }
    }
    setSampleCounts(counts);
  };

  const handleCreateJob = async () => {
    if (!selectedProject) return;

    try {
      setCreatingJob(true);
      await clientSuppliedJobsService.create({
        projectId: selectedProject._id,
      });

      // Refresh the jobs list
      await fetchClientSuppliedJobs();

      // Close dialog and reset form
      setCreateDialogOpen(false);
      setSelectedProject(null);
    } catch (error) {
      console.error("Error creating client supplied job:", error);
    } finally {
      setCreatingJob(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this client supplied job? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await clientSuppliedJobsService.delete(jobId);
      // Refresh the jobs list
      await fetchClientSuppliedJobs();
    } catch (error) {
      console.error("Error deleting client supplied job:", error);
      alert("Failed to delete job. Please try again.");
    }
  };

  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter(
    (job) =>
      // Exclude completed jobs from the table
      job.status !== "Completed" &&
      (job.projectId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.projectId?.client?.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        job.projectId?.projectID
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()))
  );

  const handleViewJob = (jobId) => {
    // Ensure we're passing a string ID, not an object
    const actualJobId = typeof jobId === "object" ? jobId._id : jobId;
    navigate(`/fibre-id/client-supplied/${actualJobId}/samples`);
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "In Progress":
        return "info";
      case "Completed":
        return "success";
      default:
        return "info";
    }
  };

  const handleGeneratePDF = async (job) => {
    try {
      setGeneratingPDF((prev) => ({ ...prev, [job._id]: true }));

      // Fetch sample items for this job
      const response = await sampleItemsService.getAll({
        projectId: job.projectId._id || job.projectId,
      });
      const sampleItems = response.data || [];

      // Generate the PDF using pdfMake
      await generateFibreIDReport({
        job: job,
        sampleItems: sampleItems,
        openInNewTab: false,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      // You might want to show a snackbar or alert here
    } finally {
      setGeneratingPDF((prev) => ({ ...prev, [job._id]: false }));
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* PDF Loading Overlay */}
        <PDFLoadingOverlay
          open={Object.values(generatingPDF).some(Boolean)}
          message="Generating Fibre ID Report PDF..."
        />
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Fibre ID Home
          </Link>
          <Typography color="text.primary">Client Supplied Jobs</Typography>
        </Breadcrumbs>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Client Supplied Jobs
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View and manage client supplied jobs for fibre identification
              analysis
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ minWidth: "200px" }}
          >
            Add New Job
          </Button>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by project name, client, or project ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Jobs Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "230px" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
                    Sample Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "150px" }}>
                    Client
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "70px" }}>
                    Samples
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No client supplied jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job._id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {job.projectId?.projectID || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.name || "Unnamed Project"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.d_Date
                            ? new Date(job.projectId.d_Date).toLocaleDateString(
                                "en-GB"
                              )
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.client?.name || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sampleCounts[job._id] || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.status || "In Progress"}
                          color={getStatusColor(job.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            onClick={() => handleViewJob(job._id)}
                            color="primary"
                            size="small"
                          >
                            Items
                          </Button>
                          <Button
                            onClick={() => handleGeneratePDF(job)}
                            color="secondary"
                            size="small"
                            startIcon={<PdfIcon />}
                            disabled={
                              generatingPDF[job._id] ||
                              (sampleCounts[job._id] || 0) === 0
                            }
                          >
                            {generatingPDF[job._id] ? "..." : "PDF"}
                          </Button>
                          <IconButton
                            onClick={() => handleDeleteJob(job._id)}
                            color="error"
                            size="small"
                            title="Delete Job"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Create Job Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => {
            setCreateDialogOpen(false);
            setSelectedProject(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create New Client Supplied Job</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {Array.isArray(projects) && projects.length > 0 ? (
                <Autocomplete
                  options={projects}
                  getOptionLabel={(option) => {
                    return `${option.projectID || "N/A"} - ${
                      option.name || "Unnamed Project"
                    }`;
                  }}
                  value={selectedProject}
                  onChange={(event, newValue) => {
                    setSelectedProject(newValue);
                  }}
                  isOptionEqualToValue={(option, value) => {
                    return option._id === value._id;
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Project"
                      placeholder="Search for a project..."
                      required
                      fullWidth
                    />
                  )}
                  renderOption={(props, option) => {
                    return (
                      <li {...props}>
                        <Box>
                          <Typography variant="body1">
                            {option.projectID || "N/A"} -{" "}
                            {option.name || "Unnamed Project"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Client: {option.client?.name || "Not specified"}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                  filterOptions={(options, { inputValue }) => {
                    if (!Array.isArray(options)) {
                      return [];
                    }

                    // If no input, show all options
                    if (!inputValue || inputValue.length === 0) {
                      return options;
                    }

                    // If input is less than 2 characters, show all options
                    if (inputValue.length < 2) {
                      return options;
                    }

                    // Filter based on input
                    const filterValue = inputValue.toLowerCase();
                    const filtered = options.filter(
                      (option) =>
                        option.projectID?.toLowerCase().includes(filterValue) ||
                        option.name?.toLowerCase().includes(filterValue) ||
                        option.client?.name?.toLowerCase().includes(filterValue)
                    );

                    return filtered;
                  }}
                />
              ) : (
                <Box sx={{ textAlign: "center", py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {Array.isArray(projects)
                      ? `No projects available (projects.length: ${projects.length})`
                      : `Loading projects... (projects type: ${typeof projects})`}
                  </Typography>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setSelectedProject(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              variant="contained"
              disabled={
                !selectedProject ||
                creatingJob ||
                !Array.isArray(projects) ||
                projects.length === 0
              }
            >
              {creatingJob ? "Creating..." : "Create Job"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default ClientSuppliedJobs;
