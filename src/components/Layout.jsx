import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material";
import Sidebar from "../scenes/global/Sidebar";
import Topbar from "../scenes/global/Topbar";

const Layout = ({ children, toggleColorMode, mode }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Top Navigation Bar */}
      <Topbar toggleColorMode={toggleColorMode} mode={mode} />

      {/* Main Content */}
      <Box
        component="main"
        className="main-content"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
