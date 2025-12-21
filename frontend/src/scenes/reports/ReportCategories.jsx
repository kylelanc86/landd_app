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
  Construction as AsbestosRemovalIcon,
  Science as FibreIcon,
} from "@mui/icons-material";
import { tokens } from "../../theme/tokens";

const categories = [
  {
    id: "asbestos-assessment",
    title: "Asbestos Assessment Reports",
    icon: AssessmentIcon,
    description: "View and manage asbestos assessment reports",
    color: "#e57373", // red-300
  },
  {
    id: "asbestos-removal-jobs",
    title: "Air Monitoring and Clearances",
    icon: AsbestosRemovalIcon,
    description: "Access air monitoring shifts and clearance reports for asbestos removal",
    color: "#ff9800", // orange-500
  },
  {
    id: "fibre-id",
    title: "Fibre ID & FIbre Count Reports",
    icon: FibreIcon,
    description: "Access fibre identification and fibre count reports",
    color: "#ba68c8", // purple-300
  },
];

const ReportCategories = ({
  onCategorySelect,
  selectedProjectId,
  availableCategories = [],
}) => {
  const theme = useTheme();

  // Filter categories to only show those with available reports
  const filteredCategories = categories.filter((category) =>
    availableCategories.includes(category.id)
  );

  return (
    <Grid container spacing={3}>
      {filteredCategories.map((category) => (
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
            ></Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default ReportCategories;
