import React, { useState, useEffect } from "react";
import { Box, Typography, useTheme, CircularProgress } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { projectService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { StatusChip, ACTIVE_STATUSES } from "../../components/JobStatus";

const AllocatedJobsTable = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 25,
    page: 0,
  });
  const [rowCount, setRowCount] = useState(0);
  const theme = useTheme();

  const fetchAllocatedJobs = async (page = 0, pageSize = 25) => {
    if (authLoading || !currentUser || !(currentUser._id || currentUser.id)) {
      return;
    }

    setLoading(true);
    try {
      // Use the new optimized endpoint with active statuses
      const response = await projectService.getAssignedToMe({
        page: page + 1, // Backend uses 1-based pagination
        limit: pageSize,
        status: ACTIVE_STATUSES.join(","),
        sortBy: "projectID",
        sortOrder: "desc",
      });

      const projectsData = response.data.data || [];

      const formattedJobs = projectsData.map((job) => ({
        id: job._id,
        projectID: job.projectID,
        name: job.name,
        department: job.department || "N/A",
        status: job.status,
        d_Date: job.d_Date,
      }));

      setJobs(formattedJobs);
      setRowCount(response.data.pagination?.total || 0);
    } catch (err) {
      console.error("Error fetching allocated jobs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocatedJobs(paginationModel.page, paginationModel.pageSize);
  }, [authLoading, currentUser, paginationModel]);

  const handlePaginationModelChange = (newModel) => {
    setPaginationModel(newModel);
  };

  const columns = [
    {
      field: "projectID",
      headerName: "Project ID",
      flex: 1,
    },
    {
      field: "name",
      headerName: "Project Name",
      flex: 2,
    },
    {
      field: "department",
      headerName: "Department",
      flex: 1.5,
    },
    {
      field: "d_Date",
      headerName: "Due Date",
      flex: 1.5,
      renderCell: (params) => {
        if (!params.value) {
          return (
            <span style={{ color: "#666", fontStyle: "italic" }}>
              No due date
            </span>
          );
        }

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

        return <span style={{ color, fontWeight: "bold" }}>{statusText}</span>;
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
  ];

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
      height="75vh"
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
        },
        "& .MuiCheckbox-root": {
          color: `${theme.palette.secondary.main} !important`,
        },
      }}
    >
      <Typography variant="h5" sx={{ mb: 2 }}>
        My Allocated Projects
      </Typography>
      <DataGrid
        rows={jobs}
        columns={columns}
        loading={loading}
        paginationMode="server"
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={[10, 25, 50]}
        checkboxSelection
        disableSelectionOnClick
        autoHeight
        components={{ Toolbar: GridToolbar }}
      />
    </Box>
  );
};

export default AllocatedJobsTable;
