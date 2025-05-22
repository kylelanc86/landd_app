import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import { useNavigate, useParams } from "react-router-dom";
import { shiftService, jobService, sampleService } from "../../services/api";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/dateUtils";
import { generateShiftReport } from "../../utils/generateShiftReport";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Shifts = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newDate, setNewDate] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const jobResponse = await jobService.getById(jobId);
        if (jobResponse.data && jobResponse.data.project) {
          setProjectDetails(jobResponse.data.project);
        }
        const shiftsResponse = await shiftService.getByJob(jobId);
        const formattedShifts = (shiftsResponse.data || []).map((shift) => ({
          ...shift,
          id: shift._id,
          status: (() => {
            const s = (shift.status || "").toLowerCase().replace(/\s+/g, "_");
            if (s === "pending") return "ongoing";
            if (
              [
                "ongoing",
                "sampling_complete",
                "analysis_complete",
                "shift_complete",
              ].includes(s)
            )
              return s;
            return "ongoing";
          })(),
        }));

        // Fetch samples for each shift
        const shiftsWithSamples = await Promise.all(
          formattedShifts.map(async (shift) => {
            try {
              const samplesResponse = await sampleService.getByShift(shift._id);
              const sampleNumbers = (samplesResponse.data || [])
                .map((sample) => {
                  const match = sample.fullSampleID?.match(/-(\d+)$/);
                  return match ? match[1] : null;
                })
                .filter(Boolean)
                .sort((a, b) => parseInt(a) - parseInt(b));

              return {
                ...shift,
                sampleNumbers,
              };
            } catch (error) {
              return {
                ...shift,
                sampleNumbers: [],
              };
            }
          })
        );
        setShifts(shiftsWithSamples);
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
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewDate("");
  };

  const handleSetToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    setNewDate(formattedDate);
  };

  const handleSubmit = async () => {
    try {
      console.log("Submit clicked - User state:", user);

      if (!newDate) {
        setError("Please select a date");
        return;
      }

      if (!user || !user.id) {
        console.log("User validation failed:", { user });
        setError("Please log in to create a shift");
        return;
      }

      const newShift = {
        job: jobId,
        name: `Shift ${new Date(newDate).toLocaleDateString()}`,
        date: new Date(newDate).toISOString(),
        startTime: "08:00",
        endTime: "16:00",
        supervisor: user.id,
        status: "ongoing",
        notes: "",
      };

      console.log("Creating shift with data:", newShift);
      const response = await shiftService.create(newShift);

      // Ensure the response data has the correct structure
      const createdShift = {
        ...response.data,
        date: response.data.date || newShift.date, // Ensure date is present
        _id: response.data._id, // Ensure _id is present
      };

      setShifts((prevShifts) => [...prevShifts, createdShift]);
      handleCloseDialog();
    } catch (err) {
      console.error("Error creating shift:", err);
      setError(
        err.response?.data?.message ||
          "Failed to create shift. Please try again."
      );
    }
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
      field: "date",
      headerName: "Date",
      flex: 1,
      renderCell: (params) => {
        return formatDate(params.row.date);
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => {
        const statusColors = {
          ongoing: theme.palette.primary.main,
          sampling_complete: theme.palette.info.main,
          analysis_complete: theme.palette.success.main,
          shift_complete: theme.palette.success.dark,
        };

        const statusLabels = {
          ongoing: "Ongoing",
          sampling_complete: "Sampling Complete",
          analysis_complete: "Analysis Complete",
          shift_complete: "Shift Complete",
        };

        return (
          <Box
            sx={{
              backgroundColor:
                statusColors[params.row.status] || theme.palette.grey[500],
              color: theme.palette.common.white,
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.875rem",
            }}
          >
            {statusLabels[params.row.status] || params.row.status}
          </Box>
        );
      },
    },
    {
      field: "sampleNumbers",
      headerName: "Sample Numbers",
      flex: 1,
      renderCell: (params) => {
        const numbers = params.row.sampleNumbers || [];
        return numbers.length > 0 ? numbers.join(", ") : "No samples";
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: ({ row }) => {
        const handleSamplesClick = () => {
          console.log("Samples button clicked for shift:", row._id);
          const path = `/air-monitoring/shift/${row._id}/samples`;
          console.log("Attempting to navigate to:", path);
          try {
            navigate(path, { replace: false });
          } catch (error) {
            console.error("Navigation error:", error);
          }
        };

        const handleViewReport = async () => {
          try {
            // Fetch job and samples for this shift
            const jobResponse = await jobService.getById(
              row.job?._id || row.job
            );
            const samplesResponse = await sampleService.getByShift(row._id);

            // Ensure we have the complete sample data including analysis
            const samplesWithAnalysis = await Promise.all(
              samplesResponse.data.map(async (sample) => {
                if (!sample.analysis) {
                  // If analysis data is missing, fetch the complete sample data
                  const completeSample = await sampleService.getById(
                    sample._id
                  );
                  return completeSample.data;
                }
                return sample;
              })
            );

            generateShiftReport({
              shift: row,
              job: jobResponse.data,
              samples: samplesWithAnalysis,
            });
          } catch (err) {
            console.error("Error generating report:", err);
            alert("Failed to generate report.");
          }
        };

        return (
          <Box>
            <Button
              variant="contained"
              size="small"
              onClick={handleSamplesClick}
              sx={{
                mr: 1,
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.common.white,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              Samples
            </Button>
            {row.status === "sampling_complete" && (
              <Button
                variant="contained"
                size="small"
                onClick={() =>
                  navigate(`/air-monitoring/shift/${row._id}/analysis`)
                }
                sx={{
                  mr: 1,
                  backgroundColor: theme.palette.success.main,
                  color: theme.palette.common.white,
                  "&:hover": {
                    backgroundColor: theme.palette.success.dark,
                  },
                }}
              >
                Analysis
              </Button>
            )}
            {row.status === "analysis_complete" && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleViewReport}
                sx={{
                  mr: 1,
                  borderColor: theme.palette.success.main,
                  color: theme.palette.success.main,
                  "&:hover": {
                    borderColor: theme.palette.success.dark,
                    backgroundColor: theme.palette.success.light,
                  },
                }}
              >
                View Report
              </Button>
            )}
            <IconButton onClick={() => handleDeleteShift(row._id)}>
              <DeleteIcon />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/air-monitoring")}
        sx={{ mb: 4 }}
      >
        Back to Jobs
      </Button>

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
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.main,
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.background.default,
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: theme.palette.primary.main,
          },
        }}
      >
        <DataGrid
          rows={shifts}
          columns={columns}
          getRowId={(row) => row._id}
          loading={loading}
          disableRowSelectionOnClick
          error={error}
          components={{
            NoRowsOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center" }}>No shifts found</Box>
            ),
            ErrorOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center", color: "error.main" }}>
                {error || "An error occurred"}
              </Box>
            ),
          }}
        />
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Add New Shift</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Date"
              type="date"
              fullWidth
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <Button
              variant="outlined"
              onClick={handleSetToday}
              sx={{ height: "56px" }}
            >
              Today
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Shifts;
