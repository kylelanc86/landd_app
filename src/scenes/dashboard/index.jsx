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

const Dashboard = () => {
  const theme = useTheme();

  // Mock data - replace with actual data from your backend
  const stats = {
    activeProjects: 12,
    reviewProjects: 5,
    invoiceProjects: 3,
    outstandingInvoices: 8,
  };

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
    <Box>
      <Typography
        variant="h4"
        sx={{ mb: 4, color: theme.palette.secondary[200] }}
      >
        Dashboard Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Projects"
            value={stats.activeProjects}
            icon={<AssignmentIcon />}
            color={theme.palette.primary[500]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Projects Under Review"
            value={stats.reviewProjects}
            icon={<RateReviewIcon />}
            color={theme.palette.secondary[500]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Projects Ready for Invoice"
            value={stats.invoiceProjects}
            icon={<AttachMoneyIcon />}
            color={theme.palette.success[500]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Outstanding Invoices"
            value={stats.outstandingInvoices}
            icon={<AttachMoneyIcon />}
            color={theme.palette.error[500]}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
