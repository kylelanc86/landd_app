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
import { generateMycometerAirFungiReport } from "../../utils/generateMycometerAirFungiReport";
import { generateMycometerAirAllergenReport } from "../../utils/generateMycometerAirAllergenReport";
import { getTodayInSydney } from "../../utils/dateUtils";
import {
  SAMPLE_TYPE_OPTIONS,
  SAMPLE_TYPE_SLUGS,
  SAMPLE_TYPE_COLORS,
  getOrderedScopeOfWorks,
  getSampleTypeReportStatus,
  PDF_SUPPORTED_SAMPLE_TYPES,
  getSamplerDisplayNameFromMeta,
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

  const [addReportOpen, setAddReportOpen] = useState(false);
  const [reportDialogMode, setReportDialogMode] = useState("create");
  const [reportToEdit, setReportToEdit] = useState(null);
  const [reportType, setReportType] = useState("");
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

  const reports = getOrderedScopeOfWorks(job?.scopeOfWorks);
  const availableReportTypes = SAMPLE_TYPE_OPTIONS.filter(
    (type) => !(job?.scopeOfWorks || []).includes(type),
  );

  const getAnalysisMeta = (sampleType) =>
    (job?.analysisMeta || []).find((item) => item.sampleType === sampleType);

  const getSamplingMeta = (sampleType) =>
    (job?.samplingMeta || []).find((item) => item.sampleType === sampleType);

  const getSampleIdsForType = (sampleType) =>
    (job?.samples || [])
      .filter((sample) => sample.sampleType === sampleType)
      .map((sample) => sample.sampleId)
      .filter(Boolean);

  const getSamplerDisplayName = (sampleType) =>
    getSamplerDisplayNameFromMeta(getSamplingMeta(sampleType));

  const handleOpenAddReport = () => {
    setReportDialogMode("create");
    setReportToEdit(null);
    setReportType(availableReportTypes[0] || "");
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
    const meta = getSamplingMeta(sampleType);
    setReportDialogMode("edit");
    setReportToEdit(sampleType);
    setReportType(sampleType);
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
        await mycometerJobsService.updateReport(jobId, reportToEdit, {
          sampledBy,
          sampleDate,
        });
        await fetchJob();
        setSavingReport(false);
        handleCloseAddReport({ force: true });
        setSuccessMessage(`${reportToEdit} report updated.`);
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
      await mycometerJobsService.deleteReport(jobId, reportToDelete);
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

      if (sampleType === "Air Fungi") {
        await generateMycometerAirFungiReport(reportArgs);
      } else if (sampleType === "Air Allergen") {
        await generateMycometerAirAllergenReport(reportArgs);
      } else {
        await generateMycometerSurfaceFungiReport(reportArgs);
      }

      setReportViewedTypes((prev) => new Set(prev).add(sampleType));
      try {
        await mycometerJobsService.markReportViewed(jobId, sampleType, {
          reportViewedAt: new Date().toISOString(),
        });
        setJob((prev) => {
          if (!prev) return prev;
          const nextMeta = [...(prev.analysisMeta || [])];
          const idx = nextMeta.findIndex(
            (item) => item.sampleType === sampleType,
          );
          if (idx >= 0) {
            nextMeta[idx] = {
              ...nextMeta[idx],
              reportViewedAt: new Date().toISOString(),
            };
          }
          return { ...prev, analysisMeta: nextMeta };
        });
      } catch (viewErr) {
        console.warn("Failed to persist report viewed:", viewErr);
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

  const handleAuthoriseReport = async (sampleType) => {
    try {
      setAuthorisingReports((prev) => ({ ...prev, [sampleType]: true }));
      setError("");
      await mycometerJobsService.authorise(jobId, sampleType);
      await fetchJob();
      await handleGeneratePDF(sampleType, { download: true });
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
    try {
      setSendingAuthorisation((prev) => ({ ...prev, [sampleType]: true }));
      setError("");
      const response = await mycometerJobsService.sendForAuthorisation(
        jobId,
        sampleType,
      );
      setJob((prev) => {
        if (!prev) return prev;
        const nextMeta = [...(prev.analysisMeta || [])];
        const idx = nextMeta.findIndex(
          (item) => item.sampleType === sampleType,
        );
        if (idx >= 0) {
          nextMeta[idx] = {
            ...nextMeta[idx],
            authorisationRequestedBy: currentUser?._id || true,
          };
        }
        return { ...prev, analysisMeta: nextMeta };
      });
      setSuccessMessage(
        response.data?.message ||
          "Authorisation request emails sent successfully.",
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
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Mycometer Reports
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1 }}>
            {job?.projectId?.projectID
              ? `${job.projectId.projectID} — ${job.projectId.name || "Unnamed Project"}`
              : job?.projectId?.name || "Mycometer Job"}
          </Typography>
          <Breadcrumbs>
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
          <Box
            sx={{
              p: 2,
              pb: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Reports
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddReport}
              disabled={!job || availableReportTypes.length === 0}
              sx={{ textTransform: "none", mb: 1 }}
            >
              Add Report
            </Button>
          </Box>
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
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "white",
                      fontWeight: "bold",
                      display: { xs: "none", md: "table-cell" },
                    }}
                  >
                    Sample IDs
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
                    <TableCell colSpan={5} align="center">
                      Job not found.
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No reports yet. Click Add Report to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((sampleType) => {
                    const status = getSampleTypeReportStatus(job, sampleType);
                    const analysisMeta = getAnalysisMeta(sampleType);
                    const sampleIds = getSampleIdsForType(sampleType);
                    const typeColors =
                      SAMPLE_TYPE_COLORS[sampleType] ||
                      SAMPLE_TYPE_COLORS["Surface Fungi"];
                    const isAnalysisComplete = Boolean(
                      analysisMeta?.analysisComplete,
                    );
                    const reportApprovedBy = analysisMeta?.reportApprovedBy;
                    const samplerName = getSamplerDisplayName(sampleType);

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
                          {getSamplingMeta(sampleType)?.sampleDate && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              Sample date:{" "}
                              {new Date(
                                getSamplingMeta(sampleType).sampleDate,
                              ).toLocaleDateString("en-AU")}
                              {samplerName ? ` · ${samplerName}` : ""}
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
                        >
                          {sampleIds.length > 0 ? sampleIds.join(", ") : "—"}
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
                            {isAnalysisComplete &&
                              PDF_SUPPORTED_SAMPLE_TYPES.includes(
                                sampleType,
                              ) && (
                                <>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={Boolean(
                                      generatingPDF[sampleType],
                                    )}
                                    onClick={() =>
                                      handleGeneratePDF(sampleType)
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
                                      generatingPDF[sampleType] ? (
                                        <CircularProgress
                                          size={16}
                                          color="success"
                                        />
                                      ) : null
                                    }
                                  >
                                    {generatingPDF[sampleType]
                                      ? "Generating…"
                                      : reportApprovedBy
                                        ? "Download Report"
                                        : "View Report"}
                                  </Button>
                                  {(() => {
                                    const conditions = {
                                      notApproved: !reportApprovedBy,
                                      reportViewed:
                                        reportViewedTypes.has(sampleType) ||
                                        !!analysisMeta?.reportViewedAt,
                                      alreadySentForAuthorisation:
                                        !!analysisMeta?.authorisationRequestedBy,
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
                                              handleAuthoriseReport(sampleType)
                                            }
                                            disabled={
                                              authorisingReports[sampleType] ||
                                              generatingPDF[sampleType]
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
                                            {authorisingReports[sampleType]
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
                                                sampleType,
                                              )
                                            }
                                            disabled={Boolean(
                                              sendingAuthorisation[sampleType],
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
                                            {sendingAuthorisation[sampleType]
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
                    {getUserDisplayName(user)}
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
