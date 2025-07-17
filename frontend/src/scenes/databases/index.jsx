import React, { useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";

// Import components for inline display
import Clients from "../clients";
import Projects from "../projects";
import Invoices from "../invoices";

const DatabaseWidget = ({
  title,
  icon,
  onClick,
  color = "primary",
  isActive = false,
}) => (
  <Card
    sx={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      transition: "all 0.3s ease",
      backgroundColor: isActive ? `${color}.light` : "background.paper",
      border: isActive ? `3px solid ${color}.main` : "2px solid transparent",
      boxShadow: isActive
        ? `0 6px 20px ${color}.main`
        : "0 2px 8px rgba(0, 0, 0, 0.1)",
      "&:hover": {
        transform: isActive ? "none" : "translateY(-4px)",
        boxShadow: isActive ? `0 6px 20px ${color}.main` : 4,
      },
    }}
  >
    <CardActionArea
      onClick={onClick}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: "center", p: 3 }}>
        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
          {React.cloneElement(icon, {
            sx: {
              fontSize: 30,
              color: isActive ? `${color}.dark` : `${color}.main`,
            },
          })}
        </Box>
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{
            color: isActive ? `${color}.dark` : "text.primary",
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {title}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const Databases = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get the database type from URL parameters, default to "projects"
  const urlParams = new URLSearchParams(location.search);
  const urlDatabase = urlParams.get("db");
  const initialDatabase = urlDatabase || "projects";

  const [selectedDatabase, setSelectedDatabase] = useState(initialDatabase);

  const handleDatabaseChange = (database) => {
    setSelectedDatabase(database);
    // Update URL without reloading the page
    const newUrl = `/databases?db=${database}`;
    navigate(newUrl, { replace: true });
  };

  const databaseWidgets = [
    {
      title: "Project Database",
      icon: <AssignmentIcon />,
      color: "primary",
      onClick: () => handleDatabaseChange("projects"),
    },
    {
      title: "Client Database",
      icon: <PeopleIcon />,
      color: "primary",
      onClick: () => handleDatabaseChange("clients"),
    },
    {
      title: "Invoice Database",
      icon: <ReceiptOutlinedIcon />,
      color: "primary",
      onClick: () => handleDatabaseChange("invoices"),
    },
  ];

  const renderSelectedContent = () => {
    // Get additional filters from URL parameters
    const statusFilter = urlParams.get('status');
    const departmentFilter = urlParams.get('department');
    const searchFilter = urlParams.get('search');
    
    const filters = {
      status: statusFilter,
      department: departmentFilter,
      search: searchFilter
    };

    switch (selectedDatabase) {
      case "projects":
        return <Projects initialFilters={filters} />;
      case "clients":
        return <Clients />;
      case "invoices":
        return <Invoices />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Widgets Section */}
      <Box
        sx={{
          backgroundColor: "background.paper",
          borderRadius: "8px",
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
          p: 3,
          mb: 3,
        }}
      >
        <Grid container spacing={3}>
          {databaseWidgets.map((widget, index) => {
            // Convert widget title to match selectedDatabase format
            let widgetKey = widget.title.toLowerCase().replace(" database", "");
            // Handle the "project" vs "projects" mismatch
            if (widgetKey === "project") widgetKey = "projects";
            if (widgetKey === "client") widgetKey = "clients";
            if (widgetKey === "invoice") widgetKey = "invoices";

            const isActive = selectedDatabase === widgetKey;

            console.log(
              `Widget: ${widget.title}, Key: ${widgetKey}, Selected: ${selectedDatabase}, Active: ${isActive}`
            );

            return (
              <Grid item xs={12} md={4} key={index}>
                <DatabaseWidget {...widget} isActive={isActive} />
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Table Section */}
      {selectedDatabase && (
        <Box
          sx={{
            backgroundColor: "background.paper",
            borderRadius: "8px",
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
            p: 3,
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            gutterBottom
            sx={{ mb: 3 }}
          ></Typography>
          {renderSelectedContent()}
        </Box>
      )}
    </Box>
  );
};

export default Databases;
