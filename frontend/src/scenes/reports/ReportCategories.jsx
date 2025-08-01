import React from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import {
  Assessment as AssessmentIcon,
  AirOutlined as AirIcon,
  CheckCircleOutline as ClearanceIcon,
  Science as FibreIcon,
  Receipt as InvoiceIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { tokens } from "../../theme";

const categories = [
  {
    id: "asbestos-assessment",
    title: "Asbestos Assessment Reports",
    icon: AssessmentIcon,
    description: "View and manage asbestos assessment reports",
    color: "#e57373", // red-300
  },
  {
    id: "air-monitoring",
    title: "Air Monitoring Reports",
    icon: AirIcon,
    description: "Access air monitoring shift reports",
    color: "#4fc3f7", // light-blue-300
  },
  {
    id: "clearance",
    title: "Clearance Reports",
    icon: ClearanceIcon,
    description: "View asbestos clearance certificates",
    color: "#81c784", // green-300
  },
  {
    id: "fibre-id",
    title: "Fibre ID Reports",
    icon: FibreIcon,
    description: "Access fibre identification reports",
    color: "#ba68c8", // purple-300
  },
  {
    id: "invoices",
    title: "Invoices",
    icon: InvoiceIcon,
    description: "View and download project invoices",
    color: "#ff8a65", // deep-orange-300
  },
];

const ReportCategories = ({ onCategorySelect, selectedProjectId }) => {
  const theme = useTheme();
  const colors = tokens;

  return (
    <Grid container spacing={3}>
      {categories.map((category) => (
        <Grid item xs={12} sm={6} md={4} key={category.id}>
          <Card
            onClick={() => onCategorySelect(category.id)}
            sx={{
              cursor: "pointer",
              height: "100%",
              position: "relative",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: theme.shadows[4],
                "& .category-arrow": {
                  opacity: 1,
                  transform: "translateX(0)",
                },
              },
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    backgroundColor: category.color + "20", // Add transparency
                    borderRadius: "50%",
                    p: 1,
                    mr: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {React.createElement(category.icon, {
                    sx: { fontSize: 32, color: category.color },
                  })}
                </Box>
                <Typography variant="h6" component="h3">
                  {category.title}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            </CardContent>
            <Box
              className="category-arrow"
              sx={{
                position: "absolute",
                right: -20,
                top: "50%",
                transform: "translateX(-20px)",
                opacity: 0,
                transition: "all 0.3s ease",
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                zIndex: 1,
              }}
            >
              <ArrowForwardIcon
                sx={{
                  fontSize: 30,
                  color: category.color,
                  filter: "drop-shadow(2px 2px 2px rgba(0,0,0,0.2))",
                }}
              />
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default ReportCategories;
