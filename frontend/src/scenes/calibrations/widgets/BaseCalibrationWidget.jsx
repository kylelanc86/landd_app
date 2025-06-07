import React from "react";
import { Box, Typography, useTheme, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const BaseCalibrationWidget = ({
  title,
  children,
  onAdd,
  onEdit,
  onDelete,
  lastCalibration,
  nextCalibration,
  addButtonText = "Add Calibration",
  nextCalibrationDue,
  viewCalibrationsPath,
  icon,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        p: 3,
        borderRadius: 2,
        boxShadow: 1,
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box display="flex" alignItems="center" gap={2}>
          {icon && (
            <img
              src={icon}
              alt={`${title} icon`}
              style={{
                width: "32px",
                height: "32px",
                objectFit: "contain",
              }}
            />
          )}
          <Typography
            variant="h5"
            color={theme.palette.text.primary}
            fontWeight="bold"
          >
            {title}
          </Typography>
        </Box>
      </Box>

      <Box mb={2}>
        <Typography variant="body2" color={theme.palette.text.secondary}>
          Last Calibration: {lastCalibration || "Not calibrated"}
        </Typography>
        <Typography variant="body2" color={theme.palette.text.secondary}>
          Next Calibration Due: {nextCalibrationDue || "Not scheduled"}
        </Typography>
      </Box>

      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={() => navigate(viewCalibrationsPath)}
        sx={{
          textTransform: "none",
          py: 1,
        }}
      >
        View Calibrations
      </Button>

      {children}
    </Box>
  );
};

export default BaseCalibrationWidget;
