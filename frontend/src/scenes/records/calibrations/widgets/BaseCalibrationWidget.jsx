import React from "react";
import {
  Box,
  Typography,
  useTheme,
  Button,
  Card,
  CardActionArea,
  CardContent,
  useMediaQuery,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../../../utils/dateFormat";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

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
  hideNextCalibrationDue = false,
  viewCalibrationsPath,
  icon,
  color = "#1976d2",
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: isTablet ? "280px" : "320px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        borderRadius: "16px",
        boxShadow:
          "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.05)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow:
            "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        },
      }}
    >
      <CardActionArea
        onClick={() => navigate(viewCalibrationsPath)}
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <Box
          component="div"
          sx={{
            height: isTablet ? 140 : 180,
            background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
            borderBottom: `2px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            padding: isTablet ? "20px" : "24px",
            transition: "all 0.3s ease-in-out",
            "&:hover": {
              background: `linear-gradient(135deg, ${color}20 0%, ${color}12 100%)`,
              borderBottom: `2px solid ${color}40`,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: isTablet ? 80 : 100,
              height: isTablet ? 80 : 100,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
              border: `2px solid ${color}30`,
              boxShadow: `0 4px 20px ${color}20, 0 2px 8px ${color}15`,
              transition: "all 0.3s ease-in-out",
            }}
          >
            {icon && (
              <img
                src={icon}
                alt={`${title} icon`}
                style={{
                  width: isTablet ? "48px" : "60px",
                  height: isTablet ? "48px" : "60px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                }}
              />
            )}
          </Box>
        </Box>
        <CardContent
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            padding: isTablet ? "16px" : "20px",
            "&:last-child": {
              paddingBottom: isTablet ? "16px" : "20px",
            },
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            gutterBottom
            sx={{
              fontSize: isTablet ? "1.25rem" : "1.5rem",
              marginBottom: isTablet ? "10px" : "12px",
              fontWeight: 600,
              color: "#1a1a1a",
              lineHeight: 1.3,
            }}
          >
            {title}
          </Typography>
          {!hideNextCalibrationDue && (
            <Box mb={2}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: isTablet ? "0.875rem" : "0.9375rem",
                  lineHeight: 1.6,
                }}
              >
                Next Calibration Due:{" "}
                {nextCalibrationDue
                  ? formatDate(nextCalibrationDue)
                  : "Not scheduled"}
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: isTablet ? "8px" : "12px",
              borderTop: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: isTablet ? "0.8125rem" : "0.875rem",
                color: color,
                transition: "all 0.2s ease-in-out",
              }}
            >
              View Calibrations
            </Typography>
            <ArrowForwardIcon
              sx={{
                fontSize: isTablet ? "18px" : "20px",
                color: color,
                transition: "transform 0.2s ease-in-out",
              }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
      {children}
    </Card>
  );
};

export default BaseCalibrationWidget;
