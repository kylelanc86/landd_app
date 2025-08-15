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
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { asbestosAssessmentService } from "../../services/api";

const LDsuppliedItems = () => {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (assessmentId) {
      fetchAssessmentDetails();
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
          <Typography color="text.primary">{assessment.projectId?.projectID}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Fibre ID: Assessment Items
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Project: {assessment.projectId?.projectID || "N/A"} -{" "}
            {assessment.projectId?.name || "Unknown Project"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Assessment Date:{" "}
            {assessment.assessmentDate
              ? new Date(assessment.assessmentDate).toLocaleDateString("en-GB")
              : "N/A"}
          </Typography>
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
