import React, { useState, useEffect } from "react";
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
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState("");

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

  // Fetch timesheet data for the current month
  const fetchTimesheetData = async () => {
    setIsLoading(true);
    try {
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);

      const response = await api.get(
        `/timesheets/review/${format(startDate, "yyyy-MM-dd")}/${format(
          endDate,
          "yyyy-MM-dd"
        )}${selectedUserId ? `?userId=${selectedUserId}` : ""}`
      );

      // Create entries for all days in the month
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const timesheetMap = response.data.reduce((acc, entry) => {
        acc[entry.date] = entry;
        return acc;
      }, {});

      // Create complete dataset with all days
      const completeData = allDays.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return (
          timesheetMap[dateStr] || {
            userId: selectedUserId,
            userName: selectedUserName,
            date: dateStr,
            totalTime: 0,
            projectTime: 0,
            status: "incomplete",
            authorizationStatus: "to_be_authorized",
          }
        );
      });

      setTimesheetData(completeData);
    } catch (error) {
      console.error("Error fetching timesheet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheetData();
  }, [selectedDate, selectedUserId]);

  const handleMonthChange = (direction) => {
    setSelectedDate(
      direction === "next"
        ? addMonths(selectedDate, 1)
        : subMonths(selectedDate, 1)
    );
  };

  const handleViewTimesheet = (userId, date) => {
    // Always use the userId from the row data
    navigate(`/timesheets?userId=${userId}&date=${date}&view=daily`);
  };

  const columns = [
    {
      field: "date",
      headerName: "Date",
      flex: 1,
      valueGetter: (params) =>
        format(new Date(params.row.date), "EEEE, MMMM d, yyyy"),
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
      renderCell: (params) => (
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
      ),
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
