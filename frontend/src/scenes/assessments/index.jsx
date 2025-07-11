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
} from "@mui/material";
import {
  Add as AddIcon,
  List as ListIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import assessmentService from "../../services/assessmentService";
import { formatDate, formatDateForInput } from "../../utils/dateUtils";
import projectService from "../../services/projectService";

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

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h2" fontWeight="bold" sx={{ mb: "5px" }}>
          Asbestos Assessment Jobs
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
