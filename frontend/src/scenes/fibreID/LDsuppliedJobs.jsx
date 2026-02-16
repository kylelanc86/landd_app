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
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
  Mail as MailIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { asbestosAssessmentService, clientSuppliedJobsService, projectService } from "../../services/api";
import { getTodayInSydney } from "../../utils/dateUtils";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { format } from "date-fns";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";

/** Add business days to a date, skipping weekends. */
const addBusinessDays = (date, businessDays) => {
  const result = new Date(date);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) added++;
  }
  return result;
};

const LDsuppliedJobs = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [standaloneJobs, setStandaloneJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState({});
  const [reportViewedAssessmentIds, setReportViewedAssessmentIds] = useState(
    new Set(),
  );
  const [sendingApprovalEmails, setSendingApprovalEmails] = useState({});
  const [authorisingReports, setAuthorisingReports] = useState({});
  const [sendingAuthorisationRequests, setSendingAuthorisationRequests] =
    useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sampleReceiptDate, setSampleReceiptDate] = useState("");
  const [turnaroundTime, setTurnaroundTime] = useState("");
  const [analysisDueDate, setAnalysisDueDate] = useState(new Date());
  const [showCustomTurnaround, setShowCustomTurnaround] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [sampleReceiptDateError, setSampleReceiptDateError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [reportViewedJobIds, setReportViewedJobIds] = useState(new Set());

  useEffect(() => {
    fetchAsbestosAssessments();
    fetchStandaloneLDJobs();
    fetchProjects();
  }, []);

  const fetchStandaloneLDJobs = async () => {
    try {
      const response = await clientSuppliedJobsService.getAll({ supplyType: "ld" });
      const data = response.data || [];
      setStandaloneJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching standalone L&D supplied jobs:", error);
      setStandaloneJobs([]);
    }
  };

  const fetchProjects = async () => {
    try {
      let response;
      let projectsData = [];
      try {
        response = await projectService.getAll({ limit: 1000, status: "all_active" });
        if (response?.data) {
          projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
        }
      } catch (e) {
        try {
          response = await projectService.getAssignedToMe({ limit: 1000, status: "all_active" });
          if (response?.data) {
            projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
          }
        } catch (e2) {
          response = await projectService.getAll({ limit: 1000 });
          if (response?.data) {
            projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
          }
        }
      }
      const sorted = (projectsData || []).sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum;
      });
      setProjects(sorted);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  };

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
    navigate(`/fibre-id/assessment/${assessment._id}/item/1/analysis`);
  };

  const handleViewStandaloneJob = (job) => {
    navigate(`/laboratory-services/ld-supplied/${job._id}/samples`);
  };

  const handleCreateJob = async () => {
    if (!selectedProject) return;
    if (!sampleReceiptDate || sampleReceiptDate.trim() === "") {
      setSampleReceiptDateError(true);
      return;
    }
    if (!turnaroundTime && !showCustomTurnaround) {
      showSnackbar("Please select a turnaround time", "error");
      return;
    }
    if (showCustomTurnaround && !analysisDueDate) {
      showSnackbar("Please select an analysis due date", "error");
      return;
    }
    try {
      setSampleReceiptDateError(false);
      setCreatingJob(true);
      const jobData = {
        projectId: selectedProject._id,
        jobType: "Fibre ID",
        sampleReceiptDate: sampleReceiptDate.trim(),
        supplyType: "ld",
      };
      const finalTurnaround = showCustomTurnaround ? "custom" : turnaroundTime;
      if (finalTurnaround) jobData.turnaroundTime = finalTurnaround;
      if (analysisDueDate) {
        jobData.analysisDueDate = analysisDueDate.toISOString
          ? analysisDueDate.toISOString()
          : new Date(analysisDueDate).toISOString();
      }
      await clientSuppliedJobsService.create(jobData);
      await fetchStandaloneLDJobs();
      setCreateDialogOpen(false);
      setSelectedProject(null);
      setSampleReceiptDate("");
      setTurnaroundTime("");
      setAnalysisDueDate(new Date());
      setShowCustomTurnaround(false);
      showSnackbar("L&D supplied job created successfully.", "success");
    } catch (error) {
      console.error("Error creating L&D supplied job:", error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create job.";
      showSnackbar(msg, "error");
    } finally {
      setCreatingJob(false);
    }
  };

  /** Analysis due text for standalone jobs (e.g. "3d 2h" or "Overdue 1d 0h"). */
  const getAnalysisDueText = (analysisDueDate) => {
    if (!analysisDueDate) return "—";
    const due = new Date(analysisDueDate);
    if (isNaN(due.getTime())) return "—";
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const totalHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    parts.push(`${hours}h`);
    const timeStr = parts.join(" ");
    return diffMs < 0 ? `Overdue ${timeStr}` : timeStr;
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
    const { uploadToAssessment = false, skipOpenDownload = false } = options; // uploadToAssessment: when authorising/approving – save report to assessment. skipOpenDownload: when true, don't open PDF in new tab (e.g. on approve).
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

  const areAllSamplesAnalysed = (job) => {
    if (!job || !job.samples || job.samples.length === 0) return false;
    return job.samples.every(
      (sample) =>
        sample.analysisData &&
        sample.analysisData.isAnalysed === true &&
        sample.analysedAt,
    );
  };

  const handleGeneratePDFForJob = async (job) => {
    try {
      setGeneratingPDF((prev) => ({ ...prev, [job._id]: true }));
      const jobResponse = await clientSuppliedJobsService.getById(job._id);
      const fullJob = jobResponse.data;
      const sampleItems = fullJob.samples || [];
      let analyst = "Unknown Analyst";
      const analysedSample = sampleItems.find((s) => s.analysedBy);
      if (analysedSample?.analysedBy) {
        if (typeof analysedSample.analysedBy === "object" && analysedSample.analysedBy.firstName) {
          analyst = `${analysedSample.analysedBy.firstName} ${analysedSample.analysedBy.lastName}`;
        } else if (typeof analysedSample.analysedBy === "string") {
          analyst = analysedSample.analysedBy;
        }
      } else if (fullJob.analyst) analyst = fullJob.analyst;
      const sampleItemsForReport = sampleItems
        .filter((item) => item.analysisData && item.analysisData.isAnalysed === true)
        .map((item, index) => ({
          itemNumber: index + 1,
          sampleReference: item.labReference || `Sample ${index + 1}`,
          labReference: item.labReference || `Sample ${index + 1}`,
          locationDescription: item.clientReference || item.sampleDescription || "N/A",
          clientReference: item.clientReference,
          analysisData: item.analysisData,
        }));
      const assessmentForReport = {
        _id: fullJob._id,
        projectId: fullJob.projectId,
        jobType: fullJob.jobType,
        status: fullJob.status,
        analysisDate: fullJob.analysisDate,
        sampleReceiptDate: fullJob.sampleReceiptDate,
        revision: fullJob.revision || 0,
      };
      await generateFibreIDReport({
        assessment: assessmentForReport,
        sampleItems: sampleItemsForReport,
        analyst: analyst || "Unknown Analyst",
        openInNewTab: !fullJob.reportApprovedBy,
        returnPdfData: false,
        reportApprovedBy: fullJob.reportApprovedBy || null,
        reportIssueDate: fullJob.reportIssueDate || null,
      });
      setReportViewedJobIds((prev) => new Set(prev).add(job._id));
    } catch (error) {
      console.error("Error generating PDF:", error);
      showSnackbar("Failed to generate report.", "error");
    } finally {
      setGeneratingPDF((prev) => ({ ...prev, [job._id]: false }));
    }
  };

  const handleAuthoriseReportForJob = async (job) => {
    try {
      setAuthorisingReports((prev) => ({ ...prev, [job._id]: true }));
      await clientSuppliedJobsService.authorise(job._id);
      await fetchStandaloneLDJobs();
      try {
        await handleGeneratePDFForJob(job);
        showSnackbar("Report authorised and downloaded successfully.", "success");
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar("Report authorised but failed to generate download.", "warning");
      }
    } catch (error) {
      console.error("Error authorising report:", error);
      showSnackbar("Failed to authorise report. Please try again.", "error");
    } finally {
      setAuthorisingReports((prev) => ({ ...prev, [job._id]: false }));
    }
  };

  const handleSendForAuthorisationForJob = async (job) => {
    try {
      setSendingAuthorisationRequests((prev) => ({ ...prev, [job._id]: true }));
      await clientSuppliedJobsService.sendForAuthorisation(job._id);
      showSnackbar(
        "Authorisation request emails sent successfully to report proofer user(s).",
        "success",
      );
      await fetchStandaloneLDJobs();
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message || "Failed to send authorisation request emails. Please try again.",
        "error",
      );
    } finally {
      setSendingAuthorisationRequests((prev) => ({ ...prev, [job._id]: false }));
    }
  };

  const handleDeleteJob = (jobId) => {
    setJobToDelete(jobId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      await clientSuppliedJobsService.delete(jobToDelete);
      await fetchStandaloneLDJobs();
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      showSnackbar("Job deleted successfully.", "success");
    } catch (error) {
      console.error("Error deleting job:", error);
      showSnackbar(error.response?.data?.message || "Failed to delete job.", "error");
    }
  };

  const cancelDeleteJob = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
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
          Jobs linked to asbestos assessments appear (<b>in bold</b>) here once samples are
          submitted to the lab. <br></br> 
          You can also create standalone L&D supplied jobs (no asbestos/residential assessment link) via Add New Job.
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
                <TableRow sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white" }}>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "80px", color: "inherit" }}>
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "240px", color: "inherit" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "105px", color: "inherit" }}>
                    Sample Receipt Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "70px", color: "inherit" }}>
                    No. of Samples
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", maxWidth: "80px", color: "inherit" }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", Width: "110px", color: "inherit" }}>
                    Analysis Due
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      width: "1%",
                      whiteSpace: "nowrap",
                      color: "inherit",
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
                ) : assessments.length === 0 && standaloneJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No L&D supplied jobs. Create a standalone job with Add New Job, or submit samples from an asbestos assessment.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                  {assessments.map((assessment) => {
                    const sampleCount = getUniqueSampleCount(assessment);
                    const labStatus = getLabSamplesStatus(assessment);
                    return (
                      <TableRow
                        key={assessment._id}
                        hover
                        onClick={() => handleViewAssessment(assessment)}
                        sx={{
                          cursor: "pointer",
                          "& .MuiTypography-root": { fontWeight: "bold" },
                          "& .MuiChip-label": { fontWeight: "bold" },
                        }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "bold" }}
                          >
                            {assessment.projectId?.projectID || "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                            {assessment.projectId?.name || "Unnamed Project"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
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
                            sx={{ fontWeight: "bold" }}
                          >
                            {sampleCount}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: "160px" }}>
                          <Chip
                            label={getLabStatusLabel(labStatus)}
                            color={getLabStatusColor(labStatus)}
                            size="small"
                            sx={{ "& .MuiChip-label": { fontWeight: "bold" } }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: "100px" }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: "bold",
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
                              // Authorise/Send: after viewing, when lab complete and assessment not yet authorised
                              const baseVisibleAuthorise =
                                conditions.reportViewed &&
                                conditions.labComplete &&
                                conditions.notAuthorised;
                              const visibility = {
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
                  })}
                  {standaloneJobs.map((job) => (
                    <TableRow
                      key={`job-${job._id}`}
                      hover
                      onClick={() => handleViewStandaloneJob(job)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                          {job.projectId?.projectID || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.name || "Unnamed Project"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.sampleReceiptDate
                            ? new Date(job.sampleReceiptDate).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                          {job.samples?.length || 0}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: "160px" }}>
                        <Chip
                          label={job.status || "In Progress"}
                          color={
                            job.status === "Completed"
                              ? "success"
                              : job.status === "Analysis Complete"
                                ? "warning"
                                : "info"
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: "100px" }}>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{
                            color: !job.analysisDueDate
                              ? "text.secondary"
                              : new Date(job.analysisDueDate) < new Date()
                                ? "error.main"
                                : "success.main",
                          }}
                        >
                          {getAnalysisDueText(job.analysisDueDate)}
                        </Typography>
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        sx={{ width: "1%", minWidth: "200px" }}
                      >
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGeneratePDFForJob(job);
                              }}
                              color="secondary"
                              size="small"
                              startIcon={<PdfIcon />}
                              disabled={
                                generatingPDF[job._id] ||
                                (job.samples?.length || 0) === 0 ||
                                !areAllSamplesAnalysed(job)
                              }
                            >
                              {generatingPDF[job._id] ? "..." : "PDF"}
                            </Button>
                            {!job.reportApprovedBy && job.status === "Analysis Complete" && (
                              <Typography
                                variant="caption"
                                sx={{ color: "error.main", fontSize: "0.7rem", mt: 0.5, ml: 0.5 }}
                              >
                                Not approved
                              </Typography>
                            )}
                          </Box>
                          {(() => {
                            const conditions = {
                              notApproved: !job.reportApprovedBy,
                              reportViewed: reportViewedJobIds.has(job._id),
                              hasAdminPermission: hasPermission(currentUser, "admin.view"),
                              hasEditPermission: hasPermission(currentUser, "clientSup.edit"),
                              isReportProofer: Boolean(currentUser?.reportProofer),
                            };
                            const baseVisible = conditions.notApproved && conditions.reportViewed;
                            const visibility = {
                              showAuthorise: baseVisible && conditions.hasAdminPermission && conditions.isReportProofer,
                              showSend: baseVisible && !conditions.isReportProofer && conditions.hasEditPermission,
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
                                      handleAuthoriseReportForJob(job);
                                    }}
                                    disabled={authorisingReports[job._id] || generatingPDF[job._id]}
                                    sx={{
                                      backgroundColor: "#4caf50",
                                      color: "white",
                                      "&:hover": { backgroundColor: "#45a049" },
                                    }}
                                  >
                                    {authorisingReports[job._id] ? "Authorising..." : "Authorise Report"}
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
                                      handleSendForAuthorisationForJob(job);
                                    }}
                                    disabled={sendingAuthorisationRequests[job._id]}
                                  >
                                    {sendingAuthorisationRequests[job._id] ? "Sending..." : "Send for Authorisation"}
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          {hasPermission(currentUser, "clientSup.delete") && (
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
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

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
              Are you sure you want to delete this L&D supplied job? This action cannot be undone.
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

        {/* Create L&D Supplied Job Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => {
            setCreateDialogOpen(false);
            setSelectedProject(null);
            setSampleReceiptDate("");
            setTurnaroundTime("");
            setAnalysisDueDate(new Date());
            setShowCustomTurnaround(false);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" } }}
        >
          <DialogTitle sx={{ pb: 2, px: 3, pt: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.main", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AddIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Create New L&D Supplied Job
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
            <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
              {Array.isArray(projects) && projects.length > 0 ? (
                <>
                  <Autocomplete
                    options={projects}
                    getOptionLabel={(option) => `${option.projectID || "N/A"} - ${option.name || "Unnamed Project"}`}
                    value={selectedProject}
                    onChange={(e, newValue) => setSelectedProject(newValue)}
                    isOptionEqualToValue={(option, value) => option._id === value._id}
                    renderInput={(params) => (
                      <TextField {...params} label="Select Project" placeholder="Search for a project..." required fullWidth />
                    )}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box>
                          <Typography variant="body1">{option.projectID || "N/A"} - {option.name || "Unnamed Project"}</Typography>
                          <Typography variant="body2" color="text.secondary">Client: {option.client?.name || "Not specified"}</Typography>
                        </Box>
                      </li>
                    )}
                  />
                  <TextField
                    fullWidth
                    label="Sample Receipt Date"
                    type="date"
                    value={sampleReceiptDate}
                    onChange={(e) => {
                      setSampleReceiptDate(e.target.value);
                      if (sampleReceiptDateError) setSampleReceiptDateError(false);
                    }}
                    InputLabelProps={{ shrink: true }}
                    error={sampleReceiptDateError}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button size="small" onClick={() => setSampleReceiptDate(getTodayInSydney())} sx={{ textTransform: "none", minWidth: "auto" }}>
                            Today
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {sampleReceiptDateError && (
                    <Typography variant="body2" sx={{ color: "error.main" }}>Enter the sample receipt date to create the new job.</Typography>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Turnaround</Typography>
                    <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                      <Button
                        variant={turnaroundTime === "3 day" ? "contained" : "outlined"}
                        onClick={() => {
                          const base = sampleReceiptDate ? new Date(sampleReceiptDate) : new Date();
                          setTurnaroundTime("3 day");
                          setAnalysisDueDate(addBusinessDays(base, 3));
                          setShowCustomTurnaround(false);
                        }}
                        sx={{ minWidth: 100, borderRadius: 2, textTransform: "none", fontWeight: 500 }}
                      >
                        3 day
                      </Button>
                      <Button
                        variant={turnaroundTime === "24 hours" ? "contained" : "outlined"}
                        onClick={() => {
                          const base = sampleReceiptDate ? new Date(sampleReceiptDate) : new Date();
                          setTurnaroundTime("24 hours");
                          setAnalysisDueDate(addBusinessDays(base, 1));
                          setShowCustomTurnaround(false);
                        }}
                        sx={{ minWidth: 100, borderRadius: 2, textTransform: "none", fontWeight: 500 }}
                      >
                        24 hours
                      </Button>
                      <Button
                        variant={showCustomTurnaround ? "contained" : "outlined"}
                        onClick={() => {
                          setShowCustomTurnaround(true);
                          setTurnaroundTime("");
                          setAnalysisDueDate(new Date());
                        }}
                        sx={{ minWidth: 100, borderRadius: 2, textTransform: "none", fontWeight: 500 }}
                      >
                        Custom
                      </Button>
                    </Box>
                    {(turnaroundTime === "3 day" || turnaroundTime === "24 hours") && analysisDueDate && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: "italic" }}>
                        Analysis due: {format(analysisDueDate instanceof Date ? analysisDueDate : new Date(analysisDueDate), "dd/MM/yyyy HH:mm")}
                      </Typography>
                    )}
                    {showCustomTurnaround && (
                      <Box sx={{ mt: 2 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DateTimePicker
                            label="Analysis Due Date & Time"
                            value={analysisDueDate instanceof Date ? analysisDueDate : new Date(analysisDueDate)}
                            onChange={(v) => setAnalysisDueDate(v)}
                            slots={{ textField: TextField }}
                            slotProps={{ textField: { fullWidth: true } }}
                            format="dd/MM/yyyy HH:mm"
                          />
                        </LocalizationProvider>
                      </Box>
                    )}
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {projects.length === 0 ? "No projects available." : "Loading projects..."}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setSelectedProject(null);
                setSampleReceiptDate("");
                setTurnaroundTime("");
                setAnalysisDueDate(new Date());
                setShowCustomTurnaround(false);
              }}
              variant="outlined"
              sx={{ minWidth: 100, borderRadius: 2, textTransform: "none", fontWeight: 500 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              variant="contained"
              disabled={!selectedProject || creatingJob || !projects?.length}
              startIcon={<AddIcon />}
              sx={{ minWidth: 120, borderRadius: 2, textTransform: "none", fontWeight: 500 }}
            >
              {creatingJob ? "Creating..." : "Create Job"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default LDsuppliedJobs;
