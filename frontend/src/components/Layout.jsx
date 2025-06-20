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
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "url('/layout-back.bmp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
            zIndex: 0,
          },
        }}
      >
        <Topbar toggleColorMode={toggleColorMode} mode={mode} />
        <Box
          sx={{
            flex: 1,
            mt: "30px", // Match the Topbar height
            p: 3,
            overflow: "auto",
            position: "relative",
            zIndex: 1,
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.3)", // Semi-transparent overlay for better readability
              zIndex: 0,
            },
          }}
        >
          <Box sx={{ position: "relative", zIndex: 1 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
