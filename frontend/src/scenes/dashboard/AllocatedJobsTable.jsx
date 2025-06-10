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
  const theme = useTheme();

  // Debug logging for component lifecycle
  useEffect(() => {
    console.log("AllocatedJobsTable mounted/updated");
    console.log("Current user state:", currentUser);
  }, [currentUser]);

  useEffect(() => {
    const fetchAllocatedJobs = async () => {
      if (authLoading || !currentUser || !(currentUser._id || currentUser.id)) {
        console.log("Waiting for user data...");
        return;
      }
      setLoading(true);
      try {
        const response = await projectService.getAll();
        console.log("All projects:", response);

        // Ensure response.data is an array
        const projectsData = Array.isArray(response.data) ? response.data : [];
        console.log("Projects data array:", projectsData);

        // Filter projects where the current user is assigned AND status is active
        const allocatedJobs = projectsData.filter((project) => {
          // Check if project.users exists and is an array
          if (!project.users || !Array.isArray(project.users)) {
            console.log(`Project ${project.name} has no users array`);
            return false;
          }

          // Check if the current user is in the users array
          const isAssigned = project.users.some((user) => {
            // Handle both string IDs and user objects
            const userId =
              typeof user === "string" ? user : user.id || user._id;
            const currentUserId = currentUser.id || currentUser._id;
            const isAssigned = userId === currentUserId;
            console.log(`Checking user assignment for ${project.name}:`, {
              userId,
              currentUserId,
              isAssigned,
            });
            return isAssigned;
          });

          const isActive = ACTIVE_STATUSES.includes(project.status);
          console.log(
            `Project ${project.name} - Assigned: ${isAssigned}, Active: ${isActive}, Users:`,
            project.users
          );
          return isAssigned && isActive;
        });
        console.log("Filtered active allocated jobs:", allocatedJobs);

        const formattedJobs = allocatedJobs.map((job) => ({
          id: job._id,
          projectID: job.projectID,
          name: job.name,
          department: job.department || "N/A",
          status: job.status,
        }));

        setJobs(formattedJobs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllocatedJobs();
  }, [authLoading, currentUser]);

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

  // Debug render conditions
  console.log("Render conditions:", {
    hasCurrentUser: !!currentUser,
    hasUserId: !!currentUser?.id,
    loading,
    jobsCount: jobs.length,
  });

  if (authLoading || !currentUser || !(currentUser._id || currentUser.id)) {
    console.log("Rendering loading state - no user ID");
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

  if (loading) {
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
