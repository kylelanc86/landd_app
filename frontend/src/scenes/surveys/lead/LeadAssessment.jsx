import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  ListItemText,
  Checkbox,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadingIcon from "@mui/icons-material/Downloading";
import { tokens } from "../../../theme/tokens";
import {
  projectService,
  asbestosAssessmentService,
  userService,
} from "../../../services/api";
import {
  downloadAssessmentPDFByAssessmentId,
  generateAssessmentPDFAsync,
} from "../../../utils/templatePDFGenerator";
import { getTodaySydney } from "../../../utils/dateUtils";
import { useSnackbar } from "../../../context/SnackbarContext";
import { useAuth } from "../../../context/AuthContext";
import PermissionGate from "../../../components/PermissionGate";
import { hasPermission } from "../../../config/permissions";

const ASSESSMENT_TYPE_OPTIONS = [
  { value: "paint", label: "Paint", chipColor: "#1dc29b" },
  { value: "paint-xrf", label: "Paint (XRF)", chipColor: "#1dc29b" },
  { value: "dust", label: "Dust", chipColor: "#c7183e" },
  { value: "soil", label: "Soil", chipColor: "#cfb43e" },
];

const STATE_OPTIONS = ["ACT", "NSW", "Commonwealth"];

/** Stored assessment PDF may be a data URL or raw base64. */
function fibreAnalysisReportToPdfSrc(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  return `data:application/pdf;base64,${s}`;
}

const LeadAssessment = () => {
  const navigate = useNavigate();
  const colors = tokens;
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [assessmentType, setAssessmentType] = useState([]);
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessmentDateError, setAssessmentDateError] = useState(false);
  const [selectedState, setSelectedState] = useState("ACT");
  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [secondaryHeader, setSecondaryHeader] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editState, setEditState] = useState("");
  const [editAssessmentType, setEditAssessmentType] = useState([]);
  const [editConsultant, setEditConsultant] = useState("");
  const [editSecondaryHeader, setEditSecondaryHeader] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pdfWorkingJobId, setPdfWorkingJobId] = useState(null);
  const [attachAnalysisDialogOpen, setAttachAnalysisDialogOpen] = useState(false);
  const [attachAnalysisJob, setAttachAnalysisJob] = useState(null);
  const [attachAnalysisItems, setAttachAnalysisItems] = useState([]);
  const [attachLeadContentDrafts, setAttachLeadContentDrafts] = useState({});
  const [attachAnalysisFile, setAttachAnalysisFile] = useState(null);
  /** Full `fibreAnalysisReport` from GET assessment when the attach dialog opens. */
  const [attachAnalysisFibreReport, setAttachAnalysisFibreReport] = useState(null);
  const [attachAnalysisLoading, setAttachAnalysisLoading] = useState(false);
  const [attachAnalysisSaving, setAttachAnalysisSaving] = useState(false);

  const fetchJobs = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await asbestosAssessmentService.getAsbestosAssessments({
        jobType: "lead-assessment",
        list: 1,
      });
      const jobsData = response.data || response || [];
      const jobsArray = Array.isArray(jobsData) ? jobsData : [];

      const processedJobs = jobsArray.map((job) => {
        const projectRef = job.projectId || {};
        const projectIdentifier =
          projectRef?.projectID || job.projectID || "Unknown";
        const projectName =
          projectRef?.name || job.projectName || "Unknown Project";
        const clientName =
          typeof projectRef?.client === "string"
            ? projectRef.client
            : projectRef?.client?.name || null;
        const consultant = job.consultantId;
        const consultantName =
          consultant && (consultant.firstName || consultant.lastName)
            ? [consultant.firstName, consultant.lastName].filter(Boolean).join(" ")
            : null;

        return {
          id: job._id,
          projectID: projectIdentifier,
          projectName,
          clientName,
          surveyDate: job.assessmentDate || job.surveyDate || null,
          status: job.status || "in-progress",
          state: job.state || null,
          assessmentType: job.assessmentType || [],
          consultantId: job.consultantId?._id || job.consultantId,
          consultantName,
          secondaryHeader: job.secondaryHeader || null,
          originalData: job,
        };
      });

      const sortedJobs = processedJobs.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "") || 0);
        return bNum - aNum;
      });

      setJobs(sortedJobs);
    } catch (err) {
      console.error("Error fetching lead assessments:", err);
      setError(err.message || "Failed to fetch assessments");
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
      const projectsData = response?.data
        ? Array.isArray(response.data)
          ? response.data
          : response.data.data || []
        : [];
      const sorted = projectsData.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "") || 0);
        return bNum - aNum;
      });
      setProjects(sorted);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setProjects([]);
    }
  }, []);

  const fetchActiveUsers = useCallback(async () => {
    try {
      const response = await userService.getAll(false);
      const users = response?.data || response || [];
      setActiveUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      console.error("Error fetching active users:", err);
      setActiveUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchActiveUsers();
  }, [fetchActiveUsers]);

  const attachReplacePreviewUrl = useMemo(() => {
    if (!attachAnalysisFile) return null;
    return URL.createObjectURL(attachAnalysisFile);
  }, [attachAnalysisFile]);

  useEffect(() => {
    return () => {
      if (attachReplacePreviewUrl) URL.revokeObjectURL(attachReplacePreviewUrl);
    };
  }, [attachReplacePreviewUrl]);

  const attachAnalysisPdfSrc = useMemo(() => {
    if (attachReplacePreviewUrl) return attachReplacePreviewUrl;
    const raw = attachAnalysisFibreReport;
    if (typeof raw === "string" && raw.trim()) return fibreAnalysisReportToPdfSrc(raw);
    return null;
  }, [attachReplacePreviewUrl, attachAnalysisFibreReport]);

  const hasAttachDialogAnalysisReport = Boolean(
    typeof attachAnalysisFibreReport === "string" && attachAnalysisFibreReport.trim(),
  );

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    switch (s) {
      case "completed":
      case "complete":
        return "#2e7d32";
      case "in_progress":
        return "#ed6c02";
      default:
        return "#757575";
    }
  };

  const formatStatusLabel = (status) => {
    if (!status) return "Unknown";
    const map = {
      in_progress: "In Progress",
      "in-progress": "In Progress",
      completed: "Completed",
      complete: "Complete",
    };
    return map[status] || status.split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  };

  const isAnalysisAttachComplete = (job) => {
    const status = String(job?.status || "").toLowerCase();
    return status === "report-ready-for-review" || status === "complete";
  };

  const hasRetainedValidPdf = (job) =>
    Boolean(
      job?.pdfReadyAt ||
        job?.pdfFilename ||
        job?.originalData?.pdfReadyAt ||
        job?.originalData?.pdfFilename,
    );

  const handleDownloadOrGenerateAssessmentReport = async (event, job) => {
    event.stopPropagation();
    if (!job?.id) return;
    setPdfWorkingJobId(job.id);
    try {
      if (hasRetainedValidPdf(job)) {
        const { filename } = await downloadAssessmentPDFByAssessmentId(job.id);
        showSnackbar(`Downloaded: ${filename}`, "success");
      } else {
        const { filename } = await generateAssessmentPDFAsync(job.id, {
          isResidential: false,
        });
        showSnackbar(`Downloaded: ${filename}`, "success");
        await fetchJobs({ force: true });
      }
    } catch (err) {
      console.error("Error generating/downloading assessment report:", err);
      showSnackbar(err.message || "Failed to generate/download report", "error");
    } finally {
      setPdfWorkingJobId(null);
    }
  };

  const handleCreateJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setAssessmentDate(getTodaySydney());
    setAssessmentDateError(false);
    setModalError(null);
    setSelectedState("ACT");
    setSelectedConsultant("");
    setAssessmentType([]);
    setSecondaryHeader("");
    if (projects.length === 0) fetchProjects();
    if (activeUsers.length === 0) fetchActiveUsers();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
    setAssessmentDate("");
    setAssessmentDateError(false);
    setModalError(null);
    setSelectedState("");
    setSelectedConsultant("");
    setAssessmentType([]);
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
    if (!selectedConsultant) {
      setModalError("Please select a consultant");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setAssessmentDateError(false);

    try {
      const payload = {
        projectId: selectedProject._id,
        assessmentDate,
        state: selectedState,
        secondaryHeader: secondaryHeader?.trim() || null,
        jobType: "lead-assessment",
        assessmentType: assessmentType.length ? assessmentType : undefined,
        consultantId: selectedConsultant,
      };
      await asbestosAssessmentService.createAsbestosAssessment(payload);
      await fetchJobs({ force: true });
      handleCloseModal();
      showSnackbar("Lead assessment created.", "success");
    } catch (err) {
      console.error("Error creating lead assessment:", err);
      setModalError(
        err.response?.data?.message || err.message || "Failed to create assessment",
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (job) => {
    navigate(`/surveys/lead/${job.id}/items`);
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
    setEditAssessmentType(job.assessmentType || []);
    setEditConsultant(job.consultantId?.toString?.() || job.consultantId || "");
    setEditSecondaryHeader(
      job.originalData?.secondaryHeader ?? job.secondaryHeader ?? "",
    );
    setEditError(null);
    setEditDialogOpen(true);
    if (activeUsers.length === 0) fetchActiveUsers();
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setJobToEdit(null);
    setEditDate("");
    setEditState("");
    setEditAssessmentType([]);
    setEditConsultant("");
    setEditSecondaryHeader("");
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!jobToEdit) return;
    if (!editDate || editDate.trim() === "") {
      setEditError("Please enter an assessment date");
      return;
    }
    if (!editConsultant) {
      setEditError("Please select a consultant");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const updateData = {
        projectId:
          jobToEdit.originalData?.projectId?._id ||
          jobToEdit.originalData?.projectId,
        assessmentDate: editDate,
        state: editState || null,
        secondaryHeader: editSecondaryHeader?.trim() || null,
        assessmentType: editAssessmentType.length ? editAssessmentType : [],
        consultantId: editConsultant,
      };
      await asbestosAssessmentService.updateAsbestosAssessment(
        jobToEdit.id,
        updateData,
      );
      await fetchJobs({ force: true });
      handleCloseEditDialog();
      showSnackbar("Lead assessment updated.", "success");
    } catch (err) {
      console.error("Error updating lead assessment:", err);
      setEditError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update assessment",
      );
    } finally {
      setEditLoading(false);
    }
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
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      showSnackbar("Lead assessment deleted.", "success");
    } catch (err) {
      console.error("Error deleting lead assessment:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to delete assessment",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  const handleBackToSurveys = () => navigate("/surveys");

  const getLeadContentUnit = (materialType) => {
    const type = String(materialType || "").toLowerCase();
    if (type === "paint" || type === "paint-xrf") return "%";
    if (type === "dust") return "μg";
    if (type === "soil") return "mg/kg";
    return "";
  };

  const parseNumeric = (value) => {
    if (value == null) return null;
    const n = Number(String(value).trim().replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const getDerivedLeadStatus = (item, leadContentValue) => {
    const type = String(item?.materialType || "").toLowerCase();
    const content = parseNumeric(leadContentValue);
    if (content == null) return "";
    if (type === "paint" || type === "paint-xrf") return content > 0.1 ? "Lead paint" : "Lead-free";
    if (type === "soil") {
      const m = String(item?.paintColour || "").match(/\(([\d.]+)\s*mg\/kg\)/i);
      const threshold = m ? Number(m[1]) : null;
      if (!Number.isFinite(threshold)) return "";
      return content >= threshold ? "Exceedance" : "No exceedance";
    }
    if (type === "dust") {
      const areaRaw = String(item?.leadSampleArea || "").toLowerCase();
      const area = areaRaw.includes("0.01")
        ? 0.01
        : areaRaw.includes("0.0258")
          ? 0.0258
          : areaRaw.includes("0.09")
            ? 0.09
            : Number(areaRaw.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(area) || area <= 0) return "";
      const concentration = (content / 1000) / area; // mg/m2
      const rating = Number(item?.locationRating);
      const threshold = rating === 1 ? 1.08 : rating === 2 ? 0.43 : rating === 3 ? 0.11 : null;
      if (!Number.isFinite(threshold)) return "";
      return concentration >= threshold ? "Exceedance" : "No exceedence";
    }
    return "";
  };

  const closeAttachAnalysisDialog = () => {
    setAttachAnalysisDialogOpen(false);
    setAttachAnalysisFile(null);
    setAttachAnalysisFibreReport(null);
    setAttachAnalysisJob(null);
    setAttachAnalysisItems([]);
    setAttachLeadContentDrafts({});
  };

  const handleOpenAttachAnalysis = async (event, job) => {
    event.stopPropagation();
    setAttachAnalysisDialogOpen(true);
    setAttachAnalysisJob(job);
    setAttachAnalysisFile(null);
    setAttachAnalysisFibreReport(null);
    setAttachAnalysisLoading(true);
    try {
      const res = await asbestosAssessmentService.getAsbestosAssessmentById(job.id);
      const full = res?.data || res || {};
      const items = Array.isArray(full.items) ? full.items : [];
      setAttachAnalysisItems(items);
      const drafts = {};
      items.forEach((item) => {
        drafts[item._id] = item.leadContent ?? "";
      });
      setAttachLeadContentDrafts(drafts);
      const report = full.fibreAnalysisReport;
      setAttachAnalysisFibreReport(
        typeof report === "string" && report.trim() ? report : null,
      );
    } catch (err) {
      showSnackbar("Failed to load assessment items.", "error");
      setAttachAnalysisDialogOpen(false);
      setAttachAnalysisFibreReport(null);
    } finally {
      setAttachAnalysisLoading(false);
    }
  };

  const handleSaveAttachAnalysis = async () => {
    if (!attachAnalysisJob) return;
    const uploadedNewAnalysisFile = !!attachAnalysisFile;
    setAttachAnalysisSaving(true);
    try {
      let savedReportData = null;
      if (attachAnalysisFile) {
        savedReportData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(attachAnalysisFile);
        });
        await asbestosAssessmentService.uploadFibreAnalysisReport(attachAnalysisJob.id, {
          reportData: savedReportData,
        });
      }

      for (const item of attachAnalysisItems) {
        const nextValue = String(attachLeadContentDrafts[item._id] ?? "").trim();
        if (nextValue === String(item.leadContent ?? "").trim()) continue;
        await asbestosAssessmentService.updateItem(attachAnalysisJob.id, item._id, {
          leadContent: nextValue || "",
          status: getDerivedLeadStatus(item, nextValue),
        });
      }

      if (uploadedNewAnalysisFile) {
        const allEntered = attachAnalysisItems.every(
          (item) => String(attachLeadContentDrafts[item._id] ?? item.leadContent ?? "").trim() !== "",
        );
        await asbestosAssessmentService.updateAsbestosAssessment(attachAnalysisJob.id, {
          projectId:
            attachAnalysisJob.originalData?.projectId?._id ||
            attachAnalysisJob.originalData?.projectId,
          assessmentDate:
            attachAnalysisJob.originalData?.assessmentDate || attachAnalysisJob.surveyDate,
          status: allEntered ? "report-ready-for-review" : "sample-analysis-complete",
        });
      }

      await fetchJobs({ force: true });
      closeAttachAnalysisDialog();
      showSnackbar(
        uploadedNewAnalysisFile
          ? "Analysis and lead content saved."
          : "Lead content saved.",
        "success",
      );
    } catch (err) {
      console.error("Error saving attach analysis:", err);
      showSnackbar(err.response?.data?.message || "Failed to save analysis", "error");
    } finally {
      setAttachAnalysisSaving(false);
    }
  };

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Container maxWidth="xl">
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
              Lead Assessment Jobs
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateJob}
              sx={{
                minWidth: "220px",
                backgroundColor: colors.primary[700],
                color: colors.grey[100],
                "&:hover": { backgroundColor: colors.primary[800] },
              }}
            >
              New Assessment
            </Button>
          </Box>

          <Paper sx={{ width: "100%", overflow: "hidden" }}>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ fontWeight: "bold", maxWidth: "90px" }}>
                      Project ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", maxWidth: "195px" }}>
                      Project Name
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        width: "120px",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      Date
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "180px" }}>
                      Assessment Type
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "120px" }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
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
                        No lead assessments found
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
                        <TableCell sx={{ maxWidth: "90px" }}>
                          <Typography variant="body2" fontWeight="medium">
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
                                component="span"
                                display="block"
                              >
                                Client: {job.clientName}
                              </Typography>
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{
                            width: "120px",
                            minWidth: "120px",
                            maxWidth: "120px",
                          }}
                        >
                          <Typography variant="body2" >
                            {job.surveyDate
                              ? new Date(job.surveyDate).toLocaleDateString(
                                  "en-GB",
                                )
                              : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(job.assessmentType || []).length > 0 ? (
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                              {job.assessmentType.map((t) => {
                                const opt = ASSESSMENT_TYPE_OPTIONS.find((o) => o.value === t);
                                const color = opt?.chipColor ?? "#757575";
                                return (
                                  <Chip
                                    key={t}
                                    label={opt?.label || t}
                                    size="small"
                                    sx={{
                                      textTransform: "capitalize",
                                      backgroundColor: color,
                                      color: "white",
                                    }}
                                  />
                                );
                              })}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {!isAnalysisAttachComplete(job) && (
                            <Tooltip title="Attach Analysis">
                              <Button
                                size="small"
                                variant="contained"
                                sx={{
                                  mr: 1,
                                  textTransform: "none",
                                  backgroundColor: "#1976d2",
                                  color: "#fff",
                                  "&:hover": { backgroundColor: "#1565c0" },
                                }}
                                onClick={(e) => handleOpenAttachAnalysis(e, job)}
                              >
                                Attach Analysis
                              </Button>
                            </Tooltip>
                          )}
                          {(job.status === "report-ready-for-review" ||
                            job.status === "complete") && (
                            <Tooltip
                              title={
                                pdfWorkingJobId === job.id
                                  ? "Generating report..."
                                  : hasRetainedValidPdf(job)
                                    ? "Download report"
                                    : "Generate and download report"
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color={hasRetainedValidPdf(job) ? "success" : "warning"}
                                  onClick={(event) =>
                                    handleDownloadOrGenerateAssessmentReport(event, job)
                                  }
                                  disabled={pdfWorkingJobId === job.id}
                                  sx={{
                                    mr: 1,
                                    ...(pdfWorkingJobId === job.id && {
                                      "@keyframes pdfSpin": {
                                        "0%": { transform: "rotate(0deg)" },
                                        "100%": { transform: "rotate(360deg)" },
                                      },
                                      animation: "pdfSpin 1s linear infinite",
                                    }),
                                  }}
                                >
                                  <DownloadingIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit Assessment">
                            <IconButton
                              onClick={(e) => handleEditClick(e, job)}
                              color="primary"
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {hasPermission(currentUser, "asbestos.delete") && (
                            <Tooltip title="Delete Assessment">
                              <IconButton
                                onClick={(e) => handleDeleteClick(e, job)}
                                color="error"
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
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
        <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">New Lead Assessment</Typography>
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

            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>Assessment Type</InputLabel>
              <Select
                multiple
                value={assessmentType}
                onChange={(e) => {
                  const v = e.target.value;
                  setAssessmentType(typeof v === "string" ? v.split(",") : v);
                  setModalError(null);
                }}
                label="Assessment Type"
                renderValue={(selected) =>
                  selected
                    .map(
                      (s) =>
                        ASSESSMENT_TYPE_OPTIONS.find((o) => o.value === s)
                          ?.label || s,
                    )
                    .join(", ")
                }
              >
                {ASSESSMENT_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Checkbox
                      checked={assessmentType.indexOf(opt.value) > -1}
                    />
                    <ListItemText primary={opt.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Assessment Date"
              type="date"
              value={assessmentDate}
              onChange={(e) => {
                setAssessmentDate(e.target.value);
                if (assessmentDateError) setAssessmentDateError(false);
                setModalError(null);
              }}
              InputLabelProps={{ shrink: true }}
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

            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>State (Jurisdiction)</InputLabel>
              <Select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setModalError(null);
                }}
                label="State (Jurisdiction)"
              >
                {STATE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>Consultant</InputLabel>
              <Select
                value={selectedConsultant}
                onChange={(e) => {
                  setSelectedConsultant(e.target.value);
                  setModalError(null);
                }}
                label="Consultant"
              >
                {activeUsers.map((user) => {
                  const uid = user._id?.toString?.() || user._id;
                  const label = [user.firstName, user.lastName]
                    .filter(Boolean)
                    .join(" ") || user.email || uid;
                  return (
                    <MenuItem key={uid} value={uid}>
                      {label}
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
              helperText="Appears beneath the project site name on the cover page"
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
                !selectedConsultant ||
                modalLoading
              }
              sx={{
                backgroundColor: colors.primary[700],
                color: colors.grey[100],
                "&:hover": { backgroundColor: colors.primary[800] },
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
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Edit Lead Assessment</Typography>
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
              InputLabelProps={{ shrink: true }}
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
              <InputLabel>Assessment Type</InputLabel>
              <Select
                multiple
                value={editAssessmentType}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditAssessmentType(
                    typeof v === "string" ? v.split(",") : v,
                  );
                  setEditError(null);
                }}
                label="Assessment Type"
                renderValue={(selected) =>
                  selected
                    .map(
                      (s) =>
                        ASSESSMENT_TYPE_OPTIONS.find((o) => o.value === s)
                          ?.label || s,
                    )
                    .join(", ")
                }
              >
                {ASSESSMENT_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Checkbox
                      checked={editAssessmentType.indexOf(opt.value) > -1}
                    />
                    <ListItemText primary={opt.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>State (Jurisdiction)</InputLabel>
              <Select
                value={editState}
                onChange={(e) => {
                  setEditState(e.target.value);
                  setEditError(null);
                }}
                label="State (Jurisdiction)"
              >
                {STATE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>Consultant</InputLabel>
              <Select
                value={editConsultant}
                onChange={(e) => {
                  setEditConsultant(e.target.value);
                  setEditError(null);
                }}
                label="Consultant"
              >
                {activeUsers.map((user) => {
                  const uid = user._id?.toString?.() || user._id;
                  const label = [user.firstName, user.lastName]
                    .filter(Boolean)
                    .join(" ") || user.email || uid;
                  return (
                    <MenuItem key={uid} value={uid}>
                      {label}
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
              disabled={!editDate || !editConsultant || editLoading}
              sx={{
                backgroundColor: colors.primary[700],
                color: colors.grey[100],
                "&:hover": { backgroundColor: colors.primary[800] },
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
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Delete Lead Assessment</Typography>
              <IconButton onClick={handleDeleteCancel}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete this lead assessment?
            </Typography>
            {jobToDelete && (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "grey.100",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" fontWeight="bold">
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
            >
              {deleteLoading ? "Deleting..." : "Delete Assessment"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={attachAnalysisDialogOpen}
          onClose={() => {
            if (!attachAnalysisSaving) closeAttachAnalysisDialog();
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {hasAttachDialogAnalysisReport || attachAnalysisFile
              ? "View/Edit Analysis Content"
              : "Attach Analysis / Lead Content"}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
              {hasAttachDialogAnalysisReport || attachAnalysisFile
                ? "Review the analysis PDF, replace it if needed, and update lead content values."
                : "Upload the analysis PDF and update lead content values."}
            </Typography>
            {!attachAnalysisLoading &&
              (attachAnalysisPdfSrc ? (
                <Box
                  sx={{
                    mb: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "grey.100",
                  }}
                >
                  <Box
                    component="iframe"
                    title="Analysis report preview"
                    src={attachAnalysisPdfSrc}
                    sx={{ width: "100%", height: 420, border: 0, display: "block" }}
                  />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No analysis PDF is attached yet. Choose a PDF below.
                </Typography>
              ))}
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }} alignItems="center">
              <Button variant="outlined" component="label" size="small" sx={{ textTransform: "none" }}>
                {attachAnalysisFile
                  ? `Replace: ${attachAnalysisFile.name}`
                  : hasAttachDialogAnalysisReport
                    ? "Replace file"
                    : "Choose PDF file"}
                <input
                  type="file"
                  hidden
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachAnalysisFile(f);
                    e.target.value = "";
                  }}
                />
              </Button>
              {attachAnalysisFile && (
                <Button size="small" onClick={() => setAttachAnalysisFile(null)} sx={{ textTransform: "none" }}>
                  Cancel replacement
                </Button>
              )}
              {attachAnalysisPdfSrc && !attachAnalysisLoading && (
                <Button
                  size="small"
                  component="a"
                  href={attachAnalysisPdfSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textTransform: "none" }}
                >
                  Open in new tab
                </Button>
              )}
            </Stack>
            {attachAnalysisLoading ? (
              <Typography variant="body2" color="text.secondary">Loading samples...</Typography>
            ) : attachAnalysisItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No samples found for this assessment.</Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {attachAnalysisItems.map((item) => (
                  <Box key={item._id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ minWidth: 64 }}>
                      {item.sampleReference || "—"}
                    </Typography>
                    <TextField
                      size="small"
                      value={attachLeadContentDrafts[item._id] ?? ""}
                      onChange={(e) =>
                        setAttachLeadContentDrafts((prev) => ({
                          ...prev,
                          [item._id]: e.target.value,
                        }))
                      }
                      sx={{ width: 130 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            {getLeadContentUnit(item.materialType)}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAttachAnalysisDialog} disabled={attachAnalysisSaving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveAttachAnalysis}
              disabled={attachAnalysisSaving || attachAnalysisLoading}
            >
              {attachAnalysisSaving ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </PermissionGate>
  );
};

export default LeadAssessment;
