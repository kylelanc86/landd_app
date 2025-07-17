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
  ArrowBack as ArrowBackIcon,
  Science as ScienceIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { asbestosAssessmentService } from "../../services/api";

const AsbestosAssessmentSamples = () => {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (assessmentId) {
      fetchAssessmentDetails();
    }
  }, [assessmentId]);

  const fetchAssessmentDetails = async () => {
    try {
      setLoading(true);
      const response = await asbestosAssessmentService.getAsbestosAssessment(
        assessmentId
      );
      setAssessment(response.data);
    } catch (error) {
      console.error("Error fetching assessment details:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (assessment?.items || []).filter(
    (item) =>
      item.labReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sampleReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sampleDescription
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.locationDescription?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBackToJobs = () => {
    navigate("/fibre-id/ldjobs");
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "ready-for-analysis":
        return "success";
      case "in-progress":
        return "warning";
      default:
        return "default";
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

  if (!assessment) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            Assessment not found
          </Typography>
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
            onClick={handleBackToJobs}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Asbestos Assessment Jobs
          </Link>
          <Typography color="text.primary">Sample Items</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Sample Items - {assessment.projectId?.name || "Unnamed Project"}
          </Typography>
          <Typography variant="body1" color="text.secondary sx={{ mb:2 }}">
            Project ID: {assessment.projectId?.projectID || "N/A"} | Client:{" "}
            {assessment.projectId?.client?.name || "Unknown Client"} |
            Assessment Date:{" "}
            {assessment.assessmentDate
              ? new Date(assessment.assessmentDate).toLocaleDateString(
                  "en-GB",
                  {
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                  }
                )
              : "N/A"}
          </Typography>
          <Chip
            label={assessment.status || "in-progress"}
            color={getStatusColor(assessment.status)}
            size="small"
            sx={{ mr: 1 }}
          />
          <Chip
            label={`${assessment.items?.length || 0} samples`}
            color="primary"
            size="small"
          />
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by lab reference, sample reference, sample description, or location..."
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

        {/* Sample Items Table */}
        <Paper sx={{ width: 1, overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Lab Reference
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Sample Reference
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Sample Description
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Analysis Result
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {searchTerm
                        ? "No samples match your search criteria"
                        : "No samples found for this assessment"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item, index) => (
                    <TableRow key={item._id || index} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {item.labReference ||
                            `${assessment.projectId?.projectID}-${index + 1}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.sampleReference ||
                            item.sampleReference ||
                            "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.sampleDescription ||
                            item.locationDescription ||
                            "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.analysisResult || "Pending"}
                          color={item.analysisResult ? "success" : "warning"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          onClick={() =>
                            navigate(`/fibre-id/analysis/${item._id || index}`)
                          }
                          sx={{ mr: 1 }}
                        >
                          Analysis
                        </Button>
                        <IconButton
                          color="primary"
                          size="small"
                          title="Edit Sample"
                        >
                          <EditIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Container>
  );
};

export default AsbestosAssessmentSamples;
