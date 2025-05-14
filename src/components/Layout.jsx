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
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Top Navigation Bar */}
      <Topbar toggleColorMode={toggleColorMode} mode={mode} />

      {/* Sidebar */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        <Sidebar />
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          position: "fixed",
          top: "64px",
          left: { sm: "240px" },
          right: 0,
          bottom: 0,
          transition: "left 0.3s ease",
          "&.collapsed": {
            left: { sm: "80px" },
          },
          overflow: "auto",
          p: 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
