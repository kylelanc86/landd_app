import {
  Box,
  Typography,
  useTheme,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import RateReviewIcon from "@mui/icons-material/RateReview";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import AirOutlinedIcon from "@mui/icons-material/AirOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { projectService } from "../../services/api";

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeProjects: 0,
    reviewProjects: 0,
    invoiceProjects: 0,
    outstandingInvoices: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projects = await projectService.getAll();

        // Calculate stats
        const activeProjects = projects.filter(
          (p) => p.status === "in_progress"
        ).length;
        const reviewProjects = projects.filter(
          (p) => p.status === "pending"
        ).length;
        const invoiceProjects = projects.filter(
          (p) => p.status === "completed"
        ).length;

        setStats({
          activeProjects,
          reviewProjects,
          invoiceProjects,
          outstandingInvoices: 0, // This will need to be implemented when we add invoice functionality
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
      title: "Active Projects",
      value: stats.activeProjects.toString(),
      icon: <AssessmentIcon />,
      bgColor: "#74B3CE",
      filter: "active",
      path: "/projects",
      queryParams: { status: "in_progress" },
    },
    {
      title: "Report Ready for Review",
      value: stats.reviewProjects.toString(),
      icon: <MapOutlinedIcon />,
      bgColor: "#FFC107",
      filter: "review",
      path: "/projects",
      queryParams: { status: "pending" },
    },
    {
      title: "Ready for Invoicing",
      value: stats.invoiceProjects.toString(),
      icon: <ReceiptOutlinedIcon />,
      bgColor: "#2196F3",
      filter: "invoice",
      path: "/projects",
      queryParams: { status: "completed" },
    },
    {
      title: "Outstanding Invoices",
      value: stats.outstandingInvoices.toString(),
      icon: <ReceiptOutlinedIcon />,
      bgColor: "#F44336",
      filter: "outstanding",
      path: "/invoices",
      queryParams: { status: "Unpaid" },
    },
  ];

  const handleCardClick = (item) => {
    const queryParams = new URLSearchParams(item.queryParams).toString();
    navigate(`${item.path}?${queryParams}`);
  };

  const StatCard = ({ title, value, icon, bgColor, item }) => (
    <Card
      key={title}
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        cursor: "pointer",
        backgroundColor: bgColor,
        "&:hover": {
          opacity: 0.9,
        },
      }}
      onClick={() => handleCardClick(item)}
    >
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box
            sx={{
              backgroundColor: bgColor,
              borderRadius: "8px",
              p: 1,
              color: theme.palette.mode === "dark" ? "white" : "black",
              opacity: 0.8,
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="h4"
            sx={{
              color: theme.palette.mode === "dark" ? "white" : "black",
              fontWeight: "bold",
            }}
          >
            {value}
          </Typography>
        </Box>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.mode === "dark" ? "white" : "black",
            fontSize: "0.9rem",
            opacity: 0.9,
          }}
        >
          {title}
        </Typography>
      </CardContent>
    </Card>
  );

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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        {gridItems.map((item, index) => (
          <Grid item xs={12} sm={6} md={3} key={index} sx={{ width: "100%" }}>
            <StatCard
              title={item.title}
              value={item.value}
              icon={item.icon}
              bgColor={item.bgColor}
              item={item}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
