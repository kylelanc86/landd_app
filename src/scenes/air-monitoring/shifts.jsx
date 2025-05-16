import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
  Grid,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import { useNavigate, useParams } from "react-router-dom";
import { shiftService, jobService } from "../../services/api";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const Shifts = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // First, get the job details to get project information
        const jobResponse = await jobService.getById(jobId);
        console.log("Job response:", jobResponse.data);

        if (jobResponse.data && jobResponse.data.project) {
          setProjectDetails(jobResponse.data.project);
        }

        // Then get the shifts
        const shiftsResponse = await shiftService.getByJob(jobId);
        console.log("Shifts response:", shiftsResponse.data);
        setShifts(shiftsResponse.data || []);

        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobId]);

  const handleAddShift = () => {
    navigate(`/air-monitoring-shifts/new/${jobId}`);
  };

  const handleEditShift = (id) => {
    navigate(`/air-monitoring-shifts/edit/${id}`);
  };

  const handleDeleteShift = async (id) => {
    if (window.confirm("Are you sure you want to delete this shift?")) {
      try {
        await shiftService.delete(id);
        setShifts(shifts.filter((shift) => shift._id !== id));
      } catch (err) {
        console.error("Error deleting shift:", err);
        setError("Failed to delete shift. Please try again later.");
      }
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Shift Name",
      flex: 1,
    },
    {
      field: "date",
      headerName: "Date",
      flex: 1,
      valueGetter: (params) => {
        return new Date(params.row.date).toLocaleDateString();
      },
    },
    {
      field: "startTime",
      headerName: "Start Time",
      flex: 1,
    },
    {
      field: "endTime",
      headerName: "End Time",
      flex: 1,
    },
    {
      field: "supervisor",
      headerName: "Supervisor",
      flex: 1,
      valueGetter: (params) => {
        return params.row.supervisor
          ? `${params.row.supervisor.firstName} ${params.row.supervisor.lastName}`
          : "Unknown";
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: ({ row: { status } }) => {
        return (
          <Box
            width="60%"
            m="0 auto"
            p="5px"
            display="flex"
            justifyContent="center"
            backgroundColor={
              status === "completed"
                ? colors.secondary[500]
                : status === "in_progress"
                ? colors.primary[500]
                : status === "cancelled"
                ? colors.neutral[700]
                : colors.grey[700]
            }
            borderRadius="4px"
          >
            <Typography color={colors.grey[0]} sx={{ ml: "5px" }}>
              {status.charAt(0).toUpperCase() +
                status.slice(1).replace("_", " ")}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: ({ row: { _id } }) => {
        return (
          <Box>
            <IconButton onClick={() => handleEditShift(_id)}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleDeleteShift(_id)}>
              <DeleteIcon />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box m="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Box>
          <Header
            title="Managing Your Shifts"
            subtitle={`Project: ${
              projectDetails?.projectID || "Loading..."
            } - ${projectDetails?.name || "Loading..."}`}
          />
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddShift}
          sx={{
            backgroundColor: colors.primary[500],
            color: colors.grey[0],
            fontSize: "14px",
            fontWeight: "bold",
            padding: "10px 20px",
          }}
        >
          Add Shift
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Box
        m="40px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
          },
          "& .name-column--cell": {
            color: colors.secondary[500],
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: colors.primary[500],
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: colors.primary[400],
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: colors.primary[500],
          },
          "& .MuiCheckbox-root": {
            color: `${colors.secondary[500]} !important`,
          },
        }}
      >
        <DataGrid
          rows={shifts}
          columns={columns}
          getRowId={(row) => row._id}
          loading={loading}
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  );
};

export default Shifts;
