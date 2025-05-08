import {
  Box,
  Typography,
  useTheme,
  Grid,
  Card,
  CardContent,
  Paper,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import RateReviewIcon from "@mui/icons-material/RateReview";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import AirOutlinedIcon from "@mui/icons-material/AirOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";

const Dashboard = () => {
  const theme = useTheme();

  // Mock data - replace with actual data from your backend
  const stats = {
    activeProjects: 12,
    reviewProjects: 5,
    invoiceProjects: 3,
    outstandingInvoices: 8,
  };

  // Update the grid boxes to display the new metrics
  const gridItems = [
    {
      title: "Active Air Monitoring Shifts",
      value: "5", // Replace with actual data
      icon: <AirOutlinedIcon />,
    },
    {
      title: "Asbestos Assessment Reports Ready for Review",
      value: "3", // Replace with actual data
      icon: <AssessmentIcon />,
    },
    {
      title: "Outstanding Invoices",
      value: "10", // Replace with actual data
      icon: <ReceiptOutlinedIcon />,
    },
    {
      title: "Projects Ready for Invoicing",
      value: "7", // Replace with actual data
      icon: <MapOutlinedIcon />,
    },
  ];

  const StatCard = ({ title, value, icon, color }) => (
    <Card
      sx={{
        height: "100%",
        backgroundColor: theme.palette.background.paper,
        borderRadius: "10px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        transition: "transform 0.2s ease-in-out",
        "&:hover": {
          transform: "translateY(-5px)",
        },
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
              backgroundColor: `${color}20`,
              borderRadius: "8px",
              p: 1,
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="h4"
            sx={{
              color: theme.palette.secondary[200],
              fontWeight: "bold",
            }}
          >
            {value}
          </Typography>
        </Box>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.grey[100],
            fontSize: "0.9rem",
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
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper
              sx={{
                p: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              {item.icon}
              <Typography variant="h6" sx={{ mt: 2 }}>
                {item.title}
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {item.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
