import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
} from "@mui/material";
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";

import { projectService } from "../../services/api";
import ProjectDetailsModal from "./ProjectDetailsModal";

const Reports = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [allProjects, setAllProjects] = useState([]);

  // Search projects function
  // Load all projects and recent searches on mount
  useEffect(() => {
    const loadAllProjects = async () => {
      try {
        const response = await projectService.getAll({
          limit: 1000,
          sortBy: "projectID",
          sortOrder: "desc",
        });
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];
        setAllProjects(projectsData);
      } catch (err) {
        console.error("Error loading all projects:", err);
      }
    };

    loadAllProjects();

    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem("recentProjectSearches");
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
  }, []);

  const handleSearch = async (searchValue = searchTerm) => {
    const termToSearch = searchValue || searchTerm;
    if (!termToSearch.trim()) {
      setError("Please enter a search term");
      return;
    }

    try {
      setSearching(true);
      setError("");
      setSearchResults([]);

      const params = {
        page: 1,
        limit: 1000,
        sortBy: "projectID",
        sortOrder: "desc",
        search: termToSearch.trim(),
      };

      const response = await projectService.getAll(params);
      const projectsData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      setSearchResults(projectsData);

      if (projectsData.length === 0) {
        setError("No projects found matching your search term");
      } else {
        // Update recent searches
        const updatedSearches = [
          projectsData[0],
          ...recentSearches.filter((p) => p._id !== projectsData[0]._id),
        ].slice(0, 5);
        setRecentSearches(updatedSearches);
        localStorage.setItem(
          "recentProjectSearches",
          JSON.stringify(updatedSearches)
        );
      }
    } catch (err) {
      console.error("Error searching projects:", err);
      setError("Failed to search projects");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setError("");
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Reports
      </Typography>

      {/* Project Search Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Projects
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
          <TextField
            fullWidth
            label="Search for a project"
            placeholder="Enter project ID, name, or client"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSearch(searchTerm);
              }
            }}
            InputProps={{
              startAdornment: (
                <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClearSearch}
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained"
            onClick={() => handleSearch(searchTerm)}
            disabled={!searchTerm.trim() || searching}
            sx={{ minWidth: 140 }}
          >
            {searching ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Search"
            )}
          </Button>
        </Box>

        {/* Recent Projects */}
        {recentSearches.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Projects
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project ID</TableCell>
                    <TableCell>Site Name</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSearches.map((project) => (
                    <TableRow
                      key={project._id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() =>
                        navigate(`/reports/project/${project._id}`)
                      }
                    >
                      <TableCell>{project.projectID}</TableCell>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>{project.client?.name}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<AssessmentIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(project);
                            setDetailsModalOpen(true);
                          }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* All Projects */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            All Projects
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Project ID</TableCell>
                  <TableCell>Site Name</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allProjects.map((project) => (
                  <TableRow
                    key={project._id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/reports/project/${project._id}`)}
                  >
                    <TableCell>{project.projectID}</TableCell>
                    <TableCell>{project.name}</TableCell>
                    <TableCell>{project.client?.name}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<AssessmentIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                          setDetailsModalOpen(true);
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Search Results ({searchResults.length} projects found)
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project ID</TableCell>
                    <TableCell>Site Name</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((project) => (
                    <TableRow key={project._id}>
                      <TableCell>{project.projectID}</TableCell>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>{project.client?.name}</TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="center"
                        >
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() =>
                              navigate(`/reports/project/${project._id}`)
                            }
                          >
                            View Reports
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AssessmentIcon />}
                            onClick={() => {
                              setSelectedProject(project);
                              setDetailsModalOpen(true);
                            }}
                          >
                            Details
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Project Details Modal */}
      <ProjectDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        project={selectedProject}
      />
    </Box>
  );
};

export default Reports;
