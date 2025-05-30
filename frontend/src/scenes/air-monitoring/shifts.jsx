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
import {
  shiftService,
  jobService,
  sampleService,
  projectService,
  clientService,
} from "../../services/api";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/dateUtils";
import { generateShiftReport } from "../../utils/generateShiftReport";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { usePermissions } from "../../hooks/usePermissions";
import TruncatedCell from "../../components/TruncatedCell";
import EditIcon from "@mui/icons-material/Edit";

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
  const { currentUser, restoreUserState } = useAuth();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetShiftId, setResetShiftId] = useState(null);
  const [reportViewedShiftIds, setReportViewedShiftIds] = useState(new Set());
  const { hasPermission } = usePermissions();

  // Reusable function to fetch shifts and their sampleNumbers
  const fetchShiftsWithSamples = async () => {
    const shiftsResponse = await shiftService.getByJob(jobId);
    const formattedShifts = await Promise.all(
      (shiftsResponse.data || []).map(async (shift) => {
        // Fetch samples for this shift
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
            id: shift._id,
            sampleNumbers,
            status: (() => {
              const s = (shift.status || "").toLowerCase().replace(/\s+/g, "_");
              if (s === "pending") return "ongoing";
              if (
                [
                  "ongoing",
                  "sampling_complete",
                  "samples_submitted_to_lab",
                  "analysis_complete",
                  "shift_complete",
                ].includes(s)
              )
                return s;
              return "ongoing";
            })(),
          };
        } catch (error) {
          return {
            ...shift,
            id: shift._id,
            sampleNumbers: [],
            status: (() => {
              const s = (shift.status || "").toLowerCase().replace(/\s+/g, "_");
              if (s === "pending") return "ongoing";
              if (
                [
                  "ongoing",
                  "sampling_complete",
                  "samples_submitted_to_lab",
                  "analysis_complete",
                  "shift_complete",
                ].includes(s)
              )
                return s;
              return "ongoing";
            })(),
          };
        }
      })
    );
    setShifts(formattedShifts);
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const jobResponse = await jobService.getById(jobId);
        if (jobResponse.data && jobResponse.data.project) {
          setProjectDetails(jobResponse.data.project);
        }
        await fetchShiftsWithSamples();
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
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
      console.log("Submit clicked - User state:", currentUser);
      const userToUse = currentUser || (await restoreUserState());

      if (!userToUse) {
        throw new Error("No user found. Please log in again.");
      }

      if (!newDate) {
        setError("Please select a date");
        return;
      }

      const newShift = {
        job: jobId,
        name: `Shift ${new Date(newDate).toLocaleDateString()}`,
        date: new Date(newDate).toISOString(),
        startTime: "08:00",
        endTime: "16:00",
        supervisor: userToUse.id,
        status: "ongoing",
        notes: "",
      };

      console.log("Creating shift with data:", newShift);
      const response = await shiftService.create(newShift);

      // Update the job status to ongoing
      await jobService.update(jobId, { status: "ongoing" });

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

  const handleDelete = async (id) => {
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

  const handleEdit = (shift) => {
    // TODO: Implement edit functionality
    console.log("Edit shift:", shift);
  };

  const handleResetStatus = async (id) => {
    setResetShiftId(id);
    setResetDialogOpen(true);
  };

  const confirmResetStatus = async () => {
    if (!resetShiftId) return;
    try {
      // Get the current shift data first
      const currentShift = await shiftService.getById(resetShiftId);

      // Update shift status while preserving analysis data but clearing report authorization
      await shiftService.update(resetShiftId, {
        status: "ongoing",
        analysedBy: currentShift.data.analysedBy,
        analysisDate: currentShift.data.analysisDate,
        reportApprovedBy: null,
        reportIssueDate: null,
      });

      // Refetch shifts to update UI
      await fetchShiftsWithSamples();
      setResetDialogOpen(false);
      setResetShiftId(null);
    } catch (err) {
      console.error("Error resetting shift status:", err);
      alert("Failed to reset shift status.");
      setResetDialogOpen(false);
      setResetShiftId(null);
    }
  };

  const cancelResetStatus = () => {
    setResetDialogOpen(false);
    setResetShiftId(null);
  };

  const columns = [
    {
      field: "name",
      headerName: "Shift Name",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "date",
      headerName: "Date",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "startTime",
      headerName: "Start Time",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "endTime",
      headerName: "End Time",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Box>
          <IconButton
            onClick={() => handleEdit(params.row)}
            color="primary"
            size="small"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDelete(params.row._id)}
            color="error"
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
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

      <Dialog open={resetDialogOpen} onClose={cancelResetStatus}>
        <DialogTitle>Reset Shift Status?</DialogTitle>
        <DialogContent>
          Are you sure you want to reset this shift's status to <b>Ongoing</b>?
          This will allow editing of analysis data. No data will be deleted or
          cleared.
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelResetStatus} color="primary">
            Cancel
          </Button>
          <Button
            onClick={confirmResetStatus}
            color="error"
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Shifts;
