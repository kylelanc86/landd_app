import React, { useState } from "react";
import { Box } from "@mui/material";
import Topbar from "../scenes/global/Topbar";
import Sidebar from "../scenes/global/Sidebar";

const Layout = ({ children, toggleColorMode, mode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: isSidebarCollapsed ? "80px" : "240px",
          transition: "margin-left 0.3s ease",
          width: `calc(100% - ${isSidebarCollapsed ? "80px" : "240px"})`,
          minHeight: "100vh",
          backgroundColor: "background.default",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Topbar toggleColorMode={toggleColorMode} mode={mode} />
        <Box
          sx={{
            flex: 1,
            mt: "80px", // Match the Topbar height
            p: 3,
            overflow: "auto",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
