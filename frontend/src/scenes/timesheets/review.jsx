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

        // Then set up the date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isMounted) {
          setSelectedDate(today);
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
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);

      // Cancel any existing request
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }

      // Create a new AbortController for this request
      const controller = new AbortController();
      currentRequestRef.current = controller;

      console.log("Review - Fetching timesheet data:", {
        startDate: format(startDate, "dd-MM-yyyy"),
        endDate: format(endDate, "dd-MM-yyyy"),
        selectedUserId,
        currentUserId: currentUser._id,
        currentUserRole: currentUser.role,
        viewMode,
      });

      // Always include userId parameter if selectedUserId exists
      const url = `/timesheets/review/${format(
        startDate,
        "dd-MM-yyyy"
      )}/${format(endDate, "dd-MM-yyyy")}?userId=${
        selectedUserId || currentUser._id
      }`;

      console.log("Review - API request URL:", url);

      const { data } = await api.get(url, { signal: controller.signal });

      // Only update state if this is still the current request
      if (currentRequestRef.current === controller) {
        console.log("Review - Raw response data:", data);
        setTimesheetData(data);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Request was aborted");
        return;
      }
      console.error("Review - Error fetching timesheet data:", error);
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
    setSelectedDate(
      direction === "next"
        ? addMonths(selectedDate, 1)
        : subMonths(selectedDate, 1)
    );
  };

  const handleViewTimesheet = (userId, date) => {
    // Use the date directly from the row data
    console.log("Navigating to timesheet view:", {
      userId,
      date,
      rowDate: date,
    });
    // Always use the userId from the row data and the date from the row
    navigate(`/timesheets?userId=${userId}&date=${date}&view=daily`);
  };

  const columns = [
    {
      field: "date",
      headerName: "Date",
      flex: 1,
      valueGetter: (params) => {
        try {
          // Parse the date string in dd-MM-yyyy format
          const [day, month, year] = params.row.date.split("-").map(Number);
          const date = new Date(year, month - 1, day);
          return format(date, "dd-MM-yyyy");
        } catch (error) {
          console.error("Error formatting date:", error);
          return params.row.date; // Return original date string if parsing fails
        }
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
      field: "projectTime",
      headerName: "Project Time",
      flex: 1,
      valueGetter: (params) => {
        const hours = Math.floor(params.row.projectTime / 60);
        const minutes = params.row.projectTime % 60;
        return `${hours}h ${minutes}m`;
      },
    },
    {
      field: "projectTimePercentage",
      headerName: "Project Time %",
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
      headerName: "User Status",
      flex: 1,
      renderCell: (params) => {
        const statusColors = {
          incomplete: "warning",
          absent: "error",
          finalised: "success",
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
      field: "authorizationStatus",
      headerName: "Authorization Status",
      flex: 1,
      renderCell: (params) => {
        const statusColors = {
          to_be_authorized: "warning",
          authorized: "success",
          query: "error",
        };
        return (
          <Chip
            label={params.value
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
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
        // Don't render anything until user data is fully loaded
        if (!isUserDataLoaded || !currentUser?._id) {
          return null;
        }

        console.log("Row data:", {
          rowUserId: params.row.userId,
          currentUserId: currentUser._id,
          rowData: params.row,
          isUserDataLoaded,
        });

        // Only show review icon if viewing someone else's timesheet
        if (String(params.row.userId) === String(currentUser._id)) {
          return null;
        }

        return (
          <Tooltip title="View Timesheet">
            <IconButton
              onClick={() =>
                handleViewTimesheet(params.row.userId, params.row.date)
              }
              color="primary"
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
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
        <Header
          title="TIMESHEET REVIEW"
          subtitle={
            selectedUserId
              ? `Reviewing timesheets for ${selectedUserName}`
              : "Review and authorize timesheets"
          }
        />
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
          disableRowSelectionOnClick
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
              backgroundColor: theme.palette.background.alt,
              "&.weekend": {
                backgroundColor: colors.primary[600],
              },
            },
          }}
          getRowClassName={(params) => {
            const date = new Date(params.row.date);
            return date.getDay() === 0 || date.getDay() === 6 ? "weekend" : "";
          }}
        />
      </Paper>
    </Box>
  );
};

export default TimesheetReview;
