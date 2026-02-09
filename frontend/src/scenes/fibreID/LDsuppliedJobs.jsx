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
  Breadcrumbs,
  Link,
} from "@mui/material";
import {
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
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [reportViewedAssessmentIds, setReportViewedAssessmentIds] = useState(
    new Set(),
  );
  const [sendingApprovalEmails, setSendingApprovalEmails] = useState({});
  const [authorisingReports, setAuthorisingReports] = useState({});
  const [sendingAuthorisationRequests, setSendingAuthorisationRequests] =
    useState({});

  useEffect(() => {
    fetchAsbestosAssessments();
  }, []);

  // Only show assessments where samples have been confirmed submitted to the lab (samplesReceivedDate set by Submit Samples to Lab modal on AssessmentItems)
  const hasSamplesSubmittedToLab = (assessment) =>
    !!assessment.samplesReceivedDate;

  const fetchAsbestosAssessments = async () => {
    try {
      setLoading(true);
      // Fetch all asbestos assessments
      const response = await asbestosAssessmentService.getAsbestosAssessments();

      // Show only L&D supplied assessments where sample submission was confirmed (samplesReceivedDate set)
      const allAssessments = response.data || [];
      const submittedOnly = Array.isArray(allAssessments)
        ? allAssessments.filter(hasSamplesSubmittedToLab)
        : [];
      setAssessments(submittedOnly);
    } catch (error) {
      console.error("Error fetching asbestos assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAssessment = (assessment) => {
    // Navigate directly to analysis page for the first item
    // The analysis page will fetch the full assessment and handle item selection
    navigate(`/fibre-id/assessment/${assessment._id}/item/1/analysis`);
  };

  // Number of sampled items: unique sample numbers (distinct sampleReference, excluding visually assessed)
  const getUniqueSampleCount = (assessment) => {
    if (!assessment.items || assessment.items.length === 0) {
      return 0;
    }
    const items = assessment.items;
    const uniqueRefs = new Set();
    items.forEach((item) => {
      if (!item.sampleReference || item.sampleReference.trim() === "") return;
      const isVisuallyAssessed =
        item.asbestosContent === "Visually Assessed as Asbestos" ||
        item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
        item.asbestosContent === "Visually Assessed as Non-asbestos";
      if (isVisuallyAssessed) return;
      uniqueRefs.add(item.sampleReference.trim());
    });
    return uniqueRefs.size;
  };

  // L&D supplied jobs table status only (samples-in-lab | analysis-complete); not the linked assessment workflow status
  const getLabSamplesStatus = (assessment) => {
    if (assessment.labSamplesStatus) return assessment.labSamplesStatus;
    // Backwards compatibility: derive from assessment status
    if (
      assessment.status === "sample-analysis-complete" ||
      assessment.status === "report-ready-for-review" ||
      assessment.status === "complete"
    ) {
      return "analysis-complete";
    }
    return "samples-in-lab";
  };

  const getLabStatusColor = (status) => {
    switch (status) {
      case "samples-in-lab":
        return "primary";
      case "analysis-complete":
        return "success";
      default:
        return "default";
    }
  };

  const getLabStatusLabel = (status) => {
    switch (status) {
      case "samples-in-lab":
        return "Samples in lab";
      case "analysis-complete":
        return "Analysis complete";
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
      (item) => item.analysisData && item.analysisData.isAnalysed === true,
    );
  };

  const handleGeneratePDF = async (assessment, options = {}) => {
    const {
      uploadToAssessment = false,
      skipOpenDownload = false,
    } = options; // uploadToAssessment: when authorising/approving – save report to assessment. skipOpenDownload: when true, don't open PDF in new tab (e.g. on approve).
    try {
      setGeneratingPDF((prev) => ({ ...prev, [assessment._id]: true }));

      // Fetch the full assessment with populated data
      const assessmentResponse =
        await asbestosAssessmentService.getAsbestosAssessmentById(
          assessment._id,
        );
      const fullAssessment = assessmentResponse.data;

      // Get sampled items that have been analysed
      const items = fullAssessment.items || [];

      // Include one item per unique sample reference that is analysed (so referred samples appear once in PDF)
      const seenRefs = new Set();
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
        if (item.analysisData?.isAnalysed !== true) {
          return false;
        }
        const ref = item.sampleReference.trim();
        if (seenRefs.has(ref)) return false;
        seenRefs.add(ref);
        return true;
      });

      if (sampledItems.length === 0) {
        showSnackbar(
          "No analysed samples found. Ensure all samples are analysed before generating the PDF.",
          "warning",
        );
        return;
      }

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
          console.log(
            "PDF Generation - Analyst from assessment level:",
            analyst,
          );
        } else if (typeof fullAssessment.analyst === "string") {
          // If it's just an ID, we can't use it directly
          console.log(
            "PDF Generation - Assessment analyst is string ID, trying fallback",
          );
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

      // Always request PDF data and download (avoids blank page when opening data URL in new tab)
      const pdfDataUrl = await generateFibreIDReport({
        assessment: assessmentForReport,
        sampleItems: sampleItemsForReport,
        analyst: analyst,
        openInNewTab: false,
        returnPdfData: true,
        reportApprovedBy: fullAssessment.reportApprovedBy || null,
        reportIssueDate: fullAssessment.reportIssueDate || null,
      });

      // Save to assessment only when authorising, so only authorised reports attach to the asbestos assessment PDF
      if (uploadToAssessment) {
        const base64Data =
          pdfDataUrl && pdfDataUrl.includes(",")
            ? pdfDataUrl.split(",")[1]
            : null;
        if (base64Data) {
          await asbestosAssessmentService.uploadFibreAnalysisReport(
            assessment._id,
            {
              reportData: base64Data,
            },
          );
        }
      }

      // Open PDF in new tab unless skipOpenDownload (e.g. when approving – we still upload to assessment but don't open/download)
      if (pdfDataUrl && !skipOpenDownload) {
        const base64 = pdfDataUrl.includes(",")
          ? pdfDataUrl.split(",")[1]
          : pdfDataUrl;
        if (base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank");
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } else {
          window.open(pdfDataUrl, "_blank");
        }
      } else if (!pdfDataUrl) {
        showSnackbar(
          "PDF could not be generated (e.g. logo failed to load).",
          "error",
        );
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

      // Fibre ID approval only - update reportApprovedBy. Do NOT touch reportAuthorisedBy (assessment authorisation).
      const projectId = assessment.projectId?._id || assessment.projectId;
      const response = await asbestosAssessmentService.updateAsbestosAssessment(
        assessment._id,
        {
          projectId,
          assessmentDate: assessment.assessmentDate,
          reportApprovedBy: approver,
          reportIssueDate: now,
          status: "report-ready-for-review",
        },
      );

      console.log("Report approved successfully:", response);

      // Refresh the assessments list
      await fetchAsbestosAssessments();

      // Generate and attach the approved report to the assessment (no automatic download)
      try {
        await handleGeneratePDF(assessment, {
          uploadToAssessment: true,
          skipOpenDownload: true,
        });
        showSnackbar("Report approved successfully.", "success");
      } catch (reportError) {
        console.error("Error generating approved report:", reportError);
        showSnackbar(
          "Report approved but failed to save report to assessment.",
          "warning",
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
        "info",
      );
    } catch (error) {
      console.error("Error sending approval request emails:", error);
      showSnackbar(
        "Failed to send approval request emails. Please try again.",
        "error",
      );
    } finally {
      setSendingApprovalEmails((prev) => ({
        ...prev,
        [assessment._id]: false,
      }));
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
          "success",
        );
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning",
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
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [assessment._id]: true,
      }));

      const response = await asbestosAssessmentService.sendForAuthorisation(
        assessment._id,
      );

      showSnackbar(
        response.data?.message ||
          `Authorisation request emails sent successfully to ${
            response.data?.recipients?.length || 0
          } report proofer user(s)`,
        "success",
      );
      await fetchAsbestosAssessments();
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error",
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
          assessment._id,
        );
        return "Date unavailable";
      }
    }

    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();

    if (diffTime < 0) {
      // Overdue
      const daysOverdue = Math.floor(
        Math.abs(diffTime) / (1000 * 60 * 60 * 24),
      );
      const hoursOverdue = Math.floor(
        (Math.abs(diffTime) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const daysText = daysOverdue === 1 ? "day" : "days";
      const hoursText = hoursOverdue === 1 ? "hour" : "hours";
      return `Overdue: ${daysOverdue} ${daysText} ${hoursOverdue} ${hoursText}`;
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
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

    return "success.main"; // Not overdue - green (same as ClientSuppliedJobs)
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

        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontStyle: "italic",
            mb: 2,
          }}
        >
          Note: L&D Supplied Jobs will be automatically removed from the L&D
          Supplied Jobs table on completion of the linked asbestos assessment
        </Typography>

        {/* Assessments Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table
              stickyHeader
              sx={{
                "& .MuiTableCell-root": {
                  padding: "11px 8px",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "80px" }}>
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "240px" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "105px" }}>
                    Sample Receipt Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "70px" }}>
                    No. of Samples
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "80px" }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", Width: "110px" }}>
                    Analysis Due
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      width: "1%",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading assessments...
                    </TableCell>
                  </TableRow>
                ) : assessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No active asbestos survey jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  assessments.map((assessment) => {
                    const sampleCount = getUniqueSampleCount(assessment);
                    const labStatus = getLabSamplesStatus(assessment);
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
                                  assessment.samplesReceivedDate,
                                ).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {sampleCount}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: "160px" }}>
                          <Chip
                            label={getLabStatusLabel(labStatus)}
                            color={getLabStatusColor(labStatus)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: "100px" }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                              color: getAnalysisDueColor(assessment),
                            }}
                          >
                            {getAnalysisDueTime(assessment)}
                          </Typography>
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          sx={{ width: "1%", minWidth: "200px" }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              gap: 1,
                              flexWrap: "wrap",
                              alignItems: "flex-start",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 1,
                                flexWrap: "wrap",
                              }}
                            >
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
                                    labStatus !== "analysis-complete"
                                  }
                                >
                                  {generatingPDF[assessment._id]
                                    ? "..."
                                    : "PDF"}
                                </Button>
                                {!assessment.reportApprovedBy &&
                                  assessment.status ===
                                    "sample-analysis-complete" && (
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
                              {assessment.reportApprovedBy && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "text.secondary",
                                    fontStyle: "italic",
                                    maxWidth: "280px",
                                  }}
                                >
                                  Approved
                                </Typography>
                              )}
                            </Box>
                            {(() => {
                              const conditions = {
                                fibreIdApproved: Boolean(
                                  assessment.reportApprovedBy,
                                ),
                                notAuthorised: !assessment.reportAuthorisedBy,
                                reportViewed: reportViewedAssessmentIds.has(
                                  assessment._id,
                                ),
                                labComplete: labStatus === "analysis-complete",
                                hasAdminPermission: hasPermission(
                                  currentUser,
                                  "admin.view",
                                ),
                                hasEditPermission: hasPermission(
                                  currentUser,
                                  "asbestos.edit",
                                ),
                                isReportProofer: Boolean(
                                  currentUser?.reportProofer,
                                ),
                                isLabSignatory: Boolean(
                                  currentUser?.labSignatory,
                                ),
                              };
                              const canAuthorise =
                                conditions.isReportProofer ||
                                conditions.isLabSignatory;
                              const canApproveFibreId =
                                conditions.isReportProofer ||
                                conditions.isLabSignatory ||
                                currentUser?.labApprovals?.fibreCounting ||
                                currentUser?.labApprovals?.fibreIdentification;
                              // Approve (fibre ID): after viewing, when fibre ID not yet approved
                              const showApproveFibreId =
                                conditions.reportViewed &&
                                !conditions.fibreIdApproved &&
                                conditions.labComplete &&
                                canApproveFibreId;
                              // Authorise/Send: after viewing, when fibre ID approved but assessment not yet authorised
                              const baseVisibleAuthorise =
                                conditions.reportViewed &&
                                conditions.fibreIdApproved &&
                                conditions.notAuthorised;
                              const visibility = {
                                showApproveFibreId,
                                showAuthorise:
                                  baseVisibleAuthorise &&
                                  conditions.hasAdminPermission &&
                                  canAuthorise,
                                showSend:
                                  baseVisibleAuthorise &&
                                  !canAuthorise &&
                                  conditions.hasEditPermission,
                              };
                              return (
                                <>
                                  {visibility.showApproveFibreId && (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      color="primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApproveReport(assessment);
                                      }}
                                      disabled={generatingPDF[assessment._id]}
                                      sx={{ textTransform: "none" }}
                                    >
                                      Approve
                                    </Button>
                                  )}
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
                                        sendingAuthorisationRequests[
                                          assessment._id
                                        ]
                                      }
                                    >
                                      {sendingAuthorisationRequests[
                                        assessment._id
                                      ]
                                        ? "Sending..."
                                        : "Send for Authorisation"}
                                    </Button>
                                  )}
                                </>
                              );
                            })()}
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
