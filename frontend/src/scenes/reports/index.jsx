import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardActionArea,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Folder as FolderIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";

import { projectService } from "../../services/api";

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
  const [searchParams] = useSearchParams();

  const [allProjects, setAllProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [noReportsDialog, setNoReportsDialog] = useState({
    open: false,
    project: null,
  });

  const itemsPerPage = 100; // 10x10 grid

  // Debounce search term to reduce filtering operations
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Load all projects sorted by projectID descending
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page: 1,
        limit: 10000, // Get all projects for client-side sorting and pagination
        sortBy: "createdAt",
        sortOrder: "desc",
        status: "all", // Get ALL projects regardless of status
      };

      const response = await projectService.getAll(params);
      const projectsData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      // Sort by projectID descending (extract numeric part for proper sorting)
      const sortedProjects = [...projectsData].sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
        const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
        return bNum - aNum; // Descending order
      });

      setAllProjects(sortedProjects);
      setFilteredProjects(sortedProjects);
      setTotalPages(Math.ceil(sortedProjects.length / itemsPerPage));
    } catch (err) {
      console.error("Error loading projects:", err);
      setError("Failed to load projects");
      setAllProjects([]);
      setFilteredProjects([]);
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage]);

  // Filter projects based on search term
  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setFilteredProjects(allProjects);
      setPage(1);
      setTotalPages(Math.ceil(allProjects.length / itemsPerPage));
      return;
    }

    setSearching(true);
    const searchLower = debouncedSearchTerm.toLowerCase().trim();

    const filtered = allProjects.filter((project) => {
      const projectID = (project.projectID || "").toLowerCase();
      const projectName = (project.name || "").toLowerCase();
      const clientName = (
        project.client?.name ||
        project.client ||
        ""
      ).toLowerCase();

      return (
        projectID.includes(searchLower) ||
        projectName.includes(searchLower) ||
        clientName.includes(searchLower)
      );
    });

    // Sort filtered results by projectID descending
    const sortedFiltered = [...filtered].sort((a, b) => {
      const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
      const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
      return bNum - aNum;
    });

    setFilteredProjects(sortedFiltered);
    setPage(1);
    setTotalPages(Math.ceil(sortedFiltered.length / itemsPerPage));
    setSearching(false);
  }, [debouncedSearchTerm, allProjects, itemsPerPage]);

  // Handle URL search parameter
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, [searchParams]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Get paginated projects
  const paginatedProjects = filteredProjects.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleClearSearch = () => {
    setSearchTerm("");
    setPage(1);
  };

  const handleProjectClick = (project) => {
    navigate(`/reports/project/${project._id}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h3"
        component="h1"
        marginTop="10px"
        marginBottom="20px"
      >
        All Projects
      </Typography>

      {/* Search Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Projects
        </Typography>
        <TextField
          fullWidth
          label="Search for a project"
          placeholder="Type project ID, name, or client"
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
                <IconButton size="small" onClick={handleClearSearch} edge="end">
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Projects Grid - 10x10 (100 per page) */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(10, 1fr)",
                gap: 2,
                "@media (max-width: 1600px)": {
                  gridTemplateColumns: "repeat(8, 1fr)",
                },
                "@media (max-width: 1200px)": {
                  gridTemplateColumns: "repeat(6, 1fr)",
                },
                "@media (max-width: 900px)": {
                  gridTemplateColumns: "repeat(4, 1fr)",
                },
                "@media (max-width: 600px)": {
                  gridTemplateColumns: "repeat(2, 1fr)",
                },
              }}
            >
              {paginatedProjects.map((project) => (
                <Card
                  key={project._id}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleProjectClick(project)}
                    sx={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      p: 2,
                      minHeight: "120px",
                    }}
                  >
                    <FolderIcon
                      sx={{
                        fontSize: 48,
                        color: "primary.main",
                        mb: 1,
                      }}
                    />
                    <Typography
                      variant="body2"
                      align="center"
                      sx={{
                        fontWeight: 500,
                        wordBreak: "break-word",
                      }}
                    >
                      {project.projectID || "N/A"}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Paper>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => setPage(value)}
                color="primary"
                size="large"
              />
            </Box>
          )}

          {/* Project Count Info */}
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 2 }}
          >
            {searchTerm.trim() ? (
              <>
                Showing {paginatedProjects.length} of {filteredProjects.length}{" "}
                matching projects
                {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
              </>
            ) : (
              <>
                Showing {paginatedProjects.length} of {filteredProjects.length}{" "}
                projects
                {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
              </>
            )}
          </Typography>
        </>
      )}

      {/* No Reports Dialog */}
      <Dialog
        open={noReportsDialog.open}
        onClose={() => setNoReportsDialog({ open: false, project: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>No Reports Available</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The project "{noReportsDialog.project?.projectID}:{" "}
            {noReportsDialog.project?.name}" doesn't have any reports yet.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setNoReportsDialog({ open: false, project: null })}
            color="primary"
          >
            OK
          </Button>
          <Button
            onClick={() =>
              navigate(`/projects/${noReportsDialog.project?._id}`)
            }
            variant="contained"
            color="primary"
          >
            View Project Details
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;
