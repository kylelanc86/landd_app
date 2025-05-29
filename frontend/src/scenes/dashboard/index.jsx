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
import AllocatedJobsTable from "./AllocatedJobsTable";
import ScienceIcon from "@mui/icons-material/Science";
import SendIcon from "@mui/icons-material/Send";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);

  // Load widget order from localStorage or use defaults
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const savedOrder = localStorage.getItem("dashboardWidgetOrder");
    return savedOrder
      ? JSON.parse(savedOrder)
      : [
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
        const labCompleteProjects = projects.filter(
          (p) => p.status === "Lab analysis complete"
        ).length;
        const samplesSubmittedProjects = projects.filter(
          (p) => p.status === "Samples submitted"
        ).length;
        const inProgressProjects = projects.filter(
          (p) => p.status === "In progress"
        ).length;

        const outstandingInvoices = invoices.filter(
          (inv) => inv.status === "unpaid"
        ).length;

        setStats({
          activeProjects,
          reviewProjects,
          invoiceProjects,
          outstandingInvoices,
          labCompleteProjects,
          samplesSubmittedProjects,
          inProgressProjects,
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
    {
      id: "labComplete",
      title: "Lab Analysis Complete",
      value: stats.labCompleteProjects.toString(),
      icon: <ScienceIcon />,
      bgcolor: tokens.secondary[600],
      path: "/projects",
      queryParams: { status: "Lab analysis complete" },
    },
    {
      id: "samplesSubmitted",
      title: "Samples Submitted",
      value: stats.samplesSubmittedProjects.toString(),
      icon: <SendIcon />,
      bgcolor: tokens.primary[500],
      path: "/projects",
      queryParams: { status: "Samples submitted" },
    },
    {
      id: "inProgress",
      title: "In Progress",
      value: stats.inProgressProjects.toString(),
      icon: <PlayArrowIcon />,
      bgcolor: tokens.neutral[600],
      path: "/projects",
      queryParams: { status: "In progress" },
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

  console.log("Debug - gridItems:", gridItems);
  console.log("Debug - visibleWidgets:", visibleWidgets);

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

      {/* Widgets Grid */}
      <Box mt="20px">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="widgets" direction="horizontal">
            {(provided) => (
              <Box
                display="grid"
                gridTemplateColumns="repeat(12, 1fr)"
                gridAutoRows="140px"
                gap="20px"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {gridItems
                  .filter((item) => visibleWidgets[item.id])
                  .map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <Box
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          gridColumn="span 3"
                          backgroundColor={item.bgcolor}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          sx={{
                            cursor: "pointer",
                            "&:hover": {
                              opacity: 0.9,
                            },
                            transform: snapshot.isDragging
                              ? "scale(1.02)"
                              : "none",
                            transition: "transform 0.2s ease",
                          }}
                          onClick={() => handleCardClick(item)}
                        >
                          <Card
                            sx={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: "transparent",
                              boxShadow: "none",
                            }}
                          >
                            <CardContent
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                position: "relative",
                              }}
                            >
                              <Box
                                {...provided.dragHandleProps}
                                sx={{
                                  position: "absolute",
                                  top: 8,
                                  right: 8,
                                  color: "white",
                                  opacity: 0.5,
                                  "&:hover": {
                                    opacity: 1,
                                  },
                                }}
                              >
                                <DragIndicatorIcon />
                              </Box>
                              <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                mb={2}
                              >
                                {item.icon}
                              </Box>
                              <Typography
                                variant="h5"
                                component="div"
                                sx={{ mb: 1, color: "white" }}
                              >
                                {item.value}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ color: "white", textAlign: "center" }}
                              >
                                {item.title}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Box>
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
