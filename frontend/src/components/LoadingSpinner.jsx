import { Box, CircularProgress } from "@mui/material";

const LoadingSpinner = () => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <CircularProgress
        sx={{
          color: "#4CAF50", // Green color for consistency
        }}
      />
    </Box>
  );
};

export default LoadingSpinner;
