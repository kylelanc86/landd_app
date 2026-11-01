import React, { useEffect, useState } from "react";
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
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  Chip,
  Button,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  FormGroup,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Mail as MailIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { mycometerJobsService, userService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { hasPermission } from "../../config/permissions";
import { formatAuthoriserDisplayName } from "../../utils/formatters";
import { generateMycometerSurfaceFungiReport } from "../../utils/generateMycometerSurfaceFungiReport";
import { generateMycometerAirReport } from "../../utils/generateMycometerAirFaiReport";
import { getTodayInSydney } from "../../utils/dateUtils";
import {
  SAMPLE_TYPE_OPTIONS,
  SAMPLE_TYPE_SLUGS,
  SAMPLE_TYPE_COLORS,
  getOrderedScopeOfWorks,
  getSampleTypeReportStatus,
  PDF_SUPPORTED_SAMPLE_TYPES,
  getSamplerDisplayWithCertFromMeta,
  formatMycometerUserLabel,
  AIR_SAMPLING_TYPES,
  AIR_SAMPLING_LABEL,
  AIR_SAMPLING_SLUG,
  DEFAULT_AIR_FLOWMETER,
  isAirSamplingType,
} from "./mycometerConstants";

const getUserDisplayName = (user) => {
  if (!user) return "Unknown";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "Unknown";
};

const getUserId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const MycometerJobReports = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isAdmin } = usePermissions();
  const { jobId } = useParams();

  const [job, setJob] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reportViewedTypes, setReportViewedTypes] = useState(new Set());
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [authorisingReports, setAuthorisingReports] = useState({});
  const [sendingAuthorisation, setSendingAuthorisation] = useState({});
  const [savingFai, setSavingFai] = useState(false);

  const [addReportOpen, setAddReportOpen] = useState(false);
  const [reportDialogMode, setReportDialogMode] = useState("create");
  const [reportToEdit, setReportToEdit] = useState(null);
  const [reportType, setReportType] = useState("");
  const [airTypesSelected, setAirTypesSelected] = useState([]);
  const [sampledBy, setSampledBy] = useState("");
  const [sampleDate, setSampleDate] = useState(getTodayInSydney());
  const [savingReport, setSavingReport] = useState(false);
  const [reportFormError, setReportFormError] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deletingReport, setDeletingReport] = useState(false);

  const canEditReports = hasPermission(currentUser, "projects.edit");

  useEffect(() => {
    fetchJob();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchUsers = async () => {
    try {
      const response = await userService.getMycometerCertified();
      const usersData = (response.data || []).slice();
      usersData.sort((a, b) =>
        getUserDisplayName(a).localeCompare(getUserDisplayName(b)),
      );
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching mycometer-certified users:", err);
    }
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await mycometerJobsService.getById(jobId);
      const jobData = response.data;
      setJob(jobData);

      const viewed = new Set();
      (jobData?.analysisMeta || []).forEach((meta) => {
        if (meta.reportViewedAt && meta.sampleType) {
          viewed.add(meta.sampleType);
        }
      });
      setReportViewedTypes(viewed);
    } catch (err) {
      console.error("Error loading mycometer job:", err);
      setError(
        err.response?.data?.message || "Failed to load job. Please try again.",
      );
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  const scopeTypes = getOrderedScopeOfWorks(job?.scopeOfWorks);
  const airTypesOnJob = scopeTypes.filter((type) => isAirSamplingType(type));
  const reports = scopeTypes.filter(
    (type) => !isAirSamplingType(type) && type !== "Air FAI",
  );
  if (airTypesOnJob.length > 0) {
    reports.push(AIR_SAMPLING_LABEL);
  }
  const availableReportTypes = [
    ...SAMPLE_TYPE_OPTIONS.filter(
      (type) =>
        type === "Surface Fungi" && !(job?.scopeOfWorks || []).includes(type),
    ),
    ...(airTypesOnJob.length === 0 ? [AIR_SAMPLING_LABEL] : []),
  ];

  const getAnalysisMeta = (sampleType) =>
    (job?.analysisMeta || []).find((item) => item.sampleType === sampleType);

  const getSamplingMeta = (sampleType) =>
    (job?.samplingMeta || []).find((item) => item.sampleType === sampleType);

  const getSampleIdsForType = (sampleType) =>
    (job?.samples || [])
      .filter((sample) => sample.sampleType === sampleType)
      .map((sample) => sample.sampleId)
      .filter(Boolean);

  const getSamplerDisplayName = (sampleType) => {
    const type =
      sampleType === AIR_SAMPLING_LABEL ? "Air Fungi" : sampleType;
    const meta = getSamplingMeta(type);
    return meta ? getSamplerDisplayWithCertFromMeta(meta, type) : "";
  };

  const handleOpenAddReport = () => {
    setReportDialogMode("create");
    setReportToEdit(null);
    setReportType(availableReportTypes[0] || "");
    setAirTypesSelected([]);
    const defaultSampler = users.some((user) => user._id === currentUser?._id)
      ? currentUser._id
      : "";
    setSampledBy(defaultSampler);
    setSampleDate(getTodayInSydney());
    setReportFormError("");
    setAddReportOpen(true);
  };

  const handleOpenEditReport = (sampleType, event) => {
    event?.stopPropagation();
    const metaType =
      sampleType === AIR_SAMPLING_LABEL
        ? airTypesOnJob.includes("Air Fungi")
          ? "Air Fungi"
          : airTypesOnJob[0]
        : sampleType;
    const meta = getSamplingMeta(metaType);
    setReportDialogMode("edit");
    setReportToEdit(sampleType);
    setReportType(sampleType);
    setAirTypesSelected(
      sampleType === AIR_SAMPLING_LABEL ? [...airTypesOnJob] : [],
    );
    const existingSampler = getUserId(meta?.sampledBy);
    const defaultSampler = users.some((user) => user._id === currentUser?._id)
      ? currentUser._id
      : "";
    setSampledBy(existingSampler || defaultSampler);
    setSampleDate(
      meta?.sampleDate ? formatDateInput(meta.sampleDate) : getTodayInSydney(),
    );
    setReportFormError("");
    setAddReportOpen(true);
  };

  const handleCloseAddReport = ({ force = false } = {}) => {
    if (savingReport && !force) return;
    setAddReportOpen(false);
    setReportDialogMode("create");
    setReportToEdit(null);
    setReportFormError("");
  };

  const handleSaveReport = async () => {
    if (reportDialogMode === "create" && !reportType) {
      setReportFormError("Please select a report type.");
      return;
    }
    if (
      (reportType === AIR_SAMPLING_LABEL || reportToEdit === AIR_SAMPLING_LABEL) &&
      airTypesSelected.length === 0
    ) {
      setReportFormError(
        "Select Air Fungi, Air Allergen, or both.",
      );
      return;
    }
    if (!sampledBy) {
      setReportFormError("Please select a sampler.");
      return;
    }
    if (!sampleDate) {
      setReportFormError("Please enter a sampling date.");
      return;
    }

    try {
      setSavingReport(true);
      setReportFormError("");

      if (reportDialogMode === "edit" && reportToEdit) {
        if (reportToEdit === AIR_SAMPLING_LABEL) {
          const removed = airTypesOnJob.filter(
            (type) => !airTypesSelected.includes(type),
          );
          const added = airTypesSelected.filter(
            (type) => !airTypesOnJob.includes(type),
          );
          const kept = airTypesSelected.filter((type) =>
            airTypesOnJob.includes(type),
          );
          for (const type of removed) {
            await mycometerJobsService.deleteReport(jobId, type);
          }
          for (const type of kept) {
            await mycometerJobsService.updateReport(jobId, type, {
              sampledBy,
              sampleDate,
            });
          }
          if (added.length > 0) {
            await mycometerJobsService.addReport(jobId, {
              sampleTypes: added,
              sampledBy,
              sampleDate,
              flowmeter: DEFAULT_AIR_FLOWMETER,
            });
          }
        } else {
          await mycometerJobsService.updateReport(jobId, reportToEdit, {
            sampledBy,
            sampleDate,
          });
        }
        await fetchJob();
        setSavingReport(false);
        handleCloseAddReport({ force: true });
        setSuccessMessage(`${reportToEdit} report updated.`);
      } else if (reportType === AIR_SAMPLING_LABEL) {
        await mycometerJobsService.addReport(jobId, {
          sampleTypes: airTypesSelected,
          sampledBy,
          sampleDate,
          flowmeter: DEFAULT_AIR_FLOWMETER,
        });
        await fetchJob();
        setSavingReport(false);
        handleCloseAddReport({ force: true });
        setSuccessMessage("Air Sampling report added.");
      } else {
        await mycometerJobsService.addReport(jobId, {
          sampleType: reportType,
          sampledBy,
          sampleDate,
        });
        await fetchJob();
        setSavingReport(false);
        handleCloseAddReport({ force: true });
        setSuccessMessage(`${reportType} report added.`);
      }
    } catch (err) {
      console.error("Error saving Mycometer report:", err);
      setReportFormError(
        err.response?.data?.message ||
          "Failed to save report. Please try again.",
      );
      setSavingReport(false);
    }
  };

  const handleOpenDeleteDialog = (sampleType, event) => {
    event?.stopPropagation();
    setReportToDelete(sampleType);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (deletingReport) return;
    setDeleteDialogOpen(false);
    setReportToDelete(null);
  };

  const handleConfirmDeleteReport = async () => {
    if (!reportToDelete) return;

    try {
      setDeletingReport(true);
      setError("");
      if (reportToDelete === AIR_SAMPLING_LABEL) {
        for (const type of airTypesOnJob) {
          await mycometerJobsService.deleteReport(jobId, type);
        }
      } else {
        await mycometerJobsService.deleteReport(jobId, reportToDelete);
      }
      await fetchJob();
      setSuccessMessage(`${reportToDelete} report deleted.`);
      handleCloseDeleteDialog();
    } catch (err) {
      console.error("Error deleting Mycometer report:", err);
      setError(
        err.response?.data?.message ||
          "Failed to delete report. Please try again.",
      );
    } finally {
      setDeletingReport(false);
    }
  };

  const handleOpenReport = (sampleType) => {
    if (sampleType === AIR_SAMPLING_LABEL) {
      navigate(`/mycometer-sampling/${jobId}/${AIR_SAMPLING_SLUG}`);
      return;
    }
    const slug = SAMPLE_TYPE_SLUGS[sampleType];
    if (!slug) return;
    navigate(`/mycometer-sampling/${jobId}/${slug}`);
  };

  const handleGeneratePDF = async (sampleType, { download = false } = {}) => {
    if (!PDF_SUPPORTED_SAMPLE_TYPES.includes(sampleType)) {
      setError(
        "PDF reports are currently only available for Surface Fungi, Air Fungi, and Air Allergen.",
      );
      return;
    }

    try {
      setGeneratingPDF((prev) => ({ ...prev, [sampleType]: true }));
      setError("");
      const response = await mycometerJobsService.getById(jobId);
      const jobData = response.data;
      const samplingMeta = (jobData.samplingMeta || []).find(
        (item) => item.sampleType === sampleType,
      );
      const analysisMeta = (jobData.analysisMeta || []).find(
        (item) => item.sampleType === sampleType,
      );
      const typeSamples = (jobData.samples || []).filter(
        (sample) => sample.sampleType === sampleType,
      );

      const reportArgs = {
        job: jobData,
        samples: typeSamples,
        samplingMeta,
        analysisMeta,
        project: jobData.projectId,
        openInNewTab: !download,
      };

      const isAirReport =
        sampleType === "Air Fungi" || sampleType === "Air Allergen";
      if (isAirReport) {
        await generateMycometerAirReport({
          job: jobData,
          project: jobData.projectId,
          openInNewTab: !download,
        });
      } else {
        await generateMycometerSurfaceFungiReport(reportArgs);
      }

      const viewedAt = new Date().toISOString();
      const typesToMark = isAirReport
        ? (jobData.scopeOfWorks || []).filter((type) =>
            ["Air Fungi", "Air Allergen"].includes(type),
          )
        : [sampleType];
      setReportViewedTypes((prev) => {
        const next = new Set(prev);
        typesToMark.forEach((type) => next.add(type));
        return next;
      });
      setJob((prev) => {
        if (!prev) return prev;
        const nextMeta = [...(prev.analysisMeta || [])];
        typesToMark.forEach((type) => {
          const idx = nextMeta.findIndex((item) => item.sampleType === type);
          if (idx >= 0) {
            nextMeta[idx] = {
              ...nextMeta[idx],
              reportViewedAt: viewedAt,
            };
          }
        });
        return { ...prev, analysisMeta: nextMeta };
      });
      for (const type of typesToMark) {
        try {
          await mycometerJobsService.markReportViewed(jobId, type, {
            reportViewedAt: viewedAt,
          });
        } catch (viewErr) {
          console.warn("Failed to persist report viewed:", viewErr);
        }
      }
    } catch (err) {
      console.error("Error generating Mycometer PDF:", err);
      setError(
        err.response?.data?.message ||
          "Failed to generate PDF report. Please try again.",
      );
    } finally {
      setGeneratingPDF((prev) => ({ ...prev, [sampleType]: false }));
    }
  };

  const airReportTypesFor = (sampleType) =>
    sampleType === AIR_SAMPLING_LABEL ? airTypesOnJob : [sampleType];

  const handleToggleFai = async (checked) => {
    const previous = job?.includeFaiOnReport;
    setJob((prev) => (prev ? { ...prev, includeFaiOnReport: checked } : prev));
    try {
      setSavingFai(true);
      setError("");
      const response = await mycometerJobsService.update(jobId, {
        includeFaiOnReport: checked,
      });
      setJob(response.data);
    } catch (err) {
      setJob((prev) =>
        prev ? { ...prev, includeFaiOnReport: previous } : prev,
      );
      setError(
        err.response?.data?.message ||
          "Failed to update the FAI report option.",
      );
    } finally {
      setSavingFai(false);
    }
  };

  const handleAuthoriseReport = async (sampleType) => {
    const types = airReportTypesFor(sampleType);
    try {
      setAuthorisingReports((prev) => ({ ...prev, [sampleType]: true }));
      setError("");
      let notified = false;
      for (const type of types) {
        const meta = (job?.analysisMeta || []).find(
          (item) => item.sampleType === type,
        );
        if (meta?.reportApprovedBy) continue;
        await mycometerJobsService.authorise(jobId, type, {
          notify: !notified,
          reportLabel:
            types.length > 1 ? "Mycometer Air Sampling report" : undefined,
        });
        notified = true;
      }
      await fetchJob();
      await handleGeneratePDF(types[0], { download: true });
      setSuccessMessage("Report authorised successfully.");
    } catch (err) {
      console.error("Error authorising Mycometer report:", err);
      setError(
        err.response?.data?.message ||
          "Failed to authorise report. Please try again.",
      );
    } finally {
      setAuthorisingReports((prev) => ({ ...prev, [sampleType]: false }));
    }
  };

  const handleSendForAuthorisation = async (sampleType) => {
    const types = airReportTypesFor(sampleType);
    try {
      setSendingAuthorisation((prev) => ({ ...prev, [sampleType]: true }));
      setError("");
      let notified = false;
      let message = "";
      for (const type of types) {
        const meta = (job?.analysisMeta || []).find(
          (item) => item.sampleType === type,
        );
        if (meta?.reportApprovedBy) continue;
        const response = await mycometerJobsService.sendForAuthorisation(
          jobId,
          type,
          {
            notify: !notified,
            reportLabel: types.length > 1 ? "Air Sampling" : undefined,
          },
        );
        if (!notified) message = response.data?.message || "";
        notified = true;
      }
      setJob((prev) => {
        if (!prev) return prev;
        const nextMeta = [...(prev.analysisMeta || [])];
        types.forEach((type) => {
          const idx = nextMeta.findIndex((item) => item.sampleType === type);
          if (idx >= 0 && !nextMeta[idx].reportApprovedBy) {
            nextMeta[idx] = {
              ...nextMeta[idx],
              authorisationRequestedBy: currentUser?._id || true,
            };
          }
        });
        return { ...prev, analysisMeta: nextMeta };
      });
      setSuccessMessage(
        message || "Authorisation request emails sent successfully.",
      );
    } catch (err) {
      console.error("Error sending Mycometer authorisation request:", err);
      setError(
        err.response?.data?.message ||
          "Failed to send authorisation request. Please try again.",
      );
    } finally {
      setSendingAuthorisation((prev) => ({ ...prev, [sampleType]: false }));
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 2 }}>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate("/mycometer-sampling")}
              sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            >
              <ArrowBackIcon sx={{ mr: 1 }} />
              Mycometer Sampling Jobs
            </Link>
          </Breadcrumbs>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h4" component="h1" sx={{ mb: 0.25 }}>
                Mycometer Reports
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 0 }}>
                {job?.projectId?.projectID
                  ? `${job.projectId.projectID} — ${job.projectId.name || "Unnamed Project"}`
                  : job?.projectId?.name || "Mycometer Job"}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddReport}
              disabled={!job || availableReportTypes.length === 0}
              sx={{ textTransform: "none", minWidth: 160, flexShrink: 0 }}
            >
              Add Report
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setSuccessMessage("")}
          >
            {successMessage}
          </Alert>
        )}

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
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Report Type
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Sample Date
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    FAI
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "white",
                      fontWeight: "bold",
                      display: { xs: "none", md: "table-cell" },
                    }}
                  >
                    Report Actions
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "white",
                      fontWeight: "bold",
                      width: 100,
                    }}
                    align="right"
                  >
                    Manage
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!job ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Job not found.
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No reports yet. Click Add Report to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((sampleType) => {
                    const isAirRow = sampleType === AIR_SAMPLING_LABEL;
                    const detailType = isAirRow
                      ? airTypesOnJob.includes("Air Fungi")
                        ? "Air Fungi"
                        : airTypesOnJob[0]
                      : sampleType;
                    const airSamplingComplete =
                      isAirRow &&
                      airTypesOnJob.length > 0 &&
                      airTypesOnJob.every(
                        (type) => getSamplingMeta(type)?.samplingComplete,
                      );
                    const airAnalysisComplete =
                      isAirRow &&
                      airTypesOnJob.length > 0 &&
                      airTypesOnJob.every(
                        (type) => getAnalysisMeta(type)?.analysisComplete,
                      );
                    const airHasSamples =
                      isAirRow &&
                      airTypesOnJob.some(
                        (type) => getSampleIdsForType(type).length > 0,
                      );
                    const status = isAirRow
                      ? !airHasSamples
                        ? { label: "", chipColor: null }
                        : airAnalysisComplete
                          ? {
                              label: "Analysis Complete",
                              chipColor: "#2e7d32",
                            }
                          : airSamplingComplete
                            ? {
                                label: "Sampling Complete",
                                chipColor: "#ed6c02",
                              }
                            : {
                                label: "Sampling In Progress",
                                chipColor: "#1976d2",
                              }
                      : getSampleTypeReportStatus(job, detailType);
                    const analysisMeta = getAnalysisMeta(detailType);
                    const typeColors =
                      SAMPLE_TYPE_COLORS[detailType] ||
                      SAMPLE_TYPE_COLORS["Air Fungi"];
                    const isAnalysisComplete = isAirRow
                      ? airAnalysisComplete
                      : Boolean(analysisMeta?.analysisComplete);
                    const airApprovers = isAirRow
                      ? airTypesOnJob
                          .map((type) => getAnalysisMeta(type)?.reportApprovedBy)
                          .filter(Boolean)
                      : [];
                    const reportApprovedBy = isAirRow
                      ? airApprovers.length === airTypesOnJob.length
                        ? airApprovers[0]
                        : ""
                      : analysisMeta?.reportApprovedBy;
                    const samplingMeta = getSamplingMeta(detailType);
                    const actionTypes = isAirRow
                      ? []
                      : [sampleType];
                    const canIncludeFai =
                      isAirRow &&
                      airTypesOnJob.includes("Air Fungi") &&
                      airTypesOnJob.includes("Air Allergen");
                    const faiChecked =
                      typeof job?.includeFaiOnReport === "boolean"
                        ? job.includeFaiOnReport
                        : (job?.scopeOfWorks || []).includes("Air FAI");
                    const airPendingTypes = isAirRow
                      ? airTypesOnJob.filter((type) => {
                          const meta = getAnalysisMeta(type);
                          return (
                            meta?.analysisComplete && !meta?.reportApprovedBy
                          );
                        })
                      : [];
                    const airReportViewed =
                      isAirRow &&
                      airTypesOnJob.length > 0 &&
                      airTypesOnJob.every(
                        (type) =>
                          reportViewedTypes.has(type) ||
                          Boolean(getAnalysisMeta(type)?.reportViewedAt),
                      );
                    const airAuthorisationSent =
                      airPendingTypes.length > 0 &&
                      airPendingTypes.every((type) =>
                        Boolean(
                          getAnalysisMeta(type)?.authorisationRequestedBy,
                        ),
                      );

                    return (
                      <TableRow
                        key={sampleType}
                        hover
                        onClick={() => handleOpenReport(sampleType)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: typeColors.color,
                            }}
                          >
                            {sampleType}
                          </Typography>
                          {isAirRow && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {airTypesOnJob.join(", ")}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {samplingMeta?.sampleDate
                              ? new Date(
                                  samplingMeta.sampleDate,
                                ).toLocaleDateString("en-AU")
                              : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          {canIncludeFai ? (
                            <Checkbox
                              size="small"
                              checked={faiChecked}
                              disabled={savingFai || !canEditReports}
                              onChange={(event) =>
                                handleToggleFai(event.target.checked)
                              }
                              inputProps={{ "aria-label": "Include FAI in report" }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {status.label ? (
                            <Chip
                              label={status.label}
                              size="small"
                              sx={{
                                backgroundColor: status.chipColor,
                                color: "white",
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                          {reportApprovedBy ? (
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{
                                mt: 0.5,
                                fontWeight: "medium",
                                color: "#2e7d32",
                                fontStyle: "italic",
                              }}
                            >
                              ✓ Authorised by{" "}
                              {formatAuthoriserDisplayName(reportApprovedBy)}
                            </Typography>
                          ) : (
                            isAnalysisComplete && (
                              <Typography
                                variant="caption"
                                display="block"
                                sx={{
                                  mt: 0.5,
                                  color: "error.main",
                                  fontSize: "0.7rem",
                                }}
                              >
                                Not approved
                              </Typography>
                            )
                          )}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                          >
                            {isAirRow && airAnalysisComplete && (
                              <Button
                                variant="outlined"
                                size="small"
                                disabled={airTypesOnJob.some(
                                  (type) => generatingPDF[type],
                                )}
                                onClick={() =>
                                  handleGeneratePDF(airTypesOnJob[0])
                                }
                                sx={{
                                  borderColor: theme.palette.success.main,
                                  color: theme.palette.success.main,
                                  "&:hover": {
                                    borderColor: theme.palette.success.dark,
                                    backgroundColor:
                                      theme.palette.success.light,
                                  },
                                }}
                                startIcon={
                                  airTypesOnJob.some(
                                    (type) => generatingPDF[type],
                                  ) ? (
                                    <CircularProgress
                                      size={16}
                                      color="success"
                                    />
                                  ) : null
                                }
                              >
                                {airTypesOnJob.some(
                                  (type) => generatingPDF[type],
                                )
                                  ? "Generating…"
                                  : reportApprovedBy
                                    ? "Download Report"
                                    : "View Report"}
                              </Button>
                            )}
                            {isAirRow &&
                              airAnalysisComplete &&
                              !reportApprovedBy &&
                              airReportViewed &&
                              canEditReports &&
                              (currentUser?.reportProofer ? (
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="success"
                                  onClick={() =>
                                    handleAuthoriseReport(AIR_SAMPLING_LABEL)
                                  }
                                  disabled={
                                    authorisingReports[AIR_SAMPLING_LABEL] ||
                                    airTypesOnJob.some(
                                      (type) => generatingPDF[type],
                                    )
                                  }
                                  sx={{
                                    backgroundColor: theme.palette.success.main,
                                    color: theme.palette.common.white,
                                    "&:hover": {
                                      backgroundColor:
                                        theme.palette.success.dark,
                                    },
                                  }}
                                >
                                  {authorisingReports[AIR_SAMPLING_LABEL]
                                    ? "Authorising..."
                                    : "Authorise"}
                                </Button>
                              ) : (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color={
                                    airAuthorisationSent ? "inherit" : "primary"
                                  }
                                  startIcon={<MailIcon />}
                                  onClick={() =>
                                    handleSendForAuthorisation(
                                      AIR_SAMPLING_LABEL,
                                    )
                                  }
                                  disabled={Boolean(
                                    sendingAuthorisation[AIR_SAMPLING_LABEL],
                                  )}
                                  sx={
                                    airAuthorisationSent
                                      ? {
                                          color: "text.secondary",
                                          borderColor: "grey.400",
                                        }
                                      : undefined
                                  }
                                >
                                  {sendingAuthorisation[AIR_SAMPLING_LABEL]
                                    ? "Sending..."
                                    : airAuthorisationSent
                                      ? "Re-send for Authorisation"
                                      : "Send for Authorisation"}
                                </Button>
                              ))}
                            {actionTypes.map((actionType) => {
                              const actionMeta = getAnalysisMeta(actionType);
                              const actionApproved = actionMeta?.reportApprovedBy;
                              const actionAnalysisComplete = Boolean(
                                actionMeta?.analysisComplete,
                              );
                              if (!actionAnalysisComplete) return null;
                              if (
                                !PDF_SUPPORTED_SAMPLE_TYPES.includes(actionType)
                              ) {
                                return null;
                              }
                              return (
                              <Box key={actionType} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                              {actionAnalysisComplete &&
                              PDF_SUPPORTED_SAMPLE_TYPES.includes(
                                actionType,
                              ) && (
                                <>
                                  {!isAirRow && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={Boolean(
                                      generatingPDF[actionType],
                                    )}
                                    onClick={() =>
                                      handleGeneratePDF(actionType)
                                    }
                                    sx={{
                                      borderColor: theme.palette.success.main,
                                      color: theme.palette.success.main,
                                      "&:hover": {
                                        borderColor: theme.palette.success.dark,
                                        backgroundColor:
                                          theme.palette.success.light,
                                      },
                                    }}
                                    startIcon={
                                      generatingPDF[actionType] ? (
                                        <CircularProgress
                                          size={16}
                                          color="success"
                                        />
                                      ) : null
                                    }
                                  >
                                    {generatingPDF[actionType]
                                      ? "Generating…"
                                      : actionApproved
                                        ? "Download Report"
                                        : "View Report"}
                                  </Button>
                                  )}
                                  {(() => {
                                    const conditions = {
                                      notApproved: !actionApproved,
                                      reportViewed:
                                        reportViewedTypes.has(actionType) ||
                                        !!actionMeta?.reportViewedAt,
                                      alreadySentForAuthorisation:
                                        !!actionMeta?.authorisationRequestedBy,
                                      hasEditPermission: hasPermission(
                                        currentUser,
                                        "projects.edit",
                                      ),
                                      isReportProofer: Boolean(
                                        currentUser?.reportProofer,
                                      ),
                                    };
                                    const baseVisible =
                                      conditions.notApproved &&
                                      conditions.reportViewed;
                                    const showAuthorise =
                                      baseVisible &&
                                      conditions.isReportProofer &&
                                      conditions.hasEditPermission;
                                    const showSend =
                                      baseVisible &&
                                      !conditions.isReportProofer &&
                                      conditions.hasEditPermission;

                                    return (
                                      <>
                                        {showAuthorise && (
                                          <Button
                                            variant="contained"
                                            size="small"
                                            color="success"
                                            onClick={() =>
                                              handleAuthoriseReport(actionType)
                                            }
                                            disabled={
                                              authorisingReports[actionType] ||
                                              generatingPDF[actionType]
                                            }
                                            sx={{
                                              backgroundColor:
                                                theme.palette.success.main,
                                              color: theme.palette.common.white,
                                              "&:hover": {
                                                backgroundColor:
                                                  theme.palette.success.dark,
                                              },
                                            }}
                                          >
                                            {authorisingReports[actionType]
                                              ? "Authorising..."
                                              : "Authorise"}
                                          </Button>
                                        )}
                                        {showSend && (
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            color={
                                              conditions.alreadySentForAuthorisation
                                                ? "inherit"
                                                : "primary"
                                            }
                                            startIcon={<MailIcon />}
                                            onClick={() =>
                                              handleSendForAuthorisation(
                                                actionType,
                                              )
                                            }
                                            disabled={Boolean(
                                              sendingAuthorisation[actionType],
                                            )}
                                            sx={
                                              conditions.alreadySentForAuthorisation
                                                ? {
                                                    color: "text.secondary",
                                                    borderColor: "grey.400",
                                                  }
                                                : undefined
                                            }
                                          >
                                            {sendingAuthorisation[actionType]
                                              ? "Sending..."
                                              : conditions.alreadySentForAuthorisation
                                                ? "Re-send for Authorisation"
                                                : "Send for Authorisation"}
                                          </Button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </>
                              )}
                              </Box>
                              );
                            })}
                          </Box>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          {canEditReports && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => handleOpenEditReport(sampleType, e)}
                              aria-label={`Edit ${sampleType} report`}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )}
                          {isAdmin && (
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) =>
                                handleOpenDeleteDialog(sampleType, e)
                              }
                              aria-label={`Delete ${sampleType} report`}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
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
        open={addReportOpen}
        onClose={handleCloseAddReport}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {reportDialogMode === "edit"
            ? "Edit Mycometer Report"
            : "Add Mycometer Report"}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
            }}
          >
            {reportFormError && (
              <Typography variant="body2" color="error">
                {reportFormError}
              </Typography>
            )}
            {reportDialogMode === "edit" ? (
              <TextField
                label="Report Type"
                value={reportType}
                fullWidth
                disabled
              />
            ) : (
              <FormControl fullWidth required>
                <InputLabel id="report-type-label">Report Type</InputLabel>
                <Select
                  labelId="report-type-label"
                  label="Report Type"
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value);
                    if (reportFormError) setReportFormError("");
                  }}
                >
                  {availableReportTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {(reportType === AIR_SAMPLING_LABEL ||
              reportToEdit === AIR_SAMPLING_LABEL) && (
              <FormControl component="fieldset" required>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Include
                </Typography>
                <FormGroup>
                  {AIR_SAMPLING_TYPES.map((type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Checkbox
                          checked={airTypesSelected.includes(type)}
                          onChange={(event) => {
                            setAirTypesSelected((current) =>
                              event.target.checked
                                ? [...current, type]
                                : current.filter((item) => item !== type),
                            );
                            if (reportFormError) setReportFormError("");
                          }}
                        />
                      }
                      label={type}
                    />
                  ))}
                </FormGroup>
              </FormControl>
            )}
            <FormControl fullWidth required>
              <InputLabel id="sampler-label">Sampler</InputLabel>
              <Select
                labelId="sampler-label"
                label="Sampler"
                value={sampledBy}
                onChange={(e) => {
                  setSampledBy(e.target.value);
                  if (reportFormError) setReportFormError("");
                }}
              >
                {users.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {formatMycometerUserLabel(
                      user,
                      reportType === "Surface Fungi" ||
                        reportToEdit === "Surface Fungi"
                        ? "Surface Fungi"
                        : "Air Fungi",
                    )}
                  </MenuItem>
                ))}
                {sampledBy &&
                  !users.some(
                    (user) => String(user._id) === String(sampledBy),
                  ) && (
                    <MenuItem value={sampledBy}>
                      {getSamplerDisplayName(reportToEdit || reportType) ||
                        "Unknown user"}
                    </MenuItem>
                  )}
              </Select>
            </FormControl>
            <TextField
              label="Sampling Date"
              type="date"
              value={sampleDate}
              onChange={(e) => {
                setSampleDate(e.target.value);
                if (reportFormError) setReportFormError("");
              }}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAddReport} disabled={savingReport}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveReport}
            disabled={
              savingReport ||
              (reportDialogMode === "create" && availableReportTypes.length === 0)
            }
            startIcon={savingReport ? <CircularProgress size={16} /> : null}
          >
            {reportDialogMode === "edit" ? "Save Changes" : "Add Report"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the{" "}
            <strong>{reportToDelete}</strong> report? All samples and analysis
            data for this report will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deletingReport}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteReport}
            color="error"
            variant="contained"
            disabled={deletingReport}
            startIcon={deletingReport ? <CircularProgress size={16} /> : null}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MycometerJobReports;
