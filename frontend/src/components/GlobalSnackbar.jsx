import React from "react";
import { Snackbar, Alert } from "@mui/material";
import { createPortal } from "react-dom";

const GlobalSnackbar = ({ open, message, severity, onClose }) => {
  return createPortal(
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      sx={{
        position: "fixed",
        zIndex: 9999999,
        top: "0 !important",
        left: "50% !important",
        transform: "translateX(-50%) !important",
        width: "100%",
        maxWidth: "600px",
        pointerEvents: "none",
        "& .MuiAlert-root": {
          width: "100%",
          minWidth: "300px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          margin: "10px",
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
            textAlign: "center",
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
