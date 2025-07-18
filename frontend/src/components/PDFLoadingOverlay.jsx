import React from "react";
import {
  Box,
  CircularProgress,
  Typography,
  Paper,
  Backdrop,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

const PDFLoadingOverlay = ({ open, message = "Generating PDF..." }) => {
  console.log("PDFLoadingOverlay render - open:", open, "message:", message);

  return (
    <Backdrop
      sx={{
        color: "#fff",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
      }}
      open={open}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          minWidth: 300,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 1,
          }}
        >
          <PictureAsPdfIcon
            sx={{
              fontSize: 40,
              color: "#d32f2f",
              animation: "pulse 2s infinite",
            }}
          />
          <CircularProgress size={40} thickness={4} sx={{ color: "#1976d2" }} />
        </Box>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: "#333",
            textAlign: "center",
          }}
        >
          {message}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: "#666",
            textAlign: "center",
            maxWidth: 250,
          }}
        >
          This may take a few moments. Please don't close this window.
        </Typography>
      </Paper>

      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </Backdrop>
  );
};

export default PDFLoadingOverlay;
