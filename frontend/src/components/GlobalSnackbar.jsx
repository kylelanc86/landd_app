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
        top: "70px !important", // 50px topbar height + 20px margin
        left: "50% !important",
        transform: "translateX(-50%) !important",
        width: "auto",
        maxWidth: "400px",
        minWidth: "300px",
        pointerEvents: "none",
        "& .MuiAlert-root": {
          width: "100%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          margin: "0",
          pointerEvents: "auto",
          borderRadius: "8px",
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
            fontWeight: 500,
          },
          "& .MuiAlert-action": {
            alignItems: "center",
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
