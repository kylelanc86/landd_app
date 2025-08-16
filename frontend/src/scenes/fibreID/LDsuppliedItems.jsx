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

  const fetchAssessmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await asbestosAssessmentService.getJob(assessmentId);

      if (!response) {
        throw new Error("Invalid response format from server");
      }

      console.log("=== RAW API RESPONSE DEBUG ===");
      console.log("Raw response:", response);
      console.log("Raw response keys:", Object.keys(response));
      console.log(
        "fibreAnalysisReport in raw response:",
        !!response.fibreAnalysisReport
      );
      if (response.fibreAnalysisReport) {
        console.log(
          "Raw fibreAnalysisReport length:",
          response.fibreAnalysisReport.length
        );
        console.log(
          "Raw fibreAnalysisReport (first 100 chars):",
          response.fibreAnalysisReport.substring(0, 100)
        );
        console.log(
          "Raw fibreAnalysisReport (last 100 chars):",
          response.fibreAnalysisReport.substring(
            response.fibreAnalysisReport.length - 100
          )
        );
      }
      console.log("=== END RAW API RESPONSE DEBUG ===");

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
        assessment: assessment,
        sampleItems: sampleItemsForReport,
        analyst: analysts.find((a) => a._id === analyst)?.firstName
          ? `${analysts.find((a) => a._id === analyst).firstName} ${
              analysts.find((a) => a._id === analyst).lastName
            }`
          : "Unknown Analyst",
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

      // Check for NaN BEFORE sending to MongoDB
      console.log("=== FRONTEND NaN CHECK BEFORE UPLOAD ===");
      console.log("Contains NaN string:", base64Data.includes("NaN"));
      console.log("Contains null string:", base64Data.includes("null"));
      console.log(
        "Contains undefined string:",
        base64Data.includes("undefined")
      );
      console.log(
        "Contains [object Object]:",
        base64Data.includes("[object Object]")
      );
      console.log(
        "Contains invalid base64 chars:",
        /[^A-Za-z0-9+/=]/.test(base64Data)
      );

      if (base64Data.includes("NaN")) {
        console.log("WARNING: NaN found in base64 BEFORE upload!");
        const nanIndex = base64Data.indexOf("NaN");
        console.log("First NaN found at index:", nanIndex);
        console.log(
          "Context around NaN (50 chars before):",
          base64Data.substring(Math.max(0, nanIndex - 50), nanIndex)
        );
        console.log(
          "Context around NaN (50 chars after):",
          base64Data.substring(nanIndex + 3, nanIndex + 53)
        );
      }
      console.log("=== END FRONTEND NaN CHECK BEFORE UPLOAD ===");

      // Log the first and last 100 characters of the base64 data for comparison
      console.log("=== BASE64 DATA COMPARISON ===");
      console.log(
        "Base64 data (first 100 chars):",
        base64Data.substring(0, 100)
      );
      console.log(
        "Base64 data (last 100 chars):",
        base64Data.substring(base64Data.length - 100)
      );
      console.log(
        "Base64 data (middle 100 chars):",
        base64Data.substring(
          Math.floor(base64Data.length / 2) - 50,
          Math.floor(base64Data.length / 2) + 50
        )
      );
      console.log("=== END BASE64 DATA COMPARISON ===");

      // Store original data for comparison
      const originalBase64Data = base64Data;
      console.log("=== ORIGINAL DATA STORED ===");
      console.log("Original base64 length:", originalBase64Data.length);
      console.log(
        "Original base64 hash (first 50 + last 50):",
        originalBase64Data.substring(0, 50) +
          "..." +
          originalBase64Data.substring(originalBase64Data.length - 50)
      );
      console.log("=== END ORIGINAL DATA STORED ===");

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

      // After upload, fetch the assessment again and compare the stored base64
      console.log("Refreshing assessment data to compare stored base64...");
      await fetchAssessmentDetails();

      if (assessment.fibreAnalysisReport) {
        console.log("=== STORED BASE64 COMPARISON ===");
        console.log(
          "Stored base64 length:",
          assessment.fibreAnalysisReport.length
        );
        console.log(
          "Stored base64 (first 100 chars):",
          assessment.fibreAnalysisReport.substring(0, 100)
        );
        console.log(
          "Stored base64 (last 100 chars):",
          assessment.fibreAnalysisReport.substring(
            assessment.fibreAnalysisReport.length - 100
          )
        );
        console.log(
          "Stored base64 (middle 100 chars):",
          assessment.fibreAnalysisReport.substring(
            Math.floor(assessment.fibreAnalysisReport.length / 2) - 50,
            Math.floor(assessment.fibreAnalysisReport.length / 2) + 50
          )
        );

        // Check if they match
        const dataMatches = base64Data === assessment.fibreAnalysisReport;
        console.log("Base64 data matches stored data:", dataMatches);
        if (!dataMatches) {
          console.log(
            "WARNING: Base64 data has been corrupted during storage!"
          );
          console.log("Original length:", base64Data.length);
          console.log("Stored length:", assessment.fibreAnalysisReport.length);
        }
        console.log("=== END STORED BASE64 COMPARISON ===");

        // Compare with original stored data
        console.log("=== ORIGINAL VS RETRIEVED COMPARISON ===");
        console.log("Original data length:", originalBase64Data.length);
        console.log(
          "Retrieved data length:",
          assessment.fibreAnalysisReport.length
        );
        console.log(
          "Lengths match:",
          originalBase64Data.length === assessment.fibreAnalysisReport.length
        );
        console.log(
          "Content matches:",
          originalBase64Data === assessment.fibreAnalysisReport
        );

        if (originalBase64Data !== assessment.fibreAnalysisReport) {
          console.log("WARNING: Data corruption confirmed!");
          console.log(
            "First 100 chars match:",
            originalBase64Data.substring(0, 100) ===
              assessment.fibreAnalysisReport.substring(0, 100)
          );
          console.log(
            "Last 100 chars match:",
            originalBase64Data.substring(originalBase64Data.length - 100) ===
              assessment.fibreAnalysisReport.substring(
                assessment.fibreAnalysisReport.length - 100
              )
          );

          // Check for corruption patterns
          console.log("=== CORRUPTION PATTERN ANALYSIS ===");
          console.log(
            "Retrieved data contains null bytes:",
            assessment.fibreAnalysisReport.includes("\0")
          );
          console.log(
            "Retrieved data contains undefined:",
            assessment.fibreAnalysisReport.includes("undefined")
          );
          console.log(
            "Retrieved data contains [object Object]:",
            assessment.fibreAnalysisReport.includes("[object Object]")
          );
          console.log(
            "Retrieved data contains NaN:",
            assessment.fibreAnalysisReport.includes("NaN")
          );
          console.log(
            "Retrieved data contains invalid base64 chars:",
            /[^A-Za-z0-9+/=]/.test(assessment.fibreAnalysisReport)
          );
          console.log("=== END CORRUPTION PATTERN ANALYSIS ===");
        }
        console.log("=== END ORIGINAL VS RETRIEVED COMPARISON ===");
      } else {
        console.log(
          "WARNING: No fibreAnalysisReport found in assessment after upload!"
        );
      }

      alert("Fibre analysis report generated and uploaded successfully!");
    } catch (error) {
      console.error("Error generating fibre analysis report:", error);
      alert(`Error generating fibre analysis report: ${error.message}`);
    } finally {
      setGeneratingPDF(false);
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
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Note: Fibre analysis reports are now generated automatically
                when you generate the asbestos assessment PDF.
              </Typography>
            </Box>

            {/* Analyst Selection */}
            <Box sx={{ mb: 2 }}>
              <FormControl sx={{ minWidth: 200, mr: 2 }}>
                <InputLabel>Analyst</InputLabel>
                <Select
                  value={analyst}
                  onChange={(e) => setAnalyst(e.target.value)}
                  label="Analyst"
                >
                  {analysts.map((analystOption) => (
                    <MenuItem key={analystOption._id} value={analystOption._id}>
                      {analystOption.firstName} {analystOption.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {analysts.length > 0
                  ? `Selected analyst: ${
                      analysts.find((a) => a._id === analyst)?.firstName
                        ? `${
                            analysts.find((a) => a._id === analyst).firstName
                          } ${analysts.find((a) => a._id === analyst).lastName}`
                        : "Unknown"
                    }`
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
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                  ✓ Fibre Analysis Report Attached
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PdfIcon />}
                  onClick={() => {
                    // Convert base64 to blob and open in new tab
                    const byteCharacters = atob(assessment.fibreAnalysisReport);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], {
                      type: "application/pdf",
                    });
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                >
                  Open Saved Report
                </Button>
              </Box>
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
