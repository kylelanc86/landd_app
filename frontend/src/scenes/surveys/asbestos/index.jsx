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
  List as ListIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Article as ArticleIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import assessmentService from "../../../services/assessmentService";
import { formatDate, formatDateForInput } from "../../../utils/dateUtils";
import PDFLoadingOverlay from "../../../components/PDFLoadingOverlay";
import projectService from "../../../services/projectService";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";

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
  const [generatingCOC, setGeneratingCOC] = useState(null);

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
      setProjects(projectsData);
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

  const handleGenerateCOC = async (assessmentId) => {
    try {
      setGeneratingCOC(assessmentId);

      const pdfBlob = await asbestosAssessmentService.generateChainOfCustody(
        assessmentId
      );

      // Create a download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ChainOfCustody_${assessmentId}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating Chain of Custody:", err);
      alert("Failed to generate Chain of Custody PDF. Please try again.");
    } finally {
      setGeneratingCOC(null);
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

  return (
    <Box m="20px">
      {/* PDF Loading Overlay */}
      <PDFLoadingOverlay
        open={generatingCOC !== null}
        message="Generating Chain of Custody PDF..."
      />

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
        <Typography color="text.primary">Asbestos Assessment Jobs</Typography>
      </Breadcrumbs>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Assessment Jobs
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
                  <TableCell>Status</TableCell>
                  <TableCell>Assessment Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ color: "text.secondary", py: 6 }}
                    >
                      No active asbestos assessment jobs.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job._id}>
                      <TableCell>
                        {job.projectId?.projectID || job.projectId}
                      </TableCell>
                      <TableCell>{job.projectId?.name || ""}</TableCell>
                      <TableCell>{job.status}</TableCell>
                      <TableCell>
                        {job.assessmentDate
                          ? formatDate(job.assessmentDate)
                          : ""}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          color="primary"
                          onClick={() => handleViewItems(job._id)}
                          title="View Items"
                        >
                          <ListIcon />
                        </IconButton>
                        <IconButton
                          color="secondary"
                          onClick={() => handleGenerateCOC(job._id)}
                          disabled={generatingCOC === job._id}
                          title="Generate Chain of Custody"
                          sx={{
                            backgroundColor: "secondary.main",
                            color: "white",
                            "&:hover": {
                              backgroundColor: "secondary.dark",
                            },
                            minWidth: "40px",
                            minHeight: "40px",
                          }}
                        >
                          {generatingCOC === job._id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <ArticleIcon />
                          )}
                        </IconButton>
                        <IconButton
                          color="secondary"
                          onClick={() => handleEditAssessment(job)}
                          title="Edit Assessment"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteAssessment(job._id)}
                          title="Delete Assessment"
                        >
                          <DeleteIcon />
                        </IconButton>
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
    </Box>
  );
};

export default AssessmentJobsPage;
