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
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthData, setMonthData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch timesheet data for the entire month
  const fetchMonthData = async () => {
    try {
      setIsLoading(true);
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");

      const response = await api.get(
        `/timesheets/status/range/${startDate}/${endDate}`
      );
      setMonthData(response.data || []);
    } catch (error) {
      console.error("Error fetching month data:", error);
      setMonthData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData();
  }, [selectedDate]);

  const handleMonthChange = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setSelectedDate(newDate);
  };

  const handleDayClick = (date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    navigate(`/timesheets/daily?date=${formattedDate}`);
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

  return (
    <Box m="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header
          title="Monthly Timesheet"
          subtitle={`${format(selectedDate, "MMMM yyyy")}`}
        />
        <Button
          variant="contained"
          onClick={() => navigate("/timesheets/daily")}
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.common.white,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Daily View
        </Button>
      </Box>

      <Paper
        elevation={3}
        sx={{ p: 2, backgroundColor: theme.palette.background.alt }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => handleMonthChange("prev")}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography variant="h5">
              {format(selectedDate, "MMMM yyyy")}
            </Typography>
            <IconButton onClick={() => handleMonthChange("next")}>
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
                  p: 1,
                  textAlign: "center",
                  fontWeight: "bold",
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.common.white,
                  borderRadius: "4px 4px 0 0",
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
                onClick={() => handleDayClick(day)}
                sx={{
                  p: 1,
                  height: "100px",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "0 0 4px 4px",
                  cursor: "pointer",
                  backgroundColor: day
                    ? day.getDay() === 0 || day.getDay() === 6
                      ? theme.palette.primary.light
                      : "inherit"
                    : "inherit",
                  "&:hover": {
                    backgroundColor: day
                      ? theme.palette.action.hover
                      : "inherit",
                  },
                }}
              >
                {day && (
                  <>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isToday(day) ? "bold" : "normal",
                        color: isToday(day)
                          ? theme.palette.primary.main
                          : day.getDay() === 0 || day.getDay() === 6
                          ? theme.palette.common.white
                          : "inherit",
                      }}
                    >
                      {format(day, "d")}
                    </Typography>
                    {getTimesheetStatus(day) && (
                      <Chip
                        size="small"
                        label={getTimesheetStatus(day)}
                        color={
                          getTimesheetStatus(day) === "finalised"
                            ? "success"
                            : getTimesheetStatus(day) === "absent"
                            ? "error"
                            : "default"
                        }
                        sx={{
                          mt: 1,
                          backgroundColor:
                            day.getDay() === 0 || day.getDay() === 6
                              ? theme.palette.common.white
                              : undefined,
                          color:
                            day.getDay() === 0 || day.getDay() === 6
                              ? theme.palette.primary.main
                              : undefined,
                        }}
                      />
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
