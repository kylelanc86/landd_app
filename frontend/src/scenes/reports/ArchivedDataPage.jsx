import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  CircularProgress,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RestoreIcon from "@mui/icons-material/Restore";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import api, { projectService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosAssessmentService from "../../services/asbestosAssessmentService";
import { formatDate } from "../../utils/dateFormat";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";

const ArchivedDataPage = () => {
  const { projectId: projectIdParam } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const [project, setProject] = useState(null);
  const [archivedJobs, setArchivedJobs] = useState([]);
  const [archivedShifts, setArchivedShifts] = useState([]);
  const [archivedClearances, setArchivedClearances] = useState([]);
  const [archivedAssessments, setArchivedAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const projectId = projectIdParam || null;

  const canRestoreJob = hasPermission(currentUser, "asbestos.edit");
  const canRestoreShift = hasPermission(currentUser, "jobs.edit");
  const canRestoreClearance = hasPermission(currentUser, "asbestos.edit");
  const canRestoreAssessment = hasPermission(currentUser, "projects.edit");

  const fetchArchivedData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response =
        await asbestosRemovalJobService.getArchivedData(projectId);
      setArchivedJobs(response.data?.archivedJobs || []);
      setArchivedShifts(response.data?.archivedShifts || []);
      setArchivedClearances(response.data?.archivedClearances || []);
      setArchivedAssessments(response.data?.archivedAssessments || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load archived data",
      );
      setArchivedJobs([]);
      setArchivedShifts([]);
      setArchivedClearances([]);
      setArchivedAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchArchivedData();
  }, [fetchArchivedData]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    projectService
      .getById(projectId)
      .then((res) => {
        if (!cancelled && res?.data) setProject(res.data);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleRestoreJob = async (job) => {
    setRestoringId(`job-${job._id}`);
    try {
      await asbestosRemovalJobService.restore(job._id);
      showSnackbar("Asbestos removal job restored successfully", "success");
      await fetchArchivedData();
      navigate(`/asbestos-removal/jobs/${job._id}/details`);
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to restore job",
        "error",
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreShift = async (shift) => {
    setRestoringId(`shift-${shift._id}`);
    try {
      await api.airMonitoringShifts.restore(shift._id);
      showSnackbar("Air monitoring shift restored successfully", "success");
      await fetchArchivedData();
      navigate(`/air-monitoring/shift/${shift._id}/samples`);
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to restore shift",
        "error",
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreClearance = async (clearance) => {
    setRestoringId(`clearance-${clearance._id}`);
    try {
      await asbestosClearanceService.restore(clearance._id);
      showSnackbar("Asbestos clearance restored successfully", "success");
      await fetchArchivedData();
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to restore clearance",
        "error",
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreAssessment = async (assessment) => {
    setRestoringId(`assessment-${assessment._id}`);
    try {
      await asbestosAssessmentService.restore(assessment._id);
      showSnackbar("Assessment restored successfully", "success");
      await fetchArchivedData();
      const path =
        assessment.jobType === "residential-asbestos"
          ? `/surveys/residential-asbestos/${assessment._id}/items`
          : `/surveys/asbestos-assessment/${assessment._id}/items`;
      navigate(path);
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to restore assessment",
        "error",
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleBack = () => {
    if (projectId) {
      navigate(`/reports/project/${projectId}`);
    } else {
      navigate("/reports");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleBack}
        sx={{ minWidth: "auto", px: 1 }}
      >
        Back
      </Button>
      <Box sx={{ mt: 2, mb: 3 }}>
        <Typography variant="h5" component="h1">
          Deleted Data
        </Typography>
        {project && (
          <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
            {project.projectID}
            {project.name ? ` – ${project.name}` : ""}
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {archivedJobs.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Archived asbestos removal jobs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Restored jobs will return to the asbestos removal jobs list with
            status &quot;In progress&quot; and you will be taken to the job
            details.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Job name</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Removalist</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Archived</TableCell>
                  {canRestoreJob && (
                    <TableCell sx={{ fontWeight: "bold" }} align="right">
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {archivedJobs.map((job) => (
                  <TableRow key={job._id} hover>
                    <TableCell>
                      {job.projectID}{" "}
                      {job.projectId?.name ? `– ${job.projectId.name}` : ""}
                    </TableCell>
                    <TableCell>{job.projectName || "—"}</TableCell>
                    <TableCell>{job.clientName || "—"}</TableCell>
                    <TableCell>{job.asbestosRemovalist || "—"}</TableCell>
                    <TableCell>
                      {formatDate(job.updatedAt || job.createdAt)}
                    </TableCell>
                    {canRestoreJob && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            restoringId === `job-${job._id}` ? (
                              <CircularProgress size={16} />
                            ) : (
                              <RestoreIcon />
                            )
                          }
                          onClick={() => handleRestoreJob(job)}
                          disabled={restoringId === `job-${job._id}`}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {archivedShifts.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Archived air monitoring shifts
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Individually archived shifts can be restored and will reappear on the
            job.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Archived</TableCell>
                  {canRestoreShift && (
                    <TableCell sx={{ fontWeight: "bold" }} align="right">
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {archivedShifts.map((shift) => (
                  <TableRow key={shift._id} hover>
                    <TableCell>{shift.name || "—"}</TableCell>
                    <TableCell>{formatDate(shift.date)}</TableCell>
                    <TableCell>
                      {shift.projectID}{" "}
                      {shift.projectName ? `– ${shift.projectName}` : ""}
                    </TableCell>
                    <TableCell>{shift.clientName || "—"}</TableCell>
                    <TableCell>{formatDate(shift.deletedAt)}</TableCell>
                    {canRestoreShift && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            restoringId === `shift-${shift._id}` ? (
                              <CircularProgress size={16} />
                            ) : (
                              <RestoreIcon />
                            )
                          }
                          onClick={() => handleRestoreShift(shift)}
                          disabled={restoringId === `shift-${shift._id}`}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {archivedClearances.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Archived asbestos clearances
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Individually archived clearances can be restored.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Archived</TableCell>
                  {canRestoreClearance && (
                    <TableCell sx={{ fontWeight: "bold" }} align="right">
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {archivedClearances.map((c) => (
                  <TableRow key={c._id} hover>
                    <TableCell>{c.clearanceType || "—"}</TableCell>
                    <TableCell>{formatDate(c.clearanceDate)}</TableCell>
                    <TableCell>{c.projectID || "—"}</TableCell>
                    <TableCell>{c.clientName || "—"}</TableCell>
                    <TableCell>{formatDate(c.deletedAt)}</TableCell>
                    {canRestoreClearance && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            restoringId === `clearance-${c._id}` ? (
                              <CircularProgress size={16} />
                            ) : (
                              <RestoreIcon />
                            )
                          }
                          onClick={() => handleRestoreClearance(c)}
                          disabled={restoringId === `clearance-${c._id}`}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {archivedAssessments.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Archived asbestos & residential assessments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Individually archived assessments can be restored.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Archived</TableCell>
                  {canRestoreAssessment && (
                    <TableCell sx={{ fontWeight: "bold" }} align="right">
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {archivedAssessments.map((a) => (
                  <TableRow key={a._id} hover>
                    <TableCell>
                      {a.jobType === "residential-asbestos"
                        ? "Residential assessment"
                        : "Asbestos assessment"}
                    </TableCell>
                    <TableCell>{formatDate(a.assessmentDate)}</TableCell>
                    <TableCell>{a.projectID || "—"}</TableCell>
                    <TableCell>{a.clientName || "—"}</TableCell>
                    <TableCell>{formatDate(a.deletedAt)}</TableCell>
                    {canRestoreAssessment && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            restoringId === `assessment-${a._id}` ? (
                              <CircularProgress size={16} />
                            ) : (
                              <RestoreIcon />
                            )
                          }
                          onClick={() => handleRestoreAssessment(a)}
                          disabled={restoringId === `assessment-${a._id}`}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!error &&
        archivedJobs.length === 0 &&
        archivedShifts.length === 0 &&
        archivedClearances.length === 0 &&
        archivedAssessments.length === 0 && (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No deleted data found.
          </Typography>
        )}
    </Box>
  );
};

export default ArchivedDataPage;
