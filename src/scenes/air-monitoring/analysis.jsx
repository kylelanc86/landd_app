import { Box, Typography, useTheme, Paper, Grid } from "@mui/material";

const AirMonitoringAnalysis = () => {
  const theme = useTheme();

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
        Air Monitoring Analysis
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
            <Typography
              variant="h6"
              sx={{ mb: 2, color: theme.palette.secondary[200] }}
            >
              Analysis Results
            </Typography>
            {/* Add your analysis content here */}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AirMonitoringAnalysis;
