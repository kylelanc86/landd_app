import React, { useState, useEffect, useCallback } from "react";
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
  Close as CloseIcon,
} from "@mui/icons-material";

import { projectService } from "../../services/api";
import ProjectDetailsModal from "./ProjectDetailsModal.jsx";

// Debounce hook for search optimization
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const Reports = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchCache, setSearchCache] = useState(new Map());

  // Debounce search term to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Function to load search results directly
  const loadSearchResults = useCallback(
    async (searchValue) => {
      if (!searchValue.trim() || searchValue.length < 2) {
        setSearchResults([]);
        setError("");
        return;
      }

      // Check cache first
      const cacheKey = `search_${searchValue.trim().toLowerCase()}`;
      if (searchCache.has(cacheKey)) {
        const cachedResults = searchCache.get(cacheKey);
        setSearchResults(cachedResults);
        if (cachedResults.length === 0) {
          setError("No projects found matching your search term");
        } else {
          setError("");
        }
        return;
      }

      try {
        setSearching(true);
        setError("");
        setSearchResults([]);

        const params = {
          page: 1,
          limit: 20, // Show more results since it's the main table
          sortBy: "createdAt", // Use createdAt for better performance
          sortOrder: "desc",
          search: searchValue.trim(),
        };

        const response = await projectService.getAll(params);
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        // Debug: Log the first project to see client data structure
        if (projectsData.length > 0) {
          console.log("First project data:", projectsData[0]);
          console.log("Client data:", projectsData[0].client);
          console.log("Total projects found:", projectsData.length);
        }

        // Cache the results
        setSearchCache((prev) => new Map(prev).set(cacheKey, projectsData));
        setSearchResults(projectsData);

        if (projectsData.length === 0) {
          setError("No projects found matching your search term");
        } else {
          setError("");
        }
      } catch (err) {
        console.error("Error searching projects:", err);
        setError("Failed to search projects");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [searchCache]
  );

  // Load recent searches on mount
  useEffect(() => {
    const savedSearches = localStorage.getItem("recentProjectSearches");
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
  }, []);

  // Load search results when debounced term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      loadSearchResults(debouncedSearchTerm);
    } else {
      setSearchResults([]);
      setError("");
    }
  }, [debouncedSearchTerm, loadSearchResults]);

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setError("");
  };

  const handleRemoveFromRecent = (projectToRemove) => {
    const updatedSearches = recentSearches.filter(
      (project) => project._id !== projectToRemove._id
    );
    setRecentSearches(updatedSearches);
    localStorage.setItem(
      "recentProjectSearches",
      JSON.stringify(updatedSearches)
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h3" component="h1" marginTop="10px" marginBottom="20px">
        All Projects
      </Typography>

      {/* Project Search Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Projects
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search for a project"
            placeholder="Type project ID, name, or client (searches automatically)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {searching ? (
                    <CircularProgress size={20} />
                  ) : (
                    <SearchIcon sx={{ color: "text.secondary" }} />
                  )}
                </InputAdornment>
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
        </Box>

        {/* Recent Projects - Only show when not searching */}
        {!searchTerm.trim() && recentSearches.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Projects ({recentSearches.length})
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project ID</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSearches.map((project) => (
                    <TableRow key={project._id} hover>
                      <TableCell>{project.projectID}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body1">
                            {project.name}
                          </Typography>
                          {project.client?.name ||
                          (typeof project.client === "string"
                            ? project.client
                            : null) ? (
                            <Typography variant="body2" color="text.secondary">
                              Client:{" "}
                              {project.client?.name ||
                                (typeof project.client === "string"
                                  ? project.client
                                  : "No Client")}
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            variant="contained"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add to recent searches when clicked
                              const updatedSearches = [
                                project,
                                ...recentSearches.filter(
                                  (p) => p._id !== project._id
                                ),
                              ].slice(0, 20);
                              setRecentSearches(updatedSearches);
                              localStorage.setItem(
                                "recentProjectSearches",
                                JSON.stringify(updatedSearches)
                              );
                              navigate(`/reports/project/${project._id}`);
                            }}
                          >
                            View Reports
                          </Button>
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
                          <IconButton
                            size="small"
                            color="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromRecent(project);
                            }}
                            title="Remove from recent"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

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
                    <TableCell>Project</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((project) => (
                    <TableRow key={project._id}>
                      <TableCell>{project.projectID}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body1">
                            {project.name}
                          </Typography>
                          {project.client?.name ||
                          (typeof project.client === "string"
                            ? project.client
                            : null) ? (
                            <Typography variant="body2" color="text.secondary">
                              Client:{" "}
                              {project.client?.name ||
                                (typeof project.client === "string"
                                  ? project.client
                                  : "No Client")}
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="center"
                        >
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => {
                              // Add to recent searches when clicked
                              const updatedSearches = [
                                project,
                                ...recentSearches.filter(
                                  (p) => p._id !== project._id
                                ),
                              ].slice(0, 20);
                              setRecentSearches(updatedSearches);
                              localStorage.setItem(
                                "recentProjectSearches",
                                JSON.stringify(updatedSearches)
                              );
                              navigate(`/reports/project/${project._id}`);
                            }}
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
