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
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
} from "@mui/material";
import {
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
  Mail as MailIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { asbestosAssessmentService } from "../../services/api";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";

const LDsuppliedJobs = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingAssessment, setUpdatingAssessment] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [reportViewedAssessmentIds, setReportViewedAssessmentIds] = useState(new Set());
  const [sendingApprovalEmails, setSendingApprovalEmails] = useState({});
  const [authorisingReports, setAuthorisingReports] = useState({});
  const [sendingAuthorisationRequests, setSendingAuthorisationRequests] = useState({});

  useEffect(() => {
    fetchAsbestosAssessments();
  }, []);

  const fetchAsbestosAssessments = async () => {
    try {
      setLoading(true);
      // Fetch all asbestos assessments
      const response = await asbestosAssessmentService.getAsbestosAssessments();

      // Show all L&D supplied assessments (including complete/authorised - do not remove from table)
      const allAssessments = response.data || [];
      setAssessments(Array.isArray(allAssessments) ? allAssessments : []);
    } catch (error) {
      console.error("Error fetching asbestos assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = assessments.filter(
    (assessment) =>
      assessment.projectId?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.projectId?.client?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.projectId?.projectID
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.assessorId?.firstName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.assessorId?.lastName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const handleViewAssessment = (assessment) => {
    // Navigate directly to analysis page for the first item
    // The analysis page will fetch the full assessment and handle item selection
    navigate(`/fibre-id/assessment/${assessment._id}/item/1/analysis`);
  };

  const handleCompleteAssessment = async (assessment) => {
    if (updatingAssessment) return;

    setUpdatingAssessment(assessment._id);
    try {
      // Update the assessment status to "complete"
      await asbestosAssessmentService.updateAsbestosAssessment(assessment._id, {
        ...assessment,
        status: "complete",
      });

      // Also update the corresponding asbestos assessment job status to "sample-analysis-complete"
      // This will trigger the "Report Ready for Review" button to appear on the asbestos assessments page
      // You may need to implement this API call based on your backend structure

      await fetchAsbestosAssessments();
    } catch (error) {
      console.error("Error completing assessment:", error);
    } finally {
      setUpdatingAssessment(null);
    }
  };

  const getReadySamplesCount = (assessment) => {
    if (!assessment.items || assessment.items.length === 0) {
      return 0;
    }

    // Count only sampled items (items with a unique sampleReference that aren't referred or visually assessed)
    const items = assessment.items;
    
    // Get all sample references and count occurrences
    const sampleRefCounts = {};
    items.forEach((item) => {
      if (item.sampleReference && item.sampleReference.trim() !== "") {
        const ref = item.sampleReference.trim();
        sampleRefCounts[ref] = (sampleRefCounts[ref] || 0) + 1;
      }
    });

    // Count items that:
    // 1. Have a sampleReference (not null/empty)
    // 2. Are NOT referred items (sampleReference is unique - count === 1)
    // 3. Are NOT visually assessed items
    return items.filter((item) => {
      // Must have a sampleReference
      if (!item.sampleReference || item.sampleReference.trim() === "") {
        return false;
      }

      // Must not be visually assessed
      const isVisuallyAssessed =
        item.asbestosContent === "Visually Assessed as Asbestos" ||
        item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
        item.asbestosContent === "Visually Assessed as Non-asbestos";
      if (isVisuallyAssessed) {
        return false;
      }

      // Must not be a referred item (sampleReference must be unique)
      const ref = item.sampleReference.trim();
      return sampleRefCounts[ref] === 1;
    }).length;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "samples-with-lab":
        return "primary";
      case "sample-analysis-complete":
        return "warning";
      case "report-ready-for-review":
        return "info";
      case "complete":
        return "success";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "samples-with-lab":
        return "Samples with Lab";
      case "sample-analysis-complete":
        return "Analysis Complete";
      case "report-ready-for-review":
        return "Report Ready for Review";
      case "complete":
        return "Complete";
      default:
        return status || "Unknown";
    }
  };

  // Check if all sampled items in an assessment have been analysed
  const areAllSampledItemsAnalysed = (assessment) => {
    if (!assessment || !assessment.items || assessment.items.length === 0) {
      return false;
    }

    // Get all sample references and count occurrences
    const items = assessment.items;
    const sampleRefCounts = {};
    items.forEach((item) => {
      if (item.sampleReference && item.sampleReference.trim() !== "") {
        const ref = item.sampleReference.trim();
        sampleRefCounts[ref] = (sampleRefCounts[ref] || 0) + 1;
      }
    });

    // Filter to only sampled items
    const sampledItems = items.filter((item) => {
      if (!item.sampleReference || item.sampleReference.trim() === "") {
        return false;
      }
      const isVisuallyAssessed =
        item.asbestosContent === "Visually Assessed as Asbestos" ||
        item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
        item.asbestosContent === "Visually Assessed as Non-asbestos";
      if (isVisuallyAssessed) {
        return false;
      }
      const ref = item.sampleReference.trim();
      return sampleRefCounts[ref] === 1;
    });

    if (sampledItems.length === 0) {
      return false;
    }

    return sampledItems.every(
      (item) => item.analysisData && item.analysisData.isAnalysed === true
    );
  };

  const handleGeneratePDF = async (assessment, options = {}) => {
    const { uploadToAssessment = false } = options; // Only true when authorising – save report to assessment so it attaches to asbestos assessment PDF
    try {
      setGeneratingPDF((prev) => ({ ...prev, [assessment._id]: true }));

      // Fetch the full assessment with populated data
      const assessmentResponse = await asbestosAssessmentService.getAsbestosAssessmentById(assessment._id);
      const fullAssessment = assessmentResponse.data;

      // Get sampled items that have been analysed
      const items = fullAssessment.items || [];
      
      // Get all sample references and count occurrences
      const sampleRefCounts = {};
      items.forEach((item) => {
        if (item.sampleReference && item.sampleReference.trim() !== "") {
          const ref = item.sampleReference.trim();
          sampleRefCounts[ref] = (sampleRefCounts[ref] || 0) + 1;
        }
      });

      // Filter to only sampled items that are analysed
      const sampledItems = items.filter((item) => {
        if (!item.sampleReference || item.sampleReference.trim() === "") {
          return false;
        }
        const isVisuallyAssessed =
          item.asbestosContent === "Visually Assessed as Asbestos" ||
          item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
          item.asbestosContent === "Visually Assessed as Non-asbestos";
        if (isVisuallyAssessed) {
          return false;
        }
        const ref = item.sampleReference.trim();
        return sampleRefCounts[ref] === 1 && item.analysisData?.isAnalysed === true;
      });

      // Transform items to match the format expected by generateFibreIDReport
      const sampleItemsForReport = sampledItems.map((item, index) => ({
        itemNumber: item.itemNumber || index + 1,
        sampleReference: item.sampleReference || `Sample ${index + 1}`,
        labReference: item.sampleReference || `Sample ${index + 1}`,
        locationDescription: item.locationDescription || "N/A",
        analysisData: item.analysisData,
      }));

      // Get analyst from assessment level (analyst is set for all samples in the job)
      // Fall back to item level if assessment analyst is not set
      let analyst = "Unknown Analyst";
      
      // First, try to get analyst from assessment level
      if (fullAssessment.analyst) {
        if (
          typeof fullAssessment.analyst === "object" &&
          fullAssessment.analyst.firstName
        ) {
          analyst = `${fullAssessment.analyst.firstName} ${fullAssessment.analyst.lastName}`;
          console.log("PDF Generation - Analyst from assessment level:", analyst);
        } else if (typeof fullAssessment.analyst === "string") {
          // If it's just an ID, we can't use it directly
          console.log("PDF Generation - Assessment analyst is string ID, trying fallback");
        }
      }
      
      // Fallback: try to get from first analysed item
      if (analyst === "Unknown Analyst") {
        const itemWithAnalyst = fullAssessment.items?.find((item) => {
          return item.analysedBy && item.analysisData?.isAnalysed === true;
        });
        
        if (itemWithAnalyst?.analysedBy) {
          if (
            typeof itemWithAnalyst.analysedBy === "object" &&
            itemWithAnalyst.analysedBy.firstName
          ) {
            analyst = `${itemWithAnalyst.analysedBy.firstName} ${itemWithAnalyst.analysedBy.lastName}`;
            console.log("PDF Generation - Analyst from item level:", analyst);
          }
        }
      }
      
      console.log("PDF Generation - Final analyst:", analyst);

      // Create an assessment-like object for the report generator
      const assessmentForReport = {
        _id: fullAssessment._id,
        projectId: fullAssessment.projectId,
        status: fullAssessment.status,
        assessmentDate: fullAssessment.assessmentDate,
        samplesReceivedDate: fullAssessment.samplesReceivedDate,
        revision: fullAssessment.revision || 0,
        LAA: fullAssessment.LAA, // Include LAA for "Sampled by" field
        assessorId: fullAssessment.assessorId, // Include assessorId as fallback
      };

      const openInNewTab = !fullAssessment.reportApprovedBy;

      // Generate the Fibre ID report and get PDF data
      const pdfDataUrl = await generateFibreIDReport({
        assessment: assessmentForReport,
        sampleItems: sampleItemsForReport,
        analyst: analyst,
        openInNewTab: false, // We handle open/download below
        returnPdfData: true,
        reportApprovedBy: fullAssessment.reportApprovedBy || null,
        reportIssueDate: fullAssessment.reportIssueDate || null,
      });

      // Save to assessment only when authorising, so only authorised reports attach to the asbestos assessment PDF
      if (uploadToAssessment) {
        const base64Data = pdfDataUrl && pdfDataUrl.includes(",") ? pdfDataUrl.split(",")[1] : null;
        if (base64Data) {
          await asbestosAssessmentService.uploadFibreAnalysisReport(assessment._id, {
            reportData: base64Data,
          });
        }
      }

      // Open in new tab or download
      if (pdfDataUrl) {
        if (openInNewTab) {
          window.open(pdfDataUrl, "_blank");
        } else {
          const link = document.createElement("a");
          link.href = pdfDataUrl;
          link.download = `${assessmentForReport.projectId?.projectID || "FibreID"}: Fibre ID Report - ${assessmentForReport.projectId?.name || "Report"} (${fullAssessment.assessmentDate ? new Date(fullAssessment.assessmentDate).toLocaleDateString("en-GB") : ""}).pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      setReportViewedAssessmentIds((prev) => new Set(prev).add(assessment._id));
    } catch (error) {
      console.error("Error generating PDF:", error);
      showSnackbar("Failed to generate report.", "error");
    } finally {
      setGeneratingPDF((prev) => ({ ...prev, [assessment._id]: false }));
    }
  };

  const handleApproveReport = async (assessment) => {
    try {
      const now = new Date().toISOString();
      const approver =
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || currentUser?.email || "Unknown";

      // Update the assessment with report approval and set status to "report-ready-for-review"
      const response = await asbestosAssessmentService.updateAsbestosAssessment(assessment._id, {
        ...assessment,
        reportApprovedBy: approver,
        reportIssueDate: now,
        status: "report-ready-for-review",
      });

      console.log("Report approved successfully:", response);

      // Refresh the assessments list
      await fetchAsbestosAssessments();

      // Generate and download the approved report
      try {
        await handleGeneratePDF(assessment);
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

  const handleSendForApproval = async (assessment) => {
    try {
      setSendingApprovalEmails((prev) => ({ ...prev, [assessment._id]: true }));

      // For now, just show a message - you may need to implement the backend endpoint
      showSnackbar(
        "Approval request functionality will be implemented soon.",
        "info"
      );
    } catch (error) {
      console.error("Error sending approval request emails:", error);
      showSnackbar(
        "Failed to send approval request emails. Please try again.",
        "error"
      );
    } finally {
      setSendingApprovalEmails((prev) => ({ ...prev, [assessment._id]: false }));
    }
  };

  const handleAuthoriseReport = async (assessment) => {
    try {
      setAuthorisingReports((prev) => ({ ...prev, [assessment._id]: true }));

      const now = new Date().toISOString();
      const authoriser =
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || currentUser?.email || "Unknown";

      // Update the assessment with authorisation, set report approved by to the authoriser, and set status to "complete"
      await asbestosAssessmentService.updateAsbestosAssessment(assessment._id, {
        ...assessment,
        reportApprovedBy: authoriser,
        reportAuthorisedBy: authoriser,
        reportAuthorisedAt: now,
        status: "complete",
      });

      // Refresh the assessments list
      await fetchAsbestosAssessments();

      // Generate the authorised report, save it to the assessment (so it attaches to asbestos assessment PDF), and download
      try {
        await handleGeneratePDF(assessment, { uploadToAssessment: true });
        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success"
        );
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Error authorising report:", error);
      showSnackbar("Failed to authorise report. Please try again.", "error");
    } finally {
      setAuthorisingReports((prev) => ({ ...prev, [assessment._id]: false }));
    }
  };

  const handleSendForAuthorisation = async (assessment) => {
    try {
      setSendingAuthorisationRequests((prev) => ({ ...prev, [assessment._id]: true }));

      // For now, just show a message - you may need to implement the backend endpoint
      showSnackbar(
        "Authorisation request functionality will be implemented soon.",
        "info"
      );
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        "Failed to send authorisation request emails. Please try again.",
        "error"
      );
    } finally {
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [assessment._id]: false,
      }));
    }
  };

  const getAnalysisDueTime = (assessment) => {
    let dueDate;

    // Use analysisDueDate if available (should always be set for new submissions)
    if (assessment.analysisDueDate) {
      dueDate = new Date(assessment.analysisDueDate);
    } else if (assessment.samplesReceivedDate && assessment.turnaroundTime) {
      // Fallback: Calculate from samplesReceivedDate and turnaroundTime for older records
      const receivedDate = new Date(assessment.samplesReceivedDate);
      dueDate = new Date(receivedDate);

      if (assessment.turnaroundTime === "3 day") {
        dueDate.setDate(receivedDate.getDate() + 3);
      } else if (assessment.turnaroundTime === "24 hours") {
        dueDate.setHours(receivedDate.getHours() + 24);
      } else {
        // For custom or unknown, default to 3 days
        dueDate.setDate(receivedDate.getDate() + 3);
      }
    } else {
      // Last resort: if we have samplesReceivedDate, assume 3 days
      if (assessment.samplesReceivedDate) {
        const receivedDate = new Date(assessment.samplesReceivedDate);
        dueDate = new Date(receivedDate);
        dueDate.setDate(receivedDate.getDate() + 3);
      } else {
        console.warn(
          "Analysis due date missing for assessment:",
          assessment._id
        );
        return "Date unavailable";
      }
    }

    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();

    if (diffTime < 0) {
      // Overdue
      const daysOverdue = Math.floor(
        Math.abs(diffTime) / (1000 * 60 * 60 * 24)
      );
      const hoursOverdue = Math.floor(
        (Math.abs(diffTime) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const daysText = daysOverdue === 1 ? "day" : "days";
      const hoursText = hoursOverdue === 1 ? "hour" : "hours";
      return `Overdue: ${daysOverdue} ${daysText} ${hoursOverdue} ${hoursText}`;
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (days === 0 && hours === 0) {
      const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      if (minutes > 0) {
        const minutesText = minutes === 1 ? "minute" : "minutes";
        return `${minutes} ${minutesText}`;
      }
      return "Due now";
    }

    const daysText = days === 1 ? "day" : "days";
    const hoursText = hours === 1 ? "hour" : "hours";

    if (days === 0) {
      return `${hours} ${hoursText}`;
    }
    if (hours === 0) {
      return `${days} ${daysText}`;
    }

    return `${days} ${daysText} ${hours} ${hoursText}`;
  };

  const getAnalysisDueColor = (assessment) => {
    let dueDate;

    // Use analysisDueDate if available (should always be set for new submissions)
    if (assessment.analysisDueDate) {
      dueDate = new Date(assessment.analysisDueDate);
    } else if (assessment.samplesReceivedDate && assessment.turnaroundTime) {
      // Fallback: Calculate from samplesReceivedDate and turnaroundTime for older records
      const receivedDate = new Date(assessment.samplesReceivedDate);
      dueDate = new Date(receivedDate);

      if (assessment.turnaroundTime === "3 day") {
        dueDate.setDate(receivedDate.getDate() + 3);
      } else if (assessment.turnaroundTime === "24 hours") {
        dueDate.setHours(receivedDate.getHours() + 24);
      } else {
        // For custom or unknown, default to 3 days
        dueDate.setDate(receivedDate.getDate() + 3);
      }
    } else if (assessment.samplesReceivedDate) {
      // Last resort: if we have samplesReceivedDate, assume 3 days
      const receivedDate = new Date(assessment.samplesReceivedDate);
      dueDate = new Date(receivedDate);
      dueDate.setDate(receivedDate.getDate() + 3);
    } else {
      return "text.secondary"; // Fallback color if no date available
    }

    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();

    if (diffTime < 0) {
      return "error.main"; // Overdue - red
    }

    const hours = diffTime / (1000 * 60 * 60);
    if (hours <= 24) {
      return "warning.main"; // Less than 24 hours - orange
    }

    return "text.primary"; // Normal - default color
  };

  return (
    <Container maxWidth="xl">
      <PDFLoadingOverlay
        open={Object.values(generatingPDF).some(Boolean)}
        message="Generating Fibre ID Report PDF..."
      />
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
              L&D Supplied Jobs
            </Typography>
          </Box>
          <Breadcrumbs>
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate("/laboratory-services")}
              sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            >
              <ArrowBackIcon sx={{ mr: 1 }} />
              Laboratory Services
            </Link>
            <Typography color="text.primary">L&D Supplied Jobs</Typography>
          </Breadcrumbs>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by project name, client, project ID, or assessor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Assessments Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>Project ID</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Sample Receipt Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    No. of Samples
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Analysis Due
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading assessments...
                    </TableCell>
                  </TableRow>
                ) : filteredAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No active asbestos assessment jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssessments.map((assessment) => {
                    const readyCount = getReadySamplesCount(assessment);
                    return (
                      <TableRow
                        key={assessment._id}
                        hover
                        onClick={() => handleViewAssessment(assessment)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {assessment.projectId?.projectID || "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {assessment.projectId?.name || "Unnamed Project"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {assessment.samplesReceivedDate
                              ? new Date(
                                  assessment.samplesReceivedDate
                                ).toLocaleDateString("en-GB")
                              : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {readyCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(assessment.status)}
                            color={getStatusColor(assessment.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: getAnalysisDueColor(assessment),
                              fontWeight: "medium",
                            }}
                          >
                            {getAnalysisDueTime(assessment)}
                          </Typography>
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
                                  handleGeneratePDF(assessment);
                                }}
                                color="secondary"
                                size="small"
                                startIcon={<PdfIcon />}
                                disabled={
                                  generatingPDF[assessment._id] ||
                                  !areAllSampledItemsAnalysed(assessment)
                                }
                              >
                                {generatingPDF[assessment._id] ? "..." : "PDF"}
                              </Button>
                              {!assessment.reportApprovedBy &&
                                assessment.status === "sample-analysis-complete" && (
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
                                notApproved: !assessment.reportApprovedBy,
                                notAuthorised: !assessment.reportAuthorisedBy,
                                reportViewed: reportViewedAssessmentIds.has(assessment._id),
                                hasAdminPermission: hasPermission(
                                  currentUser,
                                  "admin.view"
                                ),
                                hasEditPermission: hasPermission(
                                  currentUser,
                                  "asbestosAssessment.edit"
                                ),
                                isReportProofer: Boolean(
                                  currentUser?.reportProofer
                                ),
                              };
                              const baseVisible =
                                conditions.notApproved && conditions.reportViewed;
                              const visibility = {
                                showAuthorise:
                                  baseVisible &&
                                  conditions.notAuthorised &&
                                  conditions.hasAdminPermission &&
                                  conditions.isReportProofer,
                                showSend:
                                  baseVisible &&
                                  conditions.notAuthorised &&
                                  !conditions.isReportProofer &&
                                  conditions.hasEditPermission,
                              };
                              return (
                                <>
                                  {visibility.showAuthorise && (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      color="success"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAuthoriseReport(assessment);
                                      }}
                                      disabled={
                                        authorisingReports[assessment._id] ||
                                        generatingPDF[assessment._id]
                                      }
                                      sx={{
                                        backgroundColor: "#4caf50",
                                        color: "white",
                                        "&:hover": {
                                          backgroundColor: "#45a049",
                                        },
                                      }}
                                    >
                                      {authorisingReports[assessment._id]
                                        ? "Authorising..."
                                        : "Authorise Report"}
                                    </Button>
                                  )}
                                  {visibility.showSend && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      color="primary"
                                      startIcon={<MailIcon />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSendForAuthorisation(assessment);
                                      }}
                                      disabled={
                                        sendingAuthorisationRequests[assessment._id]
                                      }
                                    >
                                      {sendingAuthorisationRequests[assessment._id]
                                        ? "Sending..."
                                        : "Send for Authorisation"}
                                    </Button>
                                  )}
                                </>
                              );
                            })()}
                            {assessment.status === "sample-analysis-complete" &&
                              assessment.reportApprovedBy && (
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompleteAssessment(assessment);
                                  }}
                                  disabled={updatingAssessment === assessment._id}
                                >
                                  {updatingAssessment === assessment._id
                                    ? "Completing..."
                                    : "Complete"}
                                </Button>
                              )}
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
    </Container>
  );
};

export default LDsuppliedJobs;
