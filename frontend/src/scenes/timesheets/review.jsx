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
import pdfMake from "pdfmake/build/pdfmake";
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

// Set up pdfMake fonts
try {
  const pdfFonts = require("pdfmake/build/vfs_fonts");
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
} catch (error) {
  console.warn("pdfFonts not available, using default fonts:", error);
}

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

  // Timesheet modal state
  const [timesheetModalOpen, setTimesheetModalOpen] = useState(false);
  const [selectedTimesheetData, setSelectedTimesheetData] = useState(null);
  const [timesheetModalLoading, setTimesheetModalLoading] = useState(false);

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
    // Auto-select the current user (the user whose page the button was clicked on)
    setReportUser(selectedUserId || currentUser._id);
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setReportUser("");
    setReportStartDate("");
    setReportEndDate("");
    setReportError("");
  };

  const handleCloseTimesheetModal = () => {
    setTimesheetModalOpen(false);
    setSelectedTimesheetData(null);
    setTimesheetModalLoading(false);
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

      // Get user details
      const userResponse = await api.get(`/users/${reportUser}`);
      const user = userResponse.data;
      const employeeName = `${user.firstName} ${user.lastName}`;

      // Generate all days in the date range
      const allDays = [];
      const startDate = new Date(reportStartDate);
      const endDate = new Date(reportEndDate);

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = format(d, "yyyy-MM-dd");
        const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Find data for this day
        const dayData = timesheetData.find(
          (entry) => format(new Date(entry.date), "yyyy-MM-dd") === dateStr
        );

        allDays.push({
          date: new Date(d),
          dateStr: dateStr,
          dayOfWeek: dayOfWeek,
          isWeekday: dayOfWeek >= 1 && dayOfWeek <= 5, // Monday to Friday
          totalTime: dayData?.totalTime || 0,
          projectTime: dayData?.projectTime || 0,
          projectTimePercentage: dayData?.projectTimePercentage || 0,
          status: dayData?.status || "incomplete",
        });
      }

      // Calculate statistics
      const totalDays = allDays.length;
      const weekdays = allDays.filter((day) => day.isWeekday);
      const finalisedDays = allDays.filter((day) => day.status === "finalised");
      const absentDays = allDays.filter((day) => day.status === "absent");

      // Calculate total time and project time
      const totalTime = allDays.reduce((sum, day) => sum + day.totalTime, 0);
      const totalProjectTime = allDays.reduce(
        (sum, day) => sum + day.projectTime,
        0
      );

      // Calculate average chargeable works percentage
      const averageTotalTime = totalDays > 0 ? totalTime / totalDays : 0;
      const averageProjectTime =
        totalDays > 0 ? totalProjectTime / totalDays : 0;
      const averageChargeableWorks =
        averageTotalTime > 0
          ? (averageProjectTime / averageTotalTime) * 100
          : 0;

      // Format dates
      const startDateFormatted = format(
        new Date(reportStartDate),
        "dd/MM/yyyy"
      );
      const endDateFormatted = format(new Date(reportEndDate), "dd/MM/yyyy");

      // Create PDF document definition
      const docDefinition = {
        pageSize: "A4",
        pageMargins: [40, 60, 40, 60],
        content: [
          // Header
          {
            text: "Timesheet Report",
            style: "header",
            alignment: "center",
            margin: [0, 0, 0, 20],
          },

          // Employee Information
          {
            table: {
              widths: ["*", "*"],
              body: [
                [
                  { text: "Employee Name:", style: "label" },
                  { text: employeeName, style: "value" },
                ],
                [
                  { text: "Date Range:", style: "label" },
                  {
                    text: `${startDateFormatted} - ${endDateFormatted}`,
                    style: "value",
                  },
                ],
                [
                  { text: "Total Days:", style: "label" },
                  { text: totalDays.toString(), style: "value" },
                ],
                [
                  { text: "Weekdays:", style: "label" },
                  { text: weekdays.length.toString(), style: "value" },
                ],
                [
                  { text: "Finalised Days:", style: "label" },
                  { text: finalisedDays.length.toString(), style: "value" },
                ],
                [
                  { text: "Absent Days:", style: "label" },
                  { text: absentDays.length.toString(), style: "value" },
                ],
                [
                  { text: "Average Chargeable Works:", style: "label" },
                  {
                    text: `${averageChargeableWorks.toFixed(2)}%`,
                    style: "value",
                  },
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 20],
          },

          // Daily breakdown table
          {
            text: "Daily Breakdown",
            style: "subheader",
            margin: [0, 20, 0, 10],
          },
          {
            table: {
              widths: ["*", "*", "*", "*", "*", "*"],
              body: [
                [
                  { text: "Date", style: "tableHeader" },
                  { text: "Day", style: "tableHeader" },
                  { text: "Total Time", style: "tableHeader" },
                  { text: "Project Time", style: "tableHeader" },
                  { text: "Project %", style: "tableHeader" },
                  { text: "Status", style: "tableHeader" },
                ],
                ...allDays.map((day) => {
                  const dayName = format(day.date, "EEE"); // Mon, Tue, etc.
                  const totalTimeHours = Math.floor(day.totalTime / 60);
                  const totalTimeMinutes = day.totalTime % 60;
                  const projectTimeHours = Math.floor(day.projectTime / 60);
                  const projectTimeMinutes = day.projectTime % 60;

                  return [
                    {
                      text: format(day.date, "dd/MM/yyyy"),
                      style: "tableCell",
                    },
                    { text: dayName, style: "tableCell" },
                    {
                      text: `${totalTimeHours}h ${totalTimeMinutes}m`,
                      style: "tableCell",
                    },
                    {
                      text: `${projectTimeHours}h ${projectTimeMinutes}m`,
                      style: "tableCell",
                    },
                    {
                      text: `${day.projectTimePercentage.toFixed(1)}%`,
                      style: "tableCell",
                    },
                    {
                      text:
                        day.status.charAt(0).toUpperCase() +
                        day.status.slice(1),
                      style: "tableCell",
                    },
                  ];
                }),
              ],
              headerRows: 1,
            },
            layout: "lightHorizontalLines",
            margin: [0, 0, 0, 20],
          },

          // Generated timestamp
          {
            text: `Report generated on: ${format(
              new Date(),
              "dd/MM/yyyy 'at' HH:mm"
            )}`,
            style: "footer",
            alignment: "center",
            margin: [0, 20, 0, 0],
          },
        ],
        styles: {
          header: {
            fontSize: 24,
            bold: true,
            color: "#1976d2",
          },
          subheader: {
            fontSize: 16,
            bold: true,
            color: "#333",
          },
          label: {
            fontSize: 12,
            bold: true,
            color: "#555",
          },
          value: {
            fontSize: 12,
            color: "#333",
          },
          summaryText: {
            fontSize: 11,
            color: "#666",
            lineHeight: 1.4,
          },
          footer: {
            fontSize: 10,
            color: "#888",
            italics: true,
          },
          tableHeader: {
            fontSize: 10,
            bold: true,
            color: "#333",
            fillColor: "#f5f5f5",
          },
          tableCell: {
            fontSize: 9,
            color: "#333",
          },
        },
      };

      // Generate and download PDF without opening print dialog
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getDataUrl((dataUrl) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `timesheet-report-${employeeName.replace(
          /\s+/g,
          "-"
        )}-${reportStartDate}-to-${reportEndDate}.pdf`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });

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

  const handleViewTimesheet = async (userId, date) => {
    try {
      // Parse the date to ensure it's in the correct format
      const parsedDate = new Date(date);
      const formattedDate = format(parsedDate, "yyyy-MM-dd");

      // Use selectedUserId if available, otherwise fall back to the row's userId
      const targetUserId = selectedUserId || userId;

      console.log("Opening timesheet modal:", {
        selectedUserId,
        rowUserId: userId,
        targetUserId,
        date: formattedDate,
      });

      setTimesheetModalLoading(true);
      setTimesheetModalOpen(true);

      // Fetch the timesheet data for the modal using the range endpoint
      const response = await api.get(
        `/timesheets/range/${formattedDate}/${formattedDate}?userId=${targetUserId}`
      );

      // Aggregate the individual entries
      const entries = response.data || [];
      const totalTime = entries.reduce((total, entry) => {
        // Skip break entries for total time calculation
        if (entry.isBreak) return total;

        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60;
        return total + duration;
      }, 0);

      const projectTime = entries.reduce((total, entry) => {
        if (entry.isAdminWork || entry.isBreak) return total;
        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60;
        return total + duration;
      }, 0);

      // Determine status based on entries
      const status =
        entries.length === 0
          ? "incomplete"
          : entries.some((entry) => entry.isApproved)
          ? "authorized"
          : "finalised";

      const timesheetData = {
        date: formattedDate,
        totalTime,
        projectTime,
        status,
        entries: entries.map((entry) => ({
          projectName: entry.projectId?.name || "Admin Work",
          projectId: entry.projectId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          description: entry.description || "No description provided",
          isAdminWork: entry.isAdminWork,
          isBreak: entry.isBreak,
        })),
      };

      setSelectedTimesheetData(timesheetData);
    } catch (error) {
      console.error("Error fetching timesheet data:", error);
      setError("Failed to load timesheet data. Please try again.");
      setTimesheetModalOpen(false);
    } finally {
      setTimesheetModalLoading(false);
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

      {selectedUserName && (
        <Typography
          variant="h3"
          component="h2"
          sx={{
            color: "green",
            mb: 3,
            fontWeight: 500,
          }}
        >
          {selectedUserName}
        </Typography>
      )}

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
          height: "calc(100vh - 340px)",
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

      {/* Timesheet View Modal */}
      <Dialog
        open={timesheetModalOpen}
        onClose={handleCloseTimesheetModal}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: colors.primary[500],
              color: "white",
            }}
          >
            <DateRangeIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Timesheet Details
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          {timesheetModalLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <Typography>Loading timesheet data...</Typography>
            </Box>
          ) : selectedTimesheetData ? (
            <Box>
              {/* Timesheet Header Info */}
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  bgcolor: colors.grey[100],
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Date:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {format(
                      new Date(selectedTimesheetData.date),
                      "EEEE, dd MMMM yyyy"
                    )}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Time:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {Math.floor(selectedTimesheetData.totalTime / 60)}h{" "}
                    {selectedTimesheetData.totalTime % 60}m
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Project Time:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {Math.floor(selectedTimesheetData.projectTime / 60)}h{" "}
                    {selectedTimesheetData.projectTime % 60}m
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status:
                  </Typography>
                  <Chip
                    label={
                      selectedTimesheetData.status.charAt(0).toUpperCase() +
                      selectedTimesheetData.status.slice(1)
                    }
                    color={
                      selectedTimesheetData.status === "authorized"
                        ? "success"
                        : selectedTimesheetData.status === "finalised"
                        ? "success"
                        : selectedTimesheetData.status === "incomplete"
                        ? "warning"
                        : "error"
                    }
                    size="small"
                  />
                </Box>
              </Box>

              {/* Timesheet Entries */}
              {selectedTimesheetData.entries &&
              selectedTimesheetData.entries.length > 0 ? (
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, color: colors.primary[500] }}
                  >
                    Time Entries
                  </Typography>
                  <Box sx={{ maxHeight: "300px", overflowY: "auto" }}>
                    <Box
                      component="table"
                      sx={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.8rem",
                      }}
                    >
                      {/* Table Header */}
                      <Box
                        component="thead"
                        sx={{
                          backgroundColor: colors.primary[100],
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <Box component="tr">
                          <Box
                            component="th"
                            sx={{
                              p: 1,
                              textAlign: "center",
                              fontWeight: 600,
                              borderBottom: `2px solid ${colors.primary[300]}`,
                              fontSize: "0.75rem",
                              color: colors.primary[700],
                              minWidth: "80px",
                            }}
                          >
                            Project ID
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: 1,
                              textAlign: "left",
                              fontWeight: 600,
                              borderBottom: `2px solid ${colors.primary[300]}`,
                              fontSize: "0.75rem",
                              color: colors.primary[700],
                            }}
                          >
                            Project
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: 1,
                              textAlign: "center",
                              fontWeight: 600,
                              borderBottom: `2px solid ${colors.primary[300]}`,
                              fontSize: "0.75rem",
                              color: colors.primary[700],
                              minWidth: "80px",
                            }}
                          >
                            Start
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: 1,
                              textAlign: "center",
                              fontWeight: 600,
                              borderBottom: `2px solid ${colors.primary[300]}`,
                              fontSize: "0.75rem",
                              color: colors.primary[700],
                              minWidth: "80px",
                            }}
                          >
                            End
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: 1,
                              textAlign: "left",
                              fontWeight: 600,
                              borderBottom: `2px solid ${colors.primary[300]}`,
                              fontSize: "0.75rem",
                              color: colors.primary[700],
                            }}
                          >
                            Description
                          </Box>
                        </Box>
                      </Box>
                      {/* Table Body */}
                      <Box component="tbody">
                        {selectedTimesheetData.entries.map((entry, index) => (
                          <Box
                            key={index}
                            component="tr"
                            sx={{
                              borderBottom: `1px solid ${colors.grey[200]}`,
                              "&:hover": {
                                backgroundColor: colors.grey[50],
                              },
                            }}
                          >
                            <Box
                              component="td"
                              sx={{
                                p: 1,
                                textAlign: "center",
                                fontWeight: 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              {entry.projectId?.projectID || "N/A"}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: 1,
                                fontWeight: 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              {entry.projectName || "N/A"}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: 1,
                                textAlign: "center",
                                fontWeight: 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              {entry.startTime || "N/A"}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: 1,
                                textAlign: "center",
                                fontWeight: 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              {entry.endTime || "N/A"}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: 1,
                                fontWeight: 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              {entry.description || "No description provided"}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No time entries found for this date.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="error">
              Failed to load timesheet data. Please try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={handleCloseTimesheetModal}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimesheetReview;
