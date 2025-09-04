import React from "react";
import { Snackbar, Alert } from "@mui/material";
import { createPortal } from "react-dom";

const GlobalSnackbar = ({ open, message, severity, onClose }) => {
  return createPortal(
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        position: "fixed",
        zIndex: 9999999,
        bottom: "20px !important",
        right: "20px !important",
        left: "252px !important", // 232px sidebar width + 20px margin
        transform: "none !important",
        width: "auto",
        maxWidth: "400px",
        pointerEvents: "none",
        "& .MuiAlert-root": {
          width: "100%",
          minWidth: "300px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          margin: "0",
          pointerEvents: "auto",
        },
      }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        sx={{
          width: "100%",
          position: "relative",
          zIndex: 9999999,
          "& .MuiAlert-message": {
            width: "100%",
            textAlign: "left",
          },
        }}
      >
        {message}
      </Alert>
    </Snackbar>,
    document.body
  );
};

export default GlobalSnackbar;
