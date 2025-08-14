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
  Button,
  Chip,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
} from "@mui/material";
import {
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { asbestosAssessmentService } from "../../services/api";

const AsbestosAssessmentJobs = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingAssessment, setUpdatingAssessment] = useState(null);

  useEffect(() => {
    fetchAsbestosAssessments();
  }, []);

  const fetchAsbestosAssessments = async () => {
    try {
      setLoading(true);
      // Fetch all asbestos assessments
      const response = await asbestosAssessmentService.getAsbestosAssessments();

      // Show all assessments that aren't complete
      const activeAssessments = (response.data || []).filter(
        (assessment) => assessment.status !== "complete"
      );

      setAssessments(activeAssessments);
    } catch (error) {
      console.error("Error fetching asbestos assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = assessments.filter(
    (assessment) =>
      assessment.projectId?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.projectId?.client?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.projectId?.projectID
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.assessorId?.firstName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assessment.assessorId?.lastName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const handleViewAssessment = (assessmentId) => {
    // Navigate to assessment items list for this assessment
    navigate(`/fibre-id/assessment/${assessmentId}/items`);
  };

  const handleCompleteAssessment = async (assessment) => {
    if (updatingAssessment) return;

    setUpdatingAssessment(assessment._id);
    try {
      // Update the assessment status to "complete"
      await asbestosAssessmentService.updateAsbestosAssessment(assessment._id, {
        ...assessment,
        status: "complete",
      });

      // Also update the corresponding asbestos assessment job status to "sample-analysis-complete"
      // This will trigger the "Report Ready for Review" button to appear on the asbestos assessments page
      // You may need to implement this API call based on your backend structure

      await fetchAsbestosAssessments();
    } catch (error) {
      console.error("Error completing assessment:", error);
    } finally {
      setUpdatingAssessment(null);
    }
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const getReadySamplesCount = (assessment) => {
    return assessment.items?.length || 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "samples-with-lab":
        return "primary";
      case "complete":
        return "success";
      default:
        return "default";
    }
  };

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
          <Typography color="text.primary">Fibre ID: Asbestos Assessment Jobs</Typography>
        </Breadcrumbs>

        <Typography variant="h4" component="h1" gutterBottom>
          Fibre ID: Asbestos Assessment Jobs
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          View and manage active asbestos assessment jobs
        </Typography>

        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by project name, client, project ID, or assessor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Assessments Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>Project ID</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Sample Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    No. of Samples
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Loading assessments...
                    </TableCell>
                  </TableRow>
                ) : filteredAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No active asbestos assessment jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssessments.map((assessment) => {
                    const readyCount = getReadySamplesCount(assessment);
                    return (
                      <TableRow
                        key={assessment._id}
                        hover
                        onClick={() => handleViewAssessment(assessment._id)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {assessment.projectId?.projectID || "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {assessment.projectId?.name || "Unnamed Project"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {assessment.assessmentDate
                              ? new Date(
                                  assessment.assessmentDate
                                ).toLocaleDateString("en-GB")
                              : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {readyCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              assessment.status === "samples-with-lab"
                                ? "Samples with Lab"
                                : "Complete"
                            }
                            color={getStatusColor(assessment.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: "flex", gap: 1 }}>
                            {assessment.status !== "complete" && (
                              <Button
                                variant="outlined"
                                size="small"
                                color="success"
                                onClick={() =>
                                  handleCompleteAssessment(assessment)
                                }
                                disabled={updatingAssessment === assessment._id}
                              >
                                Complete
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Container>
  );
};

export default AsbestosAssessmentJobs;
