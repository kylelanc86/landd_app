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
import { projectService } from "../../services/api";

const ClientSuppliedJobs = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchClientSuppliedProjects();
  }, []);

  const fetchClientSuppliedProjects = async () => {
    try {
      setLoading(true);
      // Fetch projects that are client supplied (not asbestos assessments)
      const response = await projectService.getAll({
        projectType: "client-supplied",
      });
      console.log("API Response:", response);
      // Handle different response structures
      const projectsData = response.data?.projects || response.data || [];
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error("Error fetching client supplied projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = (Array.isArray(projects) ? projects : []).filter(
    (project) =>
      project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectID?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewProject = (projectId) => {
    navigate(`/fibre-id/client-supplied/${projectId}`);
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
          View and manage client supplied projects for fibre identification
          analysis
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

        {/* Projects Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>Project ID</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Created Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Loading projects...
                    </TableCell>
                  </TableRow>
                ) : filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No client supplied projects found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => (
                    <TableRow key={project._id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {project.projectID || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {project.name || "Unnamed Project"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {project.client?.name || "Unknown Client"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={project.status || "active"}
                          color={getStatusColor(project.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString(
                                "en-GB"
                              )
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleViewProject(project._id)}
                          color="primary"
                          size="small"
                          title="View Project Details"
                        >
                          <ViewIcon />
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

export default ClientSuppliedJobs;
