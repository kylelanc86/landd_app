import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Breadcrumbs,
  Link,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import assessmentService from "../../../services/assessmentService";
import { formatDate, formatDateForInput } from "../../../utils/dateUtils";
import projectService from "../../../services/projectService";

const AssessmentJobsPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState({
    assessmentDate: formatDateForInput(new Date()),
  });
  const [editForm, setEditForm] = useState({
    assessmentDate: formatDateForInput(new Date()),
  });
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectInput, setProjectInput] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedEditProject, setSelectedEditProject] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [completingJob, setCompletingJob] = useState(null);
  const [cocModalOpen, setCocModalOpen] = useState(false);
  const [selectedJobForCOC, setSelectedJobForCOC] = useState(null);
  const [jobSamples, setJobSamples] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const fetchJobs = () => {
    setLoading(true);
    assessmentService
      .getJobs()
      .then(setJobs)
      .catch((err) => setError(err.message || "Failed to fetch jobs"))
      .finally(() => setLoading(false));
  };

  const fetchProjects = async () => {
    try {
      const response = await projectService.getAll({
        limit: 1000,
        status:
          "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent, Quote sent",
      });
      const projectsData = Array.isArray(response)
        ? response
        : response.data || response.projects || response.data?.data || [];

      // Sort projects by projectID in descending order
      const sortedProjects = projectsData.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum; // Descending order (highest first)
      });

      setProjects(sortedProjects);
    } catch (error) {
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleViewItems = (jobId) => {
    navigate(`/assessments/${jobId}/items`);
  };

  const handleToggleComplete = async (job) => {
    if (completingJob) return;

    setCompletingJob(job._id);
    try {
      const newStatus = job.status === "complete" ? "in-progress" : "complete";
      // Update status using the new status update method
      await assessmentService.updateStatus(job._id, newStatus);
      // Update the job locally instead of fetching all jobs again
      setJobs((prevJobs) =>
        prevJobs.map((j) =>
          j._id === job._id ? { ...j, status: newStatus } : j
        )
      );
    } catch (err) {
      alert(
        err.message ||
          `Failed to ${
            job.status === "complete" ? "reopen" : "complete"
          } assessment job`
      );
    } finally {
      setCompletingJob(null);
    }
  };

  const handleDeleteAssessment = async (jobId) => {
    if (
      window.confirm("Are you sure you want to delete this assessment job?")
    ) {
      try {
        await assessmentService.deleteJob(jobId);
        fetchJobs();
      } catch (err) {
        alert(err.message || "Failed to delete assessment job");
      }
    }
  };

  const handleGenerateCOC = async (job) => {
    try {
      setSelectedJobForCOC(job);
      setCocModalOpen(true);

      // Fetch samples for this job
      setLoadingSamples(true);
      const samples = await assessmentService.getItems(job._id);
      setJobSamples(samples);
    } catch (err) {
      console.error("Error opening COC modal:", err);
      alert("Failed to fetch samples. Please try again.");
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleVerifyCOC = async () => {
    if (!selectedJobForCOC) return;

    try {
      // Update the job status to "samples-with-lab" when COC is verified
      await assessmentService.updateStatus(
        selectedJobForCOC._id,
        "samples-with-lab"
      );

      // Update the job locally
      setJobs((prevJobs) =>
        prevJobs.map((j) =>
          j._id === selectedJobForCOC._id
            ? { ...j, status: "samples-with-lab" }
            : j
        )
      );

      alert(
        "COC verified! Job status updated to 'Samples with Lab'. Samples have been sent to the asbestos assessment jobs table."
      );
      setCocModalOpen(false);
      setSelectedJobForCOC(null);
      setJobSamples([]);
    } catch (err) {
      console.error("Error verifying COC:", err);
      alert("Failed to verify COC. Please try again.");
    }
  };

  const handleCOCModalClose = () => {
    setCocModalOpen(false);
    setSelectedJobForCOC(null);
    setJobSamples([]);
  };

  const handleReportReadyForReview = async (job) => {
    try {
      // Update the job status to "report-ready-for-review"
      await assessmentService.updateStatus(job._id, "report-ready-for-review");

      // Update the job locally
      setJobs((prevJobs) =>
        prevJobs.map((j) =>
          j._id === job._id ? { ...j, status: "report-ready-for-review" } : j
        )
      );

      alert("Job status updated to 'Report Ready for Review'");
    } catch (err) {
      alert(err.message || "Failed to update job status");
    }
  };

  const handleEditAssessment = (job) => {
    setEditingJob(job);
    setSelectedEditProject(job.projectId);
    setEditForm({
      assessmentDate: formatDateForInput(new Date(job.assessmentDate)),
    });
    fetchProjects();
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedEditProject(null);
    setEditingJob(null);
    setEditForm({
      assessmentDate: formatDateForInput(new Date()),
    });
  };

  const handleEditFormChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!selectedEditProject) throw new Error("Please select a project");
      await assessmentService.updateJob(editingJob._id, {
        projectId: selectedEditProject._id,
        assessmentDate: editForm.assessmentDate,
      });
      handleEditDialogClose();
      fetchJobs();
    } catch (err) {
      alert(err.message || "Failed to update assessment job");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAssessment = () => {
    fetchProjects();
    setAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setAddDialogOpen(false);
    setSelectedProject(null);
    setForm({
      assessmentDate: formatDateForInput(new Date()),
    });
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!selectedProject) throw new Error("Please select a project");
      await assessmentService.createJob({
        projectId: selectedProject._id,
        assessmentDate: form.assessmentDate,
      });
      handleDialogClose();
      fetchJobs();
    } catch (err) {
      alert(err.message || "Failed to create assessment job");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToSurveys = () => {
    navigate("/surveys");
  };

  // Format status for display
  const formatStatus = (status) => {
    switch (status) {
      case "in-progress":
        return "In Progress";
      case "samples-with-lab":
        return "Samples with Lab";
      case "sample-analysis-complete":
        return "Sample Analysis Complete";
      case "report-ready-for-review":
        return "Report Ready for Review";
      case "complete":
        return "Complete";
      default:
        return status;
    }
  };

  // Filter out completed assessments
  const activeJobs = jobs.filter((job) => job.status !== "complete");

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Asbestos Assessment Jobs
      </Typography>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToSurveys}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Surveys Home
        </Link>
        <Typography color="text.primary">
          Active Asbestos Assessment Jobs
        </Typography>
      </Breadcrumbs>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Active Assessment Jobs
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddAssessment}
        >
          Add New Assessment
        </Button>
      </Box>
      <Box mt={4}>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Project ID</TableCell>
                  <TableCell>Project Name</TableCell>
                  <TableCell>Assessment Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ width: "350px" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeJobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ color: "text.secondary", py: 6 }}
                    >
                      No active asbestos assessment jobs. Completed assessments
                      are automatically hidden. Click on a row to view
                      assessment items.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeJobs.map((job) => (
                    <TableRow
                      key={job._id}
                      onClick={() => handleViewItems(job._id)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": { backgroundColor: "action.hover" },
                      }}
                    >
                      <TableCell>
                        {job.projectId?.projectID || job.projectId}
                      </TableCell>
                      <TableCell>{job.projectId?.name || ""}</TableCell>
                      <TableCell>
                        {job.assessmentDate
                          ? formatDate(job.assessmentDate)
                          : ""}
                      </TableCell>
                      <TableCell>{formatStatus(job.status)}</TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        sx={{ width: "350px" }}
                      >
                        <Button
                          variant="contained"
                          color="secondary"
                          onClick={() => handleGenerateCOC(job)}
                          title="Generate Chain of Custody"
                          size="small"
                          sx={{ mr: 1 }}
                        >
                          COC
                        </Button>
                        <IconButton
                          color="secondary"
                          onClick={() => handleEditAssessment(job)}
                          title="Edit Assessment"
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteAssessment(job._id)}
                          title="Delete Assessment"
                          sx={{ mr: 1 }}
                        >
                          <DeleteIcon />
                        </IconButton>

                        {/* Report Ready for Review Button - Only show when status is "sample-analysis-complete" */}
                        {job.status === "sample-analysis-complete" && (
                          <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => handleReportReadyForReview(job)}
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            Review Report
                          </Button>
                        )}

                        {/* Complete/Reopen Button - Only show when status is "report-ready-for-review" or "complete" */}
                        {(job.status === "report-ready-for-review" ||
                          job.status === "complete") && (
                          <Button
                            variant={
                              job.status === "complete"
                                ? "contained"
                                : "outlined"
                            }
                            color={
                              job.status === "complete" ? "error" : "success"
                            }
                            onClick={() => handleToggleComplete(job)}
                            disabled={completingJob === job._id}
                            size="small"
                            sx={{ ml: 2 }}
                          >
                            {completingJob === job._id
                              ? job.status === "complete"
                                ? "Reopening..."
                                : "Completing..."
                              : job.status === "complete"
                              ? "Reopen"
                              : "Complete"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      <Dialog
        open={addDialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Asbestos Assessment</DialogTitle>
        <form onSubmit={handleFormSubmit}>
          <DialogContent>
            <Autocomplete
              options={projects}
              getOptionLabel={(option) =>
                option.projectID + " - " + option.name
              }
              value={selectedProject}
              onChange={(_, newValue) => setSelectedProject(newValue)}
              inputValue={projectInput}
              onInputChange={(_, newInputValue) =>
                setProjectInput(newInputValue)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Project"
                  margin="normal"
                  required
                />
              )}
              isOptionEqualToValue={(option, value) => option._id === value._id}
            />
            <TextField
              label="Assessment Date"
              name="assessmentDate"
              type="date"
              value={form.assessmentDate}
              onChange={handleFormChange}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Add Assessment"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Assessment Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Asbestos Assessment</DialogTitle>
        <form onSubmit={handleEditFormSubmit}>
          <DialogContent>
            <Autocomplete
              options={projects}
              getOptionLabel={(option) =>
                option.projectID + " - " + option.name
              }
              value={selectedEditProject}
              onChange={(_, newValue) => setSelectedEditProject(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Project"
                  margin="normal"
                  required
                />
              )}
              isOptionEqualToValue={(option, value) => option._id === value._id}
            />
            <TextField
              label="Assessment Date"
              name="assessmentDate"
              type="date"
              value={editForm.assessmentDate}
              onChange={handleEditFormChange}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditDialogClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Update Assessment"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* COC Modal */}
      <Dialog
        open={cocModalOpen}
        onClose={handleCOCModalClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6">
            Chain of Custody -{" "}
            {selectedJobForCOC?.projectId?.projectID ||
              selectedJobForCOC?.projectId}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedJobForCOC && (
            <Box>
              {/* Job Details Section */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                  Job Details
                </Typography>
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Project ID
                    </Typography>
                    <Typography variant="body1">
                      {selectedJobForCOC.projectId?.projectID ||
                        selectedJobForCOC.projectId}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Project Name
                    </Typography>
                    <Typography variant="body1">
                      {selectedJobForCOC.projectId?.name || ""}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Assessment Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedJobForCOC.assessmentDate
                        ? formatDate(selectedJobForCOC.assessmentDate)
                        : ""}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Typography variant="body1">
                      {formatStatus(selectedJobForCOC.status)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body1">
                      {selectedJobForCOC.createdAt
                        ? formatDate(selectedJobForCOC.createdAt)
                        : ""}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body1">
                      {selectedJobForCOC.updatedAt
                        ? formatDate(selectedJobForCOC.updatedAt)
                        : ""}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Samples Section */}
              <Box mb={3}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <Typography variant="h6">Samples</Typography>
                  {jobSamples.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Total: {jobSamples.length} sample
                      {jobSamples.length !== 1 ? "s" : ""}
                    </Typography>
                  )}
                </Box>
                {loadingSamples ? (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : jobSamples.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item #</TableCell>
                          <TableCell>Sample Reference</TableCell>
                          <TableCell>Material Type</TableCell>
                          <TableCell>Asbestos Content</TableCell>
                          <TableCell>Asbestos Type</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {jobSamples.map((sample) => (
                          <TableRow key={sample._id}>
                            <TableCell>{sample.itemNumber || ""}</TableCell>
                            <TableCell>
                              {sample.sampleReference || ""}
                            </TableCell>
                            <TableCell>{sample.materialType || ""}</TableCell>
                            <TableCell>
                              {sample.asbestosContent || ""}
                            </TableCell>
                            <TableCell>{sample.asbestosType || ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No samples found for this assessment job.
                  </Typography>
                )}

                {/* COC Verification Note */}
                <Box mt={2} p={2} bgcolor="info.light" borderRadius={1}>
                  <Typography variant="body2" color="info.contrastText">
                    <strong>Note:</strong> Clicking "Verify COC" will:
                    <br />• Update job status to "Samples with Lab"
                    <br />• Send samples to the asbestos assessment jobs table
                    for further processing
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setCocModalOpen(false);
              handleViewItems(selectedJobForCOC._id);
            }}
            sx={{ mr: "auto", color: "white", backgroundColor: "red" }}
          >
            Modify Samples
          </Button>
          <Button onClick={handleCOCModalClose}>Cancel</Button>
          <Button
            onClick={handleVerifyCOC}
            variant="contained"
            color="primary"
            disabled={!selectedJobForCOC}
          >
            Verify COC
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssessmentJobsPage;
