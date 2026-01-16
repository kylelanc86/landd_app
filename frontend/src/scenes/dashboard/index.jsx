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
import React, { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { invoiceService } from "../../services/api";

import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import LoadingSpinner from "../../components/LoadingSpinner";
import ScienceIcon from "@mui/icons-material/Science";
import SendIcon from "@mui/icons-material/Send";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DescriptionIcon from "@mui/icons-material/Description";
import PaymentIcon from "@mui/icons-material/Payment";
import TuneIcon from "@mui/icons-material/Tune";
import { format } from "date-fns";
import api from "../../services/api";
import { userPreferencesService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  navigateToProjects,
  navigateToClients,
  navigateToInvoices,
  navigateToDatabase,
} from "../../utils/navigationHelpers";

// Lazy load the table component to prioritize widget rendering
const AllocatedJobsTable = lazy(() => import("./AllocatedJobsTable"));

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [dailyTimesheetStatus, setDailyTimesheetStatus] =
    useState("incomplete");

  // Add responsive breakpoints - allow single row when possible
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // Back to "sm" for mobile
  const isTablet = useMediaQuery(theme.breakpoints.down("md")); // Back to "md" for tablet
  const isExtraSmall = useMediaQuery("(max-width:480px)"); // Back to 480px for very small

  // Load widget order from user preferences or use defaults
  // Order should prioritize visible widgets first
  const [widgetOrder, setWidgetOrder] = useState([
    "dailyTimesheet", // Required widget
    "inProgress", // Additional widget 1
    "samplesSubmitted", // Additional widget 2
    "labComplete", // Additional widget 3 (can be enabled)
    "reportReview", // Additional widget 4 (can be enabled)
    "readyForInvoicing", // Additional widget 5 (can be enabled)
    "invoiceSent", // Additional widget 6 (can be enabled)
    "awaitingPayment", // Additional widget 7 (can be enabled)
    "allActive", // Additional widget 8 (can be enabled)
    "calibrations", // Additional widget 9 (can be enabled, permission-based)
  ]);

  // Load widget preferences from user preferences or use defaults
  // All additional widgets are false by default - users must explicitly select them
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    // Initialize from localStorage if available while API loads
    const savedWidgets = localStorage.getItem("dashboardWidgets");
    if (savedWidgets) {
      try {
        return { ...JSON.parse(savedWidgets), dailyTimesheet: true };
      } catch {
        return {
          dailyTimesheet: true,
          inProgress: false,
          samplesSubmitted: false,
          labComplete: false,
          reportReview: false,
          readyForInvoicing: false,
          invoiceSent: false,
          awaitingPayment: false,
          allActive: false,
          calibrations: false,
        };
      }
    }
    return {
      dailyTimesheet: true, // Required widget (always true)
      inProgress: false, // Additional widget 1 (user must select)
      samplesSubmitted: false, // Additional widget 2 (user must select)
      labComplete: false, // Additional widget 3 (user must select)
      reportReview: false, // Additional widget 4 (user must select)
      readyForInvoicing: false, // Additional widget 5 (user must select)
      invoiceSent: false, // Additional widget 6 (user must select)
      awaitingPayment: false, // Additional widget 7 (user must select)
      allActive: false, // Additional widget 8 (user must select)
      calibrations: false, // Additional widget 9 (user must select, permission-based)
    };
  });

  const [stats, setStats] = useState({
    inProgressProjects: 0,
    samplesSubmittedProjects: 0,
    labCompleteProjects: 0,
    reportReviewProjects: 0,
    readyForInvoicingProjects: 0,
    invoiceSentProjects: 0,
    awaitingPaymentProjects: 0,
  });

  // Load user preferences from database
  useEffect(() => {
    const DEBUG_PREFS = false; // Set to true to enable preference loading logs
    const loadUserPreferences = async () => {
      try {
        // Check if cache is empty - if so, load from database
        const cachedOrder = localStorage.getItem("dashboardWidgetOrder");
        const cachedWidgets = localStorage.getItem("dashboardWidgets");
        const cacheIsEmpty = !cachedOrder || !cachedWidgets;

        if (cacheIsEmpty) {
          if (DEBUG_PREFS) console.log("Cache is empty, loading from database");
        } else {
          if (DEBUG_PREFS)
            console.log("Cache exists, loading from cache first");
        }

        const response = await userPreferencesService.getPreferences();
        if (DEBUG_PREFS) console.log("Loaded user preferences:", response.data);

        if (response.data?.dashboard) {
          const dashboardPrefs = response.data.dashboard;

          // Load widget order
          if (
            dashboardPrefs.widgetOrder &&
            Array.isArray(dashboardPrefs.widgetOrder) &&
            dashboardPrefs.widgetOrder.length > 0
          ) {
            if (DEBUG_PREFS) {
              console.log(
                "Loading widget order from preferences:",
                dashboardPrefs.widgetOrder
              );
            }

            // Map old status-based IDs to new widget IDs
            const idMapping = {
              status_in_progress: "inProgress",
              status_samples_submitted_to_lab: "samplesSubmitted",
              status_lab_analysis_completed: "labComplete",
              status_report_sent_for_review: "reportReview",
              status_ready_for_invoicing: "readyForInvoicing",
              status_invoice_sent: "invoiceSent",
              "status_invoiced_-_awaiting_payment": "awaitingPayment",
              allActive: "allActive", // New widget - maps to itself
            };

            const mappedOrder = dashboardPrefs.widgetOrder.map(
              (id) => idMapping[id] || id
            );

            // Remove duplicates while preserving order
            const uniqueOrder = [...new Set(mappedOrder)];
            if (DEBUG_PREFS) {
              console.log("Mapped widget order:", mappedOrder);
              console.log("Unique widget order:", uniqueOrder);
            }
            setWidgetOrder(uniqueOrder);

            // Cache the widget order
            localStorage.setItem(
              "dashboardWidgetOrder",
              JSON.stringify(uniqueOrder)
            );
            if (DEBUG_PREFS) console.log("Cached widget order:", uniqueOrder);
          } else {
            if (DEBUG_PREFS) {
              console.log(
                "No valid widget order in preferences, keeping default"
              );
            }
          }

          // Load visible widgets - only if they exist in preferences
          if (dashboardPrefs.visibleWidgets) {
            const prefs = { ...dashboardPrefs.visibleWidgets };
            // Ensure daily timesheet is always enabled (required widget)
            prefs.dailyTimesheet = true;
            if (DEBUG_PREFS)
              console.log("Setting visible widgets from preferences:", prefs);

            // Get current state (may have localStorage values or initial state)
            const currentWidgets = visibleWidgets;

            // Check if preferences have all widgets defined
            // If not, we should preserve current state for missing widgets
            const allWidgetKeys = [
              "dailyTimesheet",
              "inProgress",
              "samplesSubmitted",
              "labComplete",
              "reportReview",
              "readyForInvoicing",
              "invoiceSent",
              "awaitingPayment",
              "allActive",
              "calibrations",
            ];

            const prefsHasAllKeys = allWidgetKeys.every((key) => key in prefs);

            // Merge strategy:
            // 1. Start with current state (preserves what user sees initially)
            // 2. If preferences have all keys, use them (complete preferences)
            // 3. If preferences are incomplete, merge: current state + prefs (only override what exists)
            const merged = prefsHasAllKeys
              ? {
                  ...currentWidgets, // Start with current
                  ...prefs, // Apply all preferences (complete)
                }
              : {
                  ...currentWidgets, // Start with current (preserves visible widgets)
                  ...prefs, // Only override widgets that exist in prefs
                  dailyTimesheet: true, // Always ensure dailyTimesheet is true
                };

            if (DEBUG_PREFS) {
              console.log("Merged visible widgets (current + prefs):", {
                prefsHasAllKeys,
                currentWidgets,
                prefs,
                merged,
              });
            }
            setVisibleWidgets(merged);

            // Cache the visible widgets
            localStorage.setItem("dashboardWidgets", JSON.stringify(merged));
            if (DEBUG_PREFS) console.log("Cached visible widgets:", merged);
          } else {
            // No preferences found - use default state (only dailyTimesheet enabled)
            if (DEBUG_PREFS)
              console.log("No widget preferences found, using defaults");
            const defaultWidgets = {
              dailyTimesheet: true,
              inProgress: false,
              samplesSubmitted: false,
              labComplete: false,
              reportReview: false,
              readyForInvoicing: false,
              invoiceSent: false,
              awaitingPayment: false,
              allActive: false,
              calibrations: false,
            };
            setVisibleWidgets(defaultWidgets);

            // Cache the default widgets
            localStorage.setItem(
              "dashboardWidgets",
              JSON.stringify(defaultWidgets)
            );
            if (DEBUG_PREFS)
              console.log("Cached default widgets:", defaultWidgets);
          }
        } else {
          // No dashboard preferences found - use default state
          if (DEBUG_PREFS)
            console.log("No dashboard preferences found, using defaults");
          const defaultWidgets = {
            dailyTimesheet: true,
            inProgress: false,
            samplesSubmitted: false,
            labComplete: false,
            reportReview: false,
            readyForInvoicing: false,
            invoiceSent: false,
            awaitingPayment: false,
            allActive: false,
            calibrations: false,
          };
          setVisibleWidgets(defaultWidgets);

          // Cache the default widgets
          localStorage.setItem(
            "dashboardWidgets",
            JSON.stringify(defaultWidgets)
          );
          if (DEBUG_PREFS)
            console.log("Cached default widgets:", defaultWidgets);
        }
      } catch (error) {
        console.error("Error loading user preferences:", error);
        // Fallback to localStorage if API fails
        const savedOrder = localStorage.getItem("dashboardWidgetOrder");
        const savedWidgets = localStorage.getItem("dashboardWidgets");

        if (savedOrder) {
          try {
            setWidgetOrder(JSON.parse(savedOrder));
          } catch (parseError) {
            console.error("Error parsing saved widget order:", parseError);
          }
        }

        if (savedWidgets) {
          try {
            const parsed = JSON.parse(savedWidgets);

            // Merge with defaults to ensure all widgets exist
            const merged = {
              dailyTimesheet: true,
              inProgress: false,
              samplesSubmitted: false,
              labComplete: false,
              reportReview: false,
              readyForInvoicing: false,
              invoiceSent: false,
              awaitingPayment: false,
              allActive: false,
              calibrations: false,
              ...parsed,
              dailyTimesheet: true, // Force daily timesheet to always be true
            };

            if (DEBUG_PREFS)
              console.log("Using localStorage fallback:", merged);
            setVisibleWidgets(merged);
          } catch (parseError) {
            console.error(
              "Error parsing saved widget preferences:",
              parseError
            );
            // Use default state if parsing fails
            setVisibleWidgets({
              dailyTimesheet: true,
              inProgress: false,
              samplesSubmitted: false,
              labComplete: false,
              reportReview: false,
              readyForInvoicing: false,
              invoiceSent: false,
              awaitingPayment: false,
              allActive: false,
              calibrations: false,
            });
          }
        } else {
          // No localStorage data - use default state
          console.log("No localStorage data found, using defaults");
          setVisibleWidgets({
            dailyTimesheet: true,
            inProgress: false,
            samplesSubmitted: false,
            labComplete: false,
            reportReview: false,
            readyForInvoicing: false,
            invoiceSent: false,
            awaitingPayment: false,
            allActive: false,
            calibrations: false,
          });
        }
      }
    };

    loadUserPreferences();
  }, []);

  // Fetch daily timesheet status only (optimized - removed unnecessary entries fetch)
  useEffect(() => {
    const fetchDailyTimesheetStatus = async () => {
      try {
        const startTime = performance.now();
        const today = new Date();
        const formattedDate = format(today, "yyyy-MM-dd");

        // OPTIMIZATION: Only fetch status, not timesheet entries
        // Removed: /timesheets/range API call (was unused - calculated totalTime but never displayed it)
        const statusResponse = await api.get(
          `/timesheets/status/range/${formattedDate}/${formattedDate}`
        );

        const fetchTime = performance.now() - startTime;
        console.log(
          `⚡ Dashboard timesheet status loaded in ${fetchTime.toFixed(
            2
          )}ms (was 2 API calls)`
        );

        const dailyStatus = statusResponse.data[0]?.status || "incomplete";
        setDailyTimesheetStatus(dailyStatus);
      } catch (error) {
        console.error("Error fetching daily timesheet status:", error);
        setDailyTimesheetStatus("incomplete"); // Fallback to incomplete on error
      }
    };

    fetchDailyTimesheetStatus();
  }, []);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const newOrder = Array.from(widgetOrder);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);

    // Update state
    setWidgetOrder(newOrder);

    try {
      // Save to database
      await userPreferencesService.updatePreferences({
        dashboard: {
          widgetOrder: newOrder,
          visibleWidgets: visibleWidgets,
        },
      });

      // Update cache after successful database save
      localStorage.setItem("dashboardWidgetOrder", JSON.stringify(newOrder));
      localStorage.setItem("dashboardWidgets", JSON.stringify(visibleWidgets));
    } catch (error) {
      console.error("Error saving widget order preferences:", error);
      // Fallback to localStorage if API fails
      localStorage.setItem("dashboardWidgetOrder", JSON.stringify(newOrder));
      localStorage.setItem("dashboardWidgets", JSON.stringify(visibleWidgets));
    }

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
          dailyTimesheetStatus.charAt(0).toUpperCase() +
          dailyTimesheetStatus.slice(1),
      },
      {
        id: "inProgress",
        title: "In Progress",
        icon: <PlayArrowIcon />,
        bgcolor: "#1976d2",
        onClick: () => navigateToProjects(navigate, { status: "In progress" }),
      },
      {
        id: "samplesSubmitted",
        title: "Samples Submitted to Lab",
        icon: <SendIcon />,
        bgcolor: "#ff9800",
        onClick: () =>
          navigateToProjects(navigate, { status: "Samples Submitted to Lab" }),
      },
      {
        id: "labComplete",
        title: "Lab Analysis Completed",
        icon: <ScienceIcon />,
        bgcolor: "#9c27b0",
        onClick: () =>
          navigateToProjects(navigate, { status: "Lab Analysis Completed" }),
      },
      {
        id: "reportReview",
        title: "Report sent for review",
        icon: <RateReviewIcon />,
        bgcolor: "#f57c00",
        onClick: () =>
          navigateToProjects(navigate, { status: "Report sent for review" }),
      },
      {
        id: "readyForInvoicing",
        title: "Ready for invoicing",
        icon: <ReceiptOutlinedIcon />,
        bgcolor: "#388e3c",
        onClick: () =>
          navigateToProjects(navigate, { status: "Ready for invoicing" }),
      },
      {
        id: "invoiceSent",
        title: "Invoice sent",
        icon: <DescriptionIcon />,
        bgcolor: "#7b1fa2",
        onClick: () => navigateToProjects(navigate, { status: "Invoice sent" }),
      },
      {
        id: "awaitingPayment",
        title: "Invoiced - Awaiting Payment",
        icon: <PaymentIcon />,
        bgcolor: "#000000",
        onClick: () =>
          navigateToProjects(navigate, {
            status: "Invoiced - Awaiting Payment",
          }),
      },
      {
        id: "allActive",
        title: "Active Projects",
        icon: <PlayArrowIcon />,
        bgcolor: "#ebba34",
        onClick: () => navigate("/projects"),
      },
      {
        id: "calibrations",
        title: "Calibrations",
        icon: <TuneIcon />,
        bgcolor: "#00acc1",
        onClick: () => navigate("/records/laboratory/calibrations/list"),
      },
    ],
    [dailyTimesheetStatus, currentUser, navigate]
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
  }, [gridItems]); // Run when gridItems changes

  // Ensure daily timesheet widget is always enabled (required widget)
  useEffect(() => {
    if (!visibleWidgets.dailyTimesheet) {
      setVisibleWidgets((prev) => {
        const updated = { ...prev, dailyTimesheet: true };
        localStorage.setItem("dashboardWidgets", JSON.stringify(updated));
        return updated;
      });
    }
  }, [visibleWidgets.dailyTimesheet]);

  // Debug: Log when visibleWidgets changes (disabled for performance)
  // useEffect(() => {
  //   console.log("visibleWidgets changed:", visibleWidgets);
  //   console.log(
  //     "Visible count:",
  //     Object.values(visibleWidgets).filter(Boolean).length
  //   );
  //   console.log(
  //     "All widgets state:",
  //     Object.entries(visibleWidgets)
  //       .map(([key, val]) => `${key}: ${val}`)
  //       .join(", ")
  //   );
  // }, [visibleWidgets]);

  // Get ordered and visible widgets - limit to 3 additional widgets + daily timesheet = 4 total
  const displayWidgets = useMemo(() => {
    const DEBUG = false; // Set to true to enable verbose widget debugging
    if (DEBUG) {
      console.log("displayWidgets useMemo running with:", {
        widgetOrder,
        visibleWidgets,
        gridItemsLength: gridItems.length,
      });
      console.log("visibleWidgets keys:", Object.keys(visibleWidgets));
      console.log("visibleWidgets values:", Object.values(visibleWidgets));
    }

    // First, ensure we have valid widget IDs
    const validWidgetIds = gridItems.map((item) => item.id);
    const filteredOrder = widgetOrder.filter((id) =>
      validWidgetIds.includes(id)
    );

    // If no valid widgets in order, use all grid items
    let orderToUse = filteredOrder.length > 0 ? filteredOrder : validWidgetIds;

    // Add any visible widgets that are not in the order
    const visibleWidgetIds = Object.keys(visibleWidgets).filter(
      (id) => visibleWidgets[id]
    );
    const missingVisibleWidgets = visibleWidgetIds.filter(
      (id) => !orderToUse.includes(id)
    );
    if (missingVisibleWidgets.length > 0) {
      if (DEBUG) {
        console.log(
          "Adding missing visible widgets to order:",
          missingVisibleWidgets
        );
      }
      orderToUse = [...orderToUse, ...missingVisibleWidgets];
    }

    if (DEBUG) {
      console.log("Display widgets calculation:", {
        validWidgetIds,
        filteredOrder,
        orderToUse,
        widgetOrder,
        visibleWidgets,
        gridItems: gridItems.map((item) => ({
          id: item.id,
          title: item.title,
        })),
        allActiveInValidIds: validWidgetIds.includes("allActive"),
        allActiveInOrder: widgetOrder.includes("allActive"),
        allActiveVisible: visibleWidgets.allActive,
        allActiveInFinalOrder: orderToUse.includes("allActive"),
      });
    }

    // Map and filter widgets, then limit to first 4 (1 required + up to 3 additional)
    const result = orderToUse
      .map((id) => {
        const item = gridItems.find((item) => item.id === id);
        if (DEBUG) {
          console.log(`Mapping ${id}:`, {
            item,
            isVisible: visibleWidgets[id],
          });
        }
        return item;
      })
      .filter(Boolean)
      .filter((item) => {
        const isVisible = visibleWidgets[item.id];
        if (DEBUG) {
          console.log(`Filtering ${item.id}:`, {
            isVisible,
            willShow: isVisible,
          });
        }
        return isVisible;
      })
      .slice(0, 4); // Only show first 4 widgets (1 required + up to 3 additional)

    if (DEBUG) {
      console.log(
        "Final display widgets:",
        result.map((item) => ({ id: item.id, title: item.title }))
      );
      console.log("displayWidgets length:", result.length);
    }
    return result;
  }, [widgetOrder, gridItems, visibleWidgets]);

  // Debug: Test without useMemo (disabled for performance)
  // const debugDisplayWidgets = gridItems.filter(
  //   (item) => visibleWidgets[item.id]
  // );
  // console.log(
  //   "Debug display widgets (no useMemo):",
  //   debugDisplayWidgets.map((item) => ({ id: item.id, title: item.title }))
  // );

  const handleCardClick = (item) => {
    if (typeof item.onClick === "function") {
      item.onClick();
    }
  };

  const handleWidgetToggle = async (widgetId) => {
    // console.log("Toggling widget:", widgetId);

    const isCurrentlyVisible = visibleWidgets[widgetId];
    const currentVisibleCount =
      Object.values(visibleWidgets).filter(Boolean).length;
    // console.log("Current state:", visibleWidgets);
    // console.log("Is currently visible:", isCurrentlyVisible);
    // console.log("Current visible count:", currentVisibleCount);

    // Prevent disabling the daily timesheet widget (it's required)
    if (widgetId === "dailyTimesheet" && isCurrentlyVisible) {
      // console.log("Cannot disable required daily timesheet widget");
      return; // Exit early - cannot disable required widget
    }

    // If trying to enable a widget and we're already at the limit, prevent it
    if (!isCurrentlyVisible && currentVisibleCount >= 4) {
      console.log(
        "Cannot enable widget - already at limit of 4 (1 required + 3 additional)"
      );
      return; // Exit early - already at limit
    }

    // Create new state
    const newState = {
      ...visibleWidgets,
      [widgetId]: !isCurrentlyVisible,
    };

    console.log("New state:", newState);

    // Update state immediately
    setVisibleWidgets(newState);

    try {
      // Save to database
      await userPreferencesService.updatePreferences({
        dashboard: {
          widgetOrder: widgetOrder,
          visibleWidgets: newState,
        },
      });
      console.log("Saved to database:", JSON.stringify(newState));

      // Update cache after successful database save
      localStorage.setItem("dashboardWidgets", JSON.stringify(newState));
      localStorage.setItem("dashboardWidgetOrder", JSON.stringify(widgetOrder));
      console.log("Updated cache with new widget selections");
    } catch (error) {
      console.error("Error saving widget preferences:", error);
      // Fallback to localStorage if API fails
      localStorage.setItem("dashboardWidgets", JSON.stringify(newState));
      localStorage.setItem("dashboardWidgetOrder", JSON.stringify(widgetOrder));
      console.log("Saved to localStorage:", JSON.stringify(newState));
    }
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
          onClick={() => {
            console.log(
              "Opening widget dialog with current state:",
              visibleWidgets
            );
            setWidgetDialogOpen(true);
          }}
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

      {/* Allocated Jobs Table - Lazy loaded to prioritize widget rendering */}
      <Box mt="40px">
        <Suspense
          fallback={
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              height="200px"
            >
              <CircularProgress />
            </Box>
          }
        >
          <AllocatedJobsTable />
        </Suspense>
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
              Select up to 3 additional widgets to display on your dashboard
              (Daily Timesheet is always included)
            </Typography>
          </Box>
          <FormGroup>
            {gridItems
              .filter((item) => {
                // Exclude daily timesheet from selection
                if (item.id === "dailyTimesheet") return false;
                
                // Filter calibrations widget based on permissions
                if (item.id === "calibrations") {
                  // Only show for admin level users, or users with calibrations approval, or users with lab signatory approval
                  const isAdmin = currentUser?.role === "admin";
                  const hasCalibrationsApproval = currentUser?.labApprovals?.calibrations === true;
                  const hasLabSignatoryApproval = currentUser?.labSignatory === true;
                  
                  return isAdmin || hasCalibrationsApproval || hasLabSignatoryApproval;
                }
                
                // Show all other widgets
                return true;
              })
              .map((item) => {
                // Check if this widget is currently visible
                const isChecked = visibleWidgets[item.id] === true;
                const currentCount =
                  Object.values(visibleWidgets).filter(Boolean).length;

                // Can toggle if: already checked (can uncheck) OR not at limit of 4 total widgets
                const canToggle = isChecked || currentCount < 4;

                // Disabled for performance
                // console.log(`Widget ${item.id}:`, {
                //   isChecked,
                //   currentCount,
                //   canToggle,
                //   visibleWidgetsValue: visibleWidgets[item.id],
                //   widgetState: visibleWidgets,
                // });

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
