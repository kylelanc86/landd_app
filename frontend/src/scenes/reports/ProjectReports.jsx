import React, { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import {
  Box,
  Typography,
  Button,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArchiveIcon from "@mui/icons-material/Archive";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import UploadIcon from "@mui/icons-material/Upload";
import ReportCategories from "./ReportCategories";
import ReportsList from "./ReportsList";
import ArchivedDataDialog from "./ArchivedDataDialog";
import { useNavigate } from "react-router-dom";
import {
  projectService,
  sampleService,
  clientService,
  clientSuppliedJobsService,
} from "../../services/api";
import reportService from "../../services/reportService";
import { generateShiftReport } from "../../utils/generateShiftReport";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";
import ProjectLogModalWrapper from "./ProjectLogModalWrapper";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
import { useAuth } from "../../context/AuthContext";
import { getTodayInSydney } from "../../utils/dateUtils";

const ProjectReports = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [checkingReports, setCheckingReports] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    reportType: "",
    reportDate: getTodayInSydney(),
    description: "",
    asbestosRemovalist: "",
    status: "completed",
    file: null,
  });
  const [uploading, setUploading] = useState(false);

  // Status editing state
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  // Active jobs state
  const [activeJobs, setActiveJobs] = useState([]);
  const [loadingActiveJobs, setLoadingActiveJobs] = useState(false);

  // Report processing state
  const [processingReport, setProcessingReport] = useState({
    reportId: null,
    action: null, // 'view' or 'download'
  });

  // COC dialog state
  const [cocDialogOpen, setCocDialogOpen] = useState(false);
  const [cocFullScreenOpen, setCocFullScreenOpen] = useState(false);
  const [selectedCOC, setSelectedCOC] = useState(null);

  // Archived data dialog state
  const [archivedDialogOpen, setArchivedDialogOpen] = useState(false);

  const { showSnackbar } = useSnackbar();

  // Function to format job status for display
  const formatJobStatus = (status) => {
    if (!status) return "";

    // Replace underscores with spaces
    let formatted = status.replace(/_/g, " ");

    // Capitalize first letter of each word
    formatted = formatted
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    return formatted;
  };

  // Function to format date or date range for display
  const formatDateRange = (dates) => {
    if (!dates || dates.length === 0) return "N/A";

    // Remove duplicates and sort
    const uniqueDates = [
      ...new Set(
        dates.map((date) => {
          const d = new Date(date);
          return d.toISOString().split("T")[0]; // Get YYYY-MM-DD format
        }),
      ),
    ].sort();

    if (uniqueDates.length === 1) {
      // Single date
      const date = new Date(uniqueDates[0]);
      return date.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } else {
      // Date range
      const startDate = new Date(uniqueDates[0]);
      const endDate = new Date(uniqueDates[uniqueDates.length - 1]);
      return `${startDate.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })} - ${endDate.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`;
    }
  };

  // Revise dialog state
  const [reviseDialog, setReviseDialog] = useState({
    open: false,
    report: null,
  });

  // Revision reason state
  const [revisionReason, setRevisionReason] = useState("");

  // Get project statuses context
  const { activeStatuses, inactiveStatuses, statusColors } =
    useProjectStatuses();

  // Get auth context for admin check
  const { currentUser } = useAuth();
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  // Debug logging for admin check
  console.log("ProjectReports - currentUser:", currentUser);
  console.log("ProjectReports - isAdmin:", isAdmin);

  // Function to add project to recent searches
  const addToRecentSearches = useCallback((project) => {
    try {
      if (!project || !project._id) return;

      // Get existing recent searches
      const savedSearches = localStorage.getItem("recentProjectSearches");
      let recentSearches = savedSearches ? JSON.parse(savedSearches) : [];

      // Remove project if it already exists (to move to top)
      recentSearches = recentSearches.filter((p) => p._id !== project._id);

      // Prepare project data for storage
      // Ensure client is properly stored (can be object or populated)
      let clientData = project.client;
      if (clientData && typeof clientData === "object" && clientData._id) {
        // If client is populated, keep the object structure
        clientData = {
          _id: clientData._id,
          name: clientData.name || "",
        };
      }

      const projectToSave = {
        _id: project._id,
        projectID: project.projectID,
        name: project.name,
        client: clientData,
        reports_present: project.reports_present || false,
      };

      // Add to beginning of array
      recentSearches.unshift(projectToSave);

      // Keep only the most recent 20 projects
      const limitedSearches = recentSearches.slice(0, 20);

      // Save back to localStorage
      localStorage.setItem(
        "recentProjectSearches",
        JSON.stringify(limitedSearches),
      );

      // Dispatch a custom event to notify other components
      window.dispatchEvent(new Event("recentProjectsUpdated"));
    } catch (error) {
      console.error("Error adding project to recent searches:", error);
    }
  }, []);

  // Load active jobs for this project
  const loadActiveJobs = useCallback(async () => {
    if (!projectId) return;

    setLoadingActiveJobs(true);
    try {
      const activeJobsList = [];

      // Fetch active asbestos removal jobs
      try {
        const { default: asbestosRemovalJobService } =
          await import("../../services/asbestosRemovalJobService");
        const jobsResponse = await asbestosRemovalJobService.getAll({
          projectId: projectId,
        });
        const jobs = jobsResponse.jobs || jobsResponse.data || [];
        const activeAsbestosJobs = jobs.filter(
          (job) =>
            (job.projectId === projectId || job.projectId?._id === projectId) &&
            job.status === "in_progress",
        );

        // Fetch shifts for all asbestos removal jobs to get dates
        for (const job of activeAsbestosJobs) {
          let dates = [];
          try {
            const { shiftService } = await import("../../services/api");
            const shiftsResponse = await shiftService.getByJob(job._id);
            const shifts = shiftsResponse.data || [];
            dates = shifts.map((shift) => shift.date).filter(Boolean);
          } catch (shiftError) {
            console.error(
              `Error fetching shifts for job ${job._id}:`,
              shiftError,
            );
          }

          activeJobsList.push({
            id: job._id,
            type: "asbestos-removal",
            name: job.name || "Asbestos Removal Job",
            status: job.status,
            asbestosRemovalist: job.asbestosRemovalist,
            jobType: job.jobType || "none",
            url: `/asbestos-removal/jobs/${job._id}/details`,
            dates: dates,
          });
        }
      } catch (error) {
        console.error("Error fetching active asbestos removal jobs:", error);
      }

      // Fetch active client supplied jobs (fibre ID)
      try {
        const { clientSuppliedJobsService } =
          await import("../../services/api");
        const clientJobsResponse = await clientSuppliedJobsService.getAll({
          projectId: projectId,
        });
        const clientJobs = clientJobsResponse.data || [];
        const activeClientJobs = clientJobs.filter(
          (job) =>
            (job.projectId === projectId || job.projectId?._id === projectId) &&
            (job.status === "In Progress" ||
              job.status === "Analysis Complete"),
        );

        activeClientJobs.forEach((job) => {
          // Collect all relevant dates for client supplied jobs
          const dates = [];
          if (job.sampleReceiptDate) dates.push(job.sampleReceiptDate);
          if (job.analysisDate) dates.push(job.analysisDate);
          if (job.reportIssueDate) dates.push(job.reportIssueDate);

          activeJobsList.push({
            id: job._id,
            type: "fibre-id",
            name:
              job.jobNumber || `Fibre ID Job - ${job.jobType || "Fibre ID"}`,
            status: job.status,
            jobType: job.jobType || "Fibre ID",
            url: `/client-supplied/${job._id}/samples`,
            dates: dates,
          });
        });
      } catch (error) {
        console.error("Error fetching active client supplied jobs:", error);
      }

      setActiveJobs(activeJobsList);
    } catch (error) {
      console.error("Error loading active jobs:", error);
      setActiveJobs([]);
    } finally {
      setLoadingActiveJobs(false);
    }
  }, [projectId]);

  // Load active jobs when projectId changes
  useEffect(() => {
    loadActiveJobs();
  }, [loadActiveJobs]);

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await projectService.getById(projectId);
        const projectData = response.data;
        setProject(projectData);
        setNewStatus(projectData.status || "");

        // Add project to recent searches when accessed
        addToRecentSearches(projectData);
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project details");
      }
    };
    loadProject();
  }, [projectId, addToRecentSearches]);

  // Check which report categories have data for this project
  const checkAvailableCategories = useCallback(async () => {
    if (!projectId) return;

    setCheckingReports(true);
    const available = [];

    try {
      // Check asbestos assessment reports
      try {
        const assessmentReports =
          await reportService.getAsbestosAssessmentReports(projectId);
        if (
          assessmentReports &&
          Array.isArray(assessmentReports) &&
          assessmentReports.length > 0
        ) {
          available.push("asbestos-assessment");
        }
      } catch (error) {
        console.log("No asbestos assessment reports found");
      }

      // Check asbestos removal jobs (air monitoring + clearances) - only from completed jobs
      try {
        const { default: asbestosRemovalJobService } =
          await import("../../services/asbestosRemovalJobService");

        // First check if there are any completed asbestos removal jobs for this project
        const completedJobsResponse = await asbestosRemovalJobService.getAll();
        const completedJobs =
          completedJobsResponse.jobs || completedJobsResponse.data || [];
        const hasCompletedJobs = completedJobs.some(
          (job) =>
            (job.projectId === projectId || job.projectId?._id === projectId) &&
            job.status === "completed",
        );

        // Only check for reports if there are completed jobs
        if (hasCompletedJobs) {
          // Check air monitoring reports (only from completed jobs)
          const airMonitoringResponse = await fetch(
            `${
              process.env.REACT_APP_API_URL || "http://localhost:5000/api"
            }/asbestos-clearances/air-monitoring-reports/${projectId}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            },
          );

          let hasAirMonitoring = false;
          if (airMonitoringResponse.ok) {
            const airMonitoringReports = await airMonitoringResponse.json();
            hasAirMonitoring =
              Array.isArray(airMonitoringReports) &&
              airMonitoringReports.length > 0;
          }

          // Check clearances using the dedicated endpoint
          let hasClearances = false;
          try {
            const clearanceReports =
              await reportService.getClearanceReports(projectId);
            hasClearances =
              clearanceReports &&
              Array.isArray(clearanceReports) &&
              clearanceReports.length > 0;
          } catch (clearanceError) {
            console.log("No asbestos clearance reports found");
          }

          // Only show the category when there are actual reports to display
          if (hasAirMonitoring || hasClearances) {
            available.push("asbestos-removal-jobs");
          }
        }
      } catch (error) {
        console.log("No asbestos removal job reports found");
      }

      // Check fibre ID reports (client supplied jobs)
      try {
        // Check for completed fibre ID reports
        const fibreIdReports = await reportService.getFibreIdReports(projectId);
        const hasCompletedReports =
          fibreIdReports &&
          Array.isArray(fibreIdReports) &&
          fibreIdReports.length > 0;

        // Show the category only when there are completed reports to display
        if (hasCompletedReports) {
          available.push("fibre-id");
        }
      } catch (error) {
        console.log("No fibre ID reports found");
      }

      // Check fibre count reports (client supplied jobs)
      try {
        // Check for completed fibre count reports
        const fibreCountReports =
          await reportService.getFibreCountReports(projectId);
        const hasCompletedReports =
          fibreCountReports &&
          Array.isArray(fibreCountReports) &&
          fibreCountReports.length > 0;

        // Show the category only when there are completed reports to display
        if (hasCompletedReports) {
          available.push("fibre-count");
        }
      } catch (error) {
        console.log("No fibre count reports found");
      }

      // Check uploaded reports
      try {
        const uploadedReportsResponse = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/uploaded-reports/project/${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        if (uploadedReportsResponse.ok) {
          const uploadedReports = await uploadedReportsResponse.json();

          // Add categories based on uploaded report types
          const uploadedCategories = uploadedReports.map(
            (report) => report.reportType,
          );
          const uniqueUploadedCategories = [...new Set(uploadedCategories)];

          uniqueUploadedCategories.forEach((category) => {
            if (!available.includes(category)) {
              available.push(category);
            }
          });
        }
      } catch (error) {
        console.log("No uploaded reports found");
      }

      setAvailableCategories(available);
    } catch (error) {
      console.error("Error checking available categories:", error);
      setAvailableCategories([]);
    } finally {
      setCheckingReports(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      checkAvailableCategories();
    }
  }, [projectId, checkAvailableCategories]);

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === project.status) {
      setIsEditingStatus(false);
      return;
    }

    setStatusUpdateLoading(true);
    try {
      await projectService.update(projectId, { status: newStatus });
      setProject((prev) => ({ ...prev, status: newStatus }));
      setIsEditingStatus(false);
      setError(null);
    } catch (err) {
      console.error("Error updating project status:", err);
      setError("Failed to update project status");
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Handle status edit cancel
  const handleStatusEditCancel = () => {
    setNewStatus(project.status || "");
    setIsEditingStatus(false);
  };

  // Get all available statuses (active + inactive)
  const allStatuses = [...(activeStatuses || []), ...(inactiveStatuses || [])];

  // Load reports when category changes
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let reportsData = [];

      switch (selectedCategory) {
        case "asbestos-assessment":
          // Get asbestos assessment reports for this project
          try {
            const assessmentReports =
              await reportService.getAsbestosAssessmentReports(projectId);

            if (!assessmentReports || !Array.isArray(assessmentReports)) {
              console.warn(
                "No assessment reports returned or invalid format:",
                assessmentReports,
              );
              reportsData = [];
              break;
            }

            // Map to our standard report format
            reportsData = assessmentReports.map((report) => ({
              id: report.id || report._id,
              date: report.date || report.assessmentDate || report.createdAt,
              description: report.description || "Asbestos Assessment Report",
              additionalInfo: report.assessorName || "N/A",
              status: report.status || "Unknown",
              type: "asbestos_assessment",
              data: report,
            }));
          } catch (error) {
            console.error("Error fetching asbestos assessment reports:", error);
            reportsData = [];
          }
          break;

        case "asbestos-removal-jobs":
          // Get air monitoring reports for this project using the dedicated endpoint
          try {
            const airMonitoringResponse = await fetch(
              `${
                process.env.REACT_APP_API_URL || "http://localhost:5000/api"
              }/asbestos-clearances/air-monitoring-reports/${projectId}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              },
            );

            if (airMonitoringResponse.ok) {
              const airMonitoringReports = await airMonitoringResponse.json();

              // Map air monitoring reports to report format
              const shiftReports = airMonitoringReports.map((report) => ({
                id: report._id,
                date: report.date,
                reference: `${report.jobName}-${report.name}`,
                description: "Air Monitoring Report",
                asbestosRemovalist: report.asbestosRemovalist || "N/A",
                additionalInfo: `${report.name} (${report.jobName})`,
                status: report.status,
                revision: report.revision || 0,
                type: "shift",
                data: {
                  shift: {
                    _id: report._id,
                    name: report.name,
                    date: report.date,
                    status: report.status,
                    reportApprovedBy: report.reportApprovedBy,
                    reportIssueDate: report.reportIssueDate,
                    revision: report.revision || 0,
                  },
                  job: {
                    _id: report.jobId,
                    name: report.jobName,
                    projectId: {
                      _id: report.projectId,
                      name: report.projectName,
                    },
                  },
                },
              }));

              reportsData.push(...shiftReports);
            }
          } catch (error) {
            console.error("Error fetching air monitoring reports:", error);
          }

          // Get clearances for this project using the dedicated endpoint
          try {
            const clearanceReports =
              await reportService.getClearanceReports(projectId);

            if (
              clearanceReports &&
              Array.isArray(clearanceReports) &&
              clearanceReports.length > 0
            ) {
              // Map clearances to report format
              const mappedClearanceReports = clearanceReports.map(
                (clearance) => ({
                  id: clearance.id,
                  date: clearance.date,
                  reference: clearance.reference,
                  description: clearance.description,
                  asbestosRemovalist: clearance.asbestosRemovalist || "N/A",
                  additionalInfo:
                    clearance.additionalInfo ||
                    `${clearance.clearanceType || "Clearance"} Clearance`,
                  status: clearance.status || "Unknown",
                  revision: clearance.revision || 0,
                  type: "clearance",
                  data: clearance,
                }),
              );

              reportsData.push(...mappedClearanceReports);
            }
          } catch (clearanceError) {
            console.error("Error fetching clearances:", clearanceError);
          }

          break;

        case "fibre-id":
          const fibreIdReports =
            await reportService.getFibreIdReports(projectId);
          reportsData = fibreIdReports.map((report) => ({
            id: report.id,
            date: report.date,
            description: report.description,
            status: report.status,
            revision: report.revision || 0,
            type: "fibre_id",
            data: report,
            chainOfCustody: report.chainOfCustody || null,
          }));
          break;

        case "fibre-count":
          const fibreCountReports =
            await reportService.getFibreCountReports(projectId);
          reportsData = fibreCountReports.map((report) => ({
            id: report.id,
            date: report.date,
            description: report.description,
            status: report.status,
            revision: report.revision || 0,
            type: "fibre_count",
            data: report,
            chainOfCustody: report.chainOfCustody || null,
          }));
          break;

        default:
          break;
      }

      // Add uploaded reports for the selected category
      try {
        const uploadedReportsResponse = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/uploaded-reports/project/${projectId}?reportType=${selectedCategory}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        if (uploadedReportsResponse.ok) {
          const uploadedReports = await uploadedReportsResponse.json();

          // Map uploaded reports to standard report format
          const mappedUploadedReports = uploadedReports.map((report) => ({
            id: report._id,
            date: report.reportDate,
            description: report.description || report.originalFileName,
            additionalInfo:
              `Uploaded by ${report.uploadedBy?.firstName || ""} ${
                report.uploadedBy?.lastName || ""
              }`.trim() || "Unknown",
            status: report.status,
            type: "uploaded",
            data: report,
            asbestosRemovalist: report.asbestosRemovalist || "N/A",
          }));

          reportsData.push(...mappedUploadedReports);
        }
      } catch (error) {
        console.log(
          "No uploaded reports found for category:",
          selectedCategory,
        );
      }

      // Sort reports by date (newest first)
      reportsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setReports(reportsData);
    } catch (err) {
      console.error("Error loading reports:", err);
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, projectId]);

  useEffect(() => {
    if (!selectedCategory || !projectId) return;
    loadReports();
  }, [selectedCategory, projectId, loadReports]);

  useEffect(() => {
    if (selectedCategory && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [availableCategories, selectedCategory]);

  const handleViewReport = async (report) => {
    try {
      // Use report.id, or fallback to report.data._id or report.data.id
      const reportId = report.id || report.data?._id || report.data?.id;
      setProcessingReport({ reportId: reportId, action: "view" });
      const reportTypeName =
        report.type === "shift"
          ? "Air Monitoring"
          : report.type === "clearance"
            ? "Clearance"
            : report.type === "fibre_id"
              ? "Fibre ID"
              : report.type === "asbestos_assessment"
                ? "Asbestos Assessment"
                : "Report";
      showSnackbar(`Opening ${reportTypeName} report...`, "info");

      if (report.type === "shift") {
        const { shift, job } = report.data;
        const samplesResponse = await sampleService.getByShift(shift._id);

        // Ensure we have the complete sample data including analysis
        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          }),
        );

        // Ensure project and client are fully populated
        let projectData = job.projectId;
        if (projectData && typeof projectData === "string") {
          const projectResponse = await projectService.getById(projectData);
          projectData = projectResponse.data;
        }
        if (
          projectData &&
          projectData.client &&
          typeof projectData.client === "string"
        ) {
          const clientResponse = await clientService.getById(
            projectData.client,
          );
          projectData.client = clientResponse.data;
        }

        // Get the full job data with all necessary fields
        const { default: asbestosRemovalJobService } =
          await import("../../services/asbestosRemovalJobService");
        const fullJobDataResponse = await asbestosRemovalJobService.getById(
          job._id,
        );
        const fullJobData = fullJobDataResponse.data; // Extract the actual data from axios response

        // Debug logging to see what data we're getting
        console.log("Full job data response:", fullJobDataResponse);
        console.log("Full job data:", fullJobData);
        console.log("Project data:", projectData);
        console.log("Project client data:", projectData?.client);

        // Create enhanced job object with all required data
        // The backend now provides the client data in fullJobData.projectId.client
        const enhancedJob = {
          ...fullJobData,
          // Use the project data from the job response (which now includes populated client)
          projectId: fullJobData.projectId || projectData,
          // Ensure asbestos removalist is available
          asbestosRemovalist: fullJobData.asbestosRemovalist,
          // Ensure description is available
          description:
            fullJobData.description ||
            `Asbestos removal work at ${
              fullJobData.projectId?.name || projectData?.name
            }`,
        };

        // Get sampler information from samples (more reliable than shift fields)
        const uniqueSamplers = [
          ...new Set(
            samplesWithAnalysis
              .map((sample) => {
                if (
                  sample.collectedBy &&
                  typeof sample.collectedBy === "object"
                ) {
                  return `${sample.collectedBy.firstName || ""} ${
                    sample.collectedBy.lastName || ""
                  }`.trim();
                }
                return sample.collectedBy || "";
              })
              .filter(Boolean),
          ),
        ];

        const primarySampler = uniqueSamplers[0] || "N/A";

        // Enhance shift data with any missing fields
        const enhancedShift = {
          ...shift,
          // Ensure analysis date is available (use shift date if analysis date not available)
          analysisDate: shift.analysisDate || shift.date,
          // Ensure description of works is available
          descriptionOfWorks:
            shift.descriptionOfWorks || enhancedJob.description,
          // Use sampler information from samples as fallback
          supervisor:
            shift.supervisor ||
            (primarySampler !== "N/A"
              ? {
                  firstName: primarySampler.split(" ")[0],
                  lastName: primarySampler.split(" ").slice(1).join(" "),
                }
              : null),
          defaultSampler: shift.defaultSampler,
        };

        // Debug logging to see the final enhanced objects
        console.log("Enhanced job object:", enhancedJob);
        console.log("Enhanced shift object:", enhancedShift);
        console.log("Original shift data:", shift);
        console.log("Shift supervisor:", shift?.supervisor);
        console.log("Shift defaultSampler:", shift?.defaultSampler);
        console.log("Samples with analysis:", samplesWithAnalysis);
        console.log("Unique samplers from samples:", uniqueSamplers);
        console.log("Primary sampler:", primarySampler);

        generateShiftReport({
          shift: enhancedShift,
          job: enhancedJob,
          samples: samplesWithAnalysis,
          project: projectData,
          openInNewTab: true,
          sitePlanData: enhancedShift.sitePlan
            ? {
                sitePlan: enhancedShift.sitePlan,
                sitePlanData: enhancedShift.sitePlanData,
              }
            : null,
        });
      } else if (report.type === "clearance") {
        // Generate clearance report PDF using the new template system
        const { generateHTMLTemplatePDF } =
          await import("../../utils/templatePDFGenerator");

        // Get the full clearance data
        const { default: asbestosClearanceService } =
          await import("../../services/asbestosClearanceService");
        // Use report.id or report.data.id (backend returns 'id', not '_id')
        const clearanceId = report.id || report.data?.id || report.data?._id;
        const fullClearance =
          await asbestosClearanceService.getById(clearanceId);

        // Debug logging to see what clearance data we're getting
        console.log("=== CLEARANCE DATA FROM REPORTS PAGE ===");
        console.log("Full clearance data:", fullClearance);
        console.log("Clearance createdBy:", fullClearance?.createdBy);
        console.log("Clearance LAA field:", fullClearance?.LAA);
        console.log("Clearance clearanceType:", fullClearance?.clearanceType);
        console.log("Clearance projectId:", fullClearance?.projectId);
        console.log("=== END CLEARANCE DATA DEBUG ===");

        // Fix the LAA field to use the populated user data instead of the user ID
        const enhancedClearance = {
          ...fullClearance,
          LAA:
            fullClearance.createdBy?.firstName &&
            fullClearance.createdBy?.lastName
              ? `${fullClearance.createdBy.firstName} ${fullClearance.createdBy.lastName}`
              : fullClearance.LAA,
        };

        console.log("Enhanced clearance LAA field:", enhancedClearance.LAA);

        // Generate and open the PDF in a new tab
        await generateHTMLTemplatePDF("asbestos-clearance", enhancedClearance, {
          openInNewTab: true,
        });
      } else if (report.type === "asbestos_assessment") {
        // For asbestos assessment reports, we'll navigate to the assessment details page
        // This assumes there's a route like /asbestos-assessment/:id
        navigate(`/asbestos-assessment/${report.data.id || report.data._id}`);
      } else if (report.type === "fibre_id") {
        // Generate and open the fibre ID report PDF
        const jobId = report.data.id || report.data._id;

        // Fetch the full job data with samples
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        const fullJob = jobResponse.data;

        // Get samples from the job
        const sampleItems = fullJob.samples || [];

        // Get analyst from first analysed sample or job analyst
        let analyst = null;
        const analysedSample = sampleItems.find((s) => s.analysedBy);
        if (analysedSample?.analysedBy) {
          if (
            typeof analysedSample.analysedBy === "object" &&
            analysedSample.analysedBy.firstName
          ) {
            analyst = `${analysedSample.analysedBy.firstName} ${analysedSample.analysedBy.lastName}`;
          } else if (typeof analysedSample.analysedBy === "string") {
            analyst = analysedSample.analysedBy;
          }
        } else if (fullJob.analyst) {
          analyst = fullJob.analyst;
        }

        // If no analyst found, default to "Unknown Analyst"
        if (!analyst) {
          analyst = "Unknown Analyst";
        }

        // Prepare sample items for the report
        const sampleItemsForReport = sampleItems
          .filter(
            (item) =>
              item.analysisData && item.analysisData.isAnalysed === true,
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

        // Generate and open the PDF in a new tab
        await generateFibreIDReport({
          assessment: assessmentForReport,
          sampleItems: sampleItemsForReport,
          analyst: analyst,
          openInNewTab: true,
          returnPdfData: false,
          reportApprovedBy: fullJob.reportApprovedBy || null,
          reportIssueDate: fullJob.reportIssueDate || null,
        });
      } else if (report.type === "fibre_count") {
        // Generate and open the fibre count report PDF
        const jobId = report.data.id || report.data._id;

        // Fetch the full job data with samples
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        const fullJob = jobResponse.data;

        // Get samples from the job
        const sampleItems = fullJob.samples || [];

        // Get analyst from first analyzed sample or job analyst
        let analyst = null;
        const analysedSample = sampleItems.find((s) => s.analysedBy);
        if (analysedSample?.analysedBy) {
          if (
            typeof analysedSample.analysedBy === "object" &&
            analysedSample.analysedBy.firstName
          ) {
            analyst = `${analysedSample.analysedBy.firstName} ${analysedSample.analysedBy.lastName}`;
          } else if (typeof analysedSample.analysedBy === "string") {
            analyst = analysedSample.analysedBy;
          }
        } else if (fullJob.analyst) {
          analyst = fullJob.analyst;
        }

        // If no analyst found, default to "Unknown Analyst"
        if (!analyst) {
          analyst = "Unknown Analyst";
        }

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
          openInNewTab: true,
          isClientSupplied: true, // Flag to indicate we want fibre count format
        });
      } else if (report.type === "uploaded") {
        // Download the uploaded report file
        const downloadUrl = `${
          process.env.REACT_APP_API_URL || "http://localhost:5000/api"
        }/uploaded-reports/download/${report.data._id}`;
        window.open(downloadUrl, "_blank");
      }

      showSnackbar(`${reportTypeName} report opened`, "success");
    } catch (err) {
      console.error("Error viewing report:", err);
      setError("Failed to view report");
      showSnackbar("Failed to open report. Please try again.", "error");
    } finally {
      setProcessingReport({ reportId: null, action: null });
    }
  };

  const handleExportCSV = async (report) => {
    try {
      // Only handle shift (air monitoring) reports
      if (report.type !== "shift") {
        showSnackbar(
          "CSV export is only available for air monitoring reports",
          "info",
        );
        return;
      }

      const reportId = report.id || report.data?._id || report.data?.id;
      setProcessingReport({ reportId: reportId, action: "csv" });
      showSnackbar("Exporting air monitoring shift data to CSV...", "info");

      const { shift, job } = report.data;

      // Fetch samples for this shift
      const samplesResponse = await sampleService.getByShift(shift._id);

      // Ensure we have complete sample data including analysis
      const samplesWithAnalysis = await Promise.all(
        samplesResponse.data.map(async (sample) => {
          if (!sample.analysis) {
            const completeSample = await sampleService.getById(sample._id);
            return completeSample.data;
          }
          return sample;
        }),
      );

      // Get project data
      let projectData = job.projectId;
      if (projectData && typeof projectData === "string") {
        const projectResponse = await projectService.getById(projectData);
        projectData = projectResponse.data;
      }
      if (
        projectData &&
        projectData.client &&
        typeof projectData.client === "string"
      ) {
        const clientResponse = await clientService.getById(projectData.client);
        projectData.client = clientResponse.data;
      }

      // Get full job data
      const { default: asbestosRemovalJobService } =
        await import("../../services/asbestosRemovalJobService");
      const fullJobDataResponse = await asbestosRemovalJobService.getById(
        job._id,
      );
      const fullJobData = fullJobDataResponse.data;

      // Helper function to escape CSV values
      const escapeCsvCell = (value) => {
        if (value === null || value === undefined) return "";
        return `"${String(value).replace(/"/g, '""')}"`;
      };

      // Helper to format date
      const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-AU");
      };

      // Helper to format person name
      const formatPersonName = (value) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          const { firstName, lastName } = value;
          if (firstName || lastName) {
            return [firstName, lastName].filter(Boolean).join(" ").trim();
          }
        }
        return "";
      };

      // Helper to format time
      const formatTime = (timeStr) => {
        if (!timeStr) return "";
        return timeStr.split(":").slice(0, 2).join(":");
      };

      // Build CSV rows
      const csvRows = [];

      // Add header information
      csvRows.push(["Project ID", projectData?.projectID || ""]);
      csvRows.push(["Project Name", projectData?.name || ""]);
      csvRows.push(["Shift Name", shift?.name || ""]);
      csvRows.push(["Sample Date", shift?.date ? formatDate(shift.date) : ""]);
      csvRows.push([
        "Description of Works",
        shift?.descriptionOfWorks || fullJobData?.description || "",
      ]);
      csvRows.push([
        "Asbestos Removalist",
        fullJobData?.asbestosRemovalist || "",
      ]);
      csvRows.push([
        "Supervisor",
        shift?.supervisor
          ? formatPersonName(shift.supervisor)
          : shift?.defaultSampler
            ? formatPersonName(shift.defaultSampler)
            : "",
      ]);
      csvRows.push(["Analysed By", shift?.analysedBy || ""]);
      csvRows.push([
        "Analysis Date",
        shift?.analysisDate ? formatDate(shift.analysisDate) : "",
      ]);
      csvRows.push([]); // Empty row
      csvRows.push([]); // Empty row

      // Define sample column headers
      const sampleHeaders = [
        "L&D Sample Ref",
        "Sample Location",
        "Sample Type",
        "Time On",
        "Time Off",
        "Ave Flow (L/min)",
        "Field Count",
        "Fibre Count",
        "Reported Conc. (fibres/ml)",
        "Sampler",
        "Analyst",
      ];

      csvRows.push(sampleHeaders);

      // Add sample data rows
      samplesWithAnalysis.forEach((sample) => {
        // Format location with type indicator
        let location = sample.location || "N/A";
        if (sample.type) {
          if (sample.type.toLowerCase() === "exposure") {
            location = `${location} (E)`;
          } else if (sample.type.toLowerCase() === "clearance") {
            location = `${location} (C)`;
          }
        }

        // Format reported concentration
        let reportedConc = "";
        if (sample.analysis) {
          if (
            sample.analysis.uncountableDueToDust === true ||
            sample.analysis.uncountableDueToDust === "true"
          ) {
            reportedConc = "UDD";
          } else if (
            sample.analysis.edgesDistribution === "fail" ||
            sample.analysis.backgroundDust === "fail"
          ) {
            reportedConc = "Uncountable";
          } else if (sample.analysis.reportedConcentration) {
            const conc = sample.analysis.reportedConcentration;
            if (typeof conc === "string" && conc.startsWith("<")) {
              reportedConc = conc;
            } else if (typeof conc === "number") {
              reportedConc = conc.toFixed(2);
            } else {
              reportedConc = conc.toString();
            }
          }
        }

        const row = [
          sample.fullSampleID || sample.sampleID || "",
          location,
          sample.type || "",
          formatTime(sample.startTime),
          formatTime(sample.endTime),
          sample.averageFlowrate ? sample.averageFlowrate.toFixed(1) : "",
          sample.analysis?.fieldsCounted !== undefined &&
          sample.analysis?.fieldsCounted !== null
            ? sample.analysis.fieldsCounted
            : "",
          sample.analysis?.fibresCounted !== undefined &&
          sample.analysis?.fibresCounted !== null
            ? sample.analysis.fibresCounted
            : "",
          reportedConc,
          formatPersonName(sample.collectedBy || sample.sampler),
          formatPersonName(sample.analysedBy || sample.analysis?.analysedBy),
        ];

        csvRows.push(row);
      });

      // Convert to CSV string
      const csvContent = csvRows
        .map((row) =>
          row.length ? row.map((cell) => escapeCsvCell(cell)).join(",") : "",
        )
        .join("\r\n");

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);

      // Generate filename
      const projectID = projectData?.projectID || "";
      const shiftName = shift?.name || "shift";
      const shiftDate = shift?.date
        ? formatDate(shift.date).replace(/\//g, "")
        : "";
      const filename = `${projectID}_${shiftName}_${shiftDate}.csv`;

      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSnackbar("CSV file downloaded successfully", "success");
    } catch (err) {
      console.error("Error exporting CSV:", err);
      setError("Failed to export CSV");
      showSnackbar("Failed to export CSV. Please try again.", "error");
    } finally {
      setProcessingReport({ reportId: null, action: null });
    }
  };

  const handleDownloadReport = async (report) => {
    try {
      // Use report.id, or fallback to report.data._id or report.data.id
      const reportId = report.id || report.data?._id || report.data?.id;
      setProcessingReport({ reportId: reportId, action: "download" });
      const reportTypeName =
        report.type === "shift"
          ? "Air Monitoring"
          : report.type === "clearance"
            ? "Clearance"
            : report.type === "fibre_id"
              ? "Fibre ID"
              : report.type === "fibre_count"
                ? "Fibre Count"
                : report.type === "asbestos_assessment"
                  ? "Asbestos Assessment"
                  : "Report";
      showSnackbar(`Downloading ${reportTypeName} report...`, "info");
      if (report.type === "shift") {
        const { shift, job } = report.data;
        const samplesResponse = await sampleService.getByShift(shift._id);

        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          }),
        );

        let projectData = job.projectId;
        if (projectData && typeof projectData === "string") {
          const projectResponse = await projectService.getById(projectData);
          projectData = projectResponse.data;
        }
        if (
          projectData &&
          projectData.client &&
          typeof projectData.client === "string"
        ) {
          const clientResponse = await clientService.getById(
            projectData.client,
          );
          projectData.client = clientResponse.data;
        }

        // Get the full job data with all necessary fields
        const { default: asbestosRemovalJobService } =
          await import("../../services/asbestosRemovalJobService");
        const fullJobDataResponse = await asbestosRemovalJobService.getById(
          job._id,
        );
        const fullJobData = fullJobDataResponse.data; // Extract the actual data from axios response

        // Create enhanced job object with all required data
        // The backend now provides the client data in fullJobData.projectId.client
        const enhancedJob = {
          ...fullJobData,
          // Use the project data from the job response (which now includes populated client)
          projectId: fullJobData.projectId || projectData,
          // Ensure asbestos removalist is available
          asbestosRemovalist: fullJobData.asbestosRemovalist,
          // Ensure description is available
          description:
            fullJobData.description ||
            `Asbestos removal work at ${
              fullJobData.projectId?.name || projectData?.name
            }`,
        };

        // Get sampler information from samples (more reliable than shift fields)
        const uniqueSamplers = [
          ...new Set(
            samplesWithAnalysis
              .map((sample) => {
                if (
                  sample.collectedBy &&
                  typeof sample.collectedBy === "object"
                ) {
                  return `${sample.collectedBy.firstName || ""} ${
                    sample.collectedBy.lastName || ""
                  }`.trim();
                }
                return sample.collectedBy || "";
              })
              .filter(Boolean),
          ),
        ];

        const primarySampler = uniqueSamplers[0] || "N/A";

        // Enhance shift data with any missing fields
        const enhancedShift = {
          ...shift,
          // Ensure analysis date is available (use shift date if analysis date not available)
          analysisDate: shift.analysisDate || shift.date,
          // Ensure description of works is available
          descriptionOfWorks:
            shift.descriptionOfWorks || enhancedJob.description,
          // Use sampler information from samples as fallback
          supervisor:
            shift.supervisor ||
            (primarySampler !== "N/A"
              ? {
                  firstName: primarySampler.split(" ")[0],
                  lastName: primarySampler.split(" ").slice(1).join(" "),
                }
              : null),
          defaultSampler: shift.defaultSampler,
        };

        generateShiftReport({
          shift: enhancedShift,
          job: enhancedJob,
          samples: samplesWithAnalysis,
          project: projectData,
          openInNewTab: false,
          sitePlanData: enhancedShift.sitePlan
            ? {
                sitePlan: enhancedShift.sitePlan,
                sitePlanData: enhancedShift.sitePlanData,
              }
            : null,
        });
      } else if (report.type === "clearance") {
        // Generate clearance report PDF using the new template system
        const { generateHTMLTemplatePDF } =
          await import("../../utils/templatePDFGenerator");

        // Get the full clearance data
        const { default: asbestosClearanceService } =
          await import("../../services/asbestosClearanceService");
        // Use report.id or report.data.id (backend returns 'id', not '_id')
        const clearanceId = report.id || report.data?.id || report.data?._id;
        const fullClearance =
          await asbestosClearanceService.getById(clearanceId);

        // Debug logging to see what clearance data we're getting
        console.log("=== CLEARANCE DATA FROM REPORTS PAGE ===");
        console.log("Full clearance data:", fullClearance);
        console.log("Clearance createdBy:", fullClearance?.createdBy);
        console.log("Clearance LAA field:", fullClearance?.LAA);
        console.log("Clearance clearanceType:", fullClearance?.clearanceType);
        console.log("Clearance projectId:", fullClearance?.projectId);
        console.log("=== END CLEARANCE DATA DEBUG ===");

        // Fix the LAA field to use the populated user data instead of the user ID
        const enhancedClearance = {
          ...fullClearance,
          LAA:
            fullClearance.createdBy?.firstName &&
            fullClearance.createdBy?.lastName
              ? `${fullClearance.createdBy.firstName} ${fullClearance.createdBy.lastName}`
              : fullClearance.LAA,
        };

        console.log("Enhanced clearance LAA field:", enhancedClearance.LAA);

        // Generate and download the PDF
        await generateHTMLTemplatePDF("asbestos-clearance", enhancedClearance, {
          openInNewTab: false,
        });
      } else if (report.type === "asbestos_assessment") {
        // For asbestos assessment reports, we'll navigate to the assessment details page where download is available
        navigate(`/asbestos-assessment/${report.data.id || report.data._id}`);
      } else if (report.type === "fibre_id") {
        // Generate and download the fibre ID report PDF
        const jobId = report.data.id || report.data._id;

        // Fetch the full job data with samples
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        const fullJob = jobResponse.data;

        // Get samples from the job
        const sampleItems = fullJob.samples || [];

        // Get analyst from first analysed sample or job analyst
        let analyst = null;
        const analysedSample = sampleItems.find((s) => s.analysedBy);
        if (analysedSample?.analysedBy) {
          if (
            typeof analysedSample.analysedBy === "object" &&
            analysedSample.analysedBy.firstName
          ) {
            analyst = `${analysedSample.analysedBy.firstName} ${analysedSample.analysedBy.lastName}`;
          } else if (typeof analysedSample.analysedBy === "string") {
            analyst = analysedSample.analysedBy;
          }
        } else if (fullJob.analyst) {
          analyst = fullJob.analyst;
        }

        // If no analyst found, default to "Unknown Analyst"
        if (!analyst) {
          analyst = "Unknown Analyst";
        }

        // Prepare sample items for the report
        const sampleItemsForReport = sampleItems
          .filter(
            (item) =>
              item.analysisData && item.analysisData.isAnalysed === true,
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

        // Generate and download the PDF
        await generateFibreIDReport({
          assessment: assessmentForReport,
          sampleItems: sampleItemsForReport,
          analyst: analyst,
          openInNewTab: false,
          returnPdfData: false,
          reportApprovedBy: fullJob.reportApprovedBy || null,
          reportIssueDate: fullJob.reportIssueDate || null,
        });
      } else if (report.type === "fibre_count") {
        // Generate and download the fibre count report PDF
        const jobId = report.data.id || report.data._id;

        // Fetch the full job data with samples
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        const fullJob = jobResponse.data;

        // Get samples from the job
        const sampleItems = fullJob.samples || [];

        // Get analyst from first analyzed sample or job analyst
        let analyst = null;
        const analysedSample = sampleItems.find((s) => s.analysedBy);
        if (analysedSample?.analysedBy) {
          if (
            typeof analysedSample.analysedBy === "object" &&
            analysedSample.analysedBy.firstName
          ) {
            analyst = `${analysedSample.analysedBy.firstName} ${analysedSample.analysedBy.lastName}`;
          } else if (typeof analysedSample.analysedBy === "string") {
            analyst = analysedSample.analysedBy;
          }
        } else if (fullJob.analyst) {
          analyst = fullJob.analyst;
        }

        // If no analyst found, default to "Unknown Analyst"
        if (!analyst) {
          analyst = "Unknown Analyst";
        }

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
          openInNewTab: false,
          isClientSupplied: true, // Flag to indicate we want fibre count format
        });
      } else if (report.type === "uploaded") {
        // For uploaded reports, directly download the file
        const downloadUrl = `${
          process.env.REACT_APP_API_URL || "http://localhost:5000/api"
        }/uploaded-reports/download/${report.data._id}`;

        // Create a temporary link element to trigger download
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = report.data.originalFileName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Error downloading report:", err);
      setError("Failed to download report");
      showSnackbar("Failed to download report. Please try again.", "error");
    } finally {
      setProcessingReport({ reportId: null, action: null });
    }
  };

  const handleReviseReport = (report) => {
    // Show confirmation dialog
    setReviseDialog({
      open: true,
      report: report,
    });
  };

  const confirmReviseReport = async () => {
    const report = reviseDialog.report;

    // Validate revision reason for clearance reports only
    if (report?.type === "clearance" && !revisionReason.trim()) {
      showSnackbar(
        "Please provide a reason for revising this clearance report.",
        "error",
      );
      return;
    }

    try {
      if (report.type === "shift") {
        // For air monitoring reports, we need to reset both the shift status AND the job status
        const { shift, job } = report.data;

        if (shift && shift._id && job && job._id) {
          const { shiftService } = await import("../../services/api");
          const { default: asbestosRemovalJobService } =
            await import("../../services/asbestosRemovalJobService");

          // Get current shift data to increment revision count
          const currentShift = await shiftService.getById(shift._id);
          const currentRevision = currentShift.data.revision || 0;
          const newRevision = currentRevision + 1;

          // Update the shift status back to "ongoing" to allow revision and increment revision count
          await shiftService.update(shift._id, {
            status: "ongoing",
            reportApprovedBy: null,
            reportIssueDate: null,
            revision: newRevision, // Increment revision count by 1
          });

          // Update the asbestos removal job status back to "in_progress" so it appears in the jobs table
          await asbestosRemovalJobService.update(job._id, {
            status: "in_progress",
          });

          // Show success message
          showSnackbar(
            "Report and job status reset to in progress. You can now revise the report.",
            "success",
          );

          // Reload reports to reflect the change
          loadReports();
        }
      } else if (report.type === "clearance") {
        // For clearance reports, reset the clearance status and increment revision count
        const { default: asbestosClearanceService } =
          await import("../../services/asbestosClearanceService");
        const { default: asbestosRemovalJobService } =
          await import("../../services/asbestosRemovalJobService");

        // Use report.id or report.data.id (backend returns 'id', not '_id')
        const clearanceId = report.id || report.data?.id || report.data?._id;

        // Get current clearance data to increment revision count
        const currentClearance =
          await asbestosClearanceService.getById(clearanceId);
        const currentRevision = currentClearance.revision || 0;
        const newRevision = currentRevision + 1;

        // Prepare revision reason data
        const newRevisionReason = {
          revisionNumber: newRevision,
          reason: revisionReason.trim(),
          revisedBy: currentUser._id,
          revisedAt: new Date(),
        };

        // Get existing revision reasons and add the new one
        const existingRevisionReasons = currentClearance.revisionReasons || [];
        const updatedRevisionReasons = [
          ...existingRevisionReasons,
          newRevisionReason,
        ];

        // Update clearance with new revision and revision reason
        await asbestosClearanceService.update(clearanceId, {
          status: "in progress",
          revision: newRevision,
          revisionReasons: updatedRevisionReasons,
        });

        // Find and update the associated asbestos removal job for this project
        try {
          const jobsResponse = await asbestosRemovalJobService.getAll();
          const jobs = jobsResponse.jobs || jobsResponse.data || [];
          const projectJob = jobs.find(
            (job) =>
              (job.projectId === projectId ||
                job.projectId?._id === projectId) &&
              job.status === "completed",
          );

          if (projectJob) {
            await asbestosRemovalJobService.update(projectJob._id, {
              status: "in_progress",
            });
          }
        } catch (jobError) {
          console.error(
            "Error updating associated asbestos removal job:",
            jobError,
          );
        }

        // Show success message
        showSnackbar(
          "Clearance and job status reset to in progress. You can now revise the report.",
          "success",
        );

        // Reload reports to reflect the change
        loadReports();
      } else if (report.type === "fibre_id" || report.type === "fibre_count") {
        // For fibre ID and fibre count reports (client supplied jobs), reset the status to Analysis Complete
        const { clientSuppliedJobsService } =
          await import("../../services/api");

        // Get the job ID (could be in data.id or data._id)
        const jobId = report.data._id || report.data.id || report.id;

        // Get current job data to increment revision count
        const currentJob = await clientSuppliedJobsService.getById(jobId);
        const currentRevision = currentJob.data?.revision || 0;
        const newRevision = currentRevision + 1;

        // Update the client supplied job status back to "Analysis Complete" and clear approval
        await clientSuppliedJobsService.update(jobId, {
          status: "Analysis Complete",
          reportApprovedBy: null,
          reportIssueDate: null,
          revision: newRevision,
        });

        // Show success message
        showSnackbar(
          "Client supplied job status reset to Analysis Complete. You can now revise the report.",
          "success",
        );

        // Reload reports to reflect the change
        loadReports();
      }
    } catch (error) {
      console.error("Error revising report:", error);
      showSnackbar("Failed to revise report. Please try again.", "error");
    } finally {
      // Close the dialog and clear revision reason
      setReviseDialog({
        open: false,
        report: null,
      });
      setRevisionReason("");
    }
  };

  const cancelReviseReport = () => {
    setReviseDialog({
      open: false,
      report: null,
    });
    setRevisionReason("");
  };

  // Handle COC view
  const handleViewCOC = async (report) => {
    try {
      // Get COC from report data or fetch full job data
      let chainOfCustody = report.chainOfCustody || report.data?.chainOfCustody;

      // If COC not in report data, fetch the full job
      if (!chainOfCustody) {
        const jobId = report.id || report.data?.id || report.data?._id;
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        chainOfCustody = jobResponse.data?.chainOfCustody;
      }

      if (!chainOfCustody || !chainOfCustody.data) {
        showSnackbar(
          "No Chain of Custody document available for this report",
          "info",
        );
        return;
      }

      setSelectedCOC(chainOfCustody);
      setCocDialogOpen(true);
    } catch (error) {
      console.error("Error loading COC:", error);
      showSnackbar("Failed to load Chain of Custody document", "error");
    }
  };

  // Handle COC download
  const handleDownloadCOC = () => {
    if (!selectedCOC?.data) return;

    try {
      // Convert base64 to blob
      const byteString = atob(selectedCOC.data.split(",")[1]);
      const mimeString = selectedCOC.data
        .split(",")[0]
        .split(":")[1]
        .split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedCOC.fileName || "chain-of-custody.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading COC:", error);
      showSnackbar("Failed to download Chain of Custody document", "error");
    }
  };

  // Handle report upload
  const handleUploadReport = async () => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("reportType", uploadForm.reportType);
      formData.append("reportDate", uploadForm.reportDate);
      formData.append("description", uploadForm.description);
      formData.append("status", uploadForm.status);
      formData.append("projectId", projectId);

      // Add type-specific fields
      if (uploadForm.reportType === "clearance") {
        formData.append("asbestosRemovalist", uploadForm.asbestosRemovalist);
      }

      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL || "http://localhost:5000/api"
        }/uploaded-reports/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Failed to upload report");
      }

      await response.json();

      showSnackbar("Report uploaded successfully", "success");

      // Close dialog and reset form
      setUploadDialogOpen(false);
      setUploadForm({
        reportType: "",
        reportDate: getTodayInSydney(),
        description: "",
        asbestosRemovalist: "",
        status: "completed",
        file: null,
      });

      // Refresh available categories and reports
      await checkAvailableCategories();
      if (selectedCategory) {
        await loadReports();
      }
    } catch (error) {
      console.error("Error uploading report:", error);
      showSnackbar("Failed to upload report. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Determine where user came from based on location state
  const cameFromProjects = location.state?.from === "projects";
  const backPath = cameFromProjects ? "/projects" : "/reports";
  const backText = cameFromProjects ? "Back to Projects" : "Back to Reports";

  return (
    <Box sx={{ p: 3, px: { xs: 1.5, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backPath)}
          sx={{ mb: 2 }}
        >
          {backText}
        </Button>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" gutterBottom>
              Reports for {project?.projectID}: {project?.name || "Loading..."}
            </Typography>
            {project?.client && (
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                Client:{" "}
                {typeof project.client === "object"
                  ? project.client.name
                  : project.client}
              </Typography>
            )}

            {/* Project Status Section */}
            {project && (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2 }}
              >
                <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                  Project Status:
                </Typography>

                {isEditingStatus ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <Select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        disabled={statusUpdateLoading}
                      >
                        {allStatuses.map((status) => (
                          <MenuItem key={status} value={status}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  backgroundColor:
                                    statusColors[status] || "#1976d2",
                                }}
                              />
                              {status}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Button
                      size="small"
                      startIcon={
                        statusUpdateLoading ? (
                          <CircularProgress size={16} />
                        ) : (
                          <SaveIcon />
                        )
                      }
                      onClick={handleStatusUpdate}
                      disabled={statusUpdateLoading}
                      color="primary"
                    >
                      Save
                    </Button>

                    <Button
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={handleStatusEditCancel}
                      disabled={statusUpdateLoading}
                      color="secondary"
                    >
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      label={project.status || "No Status"}
                      sx={{
                        backgroundColor:
                          statusColors[project.status] || "#1976d2",
                        color: "white",
                        fontWeight: "medium",
                      }}
                    />
                    {isAdmin && (
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setIsEditingStatus(true)}
                        sx={{ ml: 1 }}
                      >
                        Edit
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 2, ml: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArchiveIcon />}
              onClick={() => setArchivedDialogOpen(true)}
            >
              Deleted / Archived Data
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Report
            </Button>
            <Button
              variant="outlined"
              startIcon={<AssessmentIcon />}
              onClick={() => setLogModalOpen(true)}
            >
              View Project Log
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Active Jobs Table */}
      {activeJobs.length > 0 && !selectedCategory && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Active Jobs
          </Typography>
          {loadingActiveJobs ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Job Type</TableCell>
                    <TableCell>Date(s)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeJobs.map((job) => {
                    // Format job type with asbestos removalist in brackets if applicable
                    let jobTypeDisplay =
                      job.type === "asbestos-removal"
                        ? "Asbestos Removal"
                        : job.jobType || "Fibre ID";

                    if (
                      job.type === "asbestos-removal" &&
                      job.asbestosRemovalist
                    ) {
                      jobTypeDisplay += ` (${job.asbestosRemovalist})`;
                    }

                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ color: "black", fontWeight: 500 }}
                          >
                            {jobTypeDisplay}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDateRange(job.dates || [])}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatJobStatus(job.status)}
                            color={
                              job.status === "in_progress" ||
                              job.status === "In Progress"
                                ? "warning"
                                : "info"
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate(job.url)}
                          >
                            View Job
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Categories or Reports List */}
      {checkingReports ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : !selectedCategory ? (
        availableCategories.length > 0 ? (
          <ReportCategories
            onCategorySelect={setSelectedCategory}
            selectedProjectId={projectId}
            availableCategories={availableCategories}
          />
        ) : (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <Typography variant="h5" gutterBottom>
              No Reports Available
            </Typography>
          </Box>
        )
      ) : (
        <>
          <Button onClick={() => setSelectedCategory(null)} sx={{ mb: 3 }}>
            Back to Categories
          </Button>
          <ReportsList
            reports={reports}
            loading={loading}
            error={error}
            category={selectedCategory}
            onView={handleViewReport}
            onDownload={handleDownloadReport}
            onRevise={handleReviseReport}
            onViewCOC={handleViewCOC}
            onExportCSV={handleExportCSV}
            processingReport={processingReport}
          />
        </>
      )}

      {/* Archived Data Dialog */}
      <ArchivedDataDialog
        open={archivedDialogOpen}
        onClose={() => setArchivedDialogOpen(false)}
        projectId={projectId}
      />

      {/* Project Log Modal */}
      {logModalOpen && (
        <ProjectLogModalWrapper
          open={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          project={project}
        />
      )}

      {/* Revise Report Confirmation Dialog */}
      <Dialog
        open={reviseDialog.open}
        onClose={cancelReviseReport}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Revise Report</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {(() => {
              const reportType = reviseDialog.report?.type;
              let tableText = "the asbestos removal jobs table";

              if (reportType === "fibre_id" || reportType === "fibre_count") {
                tableText = "the client supplied jobs table";
              } else if (reportType === "clearance") {
                tableText = "the clearances table";
              } else if (reportType === "shift") {
                tableText = "the asbestos removal jobs table";
              }

              return `Proceeding will enable editing of the report in ${tableText} and will increase the report's revision count.`;
            })()}
          </DialogContentText>
          {reviseDialog.report?.type === "clearance" && (
            <TextField
              autoFocus
              margin="dense"
              label="Reason for revision"
              fullWidth
              variant="outlined"
              multiline
              rows={3}
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Please provide a reason for revising this clearance report..."
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelReviseReport} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={confirmReviseReport}
            color="warning"
            variant="contained"
          >
            Revise Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Report Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Upload Report</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Report Type</InputLabel>
                <Select
                  value={uploadForm.reportType}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, reportType: e.target.value })
                  }
                  label="Report Type"
                >
                  <MenuItem value="asbestos-assessment">
                    Asbestos Assessment Report
                  </MenuItem>
                  <MenuItem value="asbestos-removal-jobs">
                    Asbestos Removal Report
                  </MenuItem>
                  <MenuItem value="clearance">
                    Asbestos Clearance Report
                  </MenuItem>
                  <MenuItem value="fibre-id">Fibre ID Analysis Report</MenuItem>
                  <MenuItem value="fibre-count">
                    Fibre Count Analysis Report
                  </MenuItem>
                  <MenuItem value="other">Other Report</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Report Date"
                type="date"
                value={uploadForm.reportDate}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, reportDate: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={uploadForm.status}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, status: e.target.value })
                  }
                  label="Status"
                >
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={uploadForm.description}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, description: e.target.value })
                }
                placeholder="Enter a description of the report..."
              />
            </Grid>

            {uploadForm.reportType === "clearance" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Asbestos Removalist"
                  value={uploadForm.asbestosRemovalist}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      asbestosRemovalist: e.target.value,
                    })
                  }
                  placeholder="Name of the asbestos removalist company"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ py: 2 }}
              >
                {uploadForm.file
                  ? uploadForm.file.name
                  : "Choose File to Upload"}
                <input
                  type="file"
                  hidden
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      file: e.target.files[0],
                    })
                  }
                />
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUploadDialogOpen(false);
              setUploadForm({
                reportType: "",
                reportDate: new Date().toISOString().split("T")[0],
                description: "",
                asbestosRemovalist: "",
                status: "completed",
                file: null,
              });
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUploadReport}
            variant="contained"
            disabled={
              uploading ||
              !uploadForm.reportType ||
              !uploadForm.reportDate ||
              !uploadForm.file
            }
            startIcon={
              uploading ? <CircularProgress size={20} /> : <UploadIcon />
            }
          >
            {uploading ? "Uploading..." : "Upload Report"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* COC View Dialog */}
      <Dialog
        open={cocDialogOpen}
        onClose={() => setCocDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">Chain of Custody</Typography>
            <IconButton onClick={() => setCocDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedCOC && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                File: {selectedCOC.fileName}
              </Typography>
              {selectedCOC.uploadedAt && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Uploaded: {new Date(selectedCOC.uploadedAt).toLocaleString()}
                </Typography>
              )}

              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadCOC}
                >
                  Download
                </Button>
              </Box>

              {/* Preview COC if it's an image */}
              {selectedCOC.fileType?.startsWith("image/") && (
                <Box
                  sx={{
                    border: "1px solid #ddd",
                    borderRadius: 1,
                    overflow: "hidden",
                    maxHeight: "500px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#f5f5f5",
                    cursor: "pointer",
                    "&:hover": {
                      opacity: 0.9,
                    },
                  }}
                  onClick={() => setCocFullScreenOpen(true)}
                  title="Click to view full size"
                >
                  <img
                    src={selectedCOC.data}
                    alt="Chain of Custody"
                    style={{
                      maxHeight: "500px",
                      maxWidth: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </Box>
              )}

              {/* Show PDF icon for PDFs */}
              {selectedCOC.fileType === "application/pdf" && (
                <Box
                  sx={{
                    border: "1px solid #ddd",
                    borderRadius: 1,
                    p: 4,
                    textAlign: "center",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  <DownloadIcon
                    sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                  />
                  <Typography variant="body1" color="text.secondary">
                    PDF Document
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Click Download to view
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCocDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Full Screen COC Viewer */}
      <Dialog
        open={cocFullScreenOpen}
        onClose={() => setCocFullScreenOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">
              Chain of Custody - {selectedCOC?.fileName}
            </Typography>
            <IconButton onClick={() => setCocFullScreenOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedCOC?.fileType?.startsWith("image/") && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "80vh",
                backgroundColor: "#000",
              }}
            >
              <img
                src={selectedCOC.data}
                alt="Chain of Custody"
                style={{
                  maxHeight: "90vh",
                  maxWidth: "100%",
                  objectFit: "contain",
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCocFullScreenOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectReports;
