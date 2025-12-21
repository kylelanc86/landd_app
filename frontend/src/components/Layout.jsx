import React from "react";
import { Box, useMediaQuery } from "@mui/material";
import Topbar from "../scenes/global/Topbar";
import Sidebar from "../scenes/global/Sidebar";
import PermissionDeniedNotification from "./PermissionDeniedNotification";
import { usePermissionDenied } from "../context/PermissionDeniedContext";

const Layout = ({ children }) => {
  const { permissionDenied, hidePermissionDenied } = usePermissionDenied();

  // Detect tablet and mobile screens - sidebar is hidden, so no margin needed
  // iPads in landscape can be up to ~1366px wide (iPad Pro 12.9"), so we use 1280px breakpoint
  const isMobileOrTablet = useMediaQuery("(max-width: 1280px)");

  // When sidebar is hidden on tablet/mobile, no margin needed
  // Otherwise, sidebar is 242px wide, use 232px margin for padding
  const sidebarMargin = isMobileOrTablet ? 0 : 232;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${sidebarMargin}px`,
          width: `calc(100% - ${sidebarMargin}px)`,
          minHeight: "100vh",
          backgroundColor: "#FAFAFA",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <Topbar />
        <Box
          sx={{
            flex: 1,
            mt: "23px", // Reduced from 30px to 23px to match 73px total height
            p: 3,
            overflow: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Permission Denied Modal */}
          <PermissionDeniedNotification
            open={permissionDenied.open}
            onClose={hidePermissionDenied}
            requiredPermissions={permissionDenied.requiredPermissions}
            userRole={permissionDenied.userRole}
            userPermissions={permissionDenied.userPermissions}
            action={permissionDenied.action}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
