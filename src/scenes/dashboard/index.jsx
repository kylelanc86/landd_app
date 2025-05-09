import {
  Box,
  Typography,
  useTheme,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import RateReviewIcon from "@mui/icons-material/RateReview";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import AirOutlinedIcon from "@mui/icons-material/AirOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Mock data - replace with actual data from your backend
  const stats = {
    activeProjects: 12,
    reviewProjects: 5,
    invoiceProjects: 3,
    outstandingInvoices: 8,
  };

  // Update the grid items with distinct colors and navigation
  const gridItems = [
    {
      title: "Active Projects",
      value: "5",
      icon: <AssessmentIcon />,
      bgColor: theme.palette.primary[500],
      filter: "active",
    },
    {
      title: "Report Ready for Review",
      value: "7",
      icon: <MapOutlinedIcon />,
      bgColor: theme.palette.info[500],
      filter: "review",
    },
    {
      title: "Ready for Invoicing",
      value: "3",
      icon: <ReceiptOutlinedIcon />,
      bgColor: theme.palette.secondary[500],
      filter: "invoice",
    },
    {
      title: "Outstanding Invoices",
      value: "10",
      icon: <ReceiptOutlinedIcon />,
      bgColor: theme.palette.success[500],
      filter: "outstanding",
    },
  ];

  const handleCardClick = (filter) => {
    navigate(`/projects?filter=${filter}`);
  };

  const StatCard = ({ title, value, icon, bgColor, filter }) => (
    <Card
      onClick={() => handleCardClick(filter)}
      sx={{
        height: "200px",
        width: "100%",
        backgroundColor: bgColor,
        borderRadius: "10px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        transition: "all 0.2s ease-in-out",
        cursor: "pointer",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: "0 6px 12px rgba(0, 0, 0, 0.15)",
        },
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
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
              filter={item.filter}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
