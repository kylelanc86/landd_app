import React from "react";
import { Box, Typography, Breadcrumbs, Link } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import {
  CALIBRATION_TABS,
  getCalibrationsListPath,
} from "./calibrationsNavigationUtils";

export const CALIBRATION_PAGE_PADDING = { xs: 2, sm: 3, md: 4 };

const CalibrationPageHeader = ({
  title,
  breadcrumbCurrent,
  calibrationTab = CALIBRATION_TABS.INTERNAL,
  parents = [],
  action = null,
}) => {
  const navigate = useNavigate();
  const currentLabel = breadcrumbCurrent ?? title;

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        {title}
      </Typography>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
        flexWrap="wrap"
        gap={2}
      >
        <Breadcrumbs>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate("/records")}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Records Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate(getCalibrationsListPath(calibrationTab))}
            sx={{ cursor: "pointer" }}
          >
            Calibrations
          </Link>
          {parents.map((item) => (
            <Link
              key={item.label}
              component="button"
              variant="body1"
              onClick={item.onClick}
              sx={{ cursor: "pointer" }}
            >
              {item.label}
            </Link>
          ))}
          <Typography color="text.primary">{currentLabel}</Typography>
        </Breadcrumbs>
        {action}
      </Box>
    </>
  );
};

export default CalibrationPageHeader;
