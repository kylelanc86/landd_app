import React, { useState, useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { projectService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { StatusChip } from "../../components/JobStatus";

const AllocatedJobsTable = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    const fetchAllocatedJobs = async () => {
      try {
        const response = await projectService.getAll();
        // Filter projects where the current user is assigned
        const allocatedJobs = response.data.filter((project) =>
          project.users.some((user) => user._id === currentUser.id)
        );

        const formattedJobs = allocatedJobs.map((job) => ({
          id: job._id,
          projectID: job.projectID,
          name: job.name,
          department: job.department || "N/A",
          status: job.status,
        }));

        setJobs(formattedJobs);
      } catch (error) {
        console.error("Error fetching allocated jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllocatedJobs();
  }, [currentUser.id]);

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
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
  ];

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
        pageSize={5}
        rowsPerPageOptions={[5]}
        checkboxSelection
        disableSelectionOnClick
        autoHeight
        components={{ Toolbar: GridToolbar }}
      />
    </Box>
  );
};

export default AllocatedJobsTable;
