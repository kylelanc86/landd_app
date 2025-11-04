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
import { useNavigate, useLocation } from "react-router-dom";
import { clientSuppliedJobsService, projectService } from "../../services/api";
import { generateShiftReport } from "../../utils/generateShiftReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const ClientSuppliedJobs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [sampleCounts, setSampleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedJobType, setSelectedJobType] = useState("");
  const [sampleReceiptDate, setSampleReceiptDate] = useState("");
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
    // Samples are now embedded in the job, so count them directly
    jobsArray.forEach((job) => {
      counts[job._id] = job.samples?.length || 0;
    });
    setSampleCounts(counts);
  };

  const handleCreateJob = async () => {
    if (!selectedProject || !selectedJobType) return;

    try {
      setCreatingJob(true);
      const jobData = {
        projectId: selectedProject._id,
        jobType: selectedJobType,
      };

      // Add sample receipt date if provided
      if (sampleReceiptDate) {
        jobData.sampleReceiptDate = sampleReceiptDate;
      }

      await clientSuppliedJobsService.create(jobData);

      // Refresh the jobs list
      await fetchClientSuppliedJobs();

      // Close dialog and reset form
      setCreateDialogOpen(false);
      setSelectedProject(null);
      setSelectedJobType("");
      setSampleReceiptDate("");
    } catch (error) {
      console.error("Error creating client supplied job:", error);
      alert("Failed to create job. Please ensure all fields are filled.");
    } finally {
      setCreatingJob(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    setJobToDelete(jobId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      await clientSuppliedJobsService.delete(jobToDelete);
      // Refresh the jobs list
      await fetchClientSuppliedJobs();
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (error) {
      console.error("Error deleting client supplied job:", error);
      alert("Failed to delete job. Please try again.");
    }
  };

  const cancelDeleteJob = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
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
    // Use the appropriate route based on current location
    const basePath = location.pathname.startsWith("/client-supplied")
      ? "/client-supplied"
      : "/fibre-id/client-supplied";
    navigate(`${basePath}/${actualJobId}/samples`);
  };

  const handleBackToHome = () => {
    // Navigate back based on current location
    if (location.pathname.startsWith("/client-supplied")) {
      navigate("/client-supplied");
    } else {
      navigate("/fibre-id");
    }
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

      // Fetch the job with full population to get client and project data
      const jobResponse = await clientSuppliedJobsService.getById(job._id);
      const fullJob = jobResponse.data;

      // Samples are now embedded in the job
      const sampleItems = fullJob.samples || [];

      // Get analyst from first analyzed sample or job analyst
      let analyst = null;
      const analyzedSample = sampleItems.find((s) => s.analyzedBy);
      if (analyzedSample?.analyzedBy) {
        if (
          typeof analyzedSample.analyzedBy === "object" &&
          analyzedSample.analyzedBy.firstName
        ) {
          analyst = `${analyzedSample.analyzedBy.firstName} ${analyzedSample.analyzedBy.lastName}`;
        } else if (typeof analyzedSample.analyzedBy === "string") {
          analyst = analyzedSample.analyzedBy;
        }
      } else if (fullJob.analyst) {
        analyst = fullJob.analyst;
      }

      // Transform sample items to match air monitoring format
      const transformedSamples = sampleItems.map((item, index) => {
        return {
          fullSampleID: item.labReference || `Sample-${index + 1}`,
          sampleID: item.labReference || `Sample-${index + 1}`,
          location: item.clientReference || item.locationDescription || "N/A",
          // No time or flowrate for client supplied
          startTime: null,
          endTime: null,
          averageFlowrate: null,
          // Use analysisData from sample item
          analysis: item.analysisData
            ? {
                fieldsCounted: item.analysisData.fieldsCounted,
                fibresCounted: item.analysisData.fibresCounted,
                edgesDistribution: item.analysisData.edgesDistribution,
                backgroundDust: item.analysisData.backgroundDust,
                // No reported concentration for client supplied
                reportedConcentration: null,
              }
            : null,
        };
      });

      // Create a mock shift-like object for PDF generation
      const mockShift = {
        descriptionOfWorks:
          fullJob.projectId?.name || "Client Supplied Fibre Count",
        date: fullJob.sampleReceiptDate || new Date(),
        analysedBy: analyst || "N/A",
        analysisDate: fullJob.analysisDate || new Date(),
        reportApprovedBy: "Jordan Smith",
        reportIssueDate: new Date(),
      };

      // Create a job-like object with projectId populated
      const jobForPDF = {
        projectId: fullJob.projectId,
        asbestosRemovalist: null, // Not applicable for client supplied
      };

      // Generate the PDF using air monitoring format
      await generateShiftReport({
        shift: mockShift,
        job: jobForPDF,
        samples: transformedSamples,
        project: fullJob.projectId,
        openInNewTab: false,
        isClientSupplied: true, // Flag to indicate we want fibre count format
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
                  <TableCell sx={{ fontWeight: "bold", minWidth: "120px" }}>
                    Job Type
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
                    Sample Receipt Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
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
                        <Chip
                          label={job.jobType || "Fibre ID"}
                          color={
                            job.jobType === "Fibre ID"
                              ? "primary"
                              : job.jobType === "Fibre Count"
                              ? "secondary"
                              : "default"
                          }
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.sampleReceiptDate
                            ? new Date(
                                job.sampleReceiptDate
                              ).toLocaleDateString("en-GB")
                            : "N/A"}
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
            setSelectedJobType("");
            setSampleReceiptDate("");
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "white",
              }}
            >
              <AddIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Create New Client Supplied Job
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box
              sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}
            >
              {Array.isArray(projects) && projects.length > 0 ? (
                <>
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
                          option.projectID
                            ?.toLowerCase()
                            .includes(filterValue) ||
                          option.name?.toLowerCase().includes(filterValue) ||
                          option.client?.name
                            ?.toLowerCase()
                            .includes(filterValue)
                      );

                      return filtered;
                    }}
                  />
                  <FormControl fullWidth required>
                    <InputLabel>Job Type</InputLabel>
                    <Select
                      value={selectedJobType}
                      onChange={(e) => setSelectedJobType(e.target.value)}
                      label="Job Type"
                    >
                      <MenuItem value="Fibre ID">Fibre ID</MenuItem>
                      <MenuItem value="Fibre Count">Fibre Count</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Sample Receipt Date"
                    type="date"
                    value={sampleReceiptDate}
                    onChange={(e) => setSampleReceiptDate(e.target.value)}
                    InputLabelProps={{
                      shrink: true,
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            size="small"
                            onClick={() =>
                              setSampleReceiptDate(
                                new Date().toISOString().split("T")[0]
                              )
                            }
                            sx={{ textTransform: "none", minWidth: "auto" }}
                          >
                            Today
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                </>
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
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setSelectedProject(null);
                setSelectedJobType("");
                setSampleReceiptDate("");
              }}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              variant="contained"
              disabled={
                !selectedProject ||
                !selectedJobType ||
                creatingJob ||
                !Array.isArray(projects) ||
                projects.length === 0
              }
              startIcon={<AddIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {creatingJob ? "Creating..." : "Create Job"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={cancelDeleteJob}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "error.main",
                color: "white",
              }}
            >
              <DeleteIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Confirm Delete
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              Are you sure you want to delete this client supplied job? This
              action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={cancelDeleteJob}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteJob}
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                boxShadow: "0 4px 12px rgba(244, 67, 54, 0.3)",
                "&:hover": {
                  boxShadow: "0 6px 16px rgba(244, 67, 54, 0.4)",
                },
              }}
            >
              Delete Job
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default ClientSuppliedJobs;
