import React, { useState, useEffect, useCallback } from "react";
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
  Container,
  Breadcrumbs,
  Link,
  InputAdornment,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MailIcon from "@mui/icons-material/Mail";
import { tokens } from "../../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import {
  projectService,
  asbestosAssessmentService,
  userService,
} from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../config/permissions";
import { getTodaySydney } from "../../../utils/dateUtils";
import { useSnackbar } from "../../../context/SnackbarContext";
import PDFLoadingOverlay from "../../../components/PDFLoadingOverlay";

const CACHE_KEY = "residentialAsbestosJobsCache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const loadJobsCache = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const cachedRaw = window.sessionStorage.getItem(CACHE_KEY);
    if (!cachedRaw) {
      return null;
    }

    const parsed = JSON.parse(cachedRaw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!Array.isArray(parsed.jobs) || typeof parsed.timestamp !== "number") {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("[Residential Asbestos] Failed to parse jobs cache", error);
    return null;
  }
};

const saveJobsCache = (jobs) => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    const payload = JSON.stringify({ jobs, timestamp: Date.now() });
    window.sessionStorage.setItem(CACHE_KEY, payload);
  } catch (error) {
    console.warn("[Residential Asbestos] Failed to write jobs cache", error);
  }
};

const clearJobsCache = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[Residential Asbestos] Failed to clear jobs cache", error);
  }
};

const ResidentialAsbestosAssessment = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessmentDateError, setAssessmentDateError] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [selectedLAA, setSelectedLAA] = useState("");
  const [secondaryHeader, setSecondaryHeader] = useState("");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editState, setEditState] = useState("");
  const [editLAA, setEditLAA] = useState("");
  const [editSecondaryHeader, setEditSecondaryHeader] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // View Report state
  const [generatingReportId, setGeneratingReportId] = useState(null);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Complete (archive) state
  const [completingJobId, setCompletingJobId] = useState(null);

  // Approval/authorisation state
  const [reportViewedAssessmentIds, setReportViewedAssessmentIds] = useState(
    new Set(),
  );
  const [authorisingReports, setAuthorisingReports] = useState({});
  const [sendingAuthorisationRequests, setSendingAuthorisationRequests] =
    useState({});

  const fetchJobs = useCallback(
    async ({ force = false, silent = false } = {}) => {
      const startTime = performance.now();
      console.log("[Residential Asbestos] Starting fetchJobs");

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        if (!force) {
          const cached = loadJobsCache();
          if (cached) {
            console.log("[Residential Asbestos] Serving jobs from cache");
            setJobs(cached.jobs);
            if (!silent) {
              setLoading(false);
            }
            return;
          }
        }

        const jobsResponse =
          await asbestosAssessmentService.getAsbestosAssessments({ jobType: 'residential-asbestos' });
        const jobs = jobsResponse.data || jobsResponse || [];

        if (!Array.isArray(jobs)) {
          console.error("Jobs is not an array:", jobs);
          setJobs([]);
          return;
        }

        console.log(`[Residential Asbestos] Found ${jobs.length} active jobs`);

        const processedJobs = jobs.map((job) => {
          const projectRef = job.projectId || {};
          const projectIdentifier =
            projectRef?.projectID || job.projectID || "Unknown";
          const projectName =
            projectRef?.name || job.projectName || "Unknown Project";
          const clientName =
            typeof projectRef?.client === "string"
              ? projectRef.client
              : projectRef?.client?.name || null;

          return {
            id: job._id,
            projectID: projectIdentifier,
            projectName: projectName,
            clientName: clientName,
            surveyDate: job.assessmentDate || job.surveyDate || null,
            status: job.status || "in-progress",
            LAA: job.LAA || null,
            reportAuthorisedBy: job.reportAuthorisedBy || null,
            noSamplesCollected: job.noSamplesCollected || false,
            samplesCount: Array.isArray(job.items) ? job.items.length : 0,
            originalData: job,
          };
        });

        const sortedJobs = processedJobs.sort((a, b) => {
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "") || 0);
          return bNum - aNum;
        });

        setJobs(sortedJobs);
        saveJobsCache(sortedJobs);
      } catch (err) {
        const errorTime = performance.now() - startTime;
        console.error(
          `[Residential Asbestos] Error after ${errorTime.toFixed(2)}ms:`,
          err,
        );
        setError(err.message || "Failed to fetch jobs");
        if (!force) {
          clearJobsCache();
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
        const finalTime = performance.now() - startTime;
        console.log(
          `[Residential Asbestos] fetchJobs completed in ${finalTime.toFixed(
            2,
          )}ms`,
        );
      }
    },
    [],
  );

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

  const fetchAsbestosAssessors = useCallback(async () => {
    try {
      const response = await userService.getAsbestosAssessors();
      const assessors = response.data || [];

      const sortedAssessors = assessors.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setAsbestosAssessors(sortedAssessors);
    } catch (error) {
      console.error("Error fetching asbestos assessors:", error);
      setAsbestosAssessors([]);
    }
  }, []);

  useEffect(() => {
    const cached = loadJobsCache();

    if (cached) {
      console.log("[Residential Asbestos] Using cached jobs");
      setJobs(cached.jobs);
      setLoading(false);
      fetchJobs({ force: true, silent: true });
    } else {
      fetchJobs();
    }
    fetchAsbestosAssessors();
  }, [fetchJobs, fetchAsbestosAssessors]);

  const getStatusColor = useCallback(
    (status) => {
      const normalizedStatus = status
        ?.toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/-/g, "_");

      switch (normalizedStatus) {
        case "completed":
        case "complete":
          return theme.palette.success.main;
        case "in_progress":
          return theme.palette.warning.main;
        case "active":
          return theme.palette.primary.main;
        case "cancelled":
          return theme.palette.error.main;
        case "site_works_complete":
          return theme.palette.info.main;
        case "samples_with_lab":
        case "sample_analysis_complete":
        case "report_ready_for_review":
          return theme.palette.info.main;
        default:
          return theme.palette.grey[500];
      }
    },
    [theme],
  );

  const formatStatusLabel = useCallback((status) => {
    if (!status) return "Unknown";

    const statusMap = {
      in_progress: "In Progress",
      "in-progress": "In Progress",
      "site-works-complete": "Site Works Complete",
      completed: "Completed",
      cancelled: "Cancelled",
      complete: "Analysis Complete",
      active: "Active",
      "samples-with-lab": "Samples With Lab",
      "sample-analysis-complete": "Analysis Complete",
      "report-ready-for-review": "Report Ready For Review",
    };

    return (
      statusMap[status] ||
      status
        .split(/[_-]/)
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ")
    );
  }, []);

  const handleCreateJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setAssessmentDate(getTodaySydney());
    setAssessmentDateError(false);
    setModalError(null);
    setSelectedState("ACT");
    setSelectedLAA("");
    if (projects.length === 0) {
      fetchProjects();
    }
    if (asbestosAssessors.length === 0) {
      fetchAsbestosAssessors();
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
    setAssessmentDate("");
    setAssessmentDateError(false);
    setModalError(null);
    setSelectedState("");
    setSelectedLAA("");
    setSecondaryHeader("");
  };

  const handleSubmitModal = async () => {
    if (!selectedProject) {
      setModalError("Please select a project");
      return;
    }

    if (!assessmentDate || assessmentDate.trim() === "") {
      setAssessmentDateError(true);
      setModalError("Please enter an assessment date");
      return;
    }

    if (!selectedState) {
      setModalError("Please select a state");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setAssessmentDateError(false);

    try {
      const newJobData = {
        projectId: selectedProject._id,
        assessmentDate: assessmentDate,
        state: selectedState,
        LAA: selectedLAA || null,
        secondaryHeader: secondaryHeader?.trim() || null,
        jobType: 'residential-asbestos',
      };

      const response =
        await asbestosAssessmentService.createAsbestosAssessment(newJobData);

      if (response.data) {
        clearJobsCache();
        await fetchJobs({ force: true });
        handleCloseModal();
      } else {
        // If response structure is different, still refresh
        clearJobsCache();
        await fetchJobs({ force: true });
        handleCloseModal();
      }
    } catch (err) {
      console.error("Error creating job:", err);
      setModalError(
        err.response?.data?.message || err.message || "Failed to create job",
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (job) => {
    navigate(`/surveys/residential-asbestos/${job.id}/items`);
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
      await asbestosAssessmentService.deleteAsbestosAssessment(jobToDelete.id);
      clearJobsCache();
      setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
      await fetchJobs({ force: true, silent: true });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (err) {
      console.error("Error deleting job:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to delete job",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  const hasNoSamplesCollected = (job) =>
    job.noSamplesCollected === true ||
    job.originalData?.noSamplesCollected === true;

  const canCompleteAssessment =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.canSetJobComplete === true;

  const hasSamplesSubmitted = (job) => {
    if (hasNoSamplesCollected(job)) return false;
    const status = job.status || "";
    const submittedStatuses = [
      "samples-with-lab",
      "sample-analysis-complete",
      "report-ready-for-review",
      "complete",
    ];
    return (
      (job.samplesCount > 0 || (job.originalData?.items?.length ?? 0) > 0) &&
      submittedStatuses.includes(status)
    );
  };

  // LD supplied job status label (matches LDsuppliedJobs table)
  const getLabStatusLabel = (job) => {
    const data = job.originalData || job;
    if (data.labSamplesStatus) {
      return data.labSamplesStatus === "analysis-complete"
        ? "Analysis complete"
        : "Samples in lab";
    }
    const status = data.status || job.status || "";
    if (
      [
        "sample-analysis-complete",
        "report-ready-for-review",
        "complete",
      ].includes(status)
    ) {
      return "Analysis complete";
    }
    return "Samples in lab";
  };

  const getLabStatusColor = (job) => {
    const label = getLabStatusLabel(job);
    return label === "Analysis complete" ? "success" : "primary";
  };

  const formatTimeUntilDue = (dueDate) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    if (diffMs <= 0) return "Overdue";
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
    if (hours === 0) return `${days} day${days !== 1 ? "s" : ""}`;
    return `${days} day${days !== 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
  };

  const handleAnalysisClick = (event, job) => {
    event.stopPropagation();
    navigate(`/fibre-id/assessment/${job.id}/item/1/analysis`);
  };

  const handleGoToLDSuppliedJobs = (event, job) => {
    event.stopPropagation();
    navigate("/laboratory-services/ld-supplied");
  };

  const handleCompleteClick = async (event, job) => {
    event.stopPropagation();
    if (completingJobId) return;
    setCompletingJobId(job.id);
    try {
      await asbestosAssessmentService.archiveAsbestosAssessment(job.id);
      clearJobsCache();
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      await fetchJobs({ force: true, silent: true });
      showSnackbar(
        "Assessment marked as complete and removed from the table.",
        "success",
      );
    } catch (err) {
      console.error("Error completing assessment:", err);
      showSnackbar(
        err.response?.data?.message ||
          err.message ||
          "Failed to complete assessment",
        "error",
      );
    } finally {
      setCompletingJobId(null);
    }
  };

  const handleEditClick = (event, job) => {
    event.stopPropagation();
    setJobToEdit(job);
    setEditDate(
      job.surveyDate
        ? new Date(job.surveyDate).toISOString().split("T")[0]
        : getTodaySydney(),
    );
    setEditState(job.originalData?.state || job.state || "ACT");
    setEditLAA(job.LAA || "");
    setEditSecondaryHeader(
      job.originalData?.secondaryHeader || job.secondaryHeader || "",
    );
    setEditError(null);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setJobToEdit(null);
    setEditDate("");
    setEditState("");
    setEditLAA("");
    setEditSecondaryHeader("");
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editDate || editDate.trim() === "") {
      setEditError("Please enter an assessment date");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const updateData = {
        projectId:
          jobToEdit.originalData.projectId?._id ||
          jobToEdit.originalData.projectId,
        assessmentDate: editDate,
        state: editState || null,
        LAA: editLAA || null,
        secondaryHeader: editSecondaryHeader?.trim() || null,
      };

      await asbestosAssessmentService.updateAsbestosAssessment(
        jobToEdit.id,
        updateData,
      );
      clearJobsCache();
      await fetchJobs({ force: true });
      handleCloseEditDialog();
    } catch (err) {
      console.error("Error updating job:", err);
      setEditError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update assessment",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleViewReport = async (event, job) => {
    event.stopPropagation();
    if (generatingReportId) return;

    setGeneratingReportId(job.id);
    try {
      const response =
        await asbestosAssessmentService.getAsbestosAssessmentById(job.id);
      const fullAssessment = response.data;

      const { data: pdfBlob } =
        await asbestosAssessmentService.generateAsbestosAssessmentPdf(
          fullAssessment,
          { isResidential: true },
        );

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      const projectId =
        fullAssessment.projectId?.projectID || job.projectID || "Unknown";
      const siteName =
        fullAssessment.projectId?.name || job.projectName || "Unknown";
      const assessmentDate = fullAssessment.assessmentDate
        ? new Date(fullAssessment.assessmentDate)
            .toLocaleDateString("en-GB")
            .replace(/\//g, "-")
        : "Unknown";
      link.download = `${projectId}: Residential Asbestos Assessment Report - ${siteName} (${assessmentDate}).pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setReportViewedAssessmentIds((prev) => new Set(prev).add(job.id));
      showSnackbar(
        "Residential asbestos assessment report generated successfully.",
        "success",
      );
    } catch (err) {
      console.error("Error generating asbestos assessment report:", err);
      showSnackbar(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate report",
        "error",
      );
    } finally {
      setGeneratingReportId(null);
    }
  };

  // Check if all sampled items (first occurrence per sampleReference) have been analysed
  const areAllSampledItemsAnalysed = (job) => {
    const items = job?.originalData?.items || job?.items;
    if (!items?.length) return false;
    const isVA = (item) =>
      item.asbestosContent === "Visually Assessed as Asbestos" ||
      item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
      item.asbestosContent === "Visually Assessed as Non-asbestos";
    const sampled = items.filter((item, index) => {
      if (!item.sampleReference?.trim()) return false;
      if (isVA(item)) return false;
      const ref = item.sampleReference.trim();
      const firstIndex = items.findIndex(
        (i) => (i.sampleReference || "").trim() === ref,
      );
      return index === firstIndex;
    });
    if (sampled.length === 0) return false;
    return sampled.every((item) => item.analysisData?.isAnalysed === true);
  };

  const handleBackToSurveys = () => {
    navigate("/surveys");
  };

  const handleAuthoriseReport = async (event, job) => {
    event.stopPropagation();
    if (authorisingReports[job.id]) return;

    setAuthorisingReports((prev) => ({ ...prev, [job.id]: true }));
    try {
      const now = new Date().toISOString();
      const authoriser =
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || currentUser?.email || "Unknown";

      const orig = job.originalData || {};
      await asbestosAssessmentService.updateAsbestosAssessment(job.id, {
        projectId: orig.projectId?._id || orig.projectId,
        assessmentDate: orig.assessmentDate || job.surveyDate,
        reportApprovedBy: authoriser,
        reportIssueDate: now,
        reportAuthorisedBy: authoriser,
        reportAuthorisedAt: now,
        status: "complete",
      });

      clearJobsCache();
      await fetchJobs({ force: true });
      showSnackbar("Assessment report authorised successfully.", "success");
    } catch (err) {
      console.error("Error authorising report:", err);
      showSnackbar(
        err.response?.data?.message ||
          err.message ||
          "Failed to authorise report",
        "error",
      );
    } finally {
      setAuthorisingReports((prev) => ({ ...prev, [job.id]: false }));
    }
  };

  const handleSendForAuthorisation = async (event, job) => {
    event.stopPropagation();
    if (sendingAuthorisationRequests[job.id]) return;

    setSendingAuthorisationRequests((prev) => ({
      ...prev,
      [job.id]: true,
    }));
    try {
      const response = await asbestosAssessmentService.sendForAuthorisation(
        job.id,
      );
      showSnackbar(
        response.data?.message ||
          `Authorisation request emails sent successfully to ${
            response.data?.recipients?.length || 0
          } report proofer user(s)`,
        "success",
      );
      clearJobsCache();
      await fetchJobs({ force: true });
    } catch (err) {
      console.error("Error sending authorisation request:", err);
      showSnackbar(
        err.response?.data?.message ||
          err.message ||
          "Failed to send authorisation request",
        "error",
      );
    } finally {
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [job.id]: false,
      }));
    }
  };

  return (
    <Container maxWidth="xl">
      <PDFLoadingOverlay
        open={!!generatingReportId}
        message="Generating Residential Asbestos Assessment PDF..."
      />
      <Box sx={{ mt: 4, mb: 4 }}>
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
        </Breadcrumbs>

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
            Residential Asbestos Assessments
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateJob}
            sx={{
              minWidth: "220px",
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            New Assessment
          </Button>
        </Box>

        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "90px" }}>
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "195px" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "110px" }}>
                    Survey Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "140px" }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "180px" }}>
                    Sample Analysis
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "120px" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Loading assessments...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Alert severity="error">{error}</Alert>
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No active assessments found
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      onClick={() => handleRowClick(job)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ width: "90px" }}>
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
                          {job.clientName && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              Client: {job.clientName}
                            </Typography>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: "105px" }}>
                        <Typography variant="body2">
                          {job.surveyDate
                            ? new Date(job.surveyDate).toLocaleDateString(
                                "en-GB",
                              )
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: "150px" }}>
                        <Chip
                          label={formatStatusLabel(job.status)}
                          size="small"
                          sx={{
                            backgroundColor: getStatusColor(job.status),
                            color: "white",
                          }}
                        />
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        sx={{ maxWidth: "140px" }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {!hasSamplesSubmitted(job) && (
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(job);
                              }}
                              sx={{
                                cursor: "pointer",
                                // "&:hover": {
                                //   textDecoration: "underline",
                                // },
                              }}
                            >
                              {hasNoSamplesCollected(job) ? (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  fontStyle="italic"
                                >
                                  No samples submitted to lab
                                </Typography>
                              ) : (
                                <Typography
                                  variant="body2"
                                  fontStyle="italic"
                                  color="text.secondary"
                                >
                                  No samples submitted to lab
                                </Typography>
                              )}
                            </Box>
                          )}
                          {hasSamplesSubmitted(job) &&
                            currentUser?.labApprovals?.fibreCounting ===
                              true && (
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                }}
                              >
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) =>
                                    areAllSampledItemsAnalysed(job)
                                      ? handleGoToLDSuppliedJobs(e, job)
                                      : handleAnalysisClick(e, job)
                                  }
                                  sx={
                                    job.originalData?.reportApprovedBy ||
                                    job.reportApprovedBy
                                      ? {
                                          textTransform: "none",
                                          color: "success.main",
                                          borderColor: "success.main",
                                          "&:hover": {
                                            borderColor: "success.dark",
                                            backgroundColor:
                                              "rgba(46, 125, 50, 0.04)",
                                          },
                                        }
                                      : areAllSampledItemsAnalysed(job)
                                        ? {
                                            textTransform: "none",
                                            color: "text.secondary",
                                            borderColor: "action.disabled",
                                            "&:hover": {
                                              borderColor: "text.secondary",
                                              backgroundColor: "action.hover",
                                            },
                                          }
                                        : {
                                            textTransform: "none",
                                            color: "error.main",
                                            borderColor: "error.main",
                                            "&:hover": {
                                              borderColor: "error.dark",
                                              backgroundColor:
                                                "rgba(211, 47, 47, 0.04)",
                                            },
                                          }
                                  }
                                >
                                  {job.originalData?.reportApprovedBy ||
                                  job.reportApprovedBy
                                    ? "Approved"
                                    : areAllSampledItemsAnalysed(job)
                                      ? "Analysed (not approved)"
                                      : "Analyse"}
                                </Button>
                                {job.status === "samples-with-lab" &&
                                  job.originalData?.analysisDueDate && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ mt: 0.5, display: "block" }}
                                    >
                                      {formatTimeUntilDue(
                                        job.originalData.analysisDueDate,
                                      ) === "Overdue"
                                        ? "Overdue"
                                        : `Due: ${formatTimeUntilDue(
                                            job.originalData.analysisDueDate,
                                          )}`}
                                    </Typography>
                                  )}
                              </Box>
                            )}
                          {hasSamplesSubmitted(job) &&
                            currentUser?.labApprovals?.fibreCounting !==
                              true && (
                              <Chip
                                label={getLabStatusLabel(job)}
                                size="small"
                                color={getLabStatusColor(job)}
                                sx={{ color: "white" }}
                              />
                            )}
                        </Box>
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        sx={{ minWidth: "120px" }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {/* Complete: only when ASSESSMENT report is authorised (reportAuthorisedBy), NOT fibre ID approval (reportApprovedBy). Restricted to admins or users with Can Set Job Complete. */}
                          {!!(
                            job.originalData?.reportAuthorisedBy ||
                            job.reportAuthorisedBy
                          ) &&
                            canCompleteAssessment && (
                              <Button
                                variant="outlined"
                                size="small"
                                color="success"
                                onClick={(event) =>
                                  handleCompleteClick(event, job)
                                }
                                disabled={completingJobId === job.id}
                                sx={{ textTransform: "none" }}
                              >
                                Complete
                              </Button>
                            )}
                          {(job.status === "report-ready-for-review" ||
                            job.status === "complete") && (
                            <Tooltip title="View Asbestos Assessment Report">
                              <IconButton
                                onClick={(event) =>
                                  handleViewReport(event, job)
                                }
                                color="primary"
                                size="small"
                                disabled={generatingReportId === job.id}
                              >
                                <PictureAsPdfIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {(() => {
                            const reportAuthorised =
                              job.originalData?.reportAuthorisedBy ||
                              job.reportAuthorisedBy;
                            const reportViewed = reportViewedAssessmentIds.has(
                              job.id,
                            );
                            const canAuthorise =
                              (currentUser?.reportProofer ||
                                currentUser?.labSignatory) &&
                              hasPermission(currentUser, "admin.view");
                            const canSendForApproval =
                              hasPermission(currentUser, "asbestos.edit") &&
                              !canAuthorise;

                            const showAuthorise =
                              !reportAuthorised &&
                              reportViewed &&
                              canAuthorise &&
                              (job.status === "report-ready-for-review" ||
                                job.status === "complete");
                            const showSend =
                              !reportAuthorised &&
                              reportViewed &&
                              canSendForApproval &&
                              (job.status === "report-ready-for-review" ||
                                job.status === "complete");

                            return (
                              <>
                                {showAuthorise && (
                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="success"
                                    onClick={(event) =>
                                      handleAuthoriseReport(event, job)
                                    }
                                    disabled={
                                      authorisingReports[job.id] ||
                                      generatingReportId === job.id
                                    }
                                    sx={{
                                      textTransform: "none",
                                      backgroundColor: "#4caf50",
                                      "&:hover": {
                                        backgroundColor: "#45a049",
                                      },
                                    }}
                                  >
                                    {authorisingReports[job.id]
                                      ? "Authorising..."
                                      : "Authorise Report"}
                                  </Button>
                                )}
                                {showSend && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="primary"
                                    startIcon={<MailIcon />}
                                    onClick={(event) =>
                                      handleSendForAuthorisation(event, job)
                                    }
                                    disabled={
                                      sendingAuthorisationRequests[job.id]
                                    }
                                    sx={{ textTransform: "none" }}
                                  >
                                    {sendingAuthorisationRequests[job.id]
                                      ? "Sending..."
                                      : "Send for Approval"}
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          <Tooltip title="Edit Assessment">
                            <IconButton
                              onClick={(event) => handleEditClick(event, job)}
                              color="primary"
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {hasPermission(currentUser, "asbestos.delete") && (
                            <Tooltip title="Delete Assessment">
                              <IconButton
                                onClick={(event) =>
                                  handleDeleteClick(event, job)
                                }
                                color="error"
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Create Assessment Modal */}
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
            <Typography variant="h6">
              New Residential Asbestos Assessment
            </Typography>
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

          <TextField
            fullWidth
            label="Assessment Date"
            type="date"
            value={assessmentDate}
            onChange={(e) => {
              setAssessmentDate(e.target.value);
              if (assessmentDateError) {
                setAssessmentDateError(false);
              }
              setModalError(null);
            }}
            InputLabelProps={{
              shrink: true,
            }}
            error={assessmentDateError}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={() => setAssessmentDate(getTodaySydney())}
                    sx={{ textTransform: "none", minWidth: "auto" }}
                  >
                    Today
                  </Button>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          {assessmentDateError && (
            <Typography variant="body2" sx={{ color: "error.main", mb: 2 }}>
              Please enter an assessment date.
            </Typography>
          )}

          <FormControl fullWidth sx={{ mb: 2 }} required>
            <InputLabel>State</InputLabel>
            <Select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setModalError(null);
              }}
              label="State"
            >
              <MenuItem value="ACT">ACT</MenuItem>
              <MenuItem value="NSW">NSW</MenuItem>
              <MenuItem value="Commonwealth">Commonwealth</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
            <Select
              value={selectedLAA}
              onChange={(e) => {
                setSelectedLAA(e.target.value);
                setModalError(null);
              }}
              label="LAA (Licensed Asbestos Assessor)"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {asbestosAssessors.map((assessor) => {
                const assessorValue = `${assessor.firstName} ${assessor.lastName}`;
                return (
                  <MenuItem key={assessor._id} value={assessorValue}>
                    {assessor.firstName} {assessor.lastName}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Secondary Header (Optional)"
            value={secondaryHeader}
            onChange={(e) => {
              setSecondaryHeader(e.target.value);
              setModalError(null);
            }}
            placeholder="Enter secondary header text"
            helperText="This will appear as a smaller header beneath the project site name on the cover page"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSubmitModal}
            variant="contained"
            disabled={
              !selectedProject ||
              !assessmentDate ||
              !selectedState ||
              modalLoading
            }
            sx={{
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            {modalLoading ? "Creating..." : "Create Assessment"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Assessment Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              Edit Residential Asbestos Assessment
            </Typography>
            <IconButton onClick={handleCloseEditDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Assessment Date"
            type="date"
            value={editDate}
            onChange={(e) => {
              setEditDate(e.target.value);
              setEditError(null);
            }}
            InputLabelProps={{
              shrink: true,
            }}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={() => setEditDate(getTodaySydney())}
                    sx={{ textTransform: "none", minWidth: "auto" }}
                  >
                    Today
                  </Button>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2, mt: 1 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>State</InputLabel>
            <Select
              value={editState}
              onChange={(e) => {
                setEditState(e.target.value);
                setEditError(null);
              }}
              label="State"
            >
              <MenuItem value="ACT">ACT</MenuItem>
              <MenuItem value="NSW">NSW</MenuItem>
              <MenuItem value="Commonwealth">Commonwealth</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
            <Select
              value={editLAA}
              onChange={(e) => {
                setEditLAA(e.target.value);
                setEditError(null);
              }}
              label="LAA (Licensed Asbestos Assessor)"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {asbestosAssessors.map((assessor) => {
                const assessorValue = `${assessor.firstName} ${assessor.lastName}`;
                return (
                  <MenuItem key={assessor._id} value={assessorValue}>
                    {assessor.firstName} {assessor.lastName}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Secondary Header (Optional)"
            value={editSecondaryHeader}
            onChange={(e) => {
              setEditSecondaryHeader(e.target.value);
              setEditError(null);
            }}
            placeholder="Enter secondary header text"
            helperText="This will appear as a smaller header beneath the project site name on the cover page"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={editLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={!editDate || editLoading}
            sx={{
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            {editLoading ? "Saving..." : "Save Changes"}
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
            <Typography variant="h6">
              Delete Residential Asbestos Assessment
            </Typography>
            <IconButton onClick={handleDeleteCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this residential asbestos
            assessment?
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
                Status: {formatStatusLabel(jobToDelete.status)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. All associated data will be
            permanently deleted.
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
            {deleteLoading ? "Deleting..." : "Delete Assessment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ResidentialAsbestosAssessment;
