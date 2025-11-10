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
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import {
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Mail as MailIcon,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { clientSuppliedJobsService, projectService } from "../../services/api";
import { generateShiftReport } from "../../utils/generateShiftReport";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";

const ClientSuppliedJobs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [sampleCounts, setSampleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedJobType, setSelectedJobType] = useState("");
  const [sampleReceiptDate, setSampleReceiptDate] = useState("");
  const [creatingJob, setCreatingJob] = useState(false);
  const [sampleReceiptDateError, setSampleReceiptDateError] = useState(false);
  const [completingJobs, setCompletingJobs] = useState({});
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [jobToArchive, setJobToArchive] = useState(null);
  const [reportViewedJobIds, setReportViewedJobIds] = useState(new Set());
  const [sendingApprovalEmails, setSendingApprovalEmails] = useState({});

  useEffect(() => {
    fetchClientSuppliedJobs();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh data when component comes into focus (e.g., when returning from samples page)
  useEffect(() => {
    const handleFocus = () => {
      if (jobs.length > 0) {
        fetchSampleCounts(jobs);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [jobs]);

  const fetchClientSuppliedJobs = async () => {
    try {
      setLoading(true);
      // Fetch all client supplied jobs
      const response = await clientSuppliedJobsService.getAll();

      const jobsData = response.data || [];
      const jobsArray = Array.isArray(jobsData) ? jobsData : [];
      setJobs(jobsArray);

      // Fetch sample counts for each job
      await fetchSampleCounts(jobsArray);
    } catch (error) {
      console.error("Error fetching client supplied jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      // Try different approaches to get projects
      let response;
      let projectsData = [];

      // First try: getAll with parameters (this should get ALL active projects)
      try {
        response = await projectService.getAll({
          limit: 1000,
          status:
            "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
        });

        if (response && response.data) {
          projectsData = Array.isArray(response.data)
            ? response.data
            : response.data.data || [];
        }
      } catch (error) {
        // Second try: getAssignedToMe (fallback to user's projects)
        try {
          response = await projectService.getAssignedToMe({
            limit: 1000,
            status:
              "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
          });

          if (response && response.data) {
            projectsData = Array.isArray(response.data)
              ? response.data
              : response.data.data || [];
          }
        } catch (error2) {
          // Third try: simple getAll without parameters
          try {
            response = await projectService.getAll();

            if (response && response.data) {
              projectsData = Array.isArray(response.data)
                ? response.data
                : response.data.data || [];
            }
          } catch (error3) {
            console.error("All project fetching methods failed:", error3);
            throw error3;
          }
        }
      }

      // Sort projects by projectID in descending order (same as air monitoring)
      const sortedProjects = projectsData.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum; // Descending order (highest first)
      });

      setProjects(sortedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  };

  const fetchSampleCounts = async (jobsArray) => {
    const counts = {};
    // Samples are now embedded in the job, so count them directly
    jobsArray.forEach((job) => {
      counts[job._id] = job.samples?.length || 0;
    });
    setSampleCounts(counts);
  };

  const handleCreateJob = async () => {
    if (!selectedProject || !selectedJobType) return;

    if (!sampleReceiptDate || sampleReceiptDate.trim() === "") {
      setSampleReceiptDateError(true);
      return;
    }

    try {
      setSampleReceiptDateError(false);
      setCreatingJob(true);

      // Validate project ID
      if (!selectedProject._id) {
        throw new Error("Invalid project selected. Please select a project.");
      }

      // Validate job type
      if (selectedJobType !== "Fibre ID" && selectedJobType !== "Fibre Count") {
        throw new Error(
          "Invalid job type. Please select either 'Fibre ID' or 'Fibre Count'."
        );
      }

      const jobData = {
        projectId: selectedProject._id,
        jobType: selectedJobType,
      };

      // Add sample receipt date if provided (and not empty)
      if (sampleReceiptDate && sampleReceiptDate.trim() !== "") {
        jobData.sampleReceiptDate = sampleReceiptDate;
      }

      // Explicitly do NOT include sampleCount - it's calculated from samples array

      const response = await clientSuppliedJobsService.create(jobData);

      if (!response || !response.data) {
        throw new Error("Invalid response from server");
      }

      // Refresh the jobs list
      await fetchClientSuppliedJobs();

      // Close dialog and reset form
      setCreateDialogOpen(false);
      setSelectedProject(null);
      setSelectedJobType("");
      setSampleReceiptDate("");
      setSampleReceiptDateError(false);
    } catch (error) {
      console.error("Error creating client supplied job:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create job. Please ensure all fields are filled correctly.";
      alert(`Failed to create job: ${errorMessage}`);
    } finally {
      setCreatingJob(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    setJobToDelete(jobId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      await clientSuppliedJobsService.delete(jobToDelete);
      // Refresh the jobs list
      await fetchClientSuppliedJobs();
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (error) {
      console.error("Error deleting client supplied job:", error);
      alert("Failed to delete job. Please try again.");
    }
  };

  const cancelDeleteJob = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter(
    (job) =>
      // Filter by search term only (show all jobs including completed)
      job.projectId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.projectId?.client?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      job.projectId?.projectID?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewJob = (jobId) => {
    // Ensure we're passing a string ID, not an object
    const actualJobId = typeof jobId === "object" ? jobId._id : jobId;
    // Use the appropriate route based on current location
    const basePath = location.pathname.startsWith("/client-supplied")
      ? "/client-supplied"
      : "/fibre-id/client-supplied";
    navigate(`${basePath}/${actualJobId}/samples`);
  };

  const handleBackToHome = () => {
    // Navigate back based on current location
    if (location.pathname.startsWith("/client-supplied")) {
      navigate("/client-supplied");
    } else {
      navigate("/fibre-id");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "In Progress":
        return "info";
      case "Analysis Complete":
        return "warning";
      case "Completed":
        return "success";
      default:
        return "info";
    }
  };

  const handleCompleteJob = async (jobId) => {
    try {
      setCompletingJobs((prev) => ({ ...prev, [jobId]: true }));

      await clientSuppliedJobsService.update(jobId, {
        status: "Completed",
      });

      // Update the local jobs state
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === jobId ? { ...job, status: "Completed" } : job
        )
      );

      showSnackbar("Job completed successfully!", "success");
      console.log("Job completed successfully");
    } catch (error) {
      console.error("Error completing job:", error);
      showSnackbar(`Error completing job: ${error.message}`, "error");
    } finally {
      setCompletingJobs((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleArchiveJob = (job) => {
    setJobToArchive(job);
    setArchiveDialogOpen(true);
  };

  const confirmArchiveJob = async () => {
    if (!jobToArchive) return;

    try {
      // Archive the job via API
      await clientSuppliedJobsService.archive(jobToArchive._id);

      // Remove the job from the local state
      setJobs((prevJobs) =>
        prevJobs.filter((job) => job._id !== jobToArchive._id)
      );

      showSnackbar("Job archived successfully!", "success");
      setArchiveDialogOpen(false);
      setJobToArchive(null);
    } catch (error) {
      console.error("Error archiving job:", error);
      showSnackbar(
        `Error archiving job: ${
          error.response?.data?.message || error.message
        }`,
        "error"
      );
    }
  };

  const cancelArchiveJob = () => {
    setArchiveDialogOpen(false);
    setJobToArchive(null);
  };

  // Check if all samples in a job have been analyzed (have analysisData)
  const areAllSamplesAnalyzed = (job) => {
    if (!job || !job.samples || job.samples.length === 0) {
      return false;
    }

    // For Fibre ID jobs, check if all samples have isAnalyzed === true
    if (job.jobType === "Fibre ID") {
      return job.samples.every((sample) => {
        return (
          sample.analysisData &&
          sample.analysisData.isAnalyzed === true &&
          sample.analyzedAt
        );
      });
    }

    // For Fibre Count jobs, check if all samples have fieldsCounted
    return job.samples.every((sample) => {
      return (
        sample.analysisData &&
        sample.analysisData.fieldsCounted !== undefined &&
        sample.analyzedAt
      );
    });
  };

  const handleGeneratePDF = async (job) => {
    try {
      setGeneratingPDF((prev) => ({ ...prev, [job._id]: true }));

      // Fetch the job with full population to get client and project data
      const jobResponse = await clientSuppliedJobsService.getById(job._id);
      const fullJob = jobResponse.data;

      // Samples are now embedded in the job
      const sampleItems = fullJob.samples || [];

      // Get analyst from first analyzed sample or job analyst
      let analyst = null;
      const analyzedSample = sampleItems.find((s) => s.analyzedBy);
      if (analyzedSample?.analyzedBy) {
        if (
          typeof analyzedSample.analyzedBy === "object" &&
          analyzedSample.analyzedBy.firstName
        ) {
          analyst = `${analyzedSample.analyzedBy.firstName} ${analyzedSample.analyzedBy.lastName}`;
        } else if (typeof analyzedSample.analyzedBy === "string") {
          analyst = analyzedSample.analyzedBy;
        }
      } else if (fullJob.analyst) {
        analyst = fullJob.analyst;
      }

      // If no analyst found, default to "Unknown Analyst"
      if (!analyst) {
        analyst = "Unknown Analyst";
      }

      // Handle Fibre ID jobs differently from Fibre Count jobs
      if (fullJob.jobType === "Fibre ID") {
        // Transform samples to match the format expected by generateFibreIDReport
        const sampleItemsForReport = sampleItems
          .filter(
            (item) => item.analysisData && item.analysisData.isAnalyzed === true
          )
          .map((item, index) => ({
            itemNumber: index + 1,
            sampleReference: item.labReference || `Sample ${index + 1}`,
            labReference: item.labReference || `Sample ${index + 1}`,
            locationDescription:
              item.clientReference || item.sampleDescription || "N/A",
            clientReference: item.clientReference,
            analysisData: item.analysisData,
          }));

        // Create an assessment-like object for the report generator
        const assessmentForReport = {
          _id: fullJob._id,
          projectId: fullJob.projectId,
          jobType: fullJob.jobType,
          status: fullJob.status,
          analysisDate: fullJob.analysisDate,
          sampleReceiptDate: fullJob.sampleReceiptDate,
          revision: fullJob.revision || 0,
        };

        // Generate the Fibre ID report
        await generateFibreIDReport({
          assessment: assessmentForReport,
          sampleItems: sampleItemsForReport,
          analyst: analyst || "Unknown Analyst",
          openInNewTab: !fullJob.reportApprovedBy, // open if not approved, download if approved
          returnPdfData: false,
          reportApprovedBy: fullJob.reportApprovedBy || null,
          reportIssueDate: fullJob.reportIssueDate || null,
        });
        setReportViewedJobIds((prev) => new Set(prev).add(job._id));
      } else {
        // Fibre Count jobs - use existing logic
        // Transform sample items to match air monitoring format
        const transformedSamples = sampleItems.map((item, index) => {
          return {
            fullSampleID: item.labReference || `Sample-${index + 1}`,
            sampleID: item.labReference || `Sample-${index + 1}`,
            location: item.clientReference || item.locationDescription || "N/A",
            // No time or flowrate for client supplied
            startTime: null,
            endTime: null,
            averageFlowrate: null,
            // Use analysisData from sample item
            analysis: item.analysisData
              ? {
                  fieldsCounted: item.analysisData.fieldsCounted,
                  fibresCounted: item.analysisData.fibresCounted,
                  edgesDistribution: item.analysisData.edgesDistribution,
                  backgroundDust: item.analysisData.backgroundDust,
                  // No reported concentration for client supplied
                  reportedConcentration: null,
                }
              : null,
          };
        });

        // Create a mock shift-like object for PDF generation
        const mockShift = {
          descriptionOfWorks:
            fullJob.projectId?.name || "Client Supplied Fibre Count",
          date: fullJob.sampleReceiptDate || new Date(),
          analysedBy: analyst || "N/A",
          analysisDate: fullJob.analysisDate || new Date(),
          reportApprovedBy: fullJob.reportApprovedBy || null,
          reportIssueDate: fullJob.reportIssueDate || null,
        };

        // Create a job-like object with projectId populated
        const jobForPDF = {
          projectId: fullJob.projectId,
          asbestosRemovalist: null, // Not applicable for client supplied
        };

        // Generate the PDF using air monitoring format
        await generateShiftReport({
          shift: mockShift,
          job: jobForPDF,
          samples: transformedSamples,
          project: fullJob.projectId,
          openInNewTab: !fullJob.reportApprovedBy, // open if not approved, download if approved
          isClientSupplied: true, // Flag to indicate we want fibre count format
        });
        setReportViewedJobIds((prev) => new Set(prev).add(job._id));
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      showSnackbar("Failed to generate report.", "error");
    } finally {
      setGeneratingPDF((prev) => ({ ...prev, [job._id]: false }));
    }
  };

  const handleApproveReport = async (job) => {
    try {
      const now = new Date().toISOString();
      const approver =
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || currentUser?.email || "Unknown";

      // Update the job with report approval and set status to Completed
      const response = await clientSuppliedJobsService.update(job._id, {
        reportApprovedBy: approver,
        reportIssueDate: now,
        status: "Completed",
      });

      console.log("Report approved successfully:", response);

      // Refresh the jobs list
      await fetchClientSuppliedJobs();

      // Generate and download the approved report
      try {
        await handleGeneratePDF(job);
        showSnackbar("Report approved and downloaded successfully.", "success");
      } catch (reportError) {
        console.error("Error generating approved report:", reportError);
        showSnackbar(
          "Report approved but failed to generate download.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Error approving report:", error);
      showSnackbar("Failed to approve report. Please try again.", "error");
    }
  };

  const handleSendForApproval = async (job) => {
    try {
      setSendingApprovalEmails((prev) => ({ ...prev, [job._id]: true }));

      const response = await clientSuppliedJobsService.sendForApproval(job._id);

      showSnackbar(
        response.data?.message ||
          `Approval request emails sent successfully to ${
            response.data?.recipients?.length || 0
          } signatory user(s)`,
        "success"
      );
    } catch (error) {
      console.error("Error sending approval request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send approval request emails. Please try again.",
        "error"
      );
    } finally {
      setSendingApprovalEmails((prev) => ({ ...prev, [job._id]: false }));
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* PDF Loading Overlay */}
        <PDFLoadingOverlay
          open={Object.values(generatingPDF).some(Boolean)}
          message="Generating Fibre ID Report PDF..."
        />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Client Supplied Jobs
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ minWidth: "200px" }}
          >
            Add New Job
          </Button>
        </Box>

        {/* Jobs Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "230px" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "120px" }}>
                    Job Type
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
                    Sample Receipt Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No client supplied jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow
                      key={job._id}
                      hover
                      onClick={() => handleViewJob(job._id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {job.projectId?.projectID || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.name || "Unnamed Project"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.jobType || "Fibre ID"}
                          color={
                            job.jobType === "Fibre ID"
                              ? "primary"
                              : job.jobType === "Fibre Count"
                              ? "secondary"
                              : "default"
                          }
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.sampleReceiptDate
                            ? new Date(
                                job.sampleReceiptDate
                              ).toLocaleDateString("en-GB")
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.status || "In Progress"}
                          color={getStatusColor(job.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                            }}
                          >
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGeneratePDF(job);
                              }}
                              color="secondary"
                              size="small"
                              startIcon={<PdfIcon />}
                              disabled={
                                generatingPDF[job._id] ||
                                (sampleCounts[job._id] || 0) === 0 ||
                                !areAllSamplesAnalyzed(job)
                              }
                            >
                              {generatingPDF[job._id] ? "..." : "PDF"}
                            </Button>
                            {!job.reportApprovedBy &&
                              job.status === "Analysis Complete" && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "error.main",
                                    fontSize: "0.7rem",
                                    mt: 0.5,
                                    ml: 0.5,
                                  }}
                                >
                                  Not approved
                                </Typography>
                              )}
                          </Box>
                          {(() => {
                            const conditions = {
                              notApproved: !job.reportApprovedBy,
                              reportViewed: reportViewedJobIds.has(job._id),
                              hasAdminPermission: hasPermission(
                                currentUser,
                                "admin.view"
                              ),
                              isLabSignatory: currentUser?.labSignatory,
                            };
                            const showButton =
                              conditions.notApproved &&
                              conditions.reportViewed &&
                              conditions.hasAdminPermission &&
                              conditions.isLabSignatory;
                            return showButton;
                          })() && (
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveReport(job);
                              }}
                              sx={{
                                backgroundColor: "#4caf50",
                                color: "white",
                                "&:hover": {
                                  backgroundColor: "#45a049",
                                },
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {job.status === "Analysis Complete" &&
                            !job.reportApprovedBy &&
                            !currentUser?.labSignatory && (
                              <Button
                                variant="outlined"
                                size="small"
                                color="primary"
                                startIcon={<MailIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendForApproval(job);
                                }}
                                disabled={sendingApprovalEmails[job._id]}
                              >
                                {sendingApprovalEmails[job._id]
                                  ? "Sending..."
                                  : "Send for Approval"}
                              </Button>
                            )}
                          {job.status === "Analysis Complete" &&
                            job.reportApprovedBy && (
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompleteJob(job._id);
                                }}
                                disabled={completingJobs[job._id]}
                              >
                                {completingJobs[job._id]
                                  ? "Completing..."
                                  : "Complete"}
                              </Button>
                            )}
                          {job.status === "Completed" && (
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveJob(job);
                              }}
                              color="default"
                              size="small"
                              title="Archive Job"
                            >
                              <ArchiveIcon />
                            </IconButton>
                          )}
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteJob(job._id);
                            }}
                            color="error"
                            size="small"
                            title="Delete Job"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Create Job Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => {
            setCreateDialogOpen(false);
            setSelectedProject(null);
            setSelectedJobType("");
            setSampleReceiptDate("");
          }}
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
              <AddIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Create New Client Supplied Job
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box
              sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}
            >
              {Array.isArray(projects) && projects.length > 0 ? (
                <>
                  <Autocomplete
                    options={projects}
                    getOptionLabel={(option) => {
                      return `${option.projectID || "N/A"} - ${
                        option.name || "Unnamed Project"
                      }`;
                    }}
                    value={selectedProject}
                    onChange={(event, newValue) => {
                      setSelectedProject(newValue);
                    }}
                    isOptionEqualToValue={(option, value) => {
                      return option._id === value._id;
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Project"
                        placeholder="Search for a project..."
                        required
                        fullWidth
                      />
                    )}
                    renderOption={(props, option) => {
                      return (
                        <li {...props}>
                          <Box>
                            <Typography variant="body1">
                              {option.projectID || "N/A"} -{" "}
                              {option.name || "Unnamed Project"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Client: {option.client?.name || "Not specified"}
                            </Typography>
                          </Box>
                        </li>
                      );
                    }}
                    filterOptions={(options, { inputValue }) => {
                      if (!Array.isArray(options)) {
                        return [];
                      }

                      // If no input, show all options
                      if (!inputValue || inputValue.length === 0) {
                        return options;
                      }

                      // If input is less than 2 characters, show all options
                      if (inputValue.length < 2) {
                        return options;
                      }

                      // Filter based on input
                      const filterValue = inputValue.toLowerCase();
                      const filtered = options.filter(
                        (option) =>
                          option.projectID
                            ?.toLowerCase()
                            .includes(filterValue) ||
                          option.name?.toLowerCase().includes(filterValue) ||
                          option.client?.name
                            ?.toLowerCase()
                            .includes(filterValue)
                      );

                      return filtered;
                    }}
                  />
                  <FormControl fullWidth required>
                    <InputLabel>Job Type</InputLabel>
                    <Select
                      value={selectedJobType}
                      onChange={(e) => setSelectedJobType(e.target.value)}
                      label="Job Type"
                    >
                      <MenuItem value="Fibre ID">Fibre ID</MenuItem>
                      <MenuItem value="Fibre Count">Fibre Count</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Sample Receipt Date"
                    type="date"
                    value={sampleReceiptDate}
                    onChange={(e) => {
                      setSampleReceiptDate(e.target.value);
                      if (sampleReceiptDateError) {
                        setSampleReceiptDateError(false);
                      }
                    }}
                    InputLabelProps={{
                      shrink: true,
                    }}
                    error={sampleReceiptDateError}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            size="small"
                            onClick={() =>
                              setSampleReceiptDate(
                                new Date().toISOString().split("T")[0]
                              )
                            }
                            sx={{ textTransform: "none", minWidth: "auto" }}
                          >
                            Today
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {sampleReceiptDateError && (
                    <Typography variant="body2" sx={{ color: "error.main" }}>
                      Enter the sample receipt date to create the new job.
                    </Typography>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: "center", py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {Array.isArray(projects)
                      ? `No projects available (projects.length: ${projects.length})`
                      : `Loading projects... (projects type: ${typeof projects})`}
                  </Typography>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setSelectedProject(null);
                setSelectedJobType("");
                setSampleReceiptDate("");
              }}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              variant="contained"
              disabled={
                !selectedProject ||
                !selectedJobType ||
                creatingJob ||
                !Array.isArray(projects) ||
                projects.length === 0
              }
              startIcon={<AddIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {creatingJob ? "Creating..." : "Create Job"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={cancelDeleteJob}
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
                bgcolor: "error.main",
                color: "white",
              }}
            >
              <DeleteIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Confirm Delete
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              Are you sure you want to delete this client supplied job? This
              action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={cancelDeleteJob}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteJob}
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                boxShadow: "0 4px 12px rgba(244, 67, 54, 0.3)",
                "&:hover": {
                  boxShadow: "0 6px 16px rgba(244, 67, 54, 0.4)",
                },
              }}
            >
              Delete Job
            </Button>
          </DialogActions>
        </Dialog>

        {/* Archive Confirmation Dialog */}
        <Dialog
          open={archiveDialogOpen}
          onClose={cancelArchiveJob}
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
              <ArchiveIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Archive Job
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary", mb: 2 }}>
              Are you sure you want to archive this client supplied job?
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              This job will be removed from the client supplied jobs table. You
              can access archived jobs in the Project Reports section.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={cancelArchiveJob}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmArchiveJob}
              variant="contained"
              color="primary"
              startIcon={<ArchiveIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
              }}
            >
              Archive
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default ClientSuppliedJobs;
