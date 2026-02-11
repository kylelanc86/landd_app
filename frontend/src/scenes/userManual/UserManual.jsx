import React, { useState, useEffect } from "react";
import { Box, Paper, Container, CircularProgress, Alert } from "@mui/material";
import { useTheme } from "@mui/material";
import { useAuth } from "../../context/AuthContext";

const UserManual = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [manualContent, setManualContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadManual = async () => {
      try {
        setLoading(true);
        const response = await fetch("/Air_Monitoring_User_Manual.html");
        if (!response.ok) {
          throw new Error(
            `Failed to load user manual: ${response.status} ${response.statusText}`
          );
        }
        let htmlContent = await response.text();

        // Check if user is admin or manager
        const isAdminOrManager =
          currentUser &&
          (currentUser.role === "admin" ||
            currentUser.role === "super_admin" ||
            currentUser.role === "manager");

        if (!isAdminOrManager) {
          // Remove sections 7 and 8 for non-admin/manager users
          console.log("Filtering admin sections for employee user");
          htmlContent = filterAdminSections(htmlContent);
        } else {
          console.log("Showing full manual for admin/manager user");
        }

        setManualContent(htmlContent);
      } catch (err) {
        console.error("Error loading manual:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadManual();
  }, [currentUser]);

  const filterAdminSections = (htmlContent) => {
    try {
      console.log("Starting to filter admin sections...");
      let filteredContent = htmlContent;

      // Remove navigation items for sections 7 and 8
      // More specific pattern for the admin navigation with subsections
      filteredContent = filteredContent.replace(
        /<li>\s*<a href="#admin">7\. Admin Panel<\/a>\s*<ul>[\s\S]*?<\/ul>\s*<\/li>/g,
        ""
      );
      filteredContent = filteredContent.replace(
        /<li><a href="#permissions">8\. Permissions & Access Control<\/a><\/li>/g,
        ""
      );

      console.log("Removed navigation items");

      // Find the start and end of admin section more precisely
      const adminStart = filteredContent.indexOf('<section id="admin">');
      const permissionsStart = filteredContent.indexOf(
        '<section id="permissions">'
      );

      if (adminStart !== -1 && permissionsStart !== -1) {
        // Remove everything from admin section start to permissions section start
        filteredContent =
          filteredContent.substring(0, adminStart) +
          filteredContent.substring(permissionsStart);
        console.log("Removed admin section (including all subsections)");
      }

      // Now remove the permissions section
      const permissionsEnd =
        filteredContent.indexOf(
          "</section>",
          filteredContent.indexOf('<section id="permissions">')
        ) + 10;
      const troubleshootingStart = filteredContent.indexOf(
        '<section id="troubleshooting">'
      );

      if (permissionsEnd !== -1 && troubleshootingStart !== -1) {
        // Remove everything from permissions section start to troubleshooting section start
        filteredContent =
          filteredContent.substring(
            0,
            filteredContent.indexOf('<section id="permissions">')
          ) + filteredContent.substring(troubleshootingStart);
        console.log("Removed permissions section");
      }

      // Update section numbers - change troubleshooting from 9 to 7
      filteredContent = filteredContent.replace(
        /9\. 🔧 Troubleshooting/g,
        "7. 🔧 Troubleshooting"
      );
      filteredContent = filteredContent.replace(
        /9\. Troubleshooting/g,
        "7. Troubleshooting"
      );

      console.log("Updated section numbers");

      return filteredContent;
    } catch (error) {
      console.error("Error filtering admin sections:", error);
      return htmlContent; // Return original content if filtering fails
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">Failed to load user manual: {error}</Alert>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
        py: 3,
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={3}
          sx={{
            p: 0,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              "& h1": {
                color: theme.palette.primary.main,
                textAlign: "center",
                borderBottom: `3px solid ${theme.palette.primary.main}`,
                paddingBottom: 2,
                marginBottom: 4,
              },
              "& h2": {
                color: theme.palette.secondary.main,
                borderLeft: `4px solid ${theme.palette.secondary.main}`,
                paddingLeft: 2,
                marginTop: 4,
              },
              "& h3": {
                color: theme.palette.warning.main,
                marginTop: 3,
              },
              "& h4": {
                color: theme.palette.info.main,
                marginTop: 2,
              },
              "& .nav-menu": {
                backgroundColor: theme.palette.grey[50],
                padding: 3,
                borderRadius: 2,
                marginBottom: 4,
              },
              "& .nav-menu ul": {
                listStyle: "none",
                padding: 0,
                margin: 0,
              },
              "& .nav-menu li": {
                marginBottom: 1,
              },
              "& .nav-menu a": {
                color: theme.palette.primary.main,
                textDecoration: "none",
                "&:hover": {
                  textDecoration: "underline",
                },
              },
              "& .nav-menu ul ul": {
                marginLeft: 2,
                marginTop: 0.5,
              },
              "& .nav-menu ul ul a": {
                fontSize: "0.9em",
                color: theme.palette.text.secondary,
              },
              "& p": {
                marginBottom: 2,
                lineHeight: 1.6,
              },
              "& ul, & ol": {
                marginBottom: 2,
                paddingLeft: 3,
              },
              "& li": {
                marginBottom: 0.5,
              },
              "& table": {
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: 2,
              },
              "& th, & td": {
                border: `1px solid ${theme.palette.divider}`,
                padding: 1,
                textAlign: "left",
              },
              "& th": {
                backgroundColor: theme.palette.grey[100],
                fontWeight: "bold",
              },
              "& .highlight": {
                backgroundColor: theme.palette.warning.light,
                padding: 1,
                borderRadius: 1,
                marginBottom: 2,
              },
              "& .info-box": {
                backgroundColor: theme.palette.info.light,
                padding: 2,
                borderRadius: 1,
                marginBottom: 2,
                borderLeft: `4px solid ${theme.palette.info.main}`,
              },
              "& .warning-box": {
                backgroundColor: theme.palette.warning.light,
                padding: 2,
                borderRadius: 1,
                marginBottom: 2,
                borderLeft: `4px solid ${theme.palette.warning.main}`,
              },
              "& .success-box": {
                backgroundColor: theme.palette.success.light,
                padding: 2,
                borderRadius: 1,
                marginBottom: 2,
                borderLeft: `4px solid ${theme.palette.success.main}`,
              },
            }}
            dangerouslySetInnerHTML={{ __html: manualContent }}
          />
        </Paper>
      </Container>
    </Box>
  );
};

export default UserManual;
