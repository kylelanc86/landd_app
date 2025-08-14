import React from "react";
import { Box, Typography, Chip } from "@mui/material";

export const JOB_STATUS = {
  // Active Jobs
  IN_PROGRESS: "In progress",
  REPORT_SENT_FOR_REVIEW: "Report sent for review",
  READY_FOR_INVOICING: "Ready for invoicing",
  INVOICE_SENT: "Invoice sent",

  // Inactive Jobs
  JOB_COMPLETE: "Job complete",
  ON_HOLD: "On hold",
  QUOTE_SENT: "Quote sent",
  CANCELLED: "Cancelled",
};

export const ACTIVE_STATUSES = [
  JOB_STATUS.IN_PROGRESS,
  JOB_STATUS.REPORT_SENT_FOR_REVIEW,
  JOB_STATUS.READY_FOR_INVOICING,
  JOB_STATUS.INVOICE_SENT,
];

export const INACTIVE_STATUSES = [
  JOB_STATUS.JOB_COMPLETE,
  JOB_STATUS.ON_HOLD,
  JOB_STATUS.QUOTE_SENT,
  JOB_STATUS.CANCELLED,
];

export const getStatusColor = (status) => {
  const statusColors = {
    [JOB_STATUS.IN_PROGRESS]: "#ff9800", // Orange
    [JOB_STATUS.REPORT_SENT_FOR_REVIEW]: "#9c27b0", // Purple
    [JOB_STATUS.READY_FOR_INVOICING]: "#795548", // Brown
    [JOB_STATUS.INVOICE_SENT]: "#607d8b", // Blue Grey
    [JOB_STATUS.JOB_COMPLETE]: "#4caf50", // Green
    [JOB_STATUS.ON_HOLD]: "#ff9800", // Orange
    [JOB_STATUS.QUOTE_SENT]: "#2196f3", // Blue
    [JOB_STATUS.CANCELLED]: "#f44336", // Red
  };
  return statusColors[status] || "#757575"; // Default grey
};

export const StatusChip = ({ status }) => {
  const color = getStatusColor(status);
  return (
    <Chip
      label={status}
      sx={{
        backgroundColor: color,
        color: "#fff",
        "&:hover": {
          backgroundColor: color,
          opacity: 0.9,
        },
      }}
    />
  );
};

export const UserAvatar = ({ user }) => {
  // Generate a consistent color based on the user's name
  const getInitials = (firstName, lastName) => {
    if (!firstName || !lastName) return "?";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getColorFromName = (firstName, lastName) => {
    if (!firstName || !lastName) return "#757575"; // Default grey for unknown users

    const colors = [
      "#f44336", // Red
      "#e91e63", // Pink
      "#9c27b0", // Purple
      "#673ab7", // Deep Purple
      "#3f51b5", // Indigo
      "#2196f3", // Blue
      "#03a9f4", // Light Blue
      "#00bcd4", // Cyan
      "#009688", // Teal
      "#4caf50", // Green
      "#8bc34a", // Light Green
      "#cddc39", // Lime
      "#ffc107", // Amber
      "#ff9800", // Orange
      "#ff5722", // Deep Orange
    ];

    const name = `${firstName}${lastName}`;
    const hash = name.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  // Ensure we have valid user data
  if (!user || !user.firstName || !user.lastName) {
    return (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          backgroundColor: "#757575",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.875rem",
          fontWeight: "bold",
        }}
        title="Unknown User"
      >
        ?
      </Box>
    );
  }

  const initials = getInitials(user.firstName, user.lastName);
  const backgroundColor = getColorFromName(user.firstName, user.lastName);

  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        backgroundColor,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.875rem",
        fontWeight: "bold",
        cursor: "pointer",
        "&:hover": {
          opacity: 0.9,
        },
      }}
      title={`${user.firstName} ${user.lastName}`}
    >
      {initials}
    </Box>
  );
};

export default {
  JOB_STATUS,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  getStatusColor,
  StatusChip,
  UserAvatar,
};
