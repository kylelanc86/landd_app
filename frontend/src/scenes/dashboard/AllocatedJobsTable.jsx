import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  useTheme,
  CircularProgress,
  Button,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import { projectService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { StatusChip } from "../../components/JobStatus";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";

// Late-stage jobs stay active in the system, but are omitted from this table.
const HIDDEN_FROM_ACTIVE_PROJECTS = [
  "Ready for invoicing",
  "Project ready for review",
];

const isHiddenFromActiveProjects = (status) =>
  HIDDEN_FROM_ACTIVE_PROJECTS.some(
    (hidden) =>
      String(status || "").trim().toLowerCase() === hidden.toLowerCase()
  );

const AllocatedJobsTable = () => {
  const { currentUser, loading: authLoading } = useAuth();

  // Get project statuses from custom data fields
  const {
    activeStatuses,
    statusColors,
    loading: statusesLoading,
  } = useProjectStatuses();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 25,
    page: 0,
  });
  const [rowCount, setRowCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();
  // Prevent multiple simultaneous fetches
  const fetchInProgressRef = React.useRef(false);

  // Cache key based on user ID
  const getCacheKey = useCallback(() => {
    const userId = currentUser?._id || currentUser?.id;
    return userId ? `allocatedJobs_v2_${userId}` : null;
  }, [currentUser]);

  // Load from cache
  const loadFromCache = useCallback(() => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const {
          data,
          rowCount: cachedRowCount,
          timestamp,
          pagination,
        } = JSON.parse(cached);
        // Check if cache is less than 2 minutes old
        // Reduced from 5 minutes to minimize stale data when project statuses change
        const cacheAge = Date.now() - timestamp;
        const maxAge = 2 * 60 * 1000; // 2 minutes
        if (cacheAge < maxAge) {
          return { data, rowCount: cachedRowCount, pagination };
        }
      }
    } catch (error) {
      console.error("Error loading allocated jobs from cache:", error);
    }
    return null;
  }, [getCacheKey]);

  // Save to cache
  const saveToCache = useCallback(
    (data, rowCount, pagination) => {
      const cacheKey = getCacheKey();
      if (!cacheKey) return;

      try {
        const cacheData = {
          data,
          rowCount,
          pagination,
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error) {
        console.error("Error saving allocated jobs to cache:", error);
      }
    },
    [getCacheKey]
  );

  // Performance tracking - component lifecycle
  const [mountTime] = useState(performance.now());
  const [timingMetrics, setTimingMetrics] = useState({
    componentMount: 0,
    authReady: 0,
    statusesReady: 0,
    dataFetchStart: 0,
    dataFetchComplete: 0,
    firstRenderComplete: 0,
  });
  // Use ref to access timingMetrics without causing dependency changes
  const timingMetricsRef = React.useRef(timingMetrics);
  React.useEffect(() => {
    timingMetricsRef.current = timingMetrics;
  }, [timingMetrics]);

  // Track when auth is ready
  React.useEffect(() => {
    if (!authLoading && currentUser) {
      const authReadyTime = performance.now() - mountTime;
      setTimingMetrics((prev) => ({ ...prev, authReady: authReadyTime }));
      console.log(
        `⏱️  [LIFECYCLE] Auth ready: ${authReadyTime.toFixed(2)}ms after mount`
      );
    }
  }, [authLoading, currentUser, mountTime]);

  // Track when statuses are ready
  React.useEffect(() => {
    if (!statusesLoading && activeStatuses.length > 0) {
      const statusesReadyTime = performance.now() - mountTime;
      setTimingMetrics((prev) => ({
        ...prev,
        statusesReady: statusesReadyTime,
      }));
      console.log(
        `⏱️  [LIFECYCLE] Statuses ready: ${statusesReadyTime.toFixed(
          2
        )}ms after mount`
      );
    }
  }, [statusesLoading, activeStatuses, mountTime]);

  const fetchAllocatedJobs = useCallback(
    async (page = 0, pageSize = 25, forceRefresh = false) => {
      // Prevent concurrent fetches
      if (fetchInProgressRef.current && !forceRefresh) {
        console.log("⏱️  [LIFECYCLE] Fetch already in progress, skipping");
        return;
      }

      // OPTIMIZATION: With cached project IDs, we don't need to wait for statuses
      // The backend uses cached IDs and doesn't need status filtering when using cache
      if (authLoading || !currentUser || !(currentUser._id || currentUser.id)) {
        console.log("⏱️  [LIFECYCLE] Fetch blocked - waiting for:", {
          authLoading,
          hasCurrentUser: !!currentUser,
          timeSinceMount: `${(performance.now() - mountTime).toFixed(2)}ms`,
        });
        return;
      }

      // Try to load from cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = loadFromCache();
        if (
          cached &&
          cached.pagination?.page === page &&
          cached.pagination?.pageSize === pageSize
        ) {
          console.log("📦 Loading allocated jobs from cache");
          setJobs(cached.data);
          setRowCount(cached.rowCount);
          setLoading(false);
          return;
        }
      }

      // Mark fetch as in progress
      fetchInProgressRef.current = true;

      const fetchStartTime = performance.now();
      const timeSinceMount = fetchStartTime - mountTime;

      setTimingMetrics((prev) => ({ ...prev, dataFetchStart: timeSinceMount }));

      if (forceRefresh) {
        setIsRefreshing(true);
      }

      console.log("\n" + "=".repeat(80));
      console.log(
        "📋 ALLOCATED JOBS TABLE - FETCH START",
        forceRefresh ? "(FORCED REFRESH)" : ""
      );
      console.log(
        "⏱️  Time since component mount:",
        `${timeSinceMount.toFixed(2)}ms`
      );
      console.log("⏱️  Frontend fetch initiated at:", new Date().toISOString());
      console.log("📄 Request params:", {
        page: page + 1,
        pageSize,
        userId: currentUser._id || currentUser.id,
        statusFilter: "all_active",
        activeStatusCount: activeStatuses?.length || 0,
      });

      setLoading(true);

      try {
        // Timing: API request
        const apiStartTime = performance.now();
        const response = await projectService.getAssignedToMe({
          page: page + 1, // Backend uses 1-based pagination
          limit: pageSize,
          status: "all_active", // Filter to active projects on backend
          excludeStatus: HIDDEN_FROM_ACTIVE_PROJECTS.join(","),
          sortBy: "projectID",
          sortOrder: "desc",
        });
        const apiEndTime = performance.now();
        const apiTime = apiEndTime - apiStartTime;

        // Timing: Data extraction
        const extractStart = performance.now();
        const projectsData = response.data.data || [];
        const totalCount = response.data.pagination?.total || 0;
        const extractTime = performance.now() - extractStart;

        // Timing: State update
        const stateUpdateStart = performance.now();
        setJobs(projectsData);
        setRowCount(totalCount);
        const stateUpdateTime = performance.now() - stateUpdateStart;

        // Save to cache
        saveToCache(projectsData, totalCount, { page, pageSize });

        const totalFetchTime = performance.now() - fetchStartTime;
        const timeSinceMount = performance.now() - mountTime;

        setTimingMetrics((prev) => ({
          ...prev,
          dataFetchComplete: timeSinceMount,
        }));

        // Calculate payload sizes
        const responseSize = JSON.stringify(response).length;
        const dataSize = JSON.stringify(projectsData).length;

        console.log("✅ ALLOCATED JOBS TABLE - FETCH COMPLETE");
        console.log("📊 Results:", {
          projectsReceived: projectsData.length,
          totalCount: totalCount,
          pageSize: pageSize,
        });
        // Log backend timing if available in response
        const backendTiming = response.data._timing;
        const networkLatency = backendTiming
          ? apiTime - backendTiming.backend.total
          : null;

        console.log("⏱️  Fetch timing breakdown:");
        console.log(`   • API request/response: ${apiTime.toFixed(2)}ms`);
        if (backendTiming) {
          console.log(
            `   • Backend processing: ${backendTiming.backend.total.toFixed(
              2
            )}ms`
          );
          console.log(
            `   • Network latency: ${networkLatency?.toFixed(2)}ms (${(
              (networkLatency / apiTime) *
              100
            ).toFixed(1)}%)`
          );
          if (backendTiming.backend.breakdown) {
            console.log(
              `   • Backend breakdown:`,
              backendTiming.backend.breakdown
            );
          }
        }
        console.log(`   • Data extraction: ${extractTime.toFixed(2)}ms`);
        console.log(`   • State update: ${stateUpdateTime.toFixed(2)}ms`);
        console.log(`   • Total fetch time: ${totalFetchTime.toFixed(2)}ms`);
        console.log("⏱️  Lifecycle timing:");
        console.log(`   • Time since mount: ${timeSinceMount.toFixed(2)}ms`);
        // Use ref to access timingMetrics without causing dependency changes
        const currentTimingMetrics = timingMetricsRef.current;
        console.log(
          `   • Auth ready: ${(currentTimingMetrics.authReady || 0).toFixed(
            2
          )}ms`
        );
        console.log(
          `   • Statuses ready: ${(
            currentTimingMetrics.statusesReady || 0
          ).toFixed(2)}ms`
        );
        console.log("📦 Payload sizes:");
        console.log(
          `   • Full response: ${(responseSize / 1024).toFixed(2)} KB`
        );
        console.log(`   • Data only: ${(dataSize / 1024).toFixed(2)} KB`);
        console.log(
          `   • Avg per project: ${(
            dataSize /
            projectsData.length /
            1024
          ).toFixed(2)} KB`
        );
        console.log(
          "⚠️  Note: DataGrid render time not yet measured - waiting for first render"
        );
        console.log("=".repeat(80) + "\n");

        // Store paginated data (already filtered by backend)
      } catch (err) {
        const errorTime = performance.now() - fetchStartTime;
        console.error("❌ ALLOCATED JOBS TABLE - FETCH ERROR");
        console.error("⏱️  Failed after:", `${errorTime.toFixed(2)}ms`);
        console.error("📄 Error details:", {
          page: page + 1,
          pageSize,
          error: err.message,
          stack: err.stack,
        });
        console.error("=".repeat(80) + "\n");
        setError(err.message);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        fetchInProgressRef.current = false;
      }
    },
    [
      authLoading,
      currentUser,
      mountTime,
      loadFromCache,
      saveToCache,
      activeStatuses,
    ]
  );

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    fetchAllocatedJobs(paginationModel.page, paginationModel.pageSize, true);
  }, [fetchAllocatedJobs, paginationModel]);

  // Load data on mount - will use cache if available
  useEffect(() => {
    // Only fetch if we have auth and user (fetchAllocatedJobs will check cache first)
    // Skip if fetch is already in progress
    if (!authLoading && currentUser && !fetchInProgressRef.current) {
      fetchAllocatedJobs(paginationModel.page, paginationModel.pageSize, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading,
    currentUser,
    paginationModel.page,
    paginationModel.pageSize,
    // Note: We intentionally omit fetchAllocatedJobs to prevent infinite loops
    // The function handles its own caching and duplicate prevention
  ]);

  const handlePaginationModelChange = useCallback((newModel) => {
    setPaginationModel(newModel);
  }, []);

  // Memoize formatted jobs to prevent unnecessary re-renders
  // Also filter out inactive projects as a safety net (backend should handle this, but cache might serve stale data)
  const formattedJobs = useMemo(() => {
    const formatStart = performance.now();
    const formatted = jobs
      .filter((job) => {
        if (isHiddenFromActiveProjects(job.status)) {
          return false;
        }
        // Safety net: Filter out inactive projects
        // This ensures that even if cache serves stale data, inactive projects won't show
        if (activeStatuses.length > 0) {
          return activeStatuses.includes(job.status);
        }
        // If activeStatuses isn't loaded yet, allow all (backend filtering should handle it)
        return true;
      })
      .map((job) => ({
        id: job._id || job.id,
        projectID: job.projectID,
        name: job.name,
        status: job.status,
        d_Date: job.d_Date,
      }));
    const formatTime = performance.now() - formatStart;
    if (jobs.length > 0) {
      const filteredCount = jobs.length - formatted.length;
      if (filteredCount > 0) {
        console.warn(
          `⚠️  [RENDER] Filtered out ${filteredCount} inactive project(s) from display`
        );
      }
      console.log(
        `⏱️  [RENDER] Job formatting: ${formatTime.toFixed(2)}ms for ${
          jobs.length
        } jobs (${formatted.length} active)`
      );
    }
    return formatted;
  }, [jobs, activeStatuses]);

  // Track first render completion
  React.useEffect(() => {
    if (
      formattedJobs.length > 0 &&
      !loading &&
      timingMetrics.firstRenderComplete === 0
    ) {
      const firstRenderTime = performance.now() - mountTime;
      setTimingMetrics((prev) => ({
        ...prev,
        firstRenderComplete: firstRenderTime,
      }));

      console.log("\n" + "🎉".repeat(40));
      console.log("🎉 ALLOCATED JOBS TABLE - FULLY RENDERED");
      console.log("⏱️  COMPLETE LIFECYCLE TIMING:");
      console.log(
        `   • Component mount → Auth ready: ${timingMetrics.authReady.toFixed(
          2
        )}ms`
      );
      console.log(
        `   • Component mount → Statuses ready: ${timingMetrics.statusesReady.toFixed(
          2
        )}ms`
      );
      console.log(
        `   • Component mount → Fetch started: ${timingMetrics.dataFetchStart.toFixed(
          2
        )}ms`
      );
      console.log(
        `   • Component mount → Data received: ${timingMetrics.dataFetchComplete.toFixed(
          2
        )}ms`
      );
      console.log(
        `   • Component mount → First render complete: ${firstRenderTime.toFixed(
          2
        )}ms`
      );
      console.log(
        `   • ⭐ TOTAL USER-PERCEIVED LOAD TIME: ${firstRenderTime.toFixed(
          2
        )}ms`
      );
      console.log("📊 Bottleneck analysis:");
      const authDelay = timingMetrics.authReady;
      const statusDelay = timingMetrics.statusesReady;
      const fetchDelay =
        timingMetrics.dataFetchComplete - timingMetrics.dataFetchStart;
      const renderDelay = firstRenderTime - timingMetrics.dataFetchComplete;
      console.log(
        `   • Auth loading: ${authDelay.toFixed(2)}ms (${(
          (authDelay / firstRenderTime) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   • Status loading: ${statusDelay.toFixed(2)}ms (${(
          (statusDelay / firstRenderTime) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   • Data fetching: ${fetchDelay.toFixed(2)}ms (${(
          (fetchDelay / firstRenderTime) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   • React rendering: ${renderDelay.toFixed(2)}ms (${(
          (renderDelay / firstRenderTime) *
          100
        ).toFixed(1)}%)`
      );
      console.log("🎉".repeat(40) + "\n");
    }
  }, [formattedJobs, loading, mountTime, timingMetrics]);

  const columns = useMemo(
    () => [
      {
        field: "projectID",
        headerName: "Project ID",
        flex: 1,
        minWidth: 120,
        maxWidth: 150,
      },
      {
        field: "name",
        headerName: "Project Name",
        flex: 2,
        minWidth: 200,
        maxWidth: 400,
      },
      // {
      //   field: "department",
      //   headerName: "Department",
      //   flex: 1.5,
      //   minWidth: 150,
      //   maxWidth: 200,
      // },
      {
        field: "d_Date",
        headerName: "Due Date",
        flex: 1.5,
        minWidth: 150,
        maxWidth: 200,
        renderCell: (params) => {
          if (!params.value) {
            return (
              <span style={{ color: "#666", fontStyle: "italic" }}>
                No due date
              </span>
            );
          }

          // Optimize date calculation - only calculate when cell is visible
          const dueDate = new Date(params.value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);

          const diffTime = dueDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let statusText = "";
          let color = "#000";

          if (diffDays < 0) {
            statusText = `${Math.abs(diffDays)} day${
              Math.abs(diffDays) === 1 ? "" : "s"
            } overdue`;
            color = "#d32f2f"; // Red for overdue
          } else if (diffDays === 0) {
            statusText = "Due today";
            color = "#ed6c02"; // Orange for due today
          } else {
            statusText = `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
            color = "#2e7d32"; // Green for plenty of time
          }

          return (
            <span style={{ color, fontWeight: "bold" }}>{statusText}</span>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        minWidth: 120,
        maxWidth: 150,
        renderCell: (params) => (
          <StatusChip
            status={params.value}
            customColor={statusColors && statusColors[params.value]}
          />
        ),
      },
    ],
    [statusColors]
  );

  if (authLoading || !currentUser || !(currentUser._id || currentUser.id)) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box
      m="40px 0 0 0"
      sx={{
        "& .MuiDataGrid-root": { border: "none" },
        "& .MuiDataGrid-cell": {
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
        },
        "& .MuiDataGrid-columnHeaders": {
          background: "linear-gradient(to right, #045E1F, #96CC78) !important",
          borderBottom: "none",
          "& .MuiDataGrid-columnHeaderTitle, & .MuiDataGrid-sortIcon, & .MuiSvgIcon-root":
            { color: "white" },
        },
        "& .MuiDataGrid-columnHeaderTitle": {
          fontWeight: 600,
        },
        "& .MuiDataGrid-virtualScroller": {
          backgroundColor: theme.palette.background.default,
        },
        "& .MuiDataGrid-footerContainer": {
          borderTop: "none",
          background: "linear-gradient(to right, #045E1F, #96CC78) !important",
          color: "white",
          "& .MuiTablePagination-root": {
            color: "white",
          },
          "& .MuiTablePagination-selectLabel": {
            color: "white",
          },
          "& .MuiTablePagination-displayedRows": {
            color: "white",
          },
          "& .MuiTablePagination-select": {
            color: "white",
          },
          "& .MuiTablePagination-actions": {
            color: "white",
          },
          "& .MuiIconButton-root": {
            color: "white",
          },
        },
        "& .MuiCheckbox-root": {
          color: `${theme.palette.secondary.main} !important`,
        },
        "& .MuiDataGrid-row:nth-of-type(even)": {
          backgroundColor: "#f8f9fa",
        },
        "& .MuiDataGrid-row:nth-of-type(odd)": {
          backgroundColor: "#ffffff",
        },
        "& .MuiDataGrid-row:hover": {
          backgroundColor: "#e3f2fd",
        },
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">MY ACTIVE PROJECTS</Typography>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          variant="outlined"
          startIcon={
            <RefreshIcon
              sx={{
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
                "@keyframes spin": {
                  from: { transform: "rotate(0deg)" },
                  to: { transform: "rotate(360deg)" },
                },
              }}
            />
          }
          sx={{
            color: theme.palette.primary.main,
            borderColor: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: theme.palette.primary.light + "20",
              borderColor: theme.palette.primary.dark,
            },
            "&:disabled": {
              color: theme.palette.action.disabled,
              borderColor: theme.palette.action.disabled,
            },
          }}
        >
          Refresh My Active Projects
        </Button>
      </Box>

      {/* Virtual Scrolling Optimized DataGrid with Proper Footer Positioning */}
      <DataGrid
        rows={formattedJobs}
        columns={columns}
        loading={loading} // Removed statusesLoading - we fetch in parallel now
        paginationMode="server"
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={[10, 25, 50]}
        onRowClick={(params) =>
          navigate(`/projects/${params.row.id}`, {
            state: { from: "dashboard" },
          })
        }
        autoHeight
        rowBuffer={5}
        rowThreshold={100}
        disableColumnFilter
        disableColumnSelector
        disableDensitySelector
        getRowId={(row) => row.id}
        sortingOrder={["desc", "asc"]}
        sx={{
          cursor: "pointer",
          // Ensure proper footer positioning and gradient (matches top bar)
          "& .MuiDataGrid-footerContainer": {
            position: "sticky",
            bottom: 0,
            zIndex: 1,
            background: "linear-gradient(to right, #045E1F, #96CC78) !important",
            color: "white",
            "& .MuiTablePagination-root": {
              color: "white",
            },
            "& .MuiTablePagination-selectLabel": {
              color: "white",
            },
            "& .MuiTablePagination-displayedRows": {
              color: "white",
            },
            "& .MuiTablePagination-select": {
              color: "white",
            },
            "& .MuiTablePagination-actions": {
              color: "white",
            },
            "& .MuiIconButton-root": {
              color: "white",
            },
          },
          // Remove empty row spacing
          "& .MuiDataGrid-virtualScroller": {
            minHeight: "auto !important",
          },
          // Ensure rows don't have extra spacing
          "& .MuiDataGrid-row": {
            minHeight: "52px !important",
            maxHeight: "52px !important",
          },
        }}
      />
    </Box>
  );
};

export default AllocatedJobsTable;
