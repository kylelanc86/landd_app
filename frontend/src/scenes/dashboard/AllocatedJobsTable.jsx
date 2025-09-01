import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Typography, useTheme, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { projectService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { StatusChip } from "../../components/JobStatus";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";

const AllocatedJobsTable = () => {
  const { currentUser, loading: authLoading } = useAuth();

  // Get project statuses from custom data fields
  const { activeStatuses, statusColors } = useProjectStatuses();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 25,
    page: 0,
  });
  const [rowCount, setRowCount] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalLoadTime: 0,
    dataFetchTime: 0,
    renderTime: 0,
  });
  const theme = useTheme();

  const fetchAllocatedJobs = useCallback(
    async (page = 0, pageSize = 25) => {
      if (authLoading || !currentUser || !(currentUser._id || currentUser.id)) {
        return;
      }

      const startTime = performance.now();
      setLoading(true);

      try {
        const response = await projectService.getAssignedToMe({
          page: page + 1, // Backend uses 1-based pagination
          limit: pageSize,
          status: activeStatuses.join(","),
          sortBy: "projectID",
          sortOrder: "desc",
        });

        const dataFetchTime = performance.now() - startTime;

        const projectsData = response.data.data || [];

        // Store raw data, transformation happens in memoized function
        setJobs(projectsData);
        setRowCount(response.data.pagination?.total || 0);

        const totalTime = performance.now() - startTime;
        setPerformanceMetrics({
          totalLoadTime: totalTime,
          dataFetchTime: dataFetchTime,
          renderTime: 0,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [authLoading, currentUser]
  );

  useEffect(() => {
    const renderStartTime = performance.now();

    fetchAllocatedJobs(paginationModel.page, paginationModel.pageSize);

    // Measure render time after the next tick
    requestAnimationFrame(() => {
      const renderTime = performance.now() - renderStartTime;
      setPerformanceMetrics((prev) => ({
        ...prev,
        renderTime: renderTime,
      }));
    });
  }, [authLoading, currentUser, paginationModel, fetchAllocatedJobs]);

  const handlePaginationModelChange = useCallback((newModel) => {
    setPaginationModel(newModel);
  }, []);

  // Memoize formatted jobs to prevent unnecessary re-renders
  const formattedJobs = useMemo(() => {
    return jobs.map((job) => ({
      id: job._id || job.id,
      projectID: job.projectID,
      name: job.name,
      // department: job.department || "N/A",
      status: job.status,
      d_Date: job.d_Date,
      overdueInvoice: job.overdueInvoice || {
        overdueInvoice: false,
        overdueDays: 0,
      },
      invoiceInfo: job.invoiceInfo || { hasInvoice: false },
    }));
  }, [jobs]);

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
      {
        field: "overdueInvoice",
        headerName: "Invoice",
        flex: 1,
        minWidth: 120,
        maxWidth: 150,
        renderCell: (params) => {
          const overdue = params.row.overdueInvoice;
          const invoiceInfo = params.row.invoiceInfo;

          // If there's an overdue invoice, show that prominently
          if (overdue?.overdueInvoice && overdue.overdueDays > 0) {
            return (
              <span style={{ color: "#d32f2f", fontWeight: "bold" }}>
                {overdue.overdueDays} day{overdue.overdueDays === 1 ? "" : "s"}{" "}
                overdue
              </span>
            );
          }

          // If there's an invoice but not overdue, show status and days until due
          if (invoiceInfo?.hasInvoice) {
            let statusColor = "#666";
            let statusText = invoiceInfo.status || "Unknown";

            // Color code the status
            switch (invoiceInfo.status) {
              case "paid":
                statusColor = "#2e7d32"; // Green
                break;
              case "unpaid":
                statusColor = "#ed6c02"; // Orange
                break;
              case "draft":
                statusColor = "#666"; // Gray
                break;
              case "awaiting_approval":
                statusColor = "#1976d2"; // Blue
                break;
              default:
                statusColor = "#666";
            }

            // Show status and days until due if applicable
            if (
              invoiceInfo.daysUntilDue !== null &&
              invoiceInfo.daysUntilDue >= 0
            ) {
              return (
                <div>
                  <div style={{ color: statusColor, fontWeight: "bold" }}>
                    {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>
                    {invoiceInfo.daysUntilDue === 0
                      ? "Due today"
                      : `${invoiceInfo.daysUntilDue} day${
                          invoiceInfo.daysUntilDue === 1 ? "" : "s"
                        } left`}
                  </div>
                </div>
              );
            } else {
              return (
                <span style={{ color: statusColor, fontWeight: "bold" }}>
                  {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
                </span>
              );
            }
          }

          // No invoice found
          return (
            <span style={{ color: "#666", fontStyle: "italic" }}>None</span>
          );
        },
      },
    ],
    []
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
          backgroundColor: theme.palette.primary.dark,
          borderBottom: "none",
        },
        "& .MuiDataGrid-virtualScroller": {
          backgroundColor: theme.palette.background.default,
        },
        "& .MuiDataGrid-footerContainer": {
          borderTop: "none",
          backgroundColor: theme.palette.primary.dark,
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
        // Ensure footer is properly positioned
        "& .MuiDataGrid-footerContainer": {
          position: "relative",
          borderTop: "1px solid rgba(224, 224, 224, 1)",
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
        // Remove any empty row spacing
        "& .MuiDataGrid-virtualScroller": {
          minHeight: "auto",
        },
      }}
    >
      <Typography variant="h5" sx={{ mb: 2 }}>
        MY ACTIVE PROJECTS{" "}
      </Typography>

      {/* Virtual Scrolling Optimized DataGrid with Proper Footer Positioning */}
      <DataGrid
        rows={formattedJobs}
        columns={columns}
        loading={loading}
        paginationMode="server"
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={[10, 25, 50]}
        onRowClick={(params) => navigate(`/projects/${params.row.id}`)}
        autoHeight
        rowBuffer={5}
        rowThreshold={100}
        disableColumnFilter
        disableColumnSelector
        disableDensitySelector
        getRowId={(row) => row.id}
        components={{ Toolbar: GridToolbar }}
        sortingOrder={["desc", "asc"]}
        sx={{
          cursor: "pointer",
          // Ensure proper footer positioning
          "& .MuiDataGrid-footerContainer": {
            position: "sticky",
            bottom: 0,
            zIndex: 1,
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
