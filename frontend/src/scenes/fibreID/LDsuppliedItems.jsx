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
  Chip,
  Breadcrumbs,
  Link,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { asbestosAssessmentService, userService } from "../../services/api";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";

const LDsuppliedItems = () => {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [analyst, setAnalyst] = useState("");
  const [analysts, setAnalysts] = useState([]);

  useEffect(() => {
    if (assessmentId) {
      fetchAssessmentDetails();
      fetchAnalysts();
    }
  }, [assessmentId]);

  // Debug effect to log analysts state changes
  useEffect(() => {
    console.log("Analysts state changed:", analysts);
    console.log("Current analyst selected:", analyst);
  }, [analysts, analyst]);

  const fetchAnalysts = async () => {
    try {
      console.log("=== FETCHING ANALYSTS DEBUG ===");
      const response = await userService.getAll(true); // Get all users including inactive
      console.log("User service response:", response);
      console.log("Response data:", response.data);
      console.log("Number of users returned:", response.data?.length || 0);

      // Log all users to see their structure
      if (response.data && response.data.length > 0) {
        response.data.forEach((user, index) => {
          console.log(`User ${index + 1}:`, {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            labApprovals: user.labApprovals,
            fibreIdentification: user.labApprovals?.fibreIdentification,
          });
        });
      }

      const fibreIdentificationAnalysts = response.data.filter(
        (user) => user.labApprovals?.fibreIdentification === true
      );
      console.log(
        "Filtered fibre identification analysts:",
        fibreIdentificationAnalysts
      );
      console.log(
        "Number of analysts found:",
        fibreIdentificationAnalysts.length
      );

      setAnalysts(fibreIdentificationAnalysts);

      // Set default analyst if available
      if (fibreIdentificationAnalysts.length > 0 && !analyst) {
        console.log("Setting default analyst:", fibreIdentificationAnalysts[0]);
        setAnalyst(fibreIdentificationAnalysts[0]._id);
      }
    } catch (error) {
      console.error("Error fetching analysts:", error);
    }
  };

  const fetchAssessmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await asbestosAssessmentService.getJob(assessmentId);

      if (!response) {
        throw new Error("Invalid response format from server");
      }

      setAssessment(response);
      console.log("Assessment response:", response);
      console.log("Assessment items:", response.items);
      if (response.items && response.items.length > 0) {
        response.items.forEach((item, index) => {
          console.log(`Item ${index + 1}:`, {
            itemNumber: item.itemNumber,
            sampleReference: item.sampleReference,
            analysisData: item.analysisData,
            isAnalyzed: item.analysisData?.isAnalyzed,
            asbestosContent: item.asbestosContent,
          });
        });
      }
    } catch (error) {
      console.error("Error fetching assessment details:", error);

      if (error.response?.status === 404) {
        setError("Assessment not found. Please check the URL.");
      } else if (error.response?.status === 500) {
        setError("Server error while fetching assessment data.");
      } else {
        setError(error.message || "Failed to fetch assessment details");
      }

      setAssessment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const handleBackToAssessments = () => {
    navigate("/fibre-id/ldjobs");
  };

  const handleRowClick = (itemNumber) => {
    navigate(
      `/fibre-id/assessment/${assessmentId}/item/${itemNumber}/analysis`
    );
  };

  const handleGenerateFibreAnalysisReport = async () => {
    try {
      setGeneratingPDF(true);

      console.log("=== FRONTEND FIBRE ANALYSIS REPORT GENERATION DEBUG ===");
      console.log("Assessment ID:", assessmentId);
      console.log("Assessment data:", assessment);
      console.log(
        "Items to analyze:",
        assessment.items.filter((item) => item.analysisData?.isAnalyzed)
      );

      // Debug client information
      console.log("Project ID structure:", assessment.projectId);
      console.log("Client structure:", assessment.projectId?.client);
      console.log("Client name:", assessment.projectId?.client?.name);
      console.log(
        "Client contact:",
        assessment.projectId?.client?.contact1Name
      );
      console.log("Client email:", assessment.projectId?.client?.contact1Email);
      console.log("Client address:", assessment.projectId?.client?.address);

      // Log detailed item structure
      assessment.items.forEach((item, index) => {
        console.log(`Item ${index + 1} detailed structure:`, {
          itemNumber: item.itemNumber,
          sampleReference: item.sampleReference,
          locationDescription: item.locationDescription,
          analysisData: item.analysisData,
          sampleReferenceType: typeof item.sampleReference,
          hasSampleReference: !!item.sampleReference,
        });
      });

      // Create a mock job object for the fibre analysis report
      const mockJob = {
        projectId: assessment.projectId,
        jobNumber: assessment._id,
        status: "Completed",
        assessorId: assessment.assessorId,
        assessorName: assessment.assessorId?.firstName
          ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}`
          : "LAA",
        analyst: analysts.find((a) => a._id === analyst)?.firstName
          ? `${analysts.find((a) => a._id === analyst).firstName} ${
              analysts.find((a) => a._id === analyst).lastName
            }`
          : "Unknown Analyst",
      };
      console.log("Mock job object:", mockJob);

      // Prepare sample items with the correct structure for the fibre analysis report
      const sampleItemsForReport = assessment.items
        .filter((item) => item.analysisData?.isAnalyzed)
        .map((item) => ({
          ...item,
          // Ensure sample reference is properly set
          sampleReference: item.sampleReference || `Sample ${item.itemNumber}`,
          // Include analysis data
          analysisData: item.analysisData,
          // Include location description as fallback for sample description
          locationDescription: item.locationDescription,
        }));

      console.log("Sample items for report:", sampleItemsForReport);

      // Generate the fibre analysis PDF and get base64 data
      console.log("Generating fibre analysis PDF...");
      const pdfDataUrl = await generateFibreIDReport({
        job: mockJob,
        sampleItems: sampleItemsForReport,
        openInNewTab: true, // Open in new window for immediate review
        returnPdfData: true,
      });
      console.log(
        "PDF generated successfully, data URL length:",
        pdfDataUrl.length
      );

      // Extract base64 data from data URL
      const base64Data = pdfDataUrl.split(",")[1];
      console.log("Base64 data extracted, length:", base64Data.length);

      // Upload the report to the assessment
      console.log("Uploading fibre analysis report to backend...");
      const uploadResponse =
        await asbestosAssessmentService.uploadFibreAnalysisReport(
          assessmentId,
          {
            reportData: base64Data,
          }
        );
      console.log("Upload response:", uploadResponse);

      // Refresh assessment data to show the uploaded report
      console.log("Refreshing assessment data...");
      await fetchAssessmentDetails();

      alert("Fibre analysis report generated and uploaded successfully!");
    } catch (error) {
      console.error("Error generating fibre analysis report:", error);
      alert(`Error generating fibre analysis report: ${error.message}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getAnalysisStatusColor = (item) => {
    if (item.analysisData?.isAnalyzed) {
      return "success";
    } else if (item.readyForAnalysis) {
      return "warning";
    } else {
      return "default";
    }
  };

  const getAnalysisStatusText = (item) => {
    if (item.analysisData?.isAnalyzed) {
      return "Analysed";
    } else if (item.readyForAnalysis) {
      return "Ready for Analysis";
    } else {
      return "Not Ready";
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center">
            Loading assessment details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !assessment) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            {error || "Assessment not found"}
          </Typography>
          <Box
            component="button"
            onClick={() => navigate("/fibre-id")}
            sx={{
              mt: 2,
              display: "block",
              mx: "auto",
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Return to Fibre ID Home
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Fibre ID Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToAssessments}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Assessment Jobs
          </Link>
          <Typography color="text.primary">
            {assessment.projectId?.projectID}
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Assessment Items
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Assessment Date:{" "}
            {assessment.assessmentDate
              ? new Date(assessment.assessmentDate).toLocaleDateString("en-GB")
              : "N/A"}
          </Typography>

          {/* Fibre Analysis Report Generation Button */}
          <Box sx={{ mt: 2 }}>
            {/* Analyst Selection */}
            <Box sx={{ mb: 2 }}>
              <FormControl sx={{ minWidth: 200, mr: 2 }}>
                <InputLabel>Analyst</InputLabel>
                <Select
                  value={analyst}
                  onChange={(e) => setAnalyst(e.target.value)}
                  label="Analyst"
                  size="small"
                >
                  {analysts.length > 0 ? (
                    analysts.map((analystUser) => (
                      <MenuItem key={analystUser._id} value={analystUser._id}>
                        {analystUser.firstName} {analystUser.lastName}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No analysts available</MenuItem>
                  )}
                </Select>
              </FormControl>
              {/* Debug info */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                {analysts.length > 0
                  ? `${analysts.length} analyst(s) available`
                  : "No analysts found - check lab approvals"}
              </Typography>
            </Box>

            <Button
              variant="outlined"
              color="primary"
              startIcon={<PdfIcon />}
              onClick={handleGenerateFibreAnalysisReport}
              disabled={
                generatingPDF ||
                !assessment.items?.some(
                  (item) => item.analysisData?.isAnalyzed
                ) ||
                !analyst
              }
              sx={{ mr: 2 }}
            >
              {generatingPDF
                ? "Generating..."
                : "Generate Fibre Analysis Report"}
            </Button>
            {assessment.fibreAnalysisReport && (
              <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                ✓ Fibre Analysis Report Attached
              </Typography>
            )}
          </Box>
        </Box>

        {/* Assessment Items Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>Item #</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Sample Reference
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Material Type
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Asbestos Content
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Analysis Status
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assessment.items && assessment.items.length > 0 ? (
                  assessment.items.map((item) => (
                    <TableRow
                      key={item.itemNumber}
                      hover
                      onClick={() => handleRowClick(item.itemNumber)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {item.itemNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.sampleReference || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.locationDescription || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.materialType || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.analysisData?.isAnalyzed &&
                          item.analysisData?.finalResult
                            ? item.analysisData.finalResult
                            : item.analysisData?.isAnalyzed
                            ? "Analysis Complete (No Result)"
                            : "TBC"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getAnalysisStatusText(item)}
                          color={getAnalysisStatusColor(item)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No assessment items found for this assessment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Container>
  );
};

export default LDsuppliedItems;
