import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { tokens } from "../../theme";
import projectService from "../../services/projectService";
import asbestosClearanceReportService from "../../services/asbestosClearanceReportService";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import recentProjectsService from "../../services/recentProjectsService";
import {
  shiftService,
  jobService,
  sampleService,
  clientService,
} from "../../services/api";
import { generateShiftReport } from "../../utils/generateShiftReport";

const ProjectReports = () => {
  const theme = useTheme();
  const colors = tokens;
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProjectReports();
  }, [projectId]);

  const loadProjectReports = async () => {
    try {
      setLoading(true);
      setError("");

      // Get project details
      const projectResponse = await projectService.getById(projectId);
      const projectData = projectResponse.data;
      setProject(projectData);

      // Add to recent projects
      recentProjectsService.addRecentProject(projectData);

      const allReports = [];

      // 1. Get asbestos clearance reports
      try {
        console.log("Fetching clearance reports for project:", projectId);
        const clearanceReports = await asbestosClearanceReportService.getAll({
          projectId: projectId,
        });
        console.log("Clearance reports response:", clearanceReports);
        if (clearanceReports.reports) {
          console.log(
            "Number of clearance reports found:",
            clearanceReports.reports.length
          );

          // Group reports by clearanceId to avoid duplicates
          const clearanceGroups = {};
          clearanceReports.reports.forEach((report) => {
            const clearanceId = report.clearanceId?._id || report.clearanceId;
            if (!clearanceGroups[clearanceId]) {
              clearanceGroups[clearanceId] = {
                id: clearanceId,
                date: new Date(
                  report.clearanceId?.clearanceDate || report.createdAt
                ),
                type: "Asbestos Clearance Report",
                status: report.clearanceId?.status || "Unknown",
                report: report,
                category: "clearance",
              };
            }
          });

          // Add only one report per clearance
          Object.values(clearanceGroups).forEach((report) => {
            console.log("Adding clearance report:", report.id, report.status);
            allReports.push(report);
          });
        }
      } catch (err) {
        console.log("No clearance reports found for this project:", err);
      }

      // 2. Get asbestos removal jobs - REMOVED: No longer displaying removal jobs

      // 3. Get air monitoring reports (shifts) - ONLY if no clearance reports exist
      if (allReports.length === 0) {
        try {
          console.log(
            "No clearance reports found, fetching air monitoring reports for project:",
            projectId
          );
          // First get all jobs for this project
          const jobsResponse = await jobService.getAll();
          console.log("All jobs response:", jobsResponse);
          const projectJobs =
            jobsResponse.data?.filter(
              (job) =>
                job.projectId === projectId || job.projectId?._id === projectId
            ) || [];
          console.log("Project jobs found:", projectJobs.length);

          // Get shifts for each job
          for (const job of projectJobs) {
            try {
              console.log("Fetching shifts for job:", job._id, job.name);
              const shiftsResponse = await shiftService.getByJob(job._id);
              const shifts = shiftsResponse.data || [];
              console.log("Shifts found for job:", job.name, shifts.length);

              shifts.forEach((shift) => {
                console.log(
                  "Checking shift:",
                  shift._id,
                  shift.name,
                  "status:",
                  shift.status
                );
                // Only include shifts that have reports (analysis complete or shift complete)
                if (
                  shift.status === "analysis_complete" ||
                  shift.status === "shift_complete" ||
                  shift.reportApprovedBy
                ) {
                  console.log(
                    "Adding air monitoring report for shift:",
                    shift._id
                  );
                  allReports.push({
                    id: shift._id,
                    date: new Date(
                      shift.reportIssueDate ||
                        shift.updatedAt ||
                        shift.createdAt
                    ),
                    type: "Air Monitoring Report",
                    status: shift.reportApprovedBy
                      ? "Authorized"
                      : shift.status,
                    report: shift,
                    jobName: job.name,
                    shiftName: shift.name,
                    category: "air-monitoring",
                  });
                }
              });
            } catch (err) {
              console.log(`No shifts found for job ${job._id}:`, err);
            }
          }
        } catch (err) {
          console.log("No air monitoring reports found for this project:", err);
        }
      }

      // Sort reports by date (newest first) and take only the most recent one
      allReports.sort((a, b) => b.date - a.date);

      // Only keep the most recent report
      const finalReports = allReports.length > 0 ? [allReports[0]] : [];

      console.log("Final reports array (most recent only):", finalReports);
      console.log(
        "Reports by type:",
        finalReports.reduce((acc, report) => {
          acc[report.type] = (acc[report.type] || 0) + 1;
          return acc;
        }, {})
      );

      setReports(finalReports);
    } catch (err) {
      console.error("Error loading project reports:", err);
      setError("Failed to load reports for this project");
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (report) => {
    try {
      if (report.type === "Air Monitoring Report") {
        // Generate air monitoring report
        const shift = report.report;
        const jobResponse = await jobService.getById(
          shift.job?._id || shift.job
        );
        const samplesResponse = await sampleService.getByShift(shift._id);

        // Ensure we have the complete sample data including analysis
        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              // If analysis data is missing, fetch the complete sample data
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          })
        );

        // Ensure project and client are fully populated
        let project = jobResponse.data.projectId;
        if (project && typeof project === "string") {
          const projectResponse = await projectService.getById(project);
          project = projectResponse.data;
        }
        if (project && project.client && typeof project.client === "string") {
          const clientResponse = await clientService.getById(project.client);
          project.client = clientResponse.data;
        }

        generateShiftReport({
          shift: shift,
          job: jobResponse.data,
          samples: samplesWithAnalysis,
          project: project,
          openInNewTab: true, // Open in new tab for viewing
        });
      } else if (report.type === "Asbestos Clearance Report") {
        // Generate asbestos clearance report
        const clearanceReport = report.report;

        // Extract the actual clearance ID - it could be a string or an object with _id
        const clearanceId =
          typeof clearanceReport.clearanceId === "object"
            ? clearanceReport.clearanceId._id
            : clearanceReport.clearanceId;

        // Open PDF directly in browser using the existing endpoint
        const api = require("../../services/axios").default;
        const response = await api.post(
          "/pdf-pdfshift/generate-asbestos-clearance",
          {
            clearanceData: { _id: clearanceId },
          },
          {
            responseType: "blob",
          }
        );

        // Create blob URL and open in new tab
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");

        console.log("Asbestos clearance PDF opened in browser");
      }
    } catch (err) {
      console.error("Error viewing report:", err);
      setError("Failed to view report");
    }
  };

  const handleDownloadReport = async (report) => {
    try {
      if (report.type === "Air Monitoring Report") {
        // Generate and download air monitoring report
        const shift = report.report;
        const jobResponse = await jobService.getById(
          shift.job?._id || shift.job
        );
        const samplesResponse = await sampleService.getByShift(shift._id);

        // Ensure we have the complete sample data including analysis
        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              // If analysis data is missing, fetch the complete sample data
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          })
        );

        // Ensure project and client are fully populated
        let project = jobResponse.data.projectId;
        if (project && typeof project === "string") {
          const projectResponse = await projectService.getById(project);
          project = projectResponse.data;
        }
        if (project && project.client && typeof project.client === "string") {
          const clientResponse = await clientService.getById(project.client);
          project.client = clientResponse.data;
        }

        generateShiftReport({
          shift: shift,
          job: jobResponse.data,
          samples: samplesWithAnalysis,
          project: project,
          openInNewTab: false, // Download instead of opening in new tab
        });
      } else if (report.type === "Asbestos Clearance Report") {
        // Generate and download asbestos clearance report
        const clearanceReport = report.report;

        // Get the full clearance data with populated project
        const asbestosClearanceService =
          require("../../services/asbestosClearanceService").default;

        // Extract the actual clearance ID - it could be a string or an object with _id
        const clearanceId =
          typeof clearanceReport.clearanceId === "object"
            ? clearanceReport.clearanceId._id
            : clearanceReport.clearanceId;

        const fullClearance = await asbestosClearanceService.getById(
          clearanceId
        );

        // Use the HTML template-based PDF generation
        const {
          generateHTMLTemplatePDF,
        } = require("../../utils/templatePDFGenerator");
        const fileName = await generateHTMLTemplatePDF(
          "asbestos-clearance", // template type
          fullClearance // clearance data
        );

        console.log(
          "Asbestos clearance PDF downloaded successfully:",
          fileName
        );
      }
    } catch (err) {
      console.error("Error downloading report:", err);
      setError("Failed to download report");
    }
  };

  const handlePrintReport = async (report) => {
    try {
      if (report.type === "Air Monitoring Report") {
        // Generate and print air monitoring report
        const shift = report.report;
        const jobResponse = await jobService.getById(
          shift.job?._id || shift.job
        );
        const samplesResponse = await sampleService.getByShift(shift._id);

        // Ensure we have the complete sample data including analysis
        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              // If analysis data is missing, fetch the complete sample data
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          })
        );

        // Ensure project and client are fully populated
        let project = jobResponse.data.project;
        if (project && typeof project === "string") {
          const projectResponse = await projectService.getById(project);
          project = projectResponse.data;
        }
        if (project && project.client && typeof project.client === "string") {
          const clientResponse = await clientService.getById(project.client);
          project.client = clientResponse.data;
        }

        // Generate report and open in new tab, then trigger print
        generateShiftReport({
          shift: shift,
          job: jobResponse.data,
          samples: samplesWithAnalysis,
          project: project,
          openInNewTab: true, // Open in new tab for printing
        });

        // Wait a moment for the PDF to load, then trigger print
        setTimeout(() => {
          window.print();
        }, 1000);
      }
    } catch (err) {
      console.error("Error printing report:", err);
      setError("Failed to print report");
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "complete":
      case "completed":
        return "success";
      case "in progress":
      case "in_progress":
        return "warning";
      case "pending":
        return "info";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "air-monitoring":
        return "primary";
      case "clearance":
        return "secondary";
      case "removal":
        return "info";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading project reports...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <IconButton onClick={() => navigate("/reports")} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Project Reports
          </Typography>
          {project && (
            <Typography variant="h6" color="text.secondary">
              {project.projectID} - {project.name}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Reports Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          All Reports ({reports.length})
        </Typography>

        {reports.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: colors.primary[700] }}>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Date
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Report Type
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Status
                  </TableCell>

                  <TableCell
                    sx={{ color: "white", fontWeight: "bold" }}
                    align="center"
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>
                      {report.date.toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {report.type}
                        </Typography>
                        {report.jobName && (
                          <Typography variant="caption" color="text.secondary">
                            {report.jobName} • {report.shiftName}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.status}
                        color={getStatusColor(report.status)}
                        size="small"
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "center",
                        }}
                      >
                        <Tooltip title="View Report">
                          <IconButton
                            size="small"
                            onClick={() => handleViewReport(report)}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Report">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadReport(report)}
                            color="secondary"
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print Report">
                          <IconButton
                            size="small"
                            onClick={() => handlePrintReport(report)}
                            color="info"
                          >
                            <PrintIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Reports Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No reports have been generated for this project yet.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ProjectReports;
