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
} from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";
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
              color: colors.grey[100],
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
      flex: 1,
      valueGetter: (params) => {
        const hours = Math.floor(params.row.totalTime / 60);
        const minutes = params.row.totalTime % 60;
        return `${hours}h ${minutes}m`;
      },
    },
    {
      field: "projectTimePercentage",
      headerName: "Project %",
      flex: 1,
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
      flex: 1,
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
                backgroundColor: colors.secondary[500],
                color: colors.grey[100],
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
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}> TIMESHEET REVIEW </Typography>
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
    </Box>
  );
};

export default TimesheetReview;
