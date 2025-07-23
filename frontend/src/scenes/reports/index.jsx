import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Divider,
} from "@mui/material";
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Clear as ClearIcon,
  Folder as FolderIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { tokens } from "../../theme";
import projectService from "../../services/projectService";
import asbestosClearanceReportService from "../../services/asbestosClearanceReportService";
import recentProjectsService from "../../services/recentProjectsService";
import {
  shiftService,
  jobService,
  sampleService,
  clientService,
} from "../../services/api";
import { generateShiftReport } from "../../utils/generateShiftReport";

const Reports = () => {
  const theme = useTheme();
  const colors = tokens;

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectReports, setProjectReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState("");
  const [projectsWithReports, setProjectsWithReports] = useState(new Set());
  const [recentProjects, setRecentProjects] = useState([]);
  const [loadingRecentProjects, setLoadingRecentProjects] = useState(false);
  const navigate = useNavigate();

  // Load recent projects on component mount
  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    try {
      setLoadingRecentProjects(true);
      const projects = await recentProjectsService.getRecentProjectsWithData(
        projectService
      );
      setRecentProjects(projects);
    } catch (error) {
      console.error("Error loading recent projects:", error);
    } finally {
      setLoadingRecentProjects(false);
    }
  };

  const handleRecentProjectClick = async (project) => {
    try {
      // Add to recent projects
      recentProjectsService.addRecentProject(project);

      // Navigate to project reports page
      navigate(`/reports/project/${project._id}`);
    } catch (error) {
      console.error("Error handling recent project click:", error);
      setError("Failed to load project");
    }
  };

  const handleRemoveRecentProject = (projectId, event) => {
    event.stopPropagation(); // Prevent triggering the card click
    recentProjectsService.removeRecentProject(projectId);
    setRecentProjects((prev) => prev.filter((p) => p._id !== projectId));
  };

  // Search projects function - using the same approach as projects page
  const handleSearch = async (searchValue = searchTerm) => {
    const termToSearch = searchValue || searchTerm;
    if (!termToSearch.trim()) {
      setError("Please enter a search term");
      return;
    }

    try {
      setSearching(true);
      setError("");
      setSearchResults([]);
      setSelectedProject(null);
      setProjectReports([]);

      // Use the same parameters as the projects page
      const params = {
        page: 1,
        limit: 1000, // Large limit to get more results
        sortBy: "projectID",
        sortOrder: "desc",
        search: termToSearch.trim(),
      };

      // Ensure limit is a number
      params.limit = parseInt(params.limit);

      console.log("Search params:", params);
      console.log("Current searchTerm:", searchTerm);
      console.log("Search term being used:", termToSearch.trim());
      const response = await projectService.getAll(params);

      console.log("Search response:", response);

      // Use the same response handling as projects page
      const projectsData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      console.log("Projects data:", projectsData.length);

      setSearchResults(projectsData);

      // Use the reports_present field from the API response
      const projectsWithReportsSet = new Set();

      projectsData.forEach((project) => {
        if (project.reports_present) {
          projectsWithReportsSet.add(project._id);
        }
      });

      setProjectsWithReports(projectsWithReportsSet);

      if (projectsData.length === 0) {
        setError("No projects found matching your search term");
      }
    } catch (err) {
      console.error("Error searching projects:", err);
      setError("Failed to search projects");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setSelectedProject(null);
    setProjectReports([]);
    setError("");
    setProjectsWithReports(new Set());
  };

  const handleLoadReportsForProject = async (project) => {
    if (!projectsWithReports.has(project._id)) {
      return; // Don't allow loading reports if project has no reports
    }

    try {
      setLoadingReports(true);
      setError("");

      // Collect all reports for the selected project
      const allReports = [];

      // 1. Get asbestos clearance reports
      try {
        const clearanceReports = await asbestosClearanceReportService.getAll({
          projectId: project._id,
        });
        if (clearanceReports.reports) {
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
            allReports.push(report);
          });
        }
      } catch (err) {
        console.log("No clearance reports found for this project:", err);
      }

      // 2. Get air monitoring reports (shifts) - ONLY if no clearance reports exist
      if (allReports.length === 0) {
        try {
          // First get all jobs for this project
          const jobsResponse = await jobService.getAll();
          const projectJobs =
            jobsResponse.data?.filter(
              (job) =>
                job.project === project._id || job.project?._id === project._id
            ) || [];

          // Get shifts for each job
          for (const job of projectJobs) {
            try {
              const shiftsResponse = await shiftService.getByJob(job._id);
              const shifts = shiftsResponse.data || [];

              shifts.forEach((shift) => {
                // Only include shifts that have reports (analysis complete or shift complete)
                if (
                  shift.status === "analysis_complete" ||
                  shift.status === "shift_complete" ||
                  shift.reportApprovedBy
                ) {
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
                  });
                }
              });
            } catch (err) {
              console.log(`No shifts found for job ${job._id}`);
            }
          }
        } catch (err) {
          console.log("No air monitoring reports found for this project");
        }
      }

      // Sort reports by date (newest first) and take only the most recent one
      allReports.sort((a, b) => b.date - a.date);

      // Only keep the most recent report
      const finalReports = allReports.length > 0 ? [allReports[0]] : [];

      setProjectReports(finalReports);
      setSelectedProject(project);
    } catch (err) {
      console.error("Error loading reports:", err);
      setError("Failed to load reports for this project");
    } finally {
      setLoadingReports(false);
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
        let project = jobResponse.data.project;
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
          "/pdf/generate-asbestos-clearance",
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
        let project = jobResponse.data.project;
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
      } else if (report.type === "Asbestos Clearance Report") {
        // TODO: Implement asbestos clearance report printing
        console.log("Printing asbestos clearance report:", report);
      }
    } catch (err) {
      console.error("Error printing report:", err);
      setError("Failed to print report");
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "complete":
        return "success";
      case "in progress":
        return "warning";
      case "pending":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Reports
      </Typography>

      {/* Project Search Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Projects
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
          <TextField
            fullWidth
            label="Search for a project"
            placeholder="Enter project ID, name, or client"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSearch(searchTerm);
              }
            }}
            InputProps={{
              startAdornment: (
                <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClearSearch}
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained"
            onClick={() => handleSearch(searchTerm)}
            disabled={!searchTerm.trim() || searching}
            sx={{ minWidth: 140 }}
          >
            {searching ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Search"
            )}
          </Button>
        </Box>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Search Results ({searchResults.length} projects found)
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 700 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Project ID</TableCell>
                    <TableCell>Site Name</TableCell>
                    <TableCell>Reports</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((project) => {
                    const hasReports = projectsWithReports.has(project._id);
                    return (
                      <TableRow key={project._id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {project.projectID}
                          </Typography>
                        </TableCell>
                        <TableCell>{project.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              hasReports ? "Reports Available" : "No Reports"
                            }
                            color={hasReports ? "success" : "error"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="contained"
                            size="small"
                            color="secondary"
                            disabled={!hasReports}
                            onClick={() => {
                              recentProjectsService.addRecentProject(project);
                              navigate(`/reports/project/${project._id}`);
                            }}
                          >
                            Load Reports
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Recent Projects Section */}
      {recentProjects.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: colors.primary[50] }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: colors.primary[700] }}
          >
            Recent Projects
          </Typography>
          {loadingRecentProjects ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {recentProjects.map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project._id}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "action.hover",
                        boxShadow: 2,
                      },
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleRecentProjectClick(project)}
                      sx={{ p: 2 }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 1 }}
                      >
                        <Avatar
                          sx={{
                            mr: 2,
                            bgcolor: colors.primary[500],
                            width: 40,
                            height: 40,
                          }}
                        >
                          <FolderIcon />
                        </Avatar>
                        <IconButton
                          size="small"
                          onClick={(e) =>
                            handleRemoveRecentProject(project._id, e)
                          }
                          color="error"
                          sx={{
                            ml: "auto",
                            "&:hover": {
                              backgroundColor: "error.light",
                            },
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        gutterBottom
                      >
                        {project.projectID}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        {project.name}
                      </Typography>
                      {project.client?.name && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {project.client.name}
                        </Typography>
                      )}
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}

      {/* Reports Table */}
      {projectReports.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Reports for {selectedProject?.projectID}
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {report.type}
                      </Typography>
                      {report.jobName && (
                        <Typography variant="caption" color="text.secondary">
                          {report.jobName} • {report.shiftName}
                        </Typography>
                      )}
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
        </Paper>
      )}

      {/* No Reports Message */}
      {selectedProject &&
        !loadingReports &&
        projectReports.length === 0 &&
        !error && (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Reports Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No reports have been generated for this project yet.
            </Typography>
          </Paper>
        )}
    </Box>
  );
};

export default Reports;
