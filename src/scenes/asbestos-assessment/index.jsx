import { Box, Typography, useTheme } from "@mui/material";

const AsbestosAssessment = () => {
  const theme = useTheme();

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{ mb: 4, color: theme.palette.secondary[200] }}
      >
        Asbestos Assessment
      </Typography>
      {/* Add your asbestos assessment content here */}
    </Box>
  );
};

export default AsbestosAssessment;
