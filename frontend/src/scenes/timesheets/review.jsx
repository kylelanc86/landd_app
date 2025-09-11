import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
} from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import PrintIcon from "@mui/icons-material/Print";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { useNavigate, useLocation } from "react-router-dom";

const TimesheetReview = () => {
  const theme = useTheme();
  const colors = tokens;
  const { currentUser, restoreUserState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [timesheetStatus, setTimesheetStatus] = useState("incomplete");
  const [viewMode, setViewMode] = useState("full");
  const [dailyStatuses, setDailyStatuses] = useState({});
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [error, setError] = useState("");

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportUser, setReportUser] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportUsers, setReportUsers] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  // Handle navigation back to user management
  const handleBackToUserManagement = () => {
    navigate("/users");
  };

  // Handle report modal
  const handleOpenReportModal = () => {
    setReportModalOpen(true);
    setReportError("");
    // Set default dates to current month
    const today = new Date();
    const firstDay = startOfMonth(today);
    const lastDay = endOfMonth(today);
    setReportStartDate(format(firstDay, "yyyy-MM-dd"));
    setReportEndDate(format(lastDay, "yyyy-MM-dd"));
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setReportUser("");
    setReportStartDate("");
    setReportEndDate("");
    setReportError("");
  };

  // Fetch users for report dropdown
  const fetchReportUsers = async () => {
    try {
      const response = await api.get("/users");
      setReportUsers(response.data || []);
    } catch (error) {
      console.error("Error fetching users for report:", error);
      setReportError("Failed to load users");
    }
  };

  // Generate PDF report
  const generateReport = async () => {
    if (!reportUser || !reportStartDate || !reportEndDate) {
      setReportError("Please select a user and date range");
      return;
    }

    setReportLoading(true);
    setReportError("");

    try {
      // Fetch timesheet data for the selected user and date range
      const response = await api.get(`/timesheets/report`, {
        params: {
          userId: reportUser,
          startDate: reportStartDate,
          endDate: reportEndDate,
        },
      });

      const timesheetData = response.data || [];

      // Calculate averages
      const totalTime = timesheetData.reduce(
        (sum, entry) => sum + (entry.totalTime || 0),
        0
      );
      const totalProjectPercentage = timesheetData.reduce(
        (sum, entry) => sum + (entry.projectTimePercentage || 0),
        0
      );
      const averageTime =
        timesheetData.length > 0 ? totalTime / timesheetData.length : 0;
      const averageProjectPercentage =
        timesheetData.length > 0
          ? totalProjectPercentage / timesheetData.length
          : 0;

      // Format hours and minutes
      const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
      };

      // Create PDF content
      const pdfContent = `
        <html>
          <head>
            <title>Timesheet Review Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #1976d2; text-align: center; }
              h2 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .summary { background-color: #e3f2fd; padding: 15px; margin: 20px 0; }
              .summary h3 { margin: 0 0 10px 0; color: #1976d2; }
            </style>
          </head>
          <body>
            <h1>Timesheet Review Report</h1>
            <h2>Period: ${format(
              new Date(reportStartDate),
              "dd/MM/yyyy"
            )} - ${format(new Date(reportEndDate), "dd/MM/yyyy")}</h2>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time Entered</th>
                  <th>Project %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${timesheetData
                  .map(
                    (entry) => `
                  <tr>
                    <td>${format(new Date(entry.date), "dd/MM/yyyy")}</td>
                    <td>${formatTime(entry.totalTime || 0)}</td>
                    <td>${(entry.projectTimePercentage || 0).toFixed(1)}%</td>
                    <td>${entry.status || "N/A"}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            
            <div class="summary">
              <h3>Summary</h3>
              <p><strong>Average Time Entered:</strong> ${formatTime(
                averageTime
              )}</p>
              <p><strong>Average Project %:</strong> ${averageProjectPercentage.toFixed(
                1
              )}%</p>
              <p><strong>Total Days:</strong> ${timesheetData.length}</p>
            </div>
          </body>
        </html>
      `;

      // Create and download PDF
      const printWindow = window.open("", "_blank");
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.print();

      handleCloseReportModal();
    } catch (error) {
      console.error("Error generating report:", error);
      setReportError("Failed to generate report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  // Add a ref to track the current request
  const currentRequestRef = useRef(null);

  // Get userId from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId");
    if (userId) {
      setSelectedUserId(userId);
      // Fetch user details to get their name
      const fetchUserDetails = async () => {
        try {
          const response = await api.get(`/users/${userId}`);
          setSelectedUserName(
            `${response.data.firstName} ${response.data.lastName}`
          );
        } catch (error) {
          console.error("Error fetching user details:", error);
        }
      };
      fetchUserDetails();
    } else {
      setSelectedUserId(null);
      setSelectedUserName("");
    }
  }, [location.search]);

  // Fetch users when report modal opens
  useEffect(() => {
    if (reportModalOpen) {
      fetchReportUsers();
    }
  }, [reportModalOpen]);

  // Update useEffect to handle initial setup and user data loading
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        // First restore user state
        await restoreUserState();

        // Then set up the date to the first day of the current month
        const today = new Date();
        const firstDayOfMonth = startOfMonth(today);
        if (isMounted) {
          setSelectedDate(firstDayOfMonth);
          setIsInitialLoading(false);
          setIsUserDataLoaded(true);
        }
      } catch (error) {
        console.error("Error initializing data:", error);
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount

  // Fetch timesheet data for the current month
  const fetchTimesheetData = async () => {
    if (!currentUser?._id) return; // Don't fetch if user data isn't loaded

    setIsLoading(true);
    try {
      // Set the date to the first day of the month
      const startDate = startOfMonth(selectedDate);
      // Set end date to the last day of the month at 23:59:59
      const endDate = new Date(endOfMonth(selectedDate));
      endDate.setHours(23, 59, 59, 999);

      // Cancel any existing request
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }

      // Create a new AbortController for this request
      const controller = new AbortController();
      currentRequestRef.current = controller;

      console.log("Review - Date range:", {
        selectedDate: format(selectedDate, "yyyy-MM-dd"),
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd HH:mm:ss"),
        month: format(startDate, "MMMM yyyy"),
      });

      // Always include userId parameter if selectedUserId exists
      const url = `/timesheets/review/${format(
        startDate,
        "yyyy-MM-dd"
      )}/${format(endDate, "yyyy-MM-dd")}?userId=${
        selectedUserId || currentUser._id
      }`;

      console.log("Review - API request URL:", url);

      const { data } = await api.get(url, { signal: controller.signal });

      // Filter out any entries that are not in the selected month
      const filteredData = data.filter((entry) => {
        const entryDate = new Date(entry.date);
        return (
          entryDate.getMonth() === selectedDate.getMonth() &&
          entryDate.getFullYear() === selectedDate.getFullYear()
        );
      });

      // Only update state if this is still the current request
      if (currentRequestRef.current === controller) {
        console.log("Review - Filtered response data:", filteredData);
        setTimesheetData(filteredData);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Request was aborted");
        return;
      }
      console.error("Review - Error fetching timesheet data:", error);
      setError("Failed to fetch timesheet data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup function to abort any pending request
  useEffect(() => {
    return () => {
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []);

  // Update the fetch effect to include proper cleanup and debouncing
  useEffect(() => {
    if (!isUserDataLoaded || !currentUser?._id) return;

    let timeoutId;
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;

      try {
        await fetchTimesheetData();
      } catch (error) {
        console.error("Error fetching timesheet data:", error);
      }
    };

    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set a new timeout
    timeoutId = setTimeout(fetchData, 300); // Increased debounce time

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Abort any ongoing request
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, [selectedDate, selectedUserId]); // Removed isUserDataLoaded and currentUser?._id from dependencies

  const handleMonthChange = (direction) => {
    const newDate =
      direction === "next"
        ? addMonths(selectedDate, 1)
        : subMonths(selectedDate, 1);

    // Set the date to the first day of the month
    const firstDayOfMonth = startOfMonth(newDate);
    console.log("Month changed:", {
      direction,
      oldDate: format(selectedDate, "yyyy-MM-dd"),
      newDate: format(newDate, "yyyy-MM-dd"),
      firstDayOfMonth: format(firstDayOfMonth, "yyyy-MM-dd"),
    });
    setSelectedDate(firstDayOfMonth);
  };

  const handleViewTimesheet = (userId, date) => {
    try {
      // Parse the date to ensure it's in the correct format
      const parsedDate = new Date(date);
      const formattedDate = format(parsedDate, "yyyy-MM-dd");

      // Use selectedUserId if available, otherwise fall back to the row's userId
      const targetUserId = selectedUserId || userId;

      console.log("Navigating to timesheet view:", {
        selectedUserId,
        rowUserId: userId,
        targetUserId,
        date: formattedDate,
      });

      // Navigate to the timesheet view with the correct user ID
      navigate(`/timesheets?userId=${targetUserId}&date=${formattedDate}`);
    } catch (error) {
      console.error("Error navigating to timesheet:", error);
      setError("Failed to open timesheet. Please try again.");
    }
  };

  const handleAuthorizeTimesheet = async (userId, date) => {
    try {
      // Update the timesheet status to authorized
      await api.put(`/timesheets/${userId}/${date}/approve`);

      // Refresh the timesheet data
      await fetchTimesheetData();

      // Show success message
      alert("Timesheet authorized successfully");
    } catch (error) {
      console.error("Error authorizing timesheet:", error);
      setError("Failed to authorize timesheet. Please try again.");
    }
  };

  const columns = [
    {
      field: "date",
      headerName: "Date",
      minWidth: 240,
      flex: 1,
      valueGetter: (params) => {
        try {
          // Parse the date string in yyyy-MM-dd format
          const date = new Date(params.row.date);
          return {
            date: date,
            formattedDate: format(date, "EEEE, dd MMMM yyyy"),
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
          };
        } catch (error) {
          console.error("Error formatting date:", error);
          return {
            date: new Date(params.row.date),
            formattedDate: params.row.date,
            isWeekend: false,
          };
        }
      },
      renderCell: (params) => {
        const { formattedDate, isWeekend } = params.value;
        return (
          <Typography
            sx={{
              color: isWeekend ? colors.grey[100] : colors.grey[700],
              fontStyle: isWeekend ? "italic" : "normal",
              fontSize: "0.875rem",
            }}
          >
            {formattedDate}
          </Typography>
        );
      },
    },
    {
      field: "totalTime",
      headerName: "Time Entered",
      width: 120,
      valueGetter: (params) => {
        const hours = Math.floor(params.row.totalTime / 60);
        const minutes = params.row.totalTime % 60;
        return `${hours}h ${minutes}m`;
      },
    },
    {
      field: "projectTimePercentage",
      headerName: "Project %",
      width: 100,
      valueGetter: (params) => {
        if (params.row.totalTime === 0) return "0%";
        return `${Math.round(
          (params.row.projectTime / params.row.totalTime) * 100
        )}%`;
      },
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 140,
      renderCell: (params) => {
        const statusColors = {
          incomplete: "warning",
          absent: "error",
          finalised: "success",
          authorized: "success",
        };
        return (
          <Chip
            label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
            color={statusColors[params.value]}
            size="small"
          />
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => {
        return (
          <Box display="flex" alignItems="center" gap={1}>
            <Button
              variant="contained"
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                handleAuthorizeTimesheet(params.row.userId, params.row.date);
              }}
              disabled={params.row.status === "authorized"}
              sx={{
                backgroundColor: "#5A9DA5",
                color: "colors.grey[100]",
                fontSize: "0.75rem",
                padding: "4px 8px",
                minWidth: "120px",
                "&:hover": {
                  backgroundColor: colors.secondary[600],
                },
                "&.Mui-disabled": {
                  backgroundColor: colors.grey[700],
                  color: colors.grey[500],
                },
              }}
            >
              Authorise Timesheet
            </Button>
          </Box>
        );
      },
    },
  ];

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Timesheet Review
      </Typography>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToUserManagement}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            User Management
          </Link>
          <Typography color="text.primary">Timesheet Review</Typography>
        </Breadcrumbs>
      </Box>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton
            onClick={() => handleMonthChange("prev")}
            sx={{ color: colors.grey[100] }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
          <Typography variant="h6">
            {format(selectedDate, "MMMM yyyy")}
          </Typography>
          <IconButton
            onClick={() => handleMonthChange("next")}
            sx={{ color: colors.grey[100] }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
        </Box>

        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handleOpenReportModal}
          sx={{
            backgroundColor: colors.primary[500],
            color: colors.grey[100],
            "&:hover": {
              backgroundColor: colors.primary[600],
            },
          }}
        >
          Generate Report
        </Button>
      </Box>

      <Paper
        elevation={3}
        sx={{
          p: 2,
          backgroundColor: theme.palette.background.alt,
          height: "calc(100vh - 200px)",
        }}
      >
        <DataGrid
          rows={timesheetData}
          columns={columns}
          loading={isLoading}
          getRowId={(row) => `${row.userId}-${row.date}`}
          sortingOrder={["desc", "asc"]}
          onRowClick={(params) => {
            // Check if the click was in the actions column
            if (params.field === "actions") {
              return;
            }
            handleViewTimesheet(params.row.userId, params.row.date);
          }}
          sx={{
            "& .MuiDataGrid-cell": {
              borderBottom: `1px solid ${colors.grey[800]}`,
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: colors.primary[500],
              borderBottom: "none",
            },
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: theme.palette.background.alt,
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: "none",
              backgroundColor: colors.primary[500],
            },
            "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
              color: `${colors.grey[100]} !important`,
            },
            "& .MuiDataGrid-row": {
              cursor: "pointer",
              "&:hover": {
                backgroundColor: colors.primary[600],
              },
              "&.authorized": {
                backgroundColor: theme.palette.success.main,
                "&:hover": {
                  backgroundColor: theme.palette.success.dark,
                },
              },
              "&.weekend": {
                backgroundColor: colors.primary[700],
                "&:hover": {
                  backgroundColor: colors.primary[600],
                },
              },
            },
          }}
          getRowClassName={(params) => {
            const classes = [];
            if (params.row.status === "authorized") {
              classes.push("authorized");
            }
            const date = new Date(params.row.date);
            if (date.getDay() === 0 || date.getDay() === 6) {
              classes.push("weekend");
            }
            return classes.join(" ");
          }}
        />
      </Paper>

      {/* Report Generation Modal */}
      <Dialog
        open={reportModalOpen}
        onClose={handleCloseReportModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            display: "flex",
            alignItems: "center",
            gap: 1,
            backgroundColor: colors.primary[500],
            color: "white",
          }}
        >
          <DateRangeIcon />
          Generate Timesheet Report
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          {reportError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {reportError}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Select User</InputLabel>
                <Select
                  value={reportUser}
                  onChange={(e) => setReportUser(e.target.value)}
                  label="Select User"
                >
                  {reportUsers.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button
            onClick={handleCloseReportModal}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={generateReport}
            variant="contained"
            disabled={
              reportLoading || !reportUser || !reportStartDate || !reportEndDate
            }
            startIcon={<PrintIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              backgroundColor: colors.primary[500],
              "&:hover": {
                backgroundColor: colors.primary[600],
              },
            }}
          >
            {reportLoading ? "Generating..." : "Print Report"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimesheetReview;
