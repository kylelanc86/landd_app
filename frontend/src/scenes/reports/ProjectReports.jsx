import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import ReportCategories from "./ReportCategories";
import ReportsList from "./ReportsList";
import { useNavigate } from "react-router-dom";
import {
  projectService,
  sampleService,
  clientService,
} from "../../services/api";
import reportService from "../../services/reportService";
import { generateShiftReport } from "../../utils/generateShiftReport";
import ProjectLogModalWrapper from "./ProjectLogModalWrapper";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";
import { useAuth } from "../../context/AuthContext";

const ProjectReports = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Status editing state
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  const { showSnackbar } = useSnackbar();

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
  const isAdmin = currentUser?.role === "admin";

  // Debug logging for admin check
  console.log("ProjectReports - currentUser:", currentUser);
  console.log("ProjectReports - isAdmin:", isAdmin);

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await projectService.getById(projectId);
        setProject(response.data);
        setNewStatus(response.data.status || "");
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project details");
      }
    };
    loadProject();
  }, [projectId]);

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
                assessmentReports
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
              }
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
          // Only show clearances if there are completed asbestos removal jobs for this project
          try {
            const { default: asbestosClearanceService } = await import(
              "../../services/asbestosClearanceService"
            );
            const { default: asbestosRemovalJobService } = await import(
              "../../services/asbestosRemovalJobService"
            );

            // First, check if there are any completed asbestos removal jobs for this project
            const completedJobsResponse =
              await asbestosRemovalJobService.getAll();
            const completedJobs =
              completedJobsResponse.jobs || completedJobsResponse.data || [];
            const hasCompletedJobs = completedJobs.some(
              (job) =>
                (job.projectId === projectId ||
                  job.projectId?._id === projectId) &&
                job.status === "completed"
            );

            // Only fetch clearances if there are completed jobs for this project
            if (hasCompletedJobs) {
              const clearancesResponse =
                await asbestosClearanceService.getAll();

              let projectClearances = [];

              if (clearancesResponse && Array.isArray(clearancesResponse)) {
                projectClearances = clearancesResponse.filter(
                  (clearance) =>
                    clearance.projectId === projectId ||
                    clearance.projectId?._id === projectId
                );
              } else if (
                clearancesResponse.clearances &&
                Array.isArray(clearancesResponse.clearances)
              ) {
                projectClearances = clearancesResponse.clearances.filter(
                  (clearance) =>
                    clearance.projectId === projectId ||
                    clearance.projectId?._id === projectId
                );
              }

              // Map clearances to report format
              const clearanceReports = projectClearances.map((clearance) => ({
                id: clearance._id,
                date: clearance.clearanceDate || clearance.createdAt,
                reference: `${clearance.clearanceType}-${clearance._id}`,
                description: `${clearance.clearanceType} Asbestos Clearance`,
                asbestosRemovalist: clearance.asbestosRemovalist || "N/A",
                additionalInfo: `${clearance.clearanceType} Clearance`,
                status: clearance.status || "Unknown",
                revision: clearance.revision || 0,
                type: "clearance",
                data: clearance,
              }));

              reportsData.push(...clearanceReports);
            }
          } catch (clearanceError) {
            console.error("Error fetching clearances:", clearanceError);
          }

          break;

        case "fibre-id":
          const fibreIdReports = await reportService.getFibreIdReports(
            projectId
          );
          reportsData = fibreIdReports.map((report) => ({
            id: report.id,
            date: report.date,
            description: report.description,
            status: report.status,
            type: "fibre_id",
            data: report,
          }));
          break;

        default:
          break;
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

  const handleViewReport = async (report) => {
    try {
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
          })
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
            projectData.client
          );
          projectData.client = clientResponse.data;
        }

        // Get the full job data with all necessary fields
        const { default: asbestosRemovalJobService } = await import(
          "../../services/asbestosRemovalJobService"
        );
        const fullJobDataResponse = await asbestosRemovalJobService.getById(
          job._id
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
              .filter(Boolean)
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
        const { generateHTMLTemplatePDF } = await import(
          "../../utils/templatePDFGenerator"
        );

        // Get the full clearance data
        const { default: asbestosClearanceService } = await import(
          "../../services/asbestosClearanceService"
        );
        const fullClearance = await asbestosClearanceService.getById(
          report.data._id
        );

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

        // Generate the PDF
        await generateHTMLTemplatePDF("asbestos-clearance", enhancedClearance);
      } else if (report.type === "asbestos_assessment") {
        // For asbestos assessment reports, we'll navigate to the assessment details page
        // This assumes there's a route like /asbestos-assessment/:id
        navigate(`/asbestos-assessment/${report.data.id || report.data._id}`);
      } else if (report.type === "fibre_id") {
        // Navigate to the fibre ID job details page
        navigate(`/fibre-id/client-supplied/${report.data.id}/samples`);
      }
    } catch (err) {
      console.error("Error viewing report:", err);
      setError("Failed to view report");
    }
  };

  const handleDownloadReport = async (report) => {
    try {
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
          })
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
            projectData.client
          );
          projectData.client = clientResponse.data;
        }

        // Get the full job data with all necessary fields
        const { default: asbestosRemovalJobService } = await import(
          "../../services/asbestosRemovalJobService"
        );
        const fullJobDataResponse = await asbestosRemovalJobService.getById(
          job._id
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
              .filter(Boolean)
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
        const { generateHTMLTemplatePDF } = await import(
          "../../utils/templatePDFGenerator"
        );

        // Get the full clearance data
        const { default: asbestosClearanceService } = await import(
          "../../services/asbestosClearanceService"
        );
        const fullClearance = await asbestosClearanceService.getById(
          report.data._id
        );

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

        // Generate the PDF
        await generateHTMLTemplatePDF("asbestos-clearance", enhancedClearance);
      } else if (report.type === "asbestos_assessment") {
        // For asbestos assessment reports, we'll navigate to the assessment details page where download is available
        navigate(`/asbestos-assessment/${report.data.id || report.data._id}`);
      } else if (report.type === "fibre_id") {
        // For fibre ID reports, we'll navigate to the fibre ID job details page where download is available
        navigate(`/fibre-id/client-supplied/${report.data.id}/samples`);
      }
    } catch (err) {
      console.error("Error downloading report:", err);
      setError("Failed to download report");
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
        "error"
      );
      return;
    }

    try {
      if (report.type === "shift") {
        // For air monitoring reports, we need to reset both the shift status AND the job status
        const { shift, job } = report.data;

        if (shift && shift._id && job && job._id) {
          const { shiftService } = await import("../../services/api");
          const { default: asbestosRemovalJobService } = await import(
            "../../services/asbestosRemovalJobService"
          );

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
            "success"
          );

          // Reload reports to reflect the change
          loadReports();
        }
      } else if (report.type === "clearance") {
        // For clearance reports, reset the clearance status and increment revision count
        const { default: asbestosClearanceService } = await import(
          "../../services/asbestosClearanceService"
        );
        const { default: asbestosRemovalJobService } = await import(
          "../../services/asbestosRemovalJobService"
        );

        // Get current clearance data to increment revision count
        const currentClearance = await asbestosClearanceService.getById(
          report.data._id
        );
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
        await asbestosClearanceService.update(report.data._id, {
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
              job.status === "completed"
          );

          if (projectJob) {
            await asbestosRemovalJobService.update(projectJob._id, {
              status: "in_progress",
            });
          }
        } catch (jobError) {
          console.error(
            "Error updating associated asbestos removal job:",
            jobError
          );
        }

        // Show success message
        showSnackbar(
          "Clearance and job status reset to in progress. You can now revise the report.",
          "success"
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/projects")}
          sx={{ mb: 2 }}
        >
          Back to Projects
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

          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={() => setLogModalOpen(true)}
            sx={{ ml: 2 }}
          >
            View Project Log
          </Button>
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Categories or Reports List */}
      {!selectedCategory ? (
        <ReportCategories
          onCategorySelect={setSelectedCategory}
          selectedProjectId={projectId}
        />
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
          />
        </>
      )}

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
            Are you sure you want to revise this report? This will enable
            editing of the report in the asbestos removal jobs table and will
            increase the report's revision count.
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
    </Box>
  );
};

export default ProjectReports;
