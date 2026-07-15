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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  IconButton,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { projectService, mycometerJobsService } from "../../services/api";
import {
  SAMPLE_TYPE_COLORS,
  getOrderedScopeOfWorks,
  getJobReportProgress,
} from "./mycometerConstants";

const MycometerAnalysis = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [jobToEdit, setJobToEdit] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [jobToClose, setJobToClose] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  useEffect(() => {
    fetchJobs();
    fetchProjects();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await mycometerJobsService.getAll();
      const jobsData = response.data || [];
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (error) {
      console.error("Error fetching mycometer jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      let response;
      let projectsData = [];

      try {
        response = await projectService.getAll({
          limit: 1000,
          status: "all_active",
        });

        if (response && response.data) {
          projectsData = Array.isArray(response.data)
            ? response.data
            : response.data.data || [];
        }
      } catch (error) {
        console.error("Error fetching with all_active status:", error);
        try {
          response = await projectService.getAssignedToMe({
            limit: 1000,
            status: "all_active",
          });

          if (response && response.data) {
            projectsData = Array.isArray(response.data)
              ? response.data
              : response.data.data || [];
          }
        } catch (error2) {
          console.error("Error fetching assigned projects:", error2);
          response = await projectService.getAll({ limit: 1000 });

          if (response && response.data) {
            projectsData = Array.isArray(response.data)
              ? response.data
              : response.data.data || [];
          }
        }
      }

      const sortedProjects = projectsData.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum;
      });

      setProjects(sortedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const getProjectLabel = (project) => {
    if (!project) return "Unnamed Project";
    const id = project.projectID || "N/A";
    const name = project.name || "Unnamed Project";
    return `${id} - ${name}`;
  };

  const getClientName = (project) => {
    if (!project?.client) return "Not specified";
    return typeof project.client === "string"
      ? project.client
      : project.client?.name || "Not specified";
  };

  const resetForm = () => {
    setSelectedProject(null);
    setFormError("");
    setJobToEdit(null);
  };

  const handleOpenCreateDialog = () => {
    setDialogMode("create");
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (job) => {
    const projectFromJob = job.projectId;
    const matchedProject =
      projects.find((p) => p._id === projectFromJob?._id) || projectFromJob;

    setDialogMode("edit");
    setJobToEdit(job);
    setSelectedProject(matchedProject || null);
    setFormError("");
    setDialogOpen(true);
  };

  const handleCloseDialog = ({ force = false } = {}) => {
    if (saving && !force) return;
    setDialogOpen(false);
    resetForm();
  };

  const handleSaveJob = async () => {
    if (!selectedProject?._id) {
      setFormError("Please select a project.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      if (dialogMode === "edit" && jobToEdit?._id) {
        await mycometerJobsService.update(jobToEdit._id, {
          projectId: selectedProject._id,
        });
      } else {
        await mycometerJobsService.create({
          projectId: selectedProject._id,
          scopeOfWorks: [],
        });
      }

      await fetchJobs();
      setSaving(false);
      handleCloseDialog({ force: true });
    } catch (error) {
      console.error("Error saving mycometer job:", error);
      setFormError(
        error.response?.data?.message ||
          "Failed to save job. Please try again.",
      );
      setSaving(false);
    }
  };

  const handleOpenDeleteDialog = (job) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete?._id) return;

    try {
      setDeleting(true);
      await mycometerJobsService.delete(jobToDelete._id);
      await fetchJobs();
      handleCloseDeleteDialog();
    } catch (error) {
      console.error("Error deleting mycometer job:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCloseDialog = (job) => {
    setJobToClose(job);
    setCloseError("");
    setCloseDialogOpen(true);
  };

  const handleCloseCloseDialog = () => {
    if (closing) return;
    setCloseDialogOpen(false);
    setJobToClose(null);
    setCloseError("");
  };

  const handleConfirmCloseJob = async () => {
    if (!jobToClose?._id) return;

    try {
      setClosing(true);
      setCloseError("");
      await mycometerJobsService.update(jobToClose._id, {
        status: "Completed",
      });
      await fetchJobs();
      handleCloseCloseDialog();
    } catch (error) {
      console.error("Error closing mycometer job:", error);
      setCloseError(
        error.response?.data?.message ||
          "Failed to close job. Please try again.",
      );
    } finally {
      setClosing(false);
    }
  };

  const handleOpenJobReports = (jobId) => {
    navigate(`/mycometer-sampling/${jobId}`);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              Mycometer Sampling Jobs
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateDialog}
              sx={{ minWidth: "200px" }}
            >
              Add New Job
            </Button>
          </Box>
        </Box>

        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow
                  sx={{
                    background:
                      "linear-gradient(to right, #045E1F, #96CC78) !important",
                    color: "white",
                    "&:hover": { backgroundColor: "transparent" },
                  }}
                >
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 115 }}
                  >
                    Project ID
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      color: "inherit",
                      width: "27%",
                    }}
                  >
                    Project Name
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      color: "inherit",
                      width: "35%",
                    }}
                  >
                    Reports
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 140 }}
                  >
                    Progress
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 280, minWidth: 280 }}
                    align="right"
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No Mycometer jobs yet. Click Add New Job to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => {
                    const scopeOfWorks = getOrderedScopeOfWorks(
                      job.scopeOfWorks,
                    );
                    const progress = getJobReportProgress(job);
                    const isFullyComplete =
                      progress.total > 0 &&
                      progress.complete === progress.total;
                    return (
                      <TableRow
                        key={job._id}
                        hover
                        onClick={() => handleOpenJobReports(job._id)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell sx={{ width: 115 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {job.projectId?.projectID || "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: "27%" }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {job.projectId?.name || "Unnamed Project"}
                          </Typography>
                          {getClientName(job.projectId) !== "Not specified" && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              Client: {getClientName(job.projectId)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: "35%" }}>
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.75,
                            }}
                          >
                            {scopeOfWorks.length === 0 ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                No reports yet
                              </Typography>
                            ) : (
                              scopeOfWorks.map((sampleType) => {
                                const typeColors =
                                  SAMPLE_TYPE_COLORS[sampleType] || {};
                                return (
                                  <Box
                                    key={sampleType}
                                    sx={{
                                      px: 1,
                                      py: 0.25,
                                      borderRadius: 1,
                                      fontSize: "0.75rem",
                                      fontWeight: 500,
                                      color: typeColors.color,
                                      backgroundColor:
                                        typeColors.backgroundColor,
                                      border: `1px solid ${typeColors.borderColor}`,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {sampleType}
                                  </Box>
                                );
                              })
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {progress.total === 0
                              ? "—"
                              : `${progress.complete}/${progress.total} complete`}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ width: 280, minWidth: 280, whiteSpace: "nowrap" }}
                        >
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              flexWrap: "nowrap",
                              gap: 0.5,
                            }}
                          >
                            {isFullyComplete && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleOpenCloseDialog(job)}
                                sx={{ textTransform: "none", flexShrink: 0 }}
                              >
                                Close Job
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEditDialog(job)}
                              aria-label="Edit job"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleOpenDeleteDialog(job)}
                              aria-label="Delete job"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
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
            {dialogMode === "edit" ? (
              <EditIcon sx={{ fontSize: 20 }} />
            ) : (
              <AddIcon sx={{ fontSize: 20 }} />
            )}
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {dialogMode === "edit"
              ? "Edit Mycometer Job"
              : "Create New Mycometer Job"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
            {formError && (
              <Typography variant="body2" color="error">
                {formError}
              </Typography>
            )}

            <Autocomplete
              options={Array.isArray(projects) ? projects : []}
              loading={loadingProjects}
              getOptionLabel={(option) => getProjectLabel(option)}
              value={selectedProject}
              onChange={(event, newValue) => {
                setSelectedProject(newValue);
                if (formError) setFormError("");
              }}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Project"
                  placeholder="Search for a project..."
                  required
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  <Box>
                    <Typography variant="body1">
                      {getProjectLabel(option)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Client: {getClientName(option)}
                    </Typography>
                  </Box>
                </li>
              )}
              filterOptions={(options, { inputValue }) => {
                if (!Array.isArray(options)) return [];
                if (!inputValue || inputValue.length < 2) return options;

                const filterValue = inputValue.toLowerCase();
                return options.filter(
                  (option) =>
                    option.projectID?.toLowerCase().includes(filterValue) ||
                    option.name?.toLowerCase().includes(filterValue) ||
                    getClientName(option).toLowerCase().includes(filterValue),
                );
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving || !selectedProject}
            onClick={handleSaveJob}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {dialogMode === "edit" ? "Save Changes" : "Create Job"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the Mycometer job for{" "}
            <strong>
              {jobToDelete?.projectId?.name || "this project"}
            </strong>
            ? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : null}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialogOpen} onClose={handleCloseCloseDialog}>
        <DialogTitle>Close Job?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: closeError ? 2 : 0 }}>
            Please confirm that the Mycometer job for{" "}
            <strong>
              {jobToClose?.projectId?.name || "this project"}
            </strong>{" "}
            is complete. Once closed, it will be removed from this list.
          </Typography>
          {closeError && (
            <Typography variant="body2" color="error">
              {closeError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCloseDialog} disabled={closing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmCloseJob}
            color="success"
            variant="contained"
            disabled={closing}
            startIcon={
              closing ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircleIcon />
              )
            }
          >
            {closing ? "Closing..." : "Confirm Complete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MycometerAnalysis;
