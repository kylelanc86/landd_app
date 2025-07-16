import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
} from "@mui/material";
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
} from "@mui/icons-material";
import Header from "../../../components/Header";
import { tokens } from "../../../theme";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";

const AsbestosAssessment = () => {
  const theme = useTheme();
  const colors = tokens;

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingCOC, setGeneratingCOC] = useState(null);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await asbestosAssessmentService.getAll();
      console.log("Loaded assessments:", data);
      setAssessments(data);
    } catch (err) {
      console.error("Error loading assessments:", err);
      setError("Failed to load asbestos assessments");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCOC = async (assessmentId) => {
    try {
      setGeneratingCOC(assessmentId);
      setError("");

      const pdfBlob = await asbestosAssessmentService.generateChainOfCustody(
        assessmentId
      );

      // Create a download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ChainOfCustody_${assessmentId}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating Chain of Custody:", err);
      setError("Failed to generate Chain of Custody PDF. Please try again.");
    } finally {
      setGeneratingCOC(null);
    }
  };

  const handleViewAssessment = (assessmentId) => {
    // Navigate to assessment details
    console.log("View assessment:", assessmentId);
  };

  const handleEditAssessment = (assessmentId) => {
    // Navigate to edit assessment
    console.log("Edit assessment:", assessmentId);
  };

  const handleDeleteAssessment = async (assessmentId) => {
    if (window.confirm("Are you sure you want to delete this assessment?")) {
      try {
        await asbestosAssessmentService.delete(assessmentId);
        setAssessments(assessments.filter((a) => a._id !== assessmentId));
      } catch (err) {
        console.error("Error deleting assessment:", err);
        setError("Failed to delete assessment");
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "complete":
        return "success";
      case "in-progress":
        return "warning";
      case "pending":
        return "info";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Header
        title="Asbestos Assessment"
        subtitle="Manage asbestos assessment jobs"
      />

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Actions */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" color={colors.grey[100]}>
          Assessment Jobs ({assessments.length})
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArticleIcon />}
            onClick={() => console.log("Test COC button clicked")}
            color="secondary"
          >
            Test COC
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              backgroundColor: colors.primary[500],
              "&:hover": {
                backgroundColor: colors.primary[600],
              },
            }}
          >
            New Assessment
          </Button>
        </Box>
      </Box>

      {/* Assessments Table */}
      <Paper sx={{ overflow: "auto" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Project ID</TableCell>
                <TableCell>Site Name</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Assessor</TableCell>
                <TableCell>Assessment Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Samples</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No asbestos assessments found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                assessments.map((assessment) => (
                  <TableRow key={assessment._id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {assessment.projectId?.projectID || "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell>{assessment.projectId?.name || "N/A"}</TableCell>
                    <TableCell>
                      {assessment.projectId?.client?.name || "N/A"}
                    </TableCell>
                    <TableCell>
                      {assessment.assessorId
                        ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {assessment.assessmentDate
                        ? new Date(
                            assessment.assessmentDate
                          ).toLocaleDateString("en-GB")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assessment.status || "Unknown"}
                        color={getStatusColor(assessment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {assessment.items?.length || 0} samples
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "center",
                        }}
                      >
                        <Tooltip title="View Assessment">
                          <IconButton
                            size="small"
                            onClick={() => handleViewAssessment(assessment._id)}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Generate Chain of Custody">
                          <IconButton
                            size="small"
                            onClick={() => handleGenerateCOC(assessment._id)}
                            disabled={generatingCOC === assessment._id}
                            color="secondary"
                          >
                            {generatingCOC === assessment._id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <ArticleIcon />
                            )}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit Assessment">
                          <IconButton
                            size="small"
                            onClick={() => handleEditAssessment(assessment._id)}
                            color="info"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Assessment">
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleDeleteAssessment(assessment._id)
                            }
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AsbestosAssessment;
