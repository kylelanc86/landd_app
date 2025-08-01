import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Alert,
  Breadcrumbs,
  Link,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReportCategories from "./ReportCategories";
import ReportsList from "./ReportsList";
import { useNavigate } from "react-router-dom";
import {
  projectService,
  jobService,
  shiftService,
  sampleService,
  clientService,
} from "../../services/api";
import asbestosClearanceReportService from "../../services/asbestosClearanceReportService";
import { generateShiftReport } from "../../utils/generateShiftReport";

const ProjectReports = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await projectService.getById(projectId);
        setProject(response.data);
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project details");
      }
    };
    loadProject();
  }, [projectId]);

  // Load reports when category changes
  useEffect(() => {
    if (!selectedCategory || !projectId) return;

    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        let reportsData = [];

        switch (selectedCategory) {
          case "asbestos-assessment":
            const response = await fetch(
              `${
                process.env.REACT_APP_API_URL || "http://localhost:5000/api"
              }/reports/asbestos-assessment/${projectId}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              }
            );
            if (!response.ok) {
              throw new Error("Failed to fetch asbestos assessment reports");
            }
            const assessmentReports = await response.json();
            reportsData = assessmentReports;
            break;

          case "air-monitoring":
            // Get all jobs for this project
            const jobsResponse = await jobService.getAll();
            const projectJobs =
              jobsResponse.data?.filter(
                (job) =>
                  job.projectId === projectId ||
                  job.projectId?._id === projectId
              ) || [];

            // Get shifts for each job
            for (const job of projectJobs) {
              const shiftsResponse = await shiftService.getByJob(job._id);
              const shifts = shiftsResponse.data || [];

              // Map shifts to report format
              const shiftReports = shifts.map((shift) => ({
                id: shift._id,
                date: shift.date,
                reference: `${job.jobID}-${shift.name}`,
                description: "Air Monitoring Report",
                additionalInfo: `${job.name} • ${shift.name}`,
                status: shift.status,
                type: "shift",
                data: { shift, job },
              }));

              reportsData.push(...shiftReports);
            }
            break;

          case "clearance":
            const clearanceReports =
              await asbestosClearanceReportService.getAll({
                projectId,
              });

            if (clearanceReports.reports) {
              reportsData = clearanceReports.reports.map((report) => ({
                id: report._id,
                date: report.clearanceId?.clearanceDate || report.createdAt,
                reference: report.clearanceId?.clearanceNumber || "N/A",
                description: "Asbestos Clearance Report",
                status: report.clearanceId?.status || "Unknown",
                type: "clearance",
                data: report,
              }));
            }
            break;

          case "fibre-id":
            // TODO: Implement fibre ID reports loading
            break;

          case "invoices":
            // TODO: Implement invoices loading
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
    };

    loadReports();
  }, [selectedCategory, projectId]);

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

        generateShiftReport({
          shift: shift,
          job: job,
          samples: samplesWithAnalysis,
          projectId: projectData,
          openInNewTab: true,
        });
      } else if (report.type === "clearance") {
        // Generate clearance report PDF
        const api = require("../../services/axios").default;
        const response = await api.post(
          "/pdf-pdfshift/generate-asbestos-clearance",
          {
            clearanceData: { _id: report.data.clearanceId._id },
          },
          {
            responseType: "blob",
          }
        );

        // Open PDF in new tab
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
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

        generateShiftReport({
          shift: shift,
          job: job,
          samples: samplesWithAnalysis,
          projectId: projectData,
          openInNewTab: false,
        });
      } else if (report.type === "clearance") {
        const asbestosClearanceService =
          require("../../services/asbestosClearanceService").default;
        const fullClearance = await asbestosClearanceService.getById(
          report.data.clearanceId._id
        );

        const {
          generateHTMLTemplatePDF,
        } = require("../../utils/templatePDFGenerator");
        await generateHTMLTemplatePDF("asbestos-clearance", fullClearance);
      }
    } catch (err) {
      console.error("Error downloading report:", err);
      setError("Failed to download report");
    }
  };

  const handlePrintReport = async (report) => {
    // For now, we'll just view the report in a new tab and trigger the print dialog
    await handleViewReport(report);
    setTimeout(() => {
      window.print();
    }, 1000);
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

        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("/projects");
            }}
          >
            Projects
          </Link>
          <Typography color="text.primary">
            {project?.projectID || "Loading..."}
          </Typography>
        </Breadcrumbs>

        <Typography variant="h4" gutterBottom>
          Reports for {project?.name || "Loading..."}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Project ID: {project?.projectID}
        </Typography>
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
            onPrint={handlePrintReport}
          />
        </>
      )}
    </Box>
  );
};

export default ProjectReports;
