import React, { useState, useEffect, useCallback, useRef } from "react";
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
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";

import { projectService } from "../../services/api";

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

const ITEMS_PER_PAGE = 100;

const sortProjectsByID = (list) =>
  [...list].sort((a, b) =>
    String(b.projectID || "").localeCompare(String(a.projectID || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

const Reports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestIdRef = useRef(0);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const loadProjects = useCallback(async (search, currentPage) => {
    const requestId = ++requestIdRef.current;

    try {
      if (search.trim()) {
        setSearching(true);
      } else {
        setLoading(true);
      }
      setError("");

      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        status: "all",
        sortBy: "projectID",
        sortOrder: "desc",
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await projectService.getAll(params);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const projectsData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      const pagination = response.data?.pagination;

      // Search returns all matches; paginate client-side.
      // Browse (no search) uses server pagination.
      if (search.trim()) {
        const sorted = sortProjectsByID(projectsData);
        const total = sorted.length;
        const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        setProjects(sorted.slice(start, start + ITEMS_PER_PAGE));
        setTotalCount(total);
        setTotalPages(pages);
      } else {
        setProjects(sortProjectsByID(projectsData));
        setTotalCount(pagination?.total ?? projectsData.length);
        setTotalPages(
          pagination?.pages ??
            Math.max(1, Math.ceil(projectsData.length / ITEMS_PER_PAGE))
        );
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      console.error("Error loading projects:", err);
      setError("Failed to load projects");
      setProjects([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, [searchParams]);

  const prevSearchRef = useRef(debouncedSearchTerm);

  useEffect(() => {
    const searchChanged = prevSearchRef.current !== debouncedSearchTerm;
    prevSearchRef.current = debouncedSearchTerm;

    if (searchChanged && page !== 1) {
      setPage(1);
      return;
    }

    loadProjects(debouncedSearchTerm, searchChanged ? 1 : page);
  }, [debouncedSearchTerm, page, loadProjects]);

  const handleClearSearch = () => {
    setSearchTerm("");
    setPage(1);
  };

  const handleProjectClick = (project) => {
    navigate(`/reports/project/${project._id}`);
  };

  return (
    <Box sx={{ p: 3, px: { xs: 1.5, sm: 3 } }}>
      <Typography
        variant="h3"
        component="h1"
        marginTop="10px"
        marginBottom="20px"
      >
        Reports
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search for a Project
        </Typography>
        <TextField
          fullWidth
          placeholder="Type project ID, site name, or client"
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
          <Paper sx={{ p: 2, mb: 3 }}>
            {projects.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography color="text.secondary">
                  {searchTerm.trim()
                    ? "No projects match your search."
                    : "No projects found."}
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(10, minmax(90px, 1fr))",
                  gap: 1,
                  maxWidth: "100%",
                  "@media (max-width: 1000px)": {
                    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                  },
                  "@media (max-width: 768px)": {
                    gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                    gap: 0.5,
                  },
                  "@media (max-width: 600px)": {
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  },
                }}
              >
                {projects.map((project) => (
                  <Card
                    key={project._id}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      transition: "all 0.2s ease-in-out",
                      boxShadow: "none",
                      border: "none",
                      outline: "none",
                      minWidth: 0,
                      "&:hover": {
                        transform: "translateY(-2px)",
                      },
                      "&:focus": {
                        outline: "none",
                      },
                      "&:focus-visible": {
                        outline: "none",
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
                        p: 1.5,
                        minHeight: "100px",
                        "&:focus": {
                          outline: "none",
                        },
                        "&:focus-visible": {
                          outline: "none",
                        },
                      }}
                    >
                      <FolderOpenRoundedIcon
                        sx={{
                          fontSize: 50,
                          color: "primary.main",
                          mb: 1,
                        }}
                      />
                      <Typography
                        variant="body2"
                        align="center"
                        sx={{
                          fontWeight: 450,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          width: "100%",
                          fontSize: "0.7875rem",
                        }}
                      >
                        {project.projectID || "N/A"}
                      </Typography>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>

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

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {projects.length} of {totalCount} projects
              {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Reports;
