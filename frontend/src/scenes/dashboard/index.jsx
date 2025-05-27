import {
  Box,
  Typography,
  useTheme,
  Grid,
  Card,
  CardContent,
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
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { projectService, invoiceService } from "../../services/api";
import { ACTIVE_STATUSES } from "../../components/JobStatus";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);

  // Load widget preferences from localStorage or use defaults
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const savedPreferences = localStorage.getItem("dashboardWidgets");
    return savedPreferences
      ? JSON.parse(savedPreferences)
      : {
          active: true,
          review: true,
          invoice: true,
          outstanding: true,
        };
  });

  // Load widget order from localStorage or use defaults
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const savedOrder = localStorage.getItem("dashboardWidgetOrder");
    return savedOrder
      ? JSON.parse(savedOrder)
      : ["active", "review", "invoice", "outstanding"];
  });

  const [stats, setStats] = useState({
    activeProjects: 0,
    reviewProjects: 0,
    invoiceProjects: 0,
    outstandingInvoices: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects and invoices in parallel
        const [projectsRes, invoicesRes] = await Promise.all([
          projectService.getAll(),
          invoiceService.getAll(),
        ]);
        const projects = projectsRes.data;
        const invoices = invoicesRes.data;

        // Use ACTIVE_STATUSES for active projects
        const activeProjects = projects.filter((p) =>
          ACTIVE_STATUSES.includes(p.status)
        ).length;
        const reviewProjects = projects.filter(
          (p) => p.status === "Report sent for review"
        ).length;
        const invoiceProjects = projects.filter(
          (p) => p.status === "Ready for invoicing"
        ).length;

        const outstandingInvoices = invoices.filter(
          (inv) => inv.status === "unpaid"
        ).length;

        setStats({
          activeProjects,
          reviewProjects,
          invoiceProjects,
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

  const gridItems = [
    {
      id: "active",
      title: "Active Projects",
      value: stats.activeProjects.toString(),
      icon: <AssignmentIcon />,
      bgcolor: tokens.primary[700],
      path: "/projects",
      queryParams: { status: "active" },
    },
    {
      id: "review",
      title: "Report Ready for Review",
      value: stats.reviewProjects.toString(),
      icon: <RateReviewIcon />,
      bgcolor: tokens.secondary[700],
      path: "/projects",
      queryParams: { status: "Report sent for review" },
    },
    {
      id: "invoice",
      title: "Ready for Invoicing",
      value: stats.invoiceProjects.toString(),
      icon: <ReceiptOutlinedIcon />,
      bgcolor: tokens.neutral[700],
      path: "/projects",
      queryParams: { status: "Ready for invoicing" },
    },
    {
      id: "outstanding",
      title: "Outstanding Invoices",
      value: stats.outstandingInvoices.toString(),
      icon: <AttachMoneyIcon />,
      bgcolor: tokens.primary[600],
      path: "/invoices",
      queryParams: { status: "unpaid" },
    },
  ];

  const handleCardClick = (item) => {
    const queryParams = new URLSearchParams(item.queryParams).toString();
    navigate(`${item.path}?${queryParams}`);
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

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(widgetOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgetOrder(items);
    localStorage.setItem("dashboardWidgetOrder", JSON.stringify(items));
  };

  const handleWidgetDialogClose = () => {
    setWidgetDialogOpen(false);
  };

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
        <Header title="DASHBOARD" subtitle="Welcome to your dashboard" />
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

      <Dialog open={widgetDialogOpen} onClose={handleWidgetDialogClose}>
        <DialogTitle>Customize Dashboard Widgets</DialogTitle>
        <DialogContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="widgets">
              {(provided) => (
                <FormGroup {...provided.droppableProps} ref={provided.innerRef}>
                  {gridItems.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(provided) => (
                        <Box
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            mb: 1,
                            p: 1,
                            backgroundColor: "background.paper",
                            borderRadius: 1,
                            "&:hover": {
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Box
                            {...provided.dragHandleProps}
                            sx={{ mr: 1, cursor: "grab" }}
                          >
                            <DragIndicatorIcon />
                          </Box>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={visibleWidgets[item.id]}
                                onChange={() => handleWidgetToggle(item.id)}
                              />
                            }
                            label={item.title}
                            sx={{ flex: 1 }}
                          />
                        </Box>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </FormGroup>
              )}
            </Droppable>
          </DragDropContext>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleWidgetDialogClose} color="primary">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        mt="20px"
        display="grid"
        gridTemplateColumns="repeat(12, 1fr)"
        gridAutoRows="140px"
        gap="20px"
      >
        {gridItems
          .filter((item) => visibleWidgets[item.id])
          .map((item) => (
            <Box
              gridColumn="span 3"
              gridRow="span 1"
              key={item.id}
              sx={{
                backgroundColor: item.bgcolor,
                borderRadius: "4px",
                boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
                cursor: "pointer",
                "&:hover": {
                  opacity: 0.9,
                  transform: "translateY(-2px)",
                  transition: "all 0.3s ease",
                },
              }}
              onClick={() => handleCardClick(item)}
            >
              <Box
                p="20px"
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                height="100%"
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box
                    sx={{
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      p: 1,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography
                    variant="h4"
                    sx={{
                      color: "white",
                      fontWeight: "bold",
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    color: "white",
                    fontSize: "0.9rem",
                    opacity: 0.9,
                  }}
                >
                  {item.title}
                </Typography>
              </Box>
            </Box>
          ))}
      </Box>
    </Box>
  );
};

export default Dashboard;
