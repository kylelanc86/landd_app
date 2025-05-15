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
import { projectService, invoiceService } from "../../services/api";
import { ACTIVE_STATUSES } from "../../components/JobStatus";
import Header from "../../components/Header";

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
      title: "Active Projects",
      value: stats.activeProjects.toString(),
      icon: <AssessmentIcon />,
      bgColor: "#74B3CE",
      filter: "active",
      path: "/projects",
      queryParams: { status: "active" },
    },
    {
      title: "Report Ready for Review",
      value: stats.reviewProjects.toString(),
      icon: <MapOutlinedIcon />,
      bgColor: "#FFC107",
      filter: "review",
      path: "/projects",
      queryParams: { status: "Report sent for review" },
    },
    {
      title: "Ready for Invoicing",
      value: stats.invoiceProjects.toString(),
      icon: <ReceiptOutlinedIcon />,
      bgColor: "#2196F3",
      filter: "invoice",
      path: "/projects",
      queryParams: { status: "Ready for invoicing" },
    },
    {
      title: "Outstanding Invoices",
      value: stats.outstandingInvoices.toString(),
      icon: <ReceiptOutlinedIcon />,
      bgColor: "#F44336",
      filter: "outstanding",
      path: "/invoices",
      queryParams: { status: "unpaid" },
    },
  ];

  const handleCardClick = (item) => {
    const queryParams = new URLSearchParams(item.queryParams).toString();
    navigate(`${item.path}?${queryParams}`);
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
      </Box>
      <Box
        mt="20px"
        display="grid"
        gridTemplateColumns="repeat(12, 1fr)"
        gridAutoRows="140px"
        gap="20px"
      >
        {gridItems.map((item, index) => (
          <Box
            gridColumn="span 3"
            gridRow="span 1"
            key={index}
            sx={{
              backgroundColor: item.bgColor,
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
