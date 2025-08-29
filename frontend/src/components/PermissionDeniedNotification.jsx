import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from "@mui/material";
import {
  Security as SecurityIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

const PermissionDeniedNotification = ({
  open,
  onClose,
  requiredPermissions = [],
  userRole = "employee",
  userPermissions = [],
  action = "perform this action",
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        "& .MuiDialog-paper": {
          border: "none",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          borderRadius: 2,
        },
        "& .MuiDialogTitle-root": {
          borderBottom: "none",
        },
        "& .MuiDialogContent-root": {
          borderTop: "none",
          borderBottom: "none",
        },
        "& .MuiDialogActions-root": {
          borderTop: "none",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 2,
        }}
      >
        <SecurityIcon color="warning" sx={{ fontSize: 28 }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: "bold" }}>
          Permission Denied
        </Typography>
        <IconButton onClick={onClose} sx={{ ml: "auto" }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Typography variant="body1" sx={{ color: "text.primary" }}>
          You don't have permission to {action}.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="contained" onClick={onClose} sx={{ minWidth: 120 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PermissionDeniedNotification;
