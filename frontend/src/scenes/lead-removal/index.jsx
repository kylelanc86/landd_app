import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
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
  Container,
  useMediaQuery,
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
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { tokens } from "../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";
import { Navigate } from "react-router-dom";
import { projectService } from "../../services/api";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import leadRemovalJobService from "../../services/leadRemovalJobService";

const LeadRemoval = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();
  const { currentUser } = useAuth();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const showPortraitColumnsOnly = isMobile && isPortrait;

  const [leadRemovalJobs, setLeadRemovalJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [leadAbatementContractors, setLeadAbatementContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create job modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState("");

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const formatStatusLabel = useCallback((status) => {
    if (!status) return "Unknown";
    const statusMap = {
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
      complete: "Complete",
      active: "Active",
    };
    return (
      statusMap[status] ||
      status
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    );
  }, []);

  const getStatusColor = useCallback(
    (status) => {
      const normalized = status?.toLowerCase().replace(/\s+/g, "_");
      switch (normalized) {
        case "completed":
        case "complete":
          return theme.palette.success.main;
        case "in_progress":
          return theme.palette.warning.main;
        case "active":
          return theme.palette.primary.main;
        case "cancelled":
          return theme.palette.error.main;
        default:
          return theme.palette.grey[500];
      }
    },
    [theme]
  );

  const getJobTypeColor = useCallback(
    (jobTypeRaw) => {
      switch (jobTypeRaw) {
        case "air_monitoring_and_clearance":
          return theme.palette.info.main;
        case "air_monitoring":
          return theme.palette.primary.main;
        case "clearance":
          return theme.palette.secondary.main;
        case "none":
        default:
          return theme.palette.grey[500];
      }
    },
    [theme]
  );

  const fetchLeadRemovalJobs = useCallback(
    async ({ force = false, silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await leadRemovalJobService.getAll({
          excludeStatus: "completed,cancelled,archived",
          limit: 1000,
          minimal: true,
        });
        let jobs = [];
        if (response?.jobs && Array.isArray(response.jobs)) {
          jobs = response.jobs;
        } else if (response?.data && Array.isArray(response.data)) {
          jobs = response.data;
        } else if (Array.isArray(response)) {
          jobs = response;
        }
        const processed = jobs.map((job) => {
          const projectRef = job.projectId || {};
          return {
            id: job._id,
            projectID: projectRef?.projectID || job.projectID || "Unknown",
            projectName:
              projectRef?.name || job.projectName || "Unknown Project",
            leadRemovalist:
              job.leadAbatementContractor || "Not assigned",
            status: job.status || "in_progress",
            jobTypeLabel: job.jobTypeLabel || "None",
            jobTypeRaw: job.jobType || "none",
          };
        });
        const sorted = processed.sort((a, b) => {
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
          return bNum - aNum;
        });
        setLeadRemovalJobs(sorted);
      } catch (err) {
        setError(err.message || "Failed to fetch jobs");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchLeadRemovalJobs();
  }, [fetchLeadRemovalJobs]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectService.getAll({
        limit: 1000,
        status:
          "Assigned,In progress,Samples submitted,Lab Analysis Completed,Report sent for review,Ready for invoicing,Invoice sent, Quote sent",
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

  const fetchLeadAbatementContractors = useCallback(async () => {
    try {
      const data = await customDataFieldGroupService.getFieldsByType(
        "asbestos_removalist"
      );
      const sortedData = (data || []).sort((a, b) =>
        (a.text || "").localeCompare(b.text || "")
      );
      setLeadAbatementContractors(sortedData);
    } catch (error) {
      console.error("Error fetching lead abatement contractors:", error);
      setLeadAbatementContractors([]);
    }
  }, []);

  const handleCreateLeadRemovalJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setSelectedContractor("");
    setModalError(null);
    if (projects.length === 0) {
      fetchProjects();
    }
    if (leadAbatementContractors.length === 0) {
      fetchLeadAbatementContractors();
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
    setSelectedContractor("");
    setModalError(null);
  };

  const handleSubmitModal = async () => {
    if (!selectedProject || !selectedContractor) {
      setModalError(
        "Please select both a project and lead abatement contractor"
      );
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
        leadAbatementContractor: selectedContractor,
        status: "in_progress",
      };

      const response = await leadRemovalJobService.create(newJobData);

      if (response.data) {
        await fetchLeadRemovalJobs({ force: true, silent: true });
        handleCloseModal();
      }
    } catch (err) {
      console.error("Error creating lead removal job:", err);
      setModalError(
        err.response?.data?.message || err.message || "Failed to create job"
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (job) => {
    navigate(`/lead-removal/jobs/${job.id}/details`);
  };

  const handleDeleteClick = (event, job) => {
    event.stopPropagation();
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    setDeleteLoading(true);
    try {
      await leadRemovalJobService.delete(jobToDelete.id);
      setLeadRemovalJobs((prev) =>
        prev.filter((job) => job.id !== jobToDelete.id)
      );
      await fetchLeadRemovalJobs({ force: true, silent: true });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (err) {
      console.error("Error deleting lead removal job:", err);
      setError(err.response?.data?.message || err.message || "Failed to delete job");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  // Restrict to super admin only
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Lead Removal Jobs
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateLeadRemovalJob}
            sx={{
              minWidth: "220px",
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            New Lead Removal Job
          </Button>
        </Box>

        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 4,
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 4 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : leadRemovalJobs.length === 0 ? (
            <Box sx={{ p: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No active lead removal jobs
              </Typography>
            </Box>
          ) : (
            <TableContainer
              sx={{
                "& thead": {
                  background:
                    "linear-gradient(to right, #045E1F, #96CC78) !important",
                },
                "& thead .MuiTableCell-root": {
                  backgroundColor: "transparent !important",
                  color: "#FFFFFF !important",
                  borderBottom:
                    "2px solid rgba(255,255,255,0.4) !important",
                },
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        minWidth: showPortraitColumnsOnly ? "80px" : "120px",
                      }}
                    >
                      Project ID
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        minWidth: showPortraitColumnsOnly ? "140px" : "240px",
                      }}
                    >
                      Site Name (Project)
                    </TableCell>
                    {!showPortraitColumnsOnly && (
                      <>
                        <TableCell
                          sx={{ fontWeight: "bold", minWidth: "120px" }}
                        >
                          Lead Removalist
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: "bold", minWidth: "140px" }}
                        >
                          Status
                        </TableCell>
                      </>
                    )}
                    {!isMobile && (
                      <TableCell
                        sx={{ fontWeight: "bold", minWidth: "100px" }}
                      >
                        Job Type
                      </TableCell>
                    )}
                    {!isMobile && hasPermission(currentUser, "asbestos.delete") && (
                      <TableCell
                        sx={{ fontWeight: "bold", width: "120px" }}
                        align="center"
                      >
                        Actions
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leadRemovalJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      onClick={() => handleRowClick(job)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {job.projectID}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectName}
                        </Typography>
                      </TableCell>
                      {!showPortraitColumnsOnly && (
                        <>
                          <TableCell>
                            <Typography variant="body2">
                              {job.leadRemovalist}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={formatStatusLabel(job.status)}
                              size="small"
                              sx={{
                                backgroundColor: getStatusColor(job.status),
                                color: "white",
                              }}
                            />
                          </TableCell>
                        </>
                      )}
                      {!isMobile && (
                        <TableCell>
                          <Chip
                            label={job.jobTypeLabel}
                            size="small"
                            sx={{
                              backgroundColor: getJobTypeColor(job.jobTypeRaw),
                              color: "white",
                            }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && hasPermission(currentUser, "asbestos.delete") && (
                        <TableCell align="center">
                          <Tooltip title="Delete Job">
                            <IconButton
                              onClick={(event) => handleDeleteClick(event, job)}
                              size="small"
                              sx={{
                                color: theme.palette.error.main,
                                "&:hover": {
                                  backgroundColor: theme.palette.error.light,
                                  color: "white",
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Create Lead Removal Job Modal */}
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
            <Typography variant="h6">New Lead Removal Job</Typography>
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
            <InputLabel>Lead abatement contractor</InputLabel>
            <Select
              value={selectedContractor}
              onChange={(e) => {
                setSelectedContractor(e.target.value);
                setModalError(null);
              }}
              label="Lead abatement contractor"
            >
              {leadAbatementContractors.map((contractor) => (
                <MenuItem key={contractor._id} value={contractor.text}>
                  {contractor.text}
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
            disabled={!selectedProject || !selectedContractor || modalLoading}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Delete Lead Removal Job</Typography>
            <IconButton onClick={handleDeleteCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this lead removal job?
          </Typography>
          {jobToDelete && (
            <Box
              sx={{
                p: 2,
                backgroundColor: theme.palette.grey[100],
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Project: {jobToDelete.projectID} - {jobToDelete.projectName}
              </Typography>
              <Typography variant="body2">
                Lead abatement contractor: {jobToDelete.leadRemovalist}
              </Typography>
              <Typography variant="body2">
                Status: {formatStatusLabel(jobToDelete.status)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The job will be archived.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            sx={{
              "&:hover": {
                backgroundColor: theme.palette.error.dark,
              },
            }}
          >
            {deleteLoading ? "Deleting..." : "Delete Job"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LeadRemoval;
