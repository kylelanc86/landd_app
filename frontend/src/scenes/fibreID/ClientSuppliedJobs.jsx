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
} from "@mui/material";
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import {
  clientSuppliedJobsService,
  sampleItemsService,
} from "../../services/api";

const ClientSuppliedJobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [sampleCounts, setSampleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchClientSuppliedJobs();
  }, []);

  // Refresh data when component comes into focus (e.g., when returning from samples page)
  useEffect(() => {
    const handleFocus = () => {
      if (jobs.length > 0) {
        fetchSampleCounts(jobs);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [jobs]);

  const fetchClientSuppliedJobs = async () => {
    try {
      setLoading(true);
      // Fetch all client supplied jobs
      const response = await clientSuppliedJobsService.getAll();

      const jobsData = response.data || [];
      const jobsArray = Array.isArray(jobsData) ? jobsData : [];
      setJobs(jobsArray);

      // Fetch sample counts for each job
      await fetchSampleCounts(jobsArray);
    } catch (error) {
      console.error("Error fetching client supplied jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleCounts = async (jobsArray) => {
    const counts = {};
    for (const job of jobsArray) {
      try {
        const response = await sampleItemsService.getAll({
          projectId: job.projectId._id || job.projectId,
        });
        counts[job._id] = response.data?.length || 0;
      } catch (error) {
        console.error(`Error fetching sample count for job ${job._id}:`, error);
        counts[job._id] = 0;
      }
    }
    setSampleCounts(counts);
  };

  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter(
    (job) =>
      job.projectId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.projectId?.client?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      job.projectId?.projectID?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewJob = (jobId) => {
    // Ensure we're passing a string ID, not an object
    const actualJobId = typeof jobId === "object" ? jobId._id : jobId;
    navigate(`/fibre-id/client-supplied/${actualJobId}/samples`);
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "completed":
        return "default";
      case "pending":
        return "warning";
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
          <Typography color="text.primary">Client Supplied Jobs</Typography>
        </Breadcrumbs>

        <Typography variant="h4" component="h1" gutterBottom>
          Client Supplied Jobs
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          View and manage client supplied jobs for fibre identification analysis
        </Typography>

        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by project name, client, or project ID..."
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

        {/* Jobs Table */}
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
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
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
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No client supplied jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job._id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {job.projectId?.projectID || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.name || "Unnamed Project"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.d_Date
                            ? new Date(job.projectId.d_Date).toLocaleDateString(
                                "en-GB"
                              )
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectId?.client?.name || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sampleCounts[job._id] || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.status || "Unknown"}
                          color={getStatusColor(job.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleViewJob(job._id)}
                          color="primary"
                          size="small"
                        >
                          Items
                        </Button>
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

export default ClientSuppliedJobs;
