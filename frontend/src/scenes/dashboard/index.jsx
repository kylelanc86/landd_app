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
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  IconButton,
  useMediaQuery,
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
import { invoiceService } from "../../services/api";

import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import AllocatedJobsTable from "./AllocatedJobsTable";
import LoadingSpinner from "../../components/LoadingSpinner";
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
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [dailyTimesheetData, setDailyTimesheetData] = useState({
    totalTime: 0,
    status: "incomplete",
  });

  // Add responsive breakpoints - allow single row when possible
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // Back to "sm" for mobile
  const isTablet = useMediaQuery(theme.breakpoints.down("md")); // Back to "md" for tablet
  const isExtraSmall = useMediaQuery("(max-width:480px)"); // Back to 480px for very small

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
    const defaultPreferences = {
      dailyTimesheet: true,
      active: true,
      review: true,
      invoice: true,
      outstanding: true,
      samplesSubmitted: true,
      inProgress: true,
    };

    const result = savedPreferences
      ? JSON.parse(savedPreferences)
      : defaultPreferences;

    return result;
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

  // Removed unnecessary data fetching since dashboard stats aren't needed

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
        icon: <AccessTimeIcon />,
        bgcolor: "#EA1517",
        onClick: () => navigate("/timesheets"),
        subtitle:
          dailyTimesheetData.status.charAt(0).toUpperCase() +
          dailyTimesheetData.status.slice(1),
      },
      {
        id: "active",
        title: "Active Projects",
        icon: <AssignmentIcon />,
        bgcolor: "#2e7d32",
        onClick: () => navigateToProjects(navigate, { status: "all_active" }),
      },
      {
        id: "review",
        title: "Report Ready for Review",
        icon: <RateReviewIcon />,
        bgcolor: "#2BBAD4",
        onClick: () =>
          navigateToProjects(navigate, { status: "Report sent for review" }),
      },
      {
        id: "invoice",
        title: "Ready for Invoicing",
        icon: <ReceiptOutlinedIcon />,
        bgcolor: "#9c27b0",
        onClick: () =>
          navigateToProjects(navigate, { status: "Ready for invoicing" }),
      },
      {
        id: "samplesSubmitted",
        title: "Samples Submitted",
        icon: <SendIcon />,
        bgcolor: "#2e7d32",
        onClick: () =>
          navigateToProjects(navigate, { status: "Samples submitted" }),
      },
      {
        id: "inProgress",
        title: "Projects In Progress",
        icon: <PlayArrowIcon />,
        bgcolor: "#CD32BF",
        onClick: () => navigateToProjects(navigate, { status: "In progress" }),
      },
    ],
    [dailyTimesheetData, stats, currentUser, navigate]
  );

  // Clean up invalid widget IDs after gridItems is defined
  useEffect(() => {
    if (gridItems.length > 0) {
      const validWidgetIds = gridItems.map((item) => item.id);
      const hasInvalidIds = Object.keys(visibleWidgets).some(
        (id) => !validWidgetIds.includes(id)
      );

      if (hasInvalidIds) {
        const cleanedWidgets = {};
        validWidgetIds.forEach((id) => {
          cleanedWidgets[id] =
            visibleWidgets[id] !== undefined ? visibleWidgets[id] : true;
        });

        setVisibleWidgets(cleanedWidgets);
        localStorage.setItem(
          "dashboardWidgets",
          JSON.stringify(cleanedWidgets)
        );
      }
    }
  }, [gridItems, visibleWidgets]); // Run when gridItems or visibleWidgets changes

  // Get ordered and visible widgets - limit to 4 widgets maximum
  const displayWidgets = useMemo(() => {
    // First, ensure we have valid widget IDs
    const validWidgetIds = gridItems.map((item) => item.id);
    const filteredOrder = widgetOrder.filter((id) =>
      validWidgetIds.includes(id)
    );

    // If no valid widgets in order, use all grid items
    const orderToUse =
      filteredOrder.length > 0 ? filteredOrder : validWidgetIds;

    // Map and filter widgets, then limit to first 4
    const result = orderToUse
      .map((id) => gridItems.find((item) => item.id === id))
      .filter(Boolean)
      .filter((item) => visibleWidgets[item.id])
      .slice(0, 4); // Only show first 4 widgets

    return result;
  }, [widgetOrder, gridItems, visibleWidgets]);

  const handleCardClick = (item) => {
    if (typeof item.onClick === "function") {
      item.onClick();
    }
  };

  const handleWidgetToggle = (widgetId) => {
    setVisibleWidgets((prev) => {
      const isCurrentlyVisible = prev[widgetId];
      const currentVisibleCount = Object.values(prev).filter(Boolean).length;

      // If trying to enable a widget and we're already at the limit, prevent it
      if (!isCurrentlyVisible && currentVisibleCount >= 4) {
        return prev; // Return previous state unchanged
      }

      // Create new state
      const newState = {
        ...prev,
        [widgetId]: !isCurrentlyVisible,
      };

      // Save to localStorage whenever preferences change
      localStorage.setItem("dashboardWidgets", JSON.stringify(newState));
      return newState;
    });
  };

  const handleWidgetDialogClose = () => {
    setWidgetDialogOpen(false);
  };

  // Always display exactly 4 widgets in 1 row
  const getOptimalColumns = () => {
    if (isExtraSmall) {
      return 1; // Single column on very small screens
    } else if (isMobile) {
      return 1; // Single column on mobile
    } else if (isTablet) {
      return 2; // 2 columns on tablet for 4 widgets (2 rows of 2)
    } else {
      return 4; // Always 4 columns on desktop for single row
    }
  };

  const optimalColumns = getOptimalColumns();

  // Show UI immediately, data will load in background

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
            backgroundColor: theme.palette.primary.main,
            "&:hover": { backgroundColor: theme.palette.primary.dark },
          }}
        >
          Select Widgets
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
                gap={isExtraSmall ? "8px" : isMobile ? "12px" : "20px"}
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  width: "100%",
                  minWidth: 0,
                  // Single row layout for 4 widgets
                  gridTemplateRows: "1fr",
                  gridAutoFlow: "row",
                  // Ensure grid items can shrink below their content size
                  gridAutoColumns: "1fr",
                  gridAutoRows: "auto",
                  // Force wrapping when widgets get too cramped
                  alignItems: "start",
                  justifyContent: "start",
                  // Individual widget styling
                  "& > *": {
                    minWidth: isExtraSmall
                      ? "120px" // Ensure minimum width to prevent concealment
                      : isMobile
                      ? "140px"
                      : isTablet
                      ? "160px"
                      : "180px",
                    height: isExtraSmall
                      ? "100px"
                      : isMobile
                      ? "120px"
                      : "160px",
                    width: "100%",
                  },
                  // Handle very small screens
                  ...(isExtraSmall && {
                    gridTemplateColumns: "1fr",
                    gap: "6px",
                  }),
                  // Handle mobile screens
                  ...(isMobile &&
                    !isExtraSmall && {
                      gridTemplateColumns: "1fr",
                      gap: "10px",
                    }),
                  // Handle tablet screens
                  ...(isTablet &&
                    !isMobile && {
                      gridTemplateColumns: "repeat(2, 1fr)", // 2x2 grid on tablet
                      gap: "16px",
                    }),
                  // Ensure smooth transitions
                  transition: "all 0.3s ease-in-out",
                  // Force wrapping when space is limited
                  overflowWrap: "break-word",
                  wordWrap: "break-word",
                  // Handle window resize smoothly - single row layout
                  "@media (max-width: 480px)": {
                    gridTemplateColumns: "1fr",
                    gap: "6px",
                  },
                  "@media (max-width: 600px)": {
                    gridTemplateColumns: "1fr",
                    gap: "8px",
                  },
                  "@media (max-width: 900px)": {
                    gridTemplateColumns: "repeat(2, 1fr)", // 2x2 grid on medium screens
                    gap: "12px",
                  },
                  "@media (max-width: 1200px)": {
                    gridTemplateColumns: "repeat(3, 1fr)", // 3 columns on smaller desktop
                    gap: "16px",
                  },
                  "@media (max-width: 1400px)": {
                    gridTemplateColumns: "repeat(4, 1fr)", // 4 columns on larger desktop
                    gap: "20px",
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
                          height: isExtraSmall
                            ? "100px"
                            : isMobile
                            ? "120px"
                            : "160px",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow:
                              "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
                          },
                          transform: snapshot.isDragging
                            ? "scale(1.05) rotate(2deg)"
                            : "none",
                          cursor: "pointer",
                          borderRadius: "16px",
                          minWidth: 0, // Allow shrinking
                          width: "100%", // Take full width of grid cell
                          // Force wrapping when space is limited
                          flexShrink: 1,
                          flexBasis: "auto",
                          boxShadow:
                            "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
                          border: "1px solid rgba(0,0,0,0.05)",
                          overflow: "hidden",
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
                          <Box
                            component="div"
                            sx={{
                              height: "100%",
                              background: `linear-gradient(135deg, ${item.bgcolor}15 0%, ${item.bgcolor}08 100%)`,
                              border: `2px solid ${item.bgcolor}40`,
                              borderRadius: "16px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                              padding: isExtraSmall
                                ? "8px"
                                : isMobile
                                ? "12px"
                                : "16px",
                              boxShadow: `0 4px 20px ${item.bgcolor}20, 0 2px 8px ${item.bgcolor}15`,
                              backdropFilter: "blur(10px)",
                              transition: "all 0.3s ease-in-out",
                              "&:hover": {
                                transform: "translateY(-1.5px)",
                                boxShadow: `0 6px 22px ${item.bgcolor}25, 0 3px 12px ${item.bgcolor}20`,
                                border: `2px solid ${item.bgcolor}50`,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: isExtraSmall
                                  ? "32px"
                                  : isMobile
                                  ? "40px"
                                  : isTablet
                                  ? "48px"
                                  : "56px",
                                height: isExtraSmall
                                  ? "32px"
                                  : isMobile
                                  ? "40px"
                                  : isTablet
                                  ? "48px"
                                  : "56px",
                                borderRadius: "50%",
                                background: `linear-gradient(135deg, ${item.bgcolor}20 0%, ${item.bgcolor}10 100%)`,
                                border: `2px solid ${item.bgcolor}30`,
                                marginBottom: isExtraSmall
                                  ? "6px"
                                  : isMobile
                                  ? "8px"
                                  : "12px",
                                boxShadow: `0 2px 8px ${item.bgcolor}25`,
                              }}
                            >
                              {React.cloneElement(item.icon, {
                                sx: {
                                  fontSize: isExtraSmall
                                    ? 20
                                    : isMobile
                                    ? 24
                                    : isTablet
                                    ? 28
                                    : 32,
                                  color: item.bgcolor,
                                  filter:
                                    "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                                },
                              })}
                            </Box>

                            <Typography
                              variant="h6"
                              component="div"
                              sx={{
                                fontSize: isExtraSmall
                                  ? "0.7rem"
                                  : isMobile
                                  ? "0.8rem"
                                  : isTablet
                                  ? "0.9rem"
                                  : "1rem",
                                fontWeight: "700",
                                color: "#1a1a1a",
                                textAlign: "center",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: isExtraSmall ? 1 : 2,
                                WebkitBoxOrient: "vertical",
                                margin: 0,
                                marginBottom: isExtraSmall
                                  ? "4px"
                                  : isMobile
                                  ? "6px"
                                  : "8px",
                                textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                                letterSpacing: "0.02em",
                                // Responsive font sizing for small widgets
                                "@media (max-width: 1200px)": {
                                  fontSize: isExtraSmall
                                    ? "0.65rem"
                                    : isMobile
                                    ? "0.75rem"
                                    : isTablet
                                    ? "0.85rem"
                                    : "0.9rem",
                                },
                                "@media (max-width: 900px)": {
                                  fontSize: isExtraSmall
                                    ? "0.6rem"
                                    : isMobile
                                    ? "0.7rem"
                                    : isTablet
                                    ? "0.8rem"
                                    : "0.85rem",
                                },
                              }}
                            >
                              {item.title}
                            </Typography>

                            {/* Show subtitle in colored text for timesheet widget */}
                            {item.id === "dailyTimesheet" && item.subtitle && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "4px 8px",
                                  borderRadius: "12px",
                                  background:
                                    item.status === "complete"
                                      ? "linear-gradient(135deg, #4caf50 0%, #45a049 100%)"
                                      : "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                                  margin: 0,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: "white",
                                    textAlign: "center",
                                    fontSize: isExtraSmall
                                      ? "0.6rem"
                                      : isMobile
                                      ? "0.7rem"
                                      : isTablet
                                      ? "0.8rem"
                                      : "0.9rem",
                                    fontWeight: "600",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    margin: 0,
                                    textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                                    // Responsive font sizing for small widgets
                                    "@media (max-width: 1200px)": {
                                      fontSize: isExtraSmall
                                        ? "0.55rem"
                                        : isMobile
                                        ? "0.65rem"
                                        : isTablet
                                        ? "0.75rem"
                                        : "0.8rem",
                                    },
                                    "@media (max-width: 900px)": {
                                      fontSize: isExtraSmall
                                        ? "0.5rem"
                                        : isMobile
                                        ? "0.6rem"
                                        : isTablet
                                        ? "0.7rem"
                                        : "0.75rem",
                                    },
                                  }}
                                >
                                  {item.subtitle}
                                </Typography>
                              </Box>
                            )}

                            <Box
                              {...provided.dragHandleProps}
                              sx={{
                                position: "absolute",
                                top: isExtraSmall ? 4 : isMobile ? 6 : 10,
                                left: isExtraSmall ? 4 : isMobile ? 6 : 10,
                                color: item.bgcolor,
                                opacity: 0.4,
                                cursor: "grab",
                                transition: "all 0.2s ease-in-out",
                                "&:hover": {
                                  opacity: 0.8,
                                  transform: "scale(1.1)",
                                },
                                "&:active": {
                                  cursor: "grabbing",
                                  transform: "scale(0.95)",
                                },
                              }}
                            >
                              <DragIndicatorIcon
                                sx={{
                                  fontSize: isExtraSmall
                                    ? 14
                                    : isMobile
                                    ? 18
                                    : 22,
                                  filter:
                                    "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                                }}
                              />
                            </Box>
                          </Box>
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
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select up to 4 widgets to display on your dashboard
            </Typography>
          </Box>
          <FormGroup>
            {gridItems.map((item) => {
              const isChecked = visibleWidgets[item.id];
              const currentCount =
                Object.values(visibleWidgets).filter(Boolean).length;
              const canToggle = isChecked || currentCount < 4;

              return (
                <FormControlLabel
                  key={item.id}
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={() => handleWidgetToggle(item.id)}
                      disabled={!canToggle}
                    />
                  }
                  label={item.title}
                  sx={{
                    opacity: canToggle ? 1 : 0.6,
                    "& .MuiFormControlLabel-label": {
                      color: canToggle ? "text.primary" : "text.disabled",
                    },
                  }}
                />
              );
            })}
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
