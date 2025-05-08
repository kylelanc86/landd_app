import { Box, Typography, useTheme, Paper, Grid, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";

const AirMonitoringSampleList = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography
        variant="h4"
        sx={{
          mb: 4,
          color: theme.palette.secondary[200],
          fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
        }}
      >
        Air Monitoring Sample List
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              borderRadius: "8px",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography
                variant="h6"
                sx={{ color: theme.palette.secondary[200] }}
              >
                Sample List
              </Typography>
              <Button
                variant="contained"
                startIcon={<AssessmentIcon />}
                onClick={() => navigate("/air-monitoring/analysis")}
                sx={{
                  py: 1,
                  backgroundColor: theme.palette.primary[500],
                  "&:hover": {
                    backgroundColor: theme.palette.primary[600],
                  },
                }}
              >
                View Analysis
              </Button>
            </Box>
            {/* Add your sample list content here */}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AirMonitoringSampleList;
