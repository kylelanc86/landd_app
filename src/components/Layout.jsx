import React, { useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material";
import Sidebar from "../scenes/global/Sidebar";
import Topbar from "../scenes/global/Topbar";

const Layout = ({ children, toggleColorMode, mode }) => {
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        className={isCollapsed ? "collapsed" : ""}
        sx={{
          position: "fixed",
          top: "64px",
          left: "240px",
          right: 0,
          bottom: 0,
          transition: "all 0.3s ease",
          "@media (max-width: 600px)": {
            left: 0,
          },
          "&.collapsed": {
            left: "80px",
            "@media (max-width: 600px)": {
              left: 0,
            },
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
