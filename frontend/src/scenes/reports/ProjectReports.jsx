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
import AssessmentIcon from "@mui/icons-material/Assessment";
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
import reportService from "../../services/reportService";
import { generateShiftReport } from "../../utils/generateShiftReport";
import ProjectLogModalWrapper from "./ProjectLogModalWrapper";

const ProjectReports = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logModalOpen, setLogModalOpen] = useState(false);

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
              console.error(
                "Error fetching asbestos assessment reports:",
                error
              );
              reportsData = [];
            }
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
                additionalInfo: `${shift.name}`,
                status: shift.status,
                type: "shift",
                data: { shift, job },
              }));

              reportsData.push(...shiftReports);
            }
            break;

          case "clearance":
            // Import asbestosClearanceService dynamically
            const { default: asbestosClearanceService } = await import(
              "../../services/asbestosClearanceService"
            );

            const allClearances = await asbestosClearanceService.getAll();

            // Filter clearances by projectId
            let projectClearances = [];
            if (allClearances && Array.isArray(allClearances)) {
              projectClearances = allClearances.filter(
                (clearance) =>
                  clearance.projectId === projectId ||
                  clearance.projectId?._id === projectId
              );
            } else if (
              allClearances.clearances &&
              Array.isArray(allClearances.clearances)
            ) {
              projectClearances = allClearances.clearances.filter(
                (clearance) =>
                  clearance.projectId === projectId ||
                  clearance.projectId?._id === projectId
              );
            }

            reportsData = projectClearances.map((clearance) => ({
              id: clearance._id,
              date: clearance.clearanceDate || clearance.createdAt,
              description: `${clearance.clearanceType} Asbestos Clearance`,
              additionalInfo: `${clearance.asbestosRemovalist || "N/A"}`,
              status: clearance.status || "Unknown",
              type: "clearance",
              data: clearance,
            }));
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

          case "invoices":
            // Get invoices for this project
            const invoicesResponse = await fetch(
              `${
                process.env.REACT_APP_API_URL || "http://localhost:5000/api"
              }/reports/invoices/${projectId}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              }
            );
            if (!invoicesResponse.ok) {
              throw new Error("Failed to fetch invoices");
            }
            const invoicesData = await invoicesResponse.json();

            // Map to our standard report format
            reportsData = invoicesData.map((invoice) => ({
              id: invoice.id || invoice._id,
              date: invoice.date || invoice.invoiceDate || invoice.createdAt,
              description: invoice.description || "Project Invoice",
              additionalInfo:
                invoice.additionalInfo || invoice.projectName || "N/A",
              status: invoice.status || "Unknown",
              type: "invoice",
              data: invoice,
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

        // Generate the PDF
        await generateHTMLTemplatePDF("asbestos-clearance", fullClearance);
      } else if (report.type === "asbestos_assessment") {
        // For asbestos assessment reports, we'll navigate to the assessment details page
        // This assumes there's a route like /asbestos-assessment/:id
        navigate(`/asbestos-assessment/${report.data.id || report.data._id}`);
      } else if (report.type === "fibre_id") {
        // Navigate to the fibre ID job details page
        navigate(`/fibre-id/client-supplied/${report.data.id}/samples`);
      } else if (report.type === "invoice") {
        // Navigate to the invoice edit page
        navigate(`/invoices/edit/${report.data.id}`);
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

        // Generate the PDF
        await generateHTMLTemplatePDF("asbestos-clearance", fullClearance);
      } else if (report.type === "asbestos_assessment") {
        // For asbestos assessment reports, we'll navigate to the assessment details page where download is available
        navigate(`/asbestos-assessment/${report.data.id || report.data._id}`);
      } else if (report.type === "fibre_id") {
        // For fibre ID reports, we'll navigate to the fibre ID job details page where download is available
        navigate(`/fibre-id/client-supplied/${report.data.id}/samples`);
      } else if (report.type === "invoice") {
        // For invoices, we'll navigate to the invoice edit page where download is available
        navigate(`/invoices/edit/${report.data.id}`);
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

  const handleReviseReport = async (report) => {
    try {
      if (report.type === "shift") {
        // Navigate to the shift edit page
        navigate(`/air-monitoring/shifts/${report.data.shift._id}/edit`);
      } else if (report.type === "clearance") {
        // Navigate to the clearance edit page
        // Navigate to asbestos removal job details page instead of standalone clearance page
        navigate(`/asbestos-removal`);
      } else if (report.type === "asbestos_assessment") {
        // Navigate to the asbestos assessment edit page
        navigate(
          `/asbestos-assessment/${report.data.id || report.data._id}/edit`
        );
      } else if (report.type === "fibre_id") {
        // Navigate to the fibre ID job edit page
        navigate(`/fibre-id/client-supplied/${report.data.id}/edit`);
      } else if (report.type === "invoice") {
        // Navigate to the invoice edit page
        navigate(`/invoices/edit/${report.data.id}`);
      }
    } catch (err) {
      console.error("Error navigating to revise report:", err);
      setError("Failed to navigate to revise report");
    }
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

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            <Typography variant="h4" gutterBottom>
              Reports for {project?.projectID}: {project?.name || "Loading..."}
            </Typography>
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
            onPrint={handlePrintReport}
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
    </Box>
  );
};

export default ProjectReports;
