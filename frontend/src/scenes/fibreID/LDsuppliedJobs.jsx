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

const LDsuppliedJobs = () => {
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

  const handleViewAssessment = (assessment) => {
    // Navigate directly to analysis page for the first item
    // The analysis page will fetch the full assessment and handle item selection
    navigate(`/fibre-id/assessment/${assessment._id}/item/1/analysis`);
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

  const getAnalysisDueTime = (assessment) => {
    let dueDate;

    // Use analysisDueDate if available (should always be set for new submissions)
    if (assessment.analysisDueDate) {
      dueDate = new Date(assessment.analysisDueDate);
    } else if (assessment.samplesReceivedDate && assessment.turnaroundTime) {
      // Fallback: Calculate from samplesReceivedDate and turnaroundTime for older records
      const receivedDate = new Date(assessment.samplesReceivedDate);
      dueDate = new Date(receivedDate);

      if (assessment.turnaroundTime === "3 day") {
        dueDate.setDate(receivedDate.getDate() + 3);
      } else if (assessment.turnaroundTime === "24 hours") {
        dueDate.setHours(receivedDate.getHours() + 24);
      } else {
        // For custom or unknown, default to 3 days
        dueDate.setDate(receivedDate.getDate() + 3);
      }
    } else {
      // Last resort: if we have samplesReceivedDate, assume 3 days
      if (assessment.samplesReceivedDate) {
        const receivedDate = new Date(assessment.samplesReceivedDate);
        dueDate = new Date(receivedDate);
        dueDate.setDate(receivedDate.getDate() + 3);
      } else {
        console.warn(
          "Analysis due date missing for assessment:",
          assessment._id
        );
        return "Date unavailable";
      }
    }

    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();

    if (diffTime < 0) {
      // Overdue
      const daysOverdue = Math.floor(
        Math.abs(diffTime) / (1000 * 60 * 60 * 24)
      );
      const hoursOverdue = Math.floor(
        (Math.abs(diffTime) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const daysText = daysOverdue === 1 ? "day" : "days";
      const hoursText = hoursOverdue === 1 ? "hour" : "hours";
      return `Overdue: ${daysOverdue} ${daysText} ${hoursOverdue} ${hoursText}`;
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (days === 0 && hours === 0) {
      const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      if (minutes > 0) {
        const minutesText = minutes === 1 ? "minute" : "minutes";
        return `${minutes} ${minutesText}`;
      }
      return "Due now";
    }

    const daysText = days === 1 ? "day" : "days";
    const hoursText = hours === 1 ? "hour" : "hours";

    if (days === 0) {
      return `${hours} ${hoursText}`;
    }
    if (hours === 0) {
      return `${days} ${daysText}`;
    }

    return `${days} ${daysText} ${hours} ${hoursText}`;
  };

  const getAnalysisDueColor = (assessment) => {
    let dueDate;

    // Use analysisDueDate if available (should always be set for new submissions)
    if (assessment.analysisDueDate) {
      dueDate = new Date(assessment.analysisDueDate);
    } else if (assessment.samplesReceivedDate && assessment.turnaroundTime) {
      // Fallback: Calculate from samplesReceivedDate and turnaroundTime for older records
      const receivedDate = new Date(assessment.samplesReceivedDate);
      dueDate = new Date(receivedDate);

      if (assessment.turnaroundTime === "3 day") {
        dueDate.setDate(receivedDate.getDate() + 3);
      } else if (assessment.turnaroundTime === "24 hours") {
        dueDate.setHours(receivedDate.getHours() + 24);
      } else {
        // For custom or unknown, default to 3 days
        dueDate.setDate(receivedDate.getDate() + 3);
      }
    } else if (assessment.samplesReceivedDate) {
      // Last resort: if we have samplesReceivedDate, assume 3 days
      const receivedDate = new Date(assessment.samplesReceivedDate);
      dueDate = new Date(receivedDate);
      dueDate.setDate(receivedDate.getDate() + 3);
    } else {
      return "text.secondary"; // Fallback color if no date available
    }

    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();

    if (diffTime < 0) {
      return "error.main"; // Overdue - red
    }

    const hours = diffTime / (1000 * 60 * 60);
    if (hours <= 24) {
      return "warning.main"; // Less than 24 hours - orange
    }

    return "text.primary"; // Normal - default color
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              L&D Supplied Jobs
            </Typography>
          </Box>
          <Breadcrumbs>
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate("/laboratory-services")}
              sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            >
              <ArrowBackIcon sx={{ mr: 1 }} />
              Laboratory Services
            </Link>
            <Typography color="text.primary">L&D Supplied Jobs</Typography>
          </Breadcrumbs>
        </Box>

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
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Analysis Due
                  </TableCell>
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
                        onClick={() => handleViewAssessment(assessment)}
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
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: getAnalysisDueColor(assessment),
                              fontWeight: "medium",
                            }}
                          >
                            {getAnalysisDueTime(assessment)}
                          </Typography>
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

export default LDsuppliedJobs;
