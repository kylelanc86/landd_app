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
  IconButton,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Badge,
} from "@mui/material";
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  ArrowBack as ArrowBackIcon,
  Science as ScienceIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { asbestosAssessmentService } from "../../services/api";

const AsbestosAssessmentJobs = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAsbestosAssessments();
  }, []);

  const fetchAsbestosAssessments = async () => {
    try {
      setLoading(true);
      // Fetch all asbestos assessments
      const response = await asbestosAssessmentService.getAsbestosAssessments();

      // Filter to only show jobs that are ready for analysis
      const jobsReadyForAnalysis = (response.data || []).filter(
        (assessment) => assessment.status === "ready-for-analysis"
      );

      setAssessments(jobsReadyForAnalysis);
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
    navigate(`/fibre-id/ldjobs/${assessmentId}/samples`);
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const getReadySamplesCount = (assessment) => {
    return assessment.items?.length || 0;
  };

  const getStatusColor = (assessment) => {
    const itemCount = getReadySamplesCount(assessment);
    if (itemCount === 0) return "default";
    if (itemCount <= 5) return "warning";
    return "success";
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
          <Typography color="text.primary">Asbestos Assessment Jobs</Typography>
        </Breadcrumbs>

        <Typography variant="h4" component="h1" gutterBottom>
          Asbestos Assessment Jobs
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          View asbestos assessment jobs ready for fibre identification analysis
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
                  <TableCell sx={{ fontWeight: "bold" }}>LAA</TableCell>
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
                    <TableCell colSpan={7} align="center">
                      Loading assessments...
                    </TableCell>
                  </TableRow>
                ) : filteredAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No asbestos assessment jobs ready for analysis found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssessments.map((assessment) => {
                    const readyCount = getReadySamplesCount(assessment);
                    return (
                      <TableRow key={assessment._id} hover>
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
                          <Typography variant="body2">
                            {assessment.assessorId
                              ? `${assessment.assessorId.firstName} ${assessment.assessorId.lastName}`
                              : "Unknown Assessor"}
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
                            label={assessment.status || "ready-for-analysis"}
                            color="success"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            onClick={() => handleViewAssessment(assessment._id)}
                            color="primary"
                            size="small"
                            title="View Assessment Details"
                          >
                            <ViewIcon />
                          </IconButton>
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
