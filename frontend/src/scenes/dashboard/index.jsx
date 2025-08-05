import {
  Box,
  Typography,
  useTheme,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  IconButton,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import RateReviewIcon from "@mui/icons-material/RateReview";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import AirOutlinedIcon from "@mui/icons-material/AirOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import WidgetsIcon from "@mui/icons-material/Widgets";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState, useMemo } from "react";
import { projectService, invoiceService } from "../../services/api";
import { ACTIVE_STATUSES } from "../../components/JobStatus";
import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import AllocatedJobsTable from "./AllocatedJobsTable";
import ScienceIcon from "@mui/icons-material/Science";
import SendIcon from "@mui/icons-material/Send";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { format } from "date-fns";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  navigateToProjects,
  navigateToClients,
  navigateToInvoices,
  navigateToDatabase,
} from "../../utils/navigationHelpers";

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [dailyTimesheetData, setDailyTimesheetData] = useState({
    totalTime: 0,
    status: "incomplete",
  });

  // Load widget order from localStorage or use defaults
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const savedOrder = localStorage.getItem("dashboardWidgetOrder");
    return savedOrder
      ? JSON.parse(savedOrder)
      : [
          "dailyTimesheet",
          "active",
          "review",
          "invoice",
          "outstanding",
          "labComplete",
          "samplesSubmitted",
          "inProgress",
        ];
  });

  // Load widget preferences from localStorage or use defaults
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const savedPreferences = localStorage.getItem("dashboardWidgets");
    return savedPreferences
      ? JSON.parse(savedPreferences)
      : {
          dailyTimesheet: true,
          active: true,
          review: true,
          invoice: true,
          outstanding: true,
          labComplete: true,
          samplesSubmitted: true,
          inProgress: true,
        };
  });

  const [stats, setStats] = useState({
    activeProjects: 0,
    reviewProjects: 0,
    invoiceProjects: 0,
    outstandingInvoices: 0,
    labCompleteProjects: 0,
    samplesSubmittedProjects: 0,
    inProgressProjects: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch dashboard stats and invoices in parallel
        const [statsRes, invoicesRes] = await Promise.all([
          projectService.getDashboardStats(),
          invoiceService.getAll(),
        ]);

        const invoices = Array.isArray(invoicesRes.data)
          ? invoicesRes.data
          : invoicesRes.data.data || [];

        const outstandingInvoices = invoices.filter(
          (inv) => inv.status === "unpaid"
        ).length;

        setStats({
          ...statsRes.data,
          outstandingInvoices,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch daily timesheet data
  useEffect(() => {
    const fetchDailyTimesheet = async () => {
      try {
        const today = new Date();
        const formattedDate = format(today, "yyyy-MM-dd");

        // Get timesheet entries for time calculation
        const entriesResponse = await api.get(
          `/timesheets/range/${formattedDate}/${formattedDate}`
        );

        // Get daily status
        const statusResponse = await api.get(
          `/timesheets/status/range/${formattedDate}/${formattedDate}`
        );

        // Calculate total time from entries
        const totalMinutes = entriesResponse.data.reduce((total, entry) => {
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

        // Get status from daily status summary (not individual entries)
        const dailyStatus = statusResponse.data[0]?.status || "incomplete";

        setDailyTimesheetData({
          totalTime: totalMinutes,
          status: dailyStatus,
        });
      } catch (error) {
        console.error("Error fetching daily timesheet:", error);
      }
    };

    fetchDailyTimesheet();
  }, []);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const newOrder = Array.from(widgetOrder);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);

    // Update both state and localStorage
    setWidgetOrder(newOrder);
    localStorage.setItem("dashboardWidgetOrder", JSON.stringify(newOrder));

    // Force a re-render by updating visibleWidgets
    setVisibleWidgets((prev) => ({ ...prev }));
  };

  // Define grid items
  const gridItems = useMemo(
    () => [
      {
        id: "dailyTimesheet",
        title: "My Daily Timesheet",
        value: `${Math.floor(dailyTimesheetData.totalTime / 60)}h ${
          dailyTimesheetData.totalTime % 60
        }m`,
        icon: <AccessTimeIcon />,
        bgcolor: "#1976d2",
        onClick: () => navigate("/timesheets"),
        subtitle:
          dailyTimesheetData.status.charAt(0).toUpperCase() +
          dailyTimesheetData.status.slice(1),
      },
      {
        id: "active",
        title: "Active Projects Database",
        value: stats.activeProjects.toString(),
        icon: <AssignmentIcon />,
        bgcolor: "#2e7d32",
        onClick: () => navigateToProjects(navigate, { status: "all_active" }),
      },
      {
        id: "review",
        title: "Projects: Report Ready for Review",
        value: stats.reviewProjects.toString(),
        icon: <RateReviewIcon />,
        bgcolor: "#ed6c02",
        onClick: () =>
          navigateToProjects(navigate, { status: "Report sent for review" }),
      },
      {
        id: "invoice",
        title: "Projects: Ready for Invoicing",
        value: stats.invoiceProjects.toString(),
        icon: <ReceiptOutlinedIcon />,
        bgcolor: "#9c27b0",
        onClick: () =>
          navigateToProjects(navigate, { status: "Ready for invoicing" }),
      },
      {
        id: "outstanding",
        title: "Outstanding Invoices Database",
        value: stats.outstandingInvoices.toString(),
        icon: <AttachMoneyIcon />,
        bgcolor: "#d32f2f",
        onClick: () => navigateToInvoices(navigate),
      },

      {
        id: "samplesSubmitted",
        title: "Projects: Samples Submitted",
        value: stats.samplesSubmittedProjects.toString(),
        icon: <SendIcon />,
        bgcolor: "#2e7d32",
        onClick: () =>
          navigateToProjects(navigate, { status: "Samples submitted" }),
      },
      {
        id: "inProgress",
        title: "Projects: In Progress",
        value: stats.inProgressProjects.toString(),
        icon: <PlayArrowIcon />,
        bgcolor: "#ed6c02",
        onClick: () => navigateToProjects(navigate, { status: "In progress" }),
      },
    ],
    [dailyTimesheetData, stats, currentUser, navigate]
  );

  // Get ordered and visible widgets
  const displayWidgets = useMemo(() => {
    // First, ensure we have valid widget IDs
    const validWidgetIds = gridItems.map((item) => item.id);
    const filteredOrder = widgetOrder.filter((id) =>
      validWidgetIds.includes(id)
    );

    // If no valid widgets in order, use all grid items
    const orderToUse =
      filteredOrder.length > 0 ? filteredOrder : validWidgetIds;

    // Map and filter widgets
    return orderToUse
      .map((id) => gridItems.find((item) => item.id === id))
      .filter(Boolean)
      .filter((item) => visibleWidgets[item.id]);
  }, [widgetOrder, gridItems, visibleWidgets]);

  const handleCardClick = (item) => {
    if (typeof item.onClick === "function") {
      item.onClick();
    }
  };

  const handleWidgetToggle = (widgetId) => {
    setVisibleWidgets((prev) => {
      const newState = {
        ...prev,
        [widgetId]: !prev[widgetId],
      };
      // Save to localStorage whenever preferences change
      localStorage.setItem("dashboardWidgets", JSON.stringify(newState));
      return newState;
    });
  };

  const handleWidgetDialogClose = () => {
    setWidgetDialogOpen(false);
  };

  // Calculate optimal number of columns based on widget count
  const getOptimalColumns = (widgetCount) => {
    if (widgetCount <= 2) return 2;
    if (widgetCount <= 4) return 2;
    if (widgetCount <= 6) return 3;
    if (widgetCount <= 8) return 4;
    return 4; // Max 4 columns
  };

  const optimalColumns = getOptimalColumns(displayWidgets.length);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{ mt: 3, mb: 4 }}
        >
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<WidgetsIcon />}
          onClick={() => setWidgetDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.secondary.main,
            "&:hover": { backgroundColor: theme.palette.secondary.dark },
          }}
        >
          Widgets
        </Button>
      </Box>

      {/* Widgets Grid */}
      <Box mt="20px">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="widgets" direction="horizontal">
            {(provided) => (
              <Box
                display="grid"
                gridTemplateColumns={`repeat(${optimalColumns}, 1fr)`}
                gap="20px"
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  "& > *": {
                    minWidth: "280px",
                    height: "200px",
                  },
                }}
              >
                {displayWidgets.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          height: "200px",
                          transition: "all 0.3s ease-in-out",
                          "&:hover": {
                            transform: "translateY(-4px)",
                            boxShadow: 4,
                          },
                          transform: snapshot.isDragging
                            ? "scale(1.02)"
                            : "none",
                          cursor: "pointer",
                          borderRadius: "8px",
                        }}
                        onClick={() => handleCardClick(item)}
                      >
                        <CardActionArea
                          sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "stretch",
                          }}
                        >
                          <CardMedia
                            component="div"
                            sx={{
                              height: 120,
                              backgroundColor: item.bgcolor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                            }}
                          >
                            {React.cloneElement(item.icon, {
                              sx: { fontSize: 50, color: "white" },
                            })}

                            <Box
                              {...provided.dragHandleProps}
                              sx={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                color: "white",
                                opacity: 0.7,
                                "&:hover": {
                                  opacity: 1,
                                },
                              }}
                            >
                              <DragIndicatorIcon />
                            </Box>
                          </CardMedia>
                          <CardContent
                            sx={{
                              flexGrow: 1,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              p: 2,
                            }}
                          >
                            <Typography
                              variant="h6"
                              component="div"
                              sx={{
                                fontSize: "0.9rem",
                                fontWeight: "bold",
                                mb: 1,
                                textAlign: "center",
                              }}
                            >
                              {item.title}
                            </Typography>
                            <Typography
                              variant="h4"
                              component="div"
                              sx={{
                                color: item.bgcolor,
                                fontSize: "1.5rem",
                                fontWeight: "bold",
                                textAlign: "center",
                                mb: 1,
                              }}
                            >
                              {item.value}
                            </Typography>
                            {item.subtitle && (
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    item.subtitle === "Incomplete"
                                      ? "#ff6b6b"
                                      : "#666",
                                  textAlign: "center",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {item.subtitle}
                              </Typography>
                            )}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      </Box>

      {/* Allocated Jobs Table */}
      <Box mt="40px">
        <AllocatedJobsTable />
      </Box>

      {/* Widget Configuration Dialog */}
      <Dialog
        open={widgetDialogOpen}
        onClose={() => setWidgetDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Configure Dashboard Widgets</DialogTitle>
        <DialogContent>
          <FormGroup>
            {gridItems.map((item) => (
              <FormControlLabel
                key={item.id}
                control={
                  <Checkbox
                    checked={visibleWidgets[item.id]}
                    onChange={() => handleWidgetToggle(item.id)}
                  />
                }
                label={item.title}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWidgetDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
