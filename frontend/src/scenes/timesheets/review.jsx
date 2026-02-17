import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  Chip,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import ProjectLogModalWrapper from "../reports/ProjectLogModalWrapper";

const TimesheetReview = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [users, setUsers] = useState([]);
  const [timesheetData, setTimesheetData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Get the week range
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(
    format(weekStart, "yyyy-MM-dd"),
  );
  const [reportEndDate, setReportEndDate] = useState(
    format(weekEnd, "yyyy-MM-dd"),
  );
  const [reportSelectedUser, setReportSelectedUser] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  // Project log modal state
  const [projectLogModalOpen, setProjectLogModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Fetch users with chargeOutRate for report calculations
  const fetchUsers = async () => {
    try {
      const response = await api.get("/users?showInactive=false");
      const activeUsers = (response.data || []).filter((user) => user.isActive);
      setUsers(activeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Fetch timesheet data for all users for the week
  const fetchTimesheetData = async () => {
    if (users.length === 0) return;

    setIsLoading(true);
    try {
      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(weekEnd, "yyyy-MM-dd");

      // Fetch timesheet data for each user
      const allEntries = [];
      for (const user of users) {
        try {
          const response = await api.get(
            `/timesheets/range/${startDate}/${endDate}?userId=${user._id}`,
          );
          const userEntries = response.data || [];
          allEntries.push(...userEntries);
        } catch (error) {
          console.error(`Error fetching data for user ${user._id}:`, error);
        }
      }

      const entries = allEntries;

      // Organize data by userId and date, also track approval status
      const organized = {};
      const approvalTracking = {}; // Track entries per user/date to calculate approval

      entries.forEach((entry) => {
        const userId = entry.userId?._id || entry.userId;
        const entryDate = format(new Date(entry.date), "yyyy-MM-dd");
        const approvalKey = `${userId}_${entryDate}`;

        if (!organized[userId]) {
          organized[userId] = {};
        }

        if (!organized[userId][entryDate]) {
          organized[userId][entryDate] = 0;
          approvalTracking[approvalKey] = { approved: 0, total: 0 };
        }

        // Calculate duration in minutes
        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60;

        if (!entry.isBreak) {
          organized[userId][entryDate] += duration;
        }

        // Track approval status - count how many entries are approved
        approvalTracking[approvalKey].total++;
        if (entry.isApproved === true) {
          approvalTracking[approvalKey].approved++;
        }
      });

      // Calculate approval status - only approved if ALL entries for that day are approved
      Object.keys(approvalTracking).forEach((key) => {
        const track = approvalTracking[key];
        // A day is approved only if all entries have been explicitly approved
        organized[`${key}_approved`] =
          track.total > 0 && track.approved === track.total;
      });

      setTimesheetData(organized);
    } catch (error) {
      console.error("Error fetching timesheet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch timesheet data when users or selected date changes
  useEffect(() => {
    if (users.length > 0) {
      fetchTimesheetData();
    }
  }, [users, selectedDate]);

  const handleWeekChange = (direction) => {
    const newDate =
      direction === "next"
        ? addWeeks(selectedDate, 1)
        : subWeeks(selectedDate, 1);
    setSelectedDate(newDate);
  };

  const handleBackToUserManagement = () => {
    navigate("/users");
  };

  const handleCellClick = async (userId, date) => {
    const user = users.find((u) => u._id === userId);
    setSelectedUser(user);
    setSelectedDay(date);
    setModalOpen(true);
    setModalLoading(true);

    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await api.get(
        `/timesheets/range/${formattedDate}/${formattedDate}?userId=${userId}`,
      );

      const entries = response.data || [];

      // Calculate totals and check approval status
      let totalMinutes = 0;
      let projectMinutes = 0;
      let isApproved =
        entries.length > 0 && entries.every((entry) => entry.isApproved);

      entries.forEach((entry) => {
        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60;

        if (!entry.isBreak) {
          totalMinutes += duration;
          if (!entry.isAdminWork) {
            projectMinutes += duration;
          }
        }
      });

      setModalData({
        entries,
        totalMinutes,
        projectMinutes,
        isApproved,
      });
    } catch (error) {
      console.error("Error fetching timesheet data:", error);
      setModalData({ entries: [], totalMinutes: 0, projectMinutes: 0 });
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalData(null);
    setSelectedUser(null);
    setSelectedDay(null);
  };

  const handleApproveTimesheet = async () => {
    if (!selectedUser || !selectedDay) return;

    try {
      const formattedDate = format(selectedDay, "yyyy-MM-dd");
      await api.put(`/timesheets/${selectedUser._id}/${formattedDate}/approve`);

      // Update modal data to reflect approval
      setModalData((prev) => ({
        ...prev,
        isApproved: true,
      }));

      // Update the timesheet data in the table to show blue
      setTimesheetData((prev) => {
        const dateStr = formattedDate;
        const userId = selectedUser._id;
        return {
          ...prev,
          [`${userId}_${dateStr}_approved`]: true,
        };
      });

      // Refresh the timesheet data to get updated approval status
      await fetchTimesheetData();
    } catch (error) {
      console.error("Error approving timesheet:", error);
      alert("Failed to approve timesheet. Please try again.");
    }
  };

  const handleOpenReportModal = () => {
    setReportModalOpen(true);
    // Default to first user if available
    setReportSelectedUser(users.length > 0 ? users[0]._id : "");
    // Default to current week
    setReportStartDate(format(weekStart, "yyyy-MM-dd"));
    setReportEndDate(format(weekEnd, "yyyy-MM-dd"));
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setReportSelectedUser("");
  };

  const handleGenerateReport = async () => {
    if (!reportSelectedUser) {
      alert("Please select a user");
      return;
    }

    setReportLoading(true);
    try {
      const user = users.find((u) => u._id === reportSelectedUser);
      const userName = user ? `${user.firstName} ${user.lastName}` : "Unknown";

      // Fetch ALL users (including inactive) for charge rate calculations
      const allUsersResponse = await api.get("/users?showInactive=true");
      const allUsers = allUsersResponse.data || [];

      // Fetch timesheet data for selected user and date range
      const response = await api.get(
        `/timesheets/range/${reportStartDate}/${reportEndDate}?userId=${reportSelectedUser}`,
      );

      const entries = response.data || [];

      // Fetch timesheet status data to check for absent days
      const statusResponse = await api.get(
        `/timesheets/status/range/${reportStartDate}/${reportEndDate}?userId=${reportSelectedUser}`,
      );
      const statusData = statusResponse.data || [];

      // Calculate absent days
      const absentDays = statusData.filter((s) => s.status === "absent").length;

      // Calculate weekend days with entries
      const weekendDates = new Set();
      entries.forEach((entry) => {
        const entryDate = new Date(entry.date);
        const dayOfWeek = entryDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendDates.add(format(entryDate, "yyyy-MM-dd"));
        }
      });
      const weekendDaysWorked = weekendDates.size;

      // Group entries by project and calculate totals
      const projectTotals = {};
      let totalMinutes = 0;
      let projectMinutes = 0;

      entries.forEach((entry) => {
        const [startHours, startMinutes] = entry.startTime
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = entry.endTime.split(":").map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let duration = endTotalMinutes - startTotalMinutes;
        if (duration < 0) duration += 24 * 60;

        if (!entry.isBreak) {
          totalMinutes += duration;

          if (!entry.isAdminWork && entry.projectId) {
            const projectKey = entry.projectId._id || entry.projectId;
            const projectName = entry.projectId?.name || "Unknown Project";
            const projectID = entry.projectId?.projectID || "";

            if (!projectTotals[projectKey]) {
              projectTotals[projectKey] = {
                _id: projectKey,
                name: projectName,
                projectID: projectID,
                userMinutes: 0,
              };
            }
            projectTotals[projectKey].userMinutes += duration;
            projectMinutes += duration;
          }
        }
      });

      // Fetch total hours for each project using the timesheetEntries field
      const projectKeys = Object.keys(projectTotals);
      for (const projectKey of projectKeys) {
        try {
          // Get project details with populated timesheet entries
          const projectResponse = await api.get(`/projects/${projectKey}`);
          const project = projectResponse.data;
          projectTotals[projectKey].budget = project.budget || 0;
          projectTotals[projectKey].categories = project.categories || [];

          // Get all timesheet entry IDs for this project
          const timesheetEntryIds = project.timesheetEntries || [];

          // Fetch each timesheet entry to calculate totals within the date range
          let projectTotalMinutes = 0;
          let projectSpending = 0;

          if (timesheetEntryIds.length > 0) {
            // Fetch all timesheet entries for this project
            const entriesPromises = timesheetEntryIds.map(async (entryId) => {
              try {
                const entryResponse = await api.get(`/timesheets/${entryId}`);
                return entryResponse.data;
              } catch (err) {
                console.error(
                  `Error fetching timesheet entry ${entryId}:`,
                  err,
                );
                return null;
              }
            });

            const projectEntries = (await Promise.all(entriesPromises)).filter(
              (e) => e !== null,
            );

            // Filter entries within the date range and calculate totals
            projectEntries.forEach((entry) => {
              const entryDate = new Date(entry.date);
              const rangeStart = new Date(reportStartDate);
              const rangeEnd = new Date(reportEndDate);

              // Only include entries within the report date range
              if (entryDate >= rangeStart && entryDate <= rangeEnd) {
                const [startHours, startMinutes] = entry.startTime
                  .split(":")
                  .map(Number);
                const [endHours, endMinutes] = entry.endTime
                  .split(":")
                  .map(Number);
                const startTotalMinutes = startHours * 60 + startMinutes;
                const endTotalMinutes = endHours * 60 + endMinutes;
                let duration = endTotalMinutes - startTotalMinutes;
                if (duration < 0) duration += 24 * 60;
                projectTotalMinutes += duration;

                // Calculate spending based on user charge out rate
                const entryUserId = entry.userId?._id || entry.userId;
                const entryUser = allUsers.find((u) => u._id === entryUserId);
                if (entryUser && entryUser.chargeOutRate) {
                  const hours = duration / 60;
                  projectSpending += hours * entryUser.chargeOutRate;
                }
              }
            });
          }

          projectTotals[projectKey].totalMinutes = projectTotalMinutes;
          projectTotals[projectKey].spending = projectSpending;
        } catch (error) {
          console.error(
            `Error fetching data for project ${projectKey}:`,
            error,
          );
          projectTotals[projectKey].totalMinutes =
            projectTotals[projectKey].userMinutes;
          projectTotals[projectKey].budget = 0;
          projectTotals[projectKey].spending = 0;
        }
      }

      // Calculate chargeable work percentage
      const chargeableWorkPercentage =
        totalMinutes > 0
          ? Math.round((projectMinutes / totalMinutes) * 100)
          : 0;

      // Calculate project budget statistics
      const numberOfProjects = Object.keys(projectTotals).length;
      let projectsUnderBudget = 0;
      let projectsOverBudget = 0;
      let totalBudgetPercentages = 0;
      let projectsWithBudget = 0;

      Object.values(projectTotals).forEach((project) => {
        if (project.budget > 0 && project.spending > 0) {
          projectsWithBudget++;
          const percentageUsed = (project.spending / project.budget) * 100;
          totalBudgetPercentages += percentageUsed;

          if (project.spending < project.budget) {
            projectsUnderBudget++;
          } else if (project.spending > project.budget) {
            projectsOverBudget++;
          }
        }
      });

      const averageBudgetPercentage =
        projectsWithBudget > 0
          ? (totalBudgetPercentages / projectsWithBudget).toFixed(1)
          : "N/A";

      // Build CSV with summary first, then project breakdown
      let csvContent = `Employee Performance Report\n`;
      csvContent += `Employee:,${userName}\n`;
      csvContent += `Period:,${format(
        new Date(reportStartDate),
        "dd/MM/yyyy",
      )} - ${format(new Date(reportEndDate), "dd/MM/yyyy")}\n`;
      csvContent += `\n`;
      csvContent += `Summary\n`;
      csvContent += `Chargeable Work %:,${chargeableWorkPercentage}%\n`;
      csvContent += `Absent Days:,${absentDays}\n`;
      csvContent += `Weekend Days Worked:,${weekendDaysWorked}\n`;
      csvContent += `Number of Projects:,${numberOfProjects}\n`;
      csvContent += `Projects Under Budget:,${projectsUnderBudget}\n`;
      csvContent += `Projects Over Budget:,${projectsOverBudget}\n`;
      csvContent += `Overall Budget Usage:,${averageBudgetPercentage}${
        typeof averageBudgetPercentage === "number" ? "%" : ""
      }\n`;
      csvContent += `\n`;
      csvContent += `Project Breakdown\n`;
      csvContent += `Project ID,Project Name,Category,User Hours,Total Project Hours,Project Budget,Project Spending,Budget Status\n`;

      // Sort projects by user time spent (descending)
      const sortedProjects = Object.values(projectTotals).sort(
        (a, b) => b.userMinutes - a.userMinutes,
      );
      sortedProjects.forEach((project) => {
        const userHours = formatHours(project.userMinutes);
        const totalHours = formatHours(project.totalMinutes || 0);
        const budget =
          project.budget > 0
            ? `$${project.budget.toLocaleString()}`
            : "Not Set";
        const categories =
          project.categories && project.categories.length > 0
            ? project.categories.join("; ")
            : "Not Set";

        let spending = "Not Available";
        let budgetStatus = "N/A";

        if (project.spending > 0) {
          spending = `$${project.spending.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;

          // Calculate budget status
          if (project.budget > 0) {
            const percentageUsed = (project.spending / project.budget) * 100;
            const difference = project.budget - project.spending;

            if (difference > 0) {
              budgetStatus = `Under budget: $${Math.abs(
                difference,
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} (${(100 - percentageUsed).toFixed(1)}%)`;
            } else if (difference < 0) {
              budgetStatus = `Over budget: $${Math.abs(
                difference,
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} (${(percentageUsed - 100).toFixed(1)}%)`;
            } else {
              budgetStatus = "On budget";
            }
          }
        }

        csvContent += `"${project.projectID}","${project.name}","${categories}","${userHours}","${totalHours}","${budget}","${spending}","${budgetStatus}"\n`;
      });

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${userName.replace(
          /\s+/g,
          "-",
        )}-performance-report-${reportStartDate}-to-${reportEndDate}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      handleCloseReportModal();
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  // Format hours for display
  const formatHours = (minutes) => {
    if (!minutes || minutes === 0) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  // Get total hours for a user for the week
  const getWeekTotal = (userId) => {
    const userData = timesheetData[userId] || {};
    const total = Object.values(userData).reduce(
      (sum, minutes) => sum + minutes,
      0,
    );
    return total;
  };

  // Get cell background color based on hours and approval status
  const getCellColor = (minutes, isApproved) => {
    if (!minutes || minutes === 0) {
      return theme.palette.grey[100];
    }
    if (isApproved) {
      return theme.palette.info.light; // Blue for approved
    }
    const hours = minutes / 60;
    if (hours >= 7.5) {
      return theme.palette.success.light;
    } else if (hours >= 4) {
      return theme.palette.warning.light;
    } else {
      return theme.palette.error.light;
    }
  };

  if (isLoading && users.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Timesheet Review - Weekly Summary
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
            onClick={() => handleWeekChange("prev")}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ minWidth: "300px", textAlign: "center" }}
          >
            {format(weekStart, "dd MMM yyyy")} -{" "}
            {format(weekEnd, "dd MMM yyyy")}
          </Typography>
          <IconButton
            onClick={() => handleWeekChange("next")}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
        </Box>

        <Button
          variant="contained"
          color="primary"
          startIcon={<DescriptionIcon />}
          onClick={handleOpenReportModal}
          sx={{
            backgroundColor: theme.palette.info.main,
            "&:hover": {
              backgroundColor: theme.palette.info.dark,
            },
            fontWeight: 600,
            px: 3,
          }}
        >
          Generate Report
        </Button>
      </Box>

      <Paper
        elevation={3}
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Loading Indicator */}
        {isLoading && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
            }}
          >
            <LinearProgress
              sx={{
                height: 4,
                borderRadius: "2px 2px 0 0",
                backgroundColor: "rgba(25, 118, 210, 0.1)",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "#1976d2",
                },
              }}
            />
          </Box>
        )}

        <TableContainer
          sx={{
            maxHeight: "calc(100vh - 300px)",
            // One gradient across entire header row; no grey on hover
            "& thead": {
              background:
                "linear-gradient(to right, #045E1F, #96CC78) !important",
            },
            "& thead tr": {
              "&:hover": {
                background:
                  "linear-gradient(to right, #045E1F, #96CC78) !important",
              },
            },
            "& thead td": {
              backgroundColor: "transparent !important",
              borderBottom: "2px solid rgba(255,255,255,0.4) !important",
            },
          }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell
                  sx={{
                    color: theme.palette.primary.contrastText,
                    fontWeight: 700,
                    fontSize: "1rem",
                    minWidth: "200px",
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  Employee
                </TableCell>
                {daysInWeek.map((day) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isSameDay(day, new Date());
                  return (
                    <TableCell
                      key={day.toISOString()}
                      align="center"
                      sx={{
                        backgroundColor: isWeekend
                          ? `${theme.palette.grey[400]} !important`
                          : isToday
                            ? `${theme.palette.warning.main} !important`
                            : "transparent !important",
                        color: theme.palette.primary.contrastText,
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        minWidth: "120px",
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                        >
                          {format(day, "EEE")}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontSize: "0.75rem" }}
                        >
                          {format(day, "dd MMM")}
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}
                <TableCell
                  align="center"
                  sx={{
                    color: theme.palette.primary.contrastText,
                    fontWeight: 700,
                    fontSize: "1rem",
                    minWidth: "120px",
                    position: "sticky",
                    right: 0,
                    zIndex: 3,
                  }}
                >
                  Week Total
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
              users.length > 0 &&
              Object.keys(timesheetData).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={daysInWeek.length + 2}
                    align="center"
                    sx={{
                      py: 8,
                      border: "none",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <CircularProgress size={40} />
                      <Typography variant="body1" color="text.secondary">
                        Loading timesheet data...
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={daysInWeek.length + 2}
                    align="center"
                    sx={{
                      py: 8,
                      border: "none",
                    }}
                  >
                    <Typography variant="body1" color="text.secondary">
                      No employees found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, index) => {
                  const weekTotal = getWeekTotal(user._id);
                  return (
                    <TableRow
                      key={user._id}
                      sx={{
                        "&:nth-of-type(odd)": {
                          backgroundColor: theme.palette.action.hover,
                        },
                        "&:hover": {
                          backgroundColor: theme.palette.action.selected,
                        },
                      }}
                    >
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{
                          fontWeight: 600,
                          position: "sticky",
                          left: 0,
                          backgroundColor: "inherit",
                          zIndex: 1,
                        }}
                      >
                        {user.firstName} {user.lastName}
                      </TableCell>
                      {daysInWeek.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const minutes = timesheetData[user._id]?.[dateStr] || 0;
                        const isApproved =
                          timesheetData[`${user._id}_${dateStr}_approved`] ||
                          false;
                        const isWeekend =
                          day.getDay() === 0 || day.getDay() === 6;
                        return (
                          <TableCell
                            key={day.toISOString()}
                            align="center"
                            onClick={() => handleCellClick(user._id, day)}
                            sx={{
                              backgroundColor:
                                isApproved && minutes > 0
                                  ? theme.palette.info.light
                                  : isWeekend
                                    ? theme.palette.grey[200]
                                    : getCellColor(minutes, isApproved),
                              fontWeight: 500,
                              fontSize: "0.9rem",
                              border: `1px solid ${theme.palette.divider}`,
                              cursor: isLoading ? "default" : "pointer",
                              transition: "all 0.2s ease",
                              opacity: isLoading ? 0.6 : 1,
                              pointerEvents: isLoading ? "none" : "auto",
                              "&:hover": {
                                transform: isLoading ? "none" : "scale(1.05)",
                                boxShadow: isLoading
                                  ? "none"
                                  : `0 4px 8px rgba(0,0,0,0.2)`,
                                zIndex: 1,
                                fontWeight: isLoading ? 500 : 700,
                              },
                            }}
                          >
                            {formatHours(minutes)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          backgroundColor: theme.palette.success.light,
                          position: "sticky",
                          right: 0,
                          zIndex: 1,
                          border: `2px solid ${theme.palette.divider}`,
                          opacity: isLoading ? 0.6 : 1,
                        }}
                      >
                        {formatHours(weekTotal)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Legend */}
      <Box
        sx={{
          mt: 3,
          p: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6" gutterBottom>
          Color Legend
        </Typography>
        <Box display="flex" gap={3} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: theme.palette.info.light,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2">Approved</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: theme.palette.success.light,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2">7.5+ hours</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: theme.palette.warning.light,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2">4 - 7.5 hours</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: theme.palette.error.light,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2">Less than 4 hours</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: theme.palette.grey[100],
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2">No time logged</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: theme.palette.grey[200],
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2">Weekend</Typography>
          </Box>
        </Box>
      </Box>

      {/* Timesheet Details Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
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
            justifyContent: "space-between",
            background:
              "linear-gradient(to right, #045E1F, #96CC78) !important",
            color: theme.palette.primary.contrastText,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <AccessTimeIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Timesheet Details
              </Typography>
              {selectedUser && selectedDay && (
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {selectedUser.firstName} {selectedUser.lastName} -{" "}
                  {format(selectedDay, "EEEE, dd MMMM yyyy")}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseModal}
            sx={{
              color: theme.palette.primary.contrastText,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          {modalLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <Typography>Loading timesheet data...</Typography>
            </Box>
          ) : modalData && modalData.entries.length > 0 ? (
            <Box>
              {/* Summary Section */}
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  backgroundColor: theme.palette.grey[100],
                  borderRadius: 2,
                  display: "flex",
                  gap: 3,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Time
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {formatHours(modalData.totalMinutes)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Project Time
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {formatHours(modalData.projectMinutes)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Project %
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {modalData.totalMinutes > 0
                      ? Math.round(
                          (modalData.projectMinutes / modalData.totalMinutes) *
                            100,
                        )
                      : 0}
                    %
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {modalData.isApproved ? (
                      <Chip
                        label="Approved"
                        color="info"
                        size="small"
                        icon={<CheckCircleIcon />}
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Chip
                        label="Pending"
                        color="warning"
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Entries Table */}
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Time Entries
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                      <TableCell sx={{ fontWeight: 700 }}>Start</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>End</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        Description
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {modalData.entries.map((entry, index) => {
                      const [startHours, startMinutes] = entry.startTime
                        .split(":")
                        .map(Number);
                      const [endHours, endMinutes] = entry.endTime
                        .split(":")
                        .map(Number);
                      const startTotalMinutes = startHours * 60 + startMinutes;
                      const endTotalMinutes = endHours * 60 + endMinutes;
                      let duration = endTotalMinutes - startTotalMinutes;
                      if (duration < 0) duration += 24 * 60;

                      return (
                        <TableRow
                          key={index}
                          sx={{
                            "&:hover": {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <TableCell>{entry.startTime}</TableCell>
                          <TableCell>{entry.endTime}</TableCell>
                          <TableCell>{formatHours(duration)}</TableCell>
                          <TableCell>
                            {entry.isBreak ? (
                              <Chip
                                label="Break"
                                size="small"
                                color="default"
                              />
                            ) : entry.isAdminWork ? (
                              <Chip
                                label="Admin"
                                size="small"
                                color="warning"
                              />
                            ) : (
                              <Chip
                                label="Project"
                                size="small"
                                color="success"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.projectId ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                }}
                              >
                                <Link
                                  component="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (entry.projectId) {
                                      setSelectedProject(entry.projectId);
                                      setProjectLogModalOpen(true);
                                    }
                                  }}
                                  sx={{
                                    color: theme.palette.primary.main,
                                    textDecoration: "none",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    "&:hover": {
                                      textDecoration: "underline",
                                    },
                                  }}
                                >
                                  {entry.projectId.projectID}
                                </Link>
                                <Typography component="span" variant="body2">
                                  {" - "}
                                  {entry.projectId.name}
                                </Typography>
                              </Box>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{entry.description || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <Typography variant="body1" color="text.secondary">
                No timesheet entries for this day.
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button
            onClick={handleCloseModal}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Close
          </Button>
          {selectedUser &&
            selectedDay &&
            modalData &&
            !modalData.isApproved &&
            modalData.entries.length > 0 && (
              <Button
                onClick={handleApproveTimesheet}
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Approve Timesheet
              </Button>
            )}
          {selectedUser && selectedDay && (
            <Button
              onClick={() => {
                const formattedDate = format(selectedDay, "yyyy-MM-dd");
                navigate(
                  `/timesheets?date=${formattedDate}&userId=${selectedUser._id}`,
                );
              }}
              variant="contained"
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              View Full Timesheet
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
            gap: 2,
            backgroundColor: theme.palette.info.main,
            color: theme.palette.info.contrastText,
          }}
        >
          <DescriptionIcon />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Generate Timesheet Report
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Employee</InputLabel>
              <Select
                value={reportSelectedUser}
                onChange={(e) => setReportSelectedUser(e.target.value)}
                label="Select Employee"
              >
                {users.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button
            onClick={handleCloseReportModal}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            color="info"
            startIcon={<PrintIcon />}
            disabled={reportLoading || !reportSelectedUser}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            {reportLoading ? "Generating..." : "Generate Report"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Log Modal */}
      {projectLogModalOpen && selectedProject && (
        <ProjectLogModalWrapper
          open={projectLogModalOpen}
          onClose={() => {
            setProjectLogModalOpen(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
        />
      )}
    </Box>
  );
};

export default TimesheetReview;
