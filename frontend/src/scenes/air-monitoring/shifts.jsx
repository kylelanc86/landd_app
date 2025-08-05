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
import { tokens } from "../../theme/tokens";
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

  // Reusable function to fetch shifts and their sampleNumbers
  const fetchShiftsWithSamples = async () => {
    try {
      console.log("Fetching shifts for job:", jobId);
      const shiftsResponse = await shiftService.getByJob(jobId);
      console.log("Shifts response:", shiftsResponse);

      if (!shiftsResponse.data) {
        console.log("No shifts data in response");
        setShifts([]);
        return;
      }

      const formattedShifts = await Promise.all(
        (shiftsResponse.data || []).map(async (shift) => {
          console.log("Processing shift:", shift._id);
          // Fetch samples for this shift
          try {
            const samplesResponse = await sampleService.getByShift(shift._id);
            console.log(
              "Samples response for shift:",
              shift._id,
              samplesResponse
            );
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
                const s = (shift.status || "")
                  .toLowerCase()
                  .replace(/\s+/g, "_");
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
            console.error(
              "Error fetching samples for shift:",
              shift._id,
              error
            );
            return {
              ...shift,
              id: shift._id,
              sampleNumbers: [],
              status: (() => {
                const s = (shift.status || "")
                  .toLowerCase()
                  .replace(/\s+/g, "_");
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
      console.log("Formatted shifts:", formattedShifts);
      setShifts(formattedShifts);
    } catch (error) {
      console.error("Error in fetchShiftsWithSamples:", error);
      setError("Failed to load shifts. Please try again later.");
      setShifts([]);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const jobResponse = await jobService.getById(jobId);
        if (jobResponse.data && jobResponse.data.projectId) {
          setProjectDetails(jobResponse.data.projectId);
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
      // First update the job status to 'in_progress'
      await jobService.update(jobId, { status: "in_progress" });

      // Then create the new shift
      const shiftData = {
        job: jobId,
        name: `Shift ${shifts.length + 1}`,
        date: newDate,
        startTime: "08:00",
        endTime: "16:00",
        supervisor: currentUser._id,
        status: "ongoing",
      };

      const response = await shiftService.create(shiftData);
      console.log("New shift created:", response.data);

      // Refresh the shifts list
      await fetchShiftsWithSamples();
      handleCloseDialog();
    } catch (error) {
      console.error("Error creating shift:", error);
      setError("Failed to create shift. Please try again.");
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

  const handleCompleteJob = async () => {
    try {
      // Update the job status to completed
      await jobService.update(jobId, { status: "completed" });

      // Show success message
      alert("Job marked as completed successfully");

      // Navigate back to jobs page
      navigate("/air-monitoring");
    } catch (error) {
      console.error("Error completing job:", error);
      setError("Failed to complete job. Please try again.");
    }
  };

  // Check if all shifts are complete
  const allShiftsComplete =
    shifts.length > 0 &&
    shifts.every((shift) => shift.status === "shift_complete");

  const columns = [
    {
      field: "date",
      headerName: "Date",
      flex: 0.5,
      renderCell: (params) => {
        return formatDate(params.row.date);
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.8,
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
          samples_submitted_to_lab: "Samples Submitted to Lab",
          analysis_complete: "Analysis Complete",
          shift_complete: "Shift Complete",
        };

        // If report is authorized, use red background and set status to shift_complete
        const backgroundColor = params.row.reportApprovedBy
          ? theme.palette.error.main
          : statusColors[params.row.status] || theme.palette.grey[500];

        // If report is authorized, always show as Shift Complete
        const statusLabel = params.row.reportApprovedBy
          ? "Shift Complete"
          : statusLabels[params.row.status] || params.row.status;

        return (
          <Box
            sx={{
              backgroundColor,
              color: theme.palette.common.white,
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.875rem",
            }}
          >
            {statusLabel}
          </Box>
        );
      },
    },
    {
      field: "sampleNumbers",
      headerName: "Sample Numbers",
      width: 200,
      renderCell: (params) => {
        const numbers = params.row.sampleNumbers || [];
        return numbers.length > 0 ? numbers.join(", ") : "No samples";
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 2,
      renderCell: ({ row }) => {
        const handleSamplesClick = () => {
          // Don't allow access to samples if report is authorized
          if (row.reportApprovedBy) {
            alert(
              "Cannot access samples while report is authorized. Please reset the shift status to access samples."
            );
            return;
          }
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
            // Fetch the latest shift data
            const shiftResponse = await shiftService.getById(row._id);
            const latestShift = shiftResponse.data;

            // Fetch job and samples for this shift
            const jobResponse = await jobService.getById(
              latestShift.job?._id || latestShift.job
            );
            const samplesResponse = await sampleService.getByShift(
              latestShift._id
            );

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

            // Ensure project and client are fully populated
            let project = jobResponse.data.projectId;
            if (project && typeof project === "string") {
              const projectResponse = await projectService.getById(project);
              project = projectResponse.data;
            }
            if (
              project &&
              project.client &&
              typeof project.client === "string"
            ) {
              const clientResponse = await clientService.getById(
                project.client
              );
              project.client = clientResponse.data;
            }

            generateShiftReport({
              shift: latestShift,
              job: jobResponse.data,
              samples: samplesWithAnalysis,
              project,
              openInNewTab: !row.reportApprovedBy, // download if authorised, open if not
            });
            setReportViewedShiftIds((prev) => new Set(prev).add(row._id));
          } catch (err) {
            console.error("Error generating report:", err);
            alert("Failed to generate report.");
          }
        };

        const handleAuthoriseReport = async () => {
          try {
            const now = new Date().toISOString();
            const approver =
              currentUser?.firstName && currentUser?.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser?.name || currentUser?.email || "Unknown";

            // First get the current shift data
            const currentShift = await shiftService.getById(row._id);

            // Create the updated shift data by spreading the current data and updating the fields we want
            const updatedShiftData = {
              ...currentShift.data,
              job: currentShift.data.job._id, // Convert to string ID
              supervisor: currentShift.data.supervisor._id, // Convert to string ID
              defaultSampler: currentShift.data.defaultSampler, // Keep as is
              status: "shift_complete",
              reportApprovedBy: approver,
              reportIssueDate: now,
            };

            // Log the data being sent
            console.log("Updating shift with data:", updatedShiftData);

            // Update shift with report approval
            const response = await shiftService.update(
              row._id,
              updatedShiftData
            );

            // Log the response
            console.log("Update response:", response.data);

            // Generate and download the report
            try {
              // Fetch job and samples for this shift
              const jobResponse = await jobService.getById(
                row.job?._id || row.job
              );
              const samplesResponse = await sampleService.getByShift(row._id);

              // Ensure we have the complete sample data including analysis
              const samplesWithAnalysis = await Promise.all(
                samplesResponse.data.map(async (sample) => {
                  // Always fetch the complete sample data to ensure we have the latest analysis
                  const completeSample = await sampleService.getById(
                    sample._id
                  );
                  return completeSample.data;
                })
              );

              // Ensure project and client are fully populated
              let project = jobResponse.data.projectId;
              if (project && typeof project === "string") {
                const projectResponse = await projectService.getById(project);
                project = projectResponse.data;
              }
              if (
                project &&
                project.client &&
                typeof project.client === "string"
              ) {
                const clientResponse = await clientService.getById(
                  project.client
                );
                project.client = clientResponse.data;
              }

              // Log the data being sent to generateShiftReport
              console.log("Generating report with data:", {
                shift: response.data,
                job: jobResponse.data,
                samples: samplesWithAnalysis,
                project,
              });

              // Generate and download the report
              generateShiftReport({
                shift: response.data, // Use the updated shift data from the response
                job: jobResponse.data,
                samples: samplesWithAnalysis,
                project,
                openInNewTab: false, // Changed to false to trigger download
              });
            } catch (reportError) {
              console.error("Error generating report:", reportError);
              // Don't throw the error - we still want to complete the authorization
            }

            // Refetch shifts and their sampleNumbers to update UI
            await fetchShiftsWithSamples();
          } catch (err) {
            console.error("Error authorizing report:", err);
            // Show more detailed error message
            const errorMessage =
              err.response?.data?.message ||
              err.message ||
              "Failed to authorise report.";
            const errorDetails = err.response?.data?.details || "";
            alert(
              `${errorMessage}${
                errorDetails ? `\n\nDetails: ${errorDetails}` : ""
              }`
            );
          }
        };

        const handleDownloadCSV = async () => {
          try {
            // Fetch all samples for this shift
            const samplesResponse = await sampleService.getByShift(row._id);
            const samples = await Promise.all(
              (samplesResponse.data || []).map(async (sample) => {
                if (!sample.analysis) {
                  // Fetch full sample if analysis is missing
                  const fullSample = await sampleService.getById(sample._id);
                  return fullSample.data;
                }
                return sample;
              })
            );

            // Prepare CSV headers
            const headers = [
              ...Object.keys(samples[0] || {}),
              ...(samples[0]?.analysis ? Object.keys(samples[0].analysis) : []),
              ...(samples[0]?.analysis?.fibreCounts
                ? samples[0].analysis.fibreCounts.map(
                    (_, i) => `fibreCount_${i + 1}`
                  )
                : []),
            ];

            // Prepare CSV rows
            const rows = samples.map((sample) => {
              const base = { ...sample };
              const analysis = sample.analysis || {};
              // Flatten fibreCounts if present
              let fibreCounts = {};
              if (Array.isArray(analysis.fibreCounts)) {
                analysis.fibreCounts.forEach((val, i) => {
                  fibreCounts[`fibreCount_${i + 1}`] = Array.isArray(val)
                    ? val.join("|")
                    : val;
                });
              }
              // Merge all fields
              return {
                ...base,
                ...analysis,
                ...fibreCounts,
              };
            });

            // Convert to CSV string
            const csv = [
              headers.join(","),
              ...rows.map((row) =>
                headers
                  .map((field) =>
                    row[field] !== undefined && row[field] !== null
                      ? `"${String(row[field]).replace(/"/g, '""')}"`
                      : ""
                  )
                  .join(",")
              ),
            ].join("\r\n");

            // Download CSV
            const blob = new Blob([csv], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${row.name || row._id}_samples.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } catch (err) {
            console.error("Error downloading CSV:", err);
            alert("Failed to download CSV.");
          }
        };

        return (
          <Box display="flex" alignItems="center">
            {row.status !== "shift_complete" && (
              <Button
                variant="contained"
                size="small"
                onClick={handleSamplesClick}
                disabled={row.reportApprovedBy}
                sx={{
                  mr: 1,
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.common.white,
                  "&:hover": {
                    backgroundColor: theme.palette.primary.dark,
                  },
                  "&.Mui-disabled": {
                    backgroundColor: theme.palette.grey[700],
                    color: theme.palette.grey[500],
                  },
                }}
              >
                Samples
              </Button>
            )}
            {(row.status === "analysis_complete" ||
              row.status === "shift_complete") && (
              <>
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
                  {row.reportApprovedBy ? "Download Report" : "View Report"}
                </Button>
                {!row.reportApprovedBy && reportViewedShiftIds.has(row._id) && (
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    onClick={handleAuthoriseReport}
                    sx={{
                      mr: 1,
                      backgroundColor: theme.palette.success.main,
                      color: theme.palette.common.white,
                      "&:hover": {
                        backgroundColor: theme.palette.success.dark,
                      },
                    }}
                  >
                    Authorise Report
                  </Button>
                )}
              </>
            )}
            {[
              "sampling_complete",
              "samples_submitted_to_lab",
              "analysis_complete",
              "shift_complete",
            ].includes(row.status) && (
              <IconButton
                size="small"
                onClick={() => handleResetStatus(row._id)}
                title="Reset status to Ongoing"
                sx={{ color: theme.palette.error.main, mr: 1 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              onClick={handleDownloadCSV}
              title="Download raw sample & analysis data"
            >
              <DownloadIcon />
            </IconButton>
            <IconButton onClick={() => handleDeleteShift(row._id)}>
              <DeleteIcon />
            </IconButton>
            {row.reportApprovedBy && (
              <Typography
                variant="body2"
                color="error.main"
                sx={{ ml: 2, fontStyle: "italic", fontWeight: 500 }}
              >
                Report Authorised
              </Typography>
            )}
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
          <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
            {" "}
            Manage Air Monitoring Shifts{" "}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          {allShiftsComplete && (
            <Button
              variant="contained"
              color="success"
              onClick={handleCompleteJob}
              sx={{
                backgroundColor: theme.palette.success.main,
                color: theme.palette.common.white,
                fontSize: "14px",
                fontWeight: "bold",
                padding: "10px 20px",
                "&:hover": {
                  backgroundColor: theme.palette.success.dark,
                },
              }}
            >
              Complete Job
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddShift}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.common.white,
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Add Shift
          </Button>
        </Box>
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
          "& .MuiDataGrid-columnHeader": {
            whiteSpace: "normal",
            lineHeight: "1.2",
            padding: "8px",
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
