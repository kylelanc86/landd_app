import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  LinearProgress,
  Pagination,
  TextField,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";

import { projectService, clientService } from "../../services/api";

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
const PROJECT_ID_COL_WIDTH = 160;
const CLIENT_COL_WIDTH = 300;

const clippedCellSx = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sortProjectsByID = (list) =>
  [...list].sort((a, b) =>
    String(b.projectID || "").localeCompare(String(a.projectID || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

const getClientName = (project) => {
  const client = project?.client;
  if (!client) return "—";
  if (typeof client === "string") return client;
  return client.name || "—";
};

const Reports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const selectedClientId = selectedClient?._id || "";

  const loadProjects = useCallback(async (search, currentPage, clientId) => {
    const requestId = ++requestIdRef.current;

    try {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      } else {
        setSearching(true);
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

      if (clientId) {
        params.client = clientId;
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
        hasLoadedOnceRef.current = true;
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
  const prevClientRef = useRef(selectedClientId);

  useEffect(() => {
    const searchChanged = prevSearchRef.current !== debouncedSearchTerm;
    const clientChanged = prevClientRef.current !== selectedClientId;
    prevSearchRef.current = debouncedSearchTerm;
    prevClientRef.current = selectedClientId;

    if ((searchChanged || clientChanged) && page !== 1) {
      setPage(1);
      return;
    }

    loadProjects(
      debouncedSearchTerm,
      searchChanged || clientChanged ? 1 : page,
      selectedClientId
    );
  }, [debouncedSearchTerm, selectedClientId, page, loadProjects]);

  useEffect(() => {
    let cancelled = false;

    const loadClients = async () => {
      try {
        setClientsLoading(true);
        const response = await clientService.getAll();
        const list = Array.isArray(response.data)
          ? response.data
          : response.data?.clients || [];
        if (cancelled) return;
        setClients(
          [...list].sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), undefined, {
              sensitivity: "base",
            })
          )
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading clients:", err);
          setClients([]);
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false);
        }
      }
    };

    loadClients();
    return () => {
      cancelled = true;
    };
  }, []);

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
          {searching && <LinearProgress sx={{ mb: 1 }} />}
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table
              sx={{
                tableLayout: "fixed",
                width: "100%",
                minWidth: PROJECT_ID_COL_WIDTH + CLIENT_COL_WIDTH + 240,
              }}
            >
              <colgroup>
                <col style={{ width: PROJECT_ID_COL_WIDTH }} />
                <col />
                <col style={{ width: CLIENT_COL_WIDTH }} />
              </colgroup>
              <TableHead>
                <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                  <TableCell
                    sx={{ fontWeight: 600, width: PROJECT_ID_COL_WIDTH }}
                  >
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Job Name</TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      width: CLIENT_COL_WIDTH,
                      verticalAlign: "top",
                    }}
                  >
                    Client
                    <Autocomplete
                      size="small"
                      options={clients}
                      value={selectedClient}
                      loading={clientsLoading}
                      onChange={(event, value) => setSelectedClient(value)}
                      getOptionLabel={(option) => option?.name || ""}
                      isOptionEqualToValue={(option, value) =>
                        option?._id === value?._id
                      }
                      sx={{
                        mt: 1,
                        width: "100%",
                        "& .MuiInputBase-root": { minWidth: 0 },
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="All clients"
                          onClick={(event) => event.stopPropagation()}
                        />
                      )}
                    />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">
                        {searchTerm.trim() || selectedClient
                          ? "No projects match your search."
                          : "No projects found."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => {
                    const jobName = project.name || "—";
                    const clientName = getClientName(project);
                    return (
                      <TableRow
                        key={project._id}
                        hover
                        onClick={() => handleProjectClick(project)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell
                          sx={{ width: PROJECT_ID_COL_WIDTH, ...clippedCellSx }}
                          title={project.projectID || "N/A"}
                        >
                          {project.projectID || "N/A"}
                        </TableCell>
                        <TableCell sx={clippedCellSx} title={jobName}>
                          {jobName}
                        </TableCell>
                        <TableCell
                          sx={{ width: CLIENT_COL_WIDTH, ...clippedCellSx }}
                          title={clientName}
                        >
                          {clientName}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

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
