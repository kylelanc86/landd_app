import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Grid,
  IconButton,
  Button,
  Chip,
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
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useNavigate } from "react-router-dom";

const MonthlyTimesheet = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthData, setMonthData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch timesheet data for the entire month
  const fetchMonthData = async () => {
    if (!currentUser?._id) {
      console.log("Waiting for user ID before fetching month data");
      return;
    }

    try {
      setIsLoading(true);
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");

      console.log("Fetching month data:", {
        startDate,
        endDate,
        userId: currentUser._id,
      });

      const response = await api.get(
        `/timesheets/status/range/${startDate}/${endDate}?userId=${currentUser._id}`
      );
      console.log("Month data response:", response.data);
      setMonthData(response.data || []);
    } catch (error) {
      console.error("Error fetching month data:", error);
      setMonthData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?._id) {
      fetchMonthData();
    }
  }, [selectedDate, currentUser]);

  const handleMonthChange = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setSelectedDate(newDate);
  };

  const handleDayClick = (date) => {
    if (!currentUser?._id) {
      console.log("No user ID available for day click", {
        currentUser,
        authLoading,
      });
      return;
    }

    const formattedDate = format(date, "yyyy-MM-dd");
    console.log("Navigating to daily view:", {
      date: formattedDate,
      userId: currentUser._id,
      currentUser: {
        id: currentUser._id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
      },
    });
    navigate(`/timesheets?date=${formattedDate}&userId=${currentUser._id}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "finalised":
        return theme.palette.success.main;
      case "absent":
        return theme.palette.error.main;
      case "incomplete":
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getDaysInMonth = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get the day of week for the first day of the month (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = monthStart.getDay();

    // Create an array of null values for padding days at the start
    const paddingDays = Array(firstDayOfWeek).fill(null);

    // Combine padding days with actual days
    return [...paddingDays, ...days];
  };

  const getTimesheetStatus = (date) => {
    const dayData = monthData.find((entry) =>
      isSameDay(new Date(entry.date), date)
    );
    return dayData?.status || "incomplete";
  };

  // Show loading state while auth is loading or no user ID
  if (authLoading || !currentUser?._id) {
    console.log("Showing loading state:", {
      authLoading,
      currentUser: currentUser
        ? {
            id: currentUser._id,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
          }
        : null,
    });
    return (
      <Box
        m="20px"
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography variant="h4">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        Timesheets
      </Typography>      </Box>

      <Paper
        elevation={3}
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.alt,
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              onClick={() => handleMonthChange("prev")}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              {format(selectedDate, "MMMM yyyy")}
            </Typography>
            <IconButton
              onClick={() => handleMonthChange("next")}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <ArrowForwardIosIcon />
            </IconButton>
          </Box>
        </Box>

        <Grid container spacing={1}>
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Grid item xs={12 / 7} key={day}>
              <Box
                sx={{
                  p: 2,
                  textAlign: "center",
                  fontWeight: 700,
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  borderRadius: "12px 12px 0 0",
                  fontSize: "1rem",
                  textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  borderBottom: `3px solid ${theme.palette.primary.dark}`,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                {day}
              </Box>
            </Grid>
          ))}

          {/* Calendar days */}
          {getDaysInMonth().map((day, index) => (
            <Grid item xs={12 / 7} key={index}>
              <Box
                onClick={() => day && handleDayClick(day)}
                sx={{
                  p: 1.5,
                  height: "120px",
                  border: "2px solid",
                  borderColor: day ? theme.palette.divider : "transparent",
                  borderRadius: "0 0 12px 12px",
                  cursor: day ? "pointer" : "default",
                  backgroundColor: day
                    ? day.getDay() === 0 || day.getDay() === 6
                      ? theme.palette.primary.light
                      : theme.palette.background.paper
                    : "transparent",
                  transition: "all 0.2s ease-in-out",
                  position: "relative",
                  overflow: "hidden",
                  "&:hover": {
                    backgroundColor: day
                      ? theme.palette.action.hover
                      : "transparent",
                    transform: day ? "translateY(-2px)" : "none",
                    boxShadow: day ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                  },
                  "&::before":
                    day && isToday(day)
                      ? {
                          content: '""',
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: "4px",
                          backgroundColor: theme.palette.error.main,
                          borderRadius: "12px 12px 0 0",
                        }
                      : {},
                }}
              >
                {day && (
                  <>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: isToday(day) ? 800 : 600,
                        color: isToday(day)
                          ? theme.palette.error.main
                          : day.getDay() === 0 || day.getDay() === 6
                          ? theme.palette.primary.contrastText
                          : theme.palette.text.primary,
                        fontSize: "1.1rem",
                        textAlign: "center",
                        mb: 1,
                        textShadow: isToday(day)
                          ? "0 1px 2px rgba(0,0,0,0.2)"
                          : "none",
                      }}
                    >
                      {format(day, "d")}
                    </Typography>
                    {getTimesheetStatus(day) && (
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Chip
                          size="small"
                          label={getTimesheetStatus(day)}
                          color={
                            getTimesheetStatus(day) === "finalised"
                              ? "success"
                              : getTimesheetStatus(day) === "absent"
                              ? "error"
                              : "warning"
                          }
                          sx={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            backgroundColor:
                              day.getDay() === 0 || day.getDay() === 6
                                ? theme.palette.common.white
                                : undefined,
                            color:
                              day.getDay() === 0 || day.getDay() === 6
                                ? theme.palette.primary.main
                                : undefined,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            "& .MuiChip-label": {
                              px: 1,
                            },
                          }}
                        />
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
};

export default MonthlyTimesheet;
