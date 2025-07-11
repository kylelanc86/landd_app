import React from "react";
import { Box } from "@mui/material";
import Topbar from "../scenes/global/Topbar";
import Sidebar from "../scenes/global/Sidebar";

const Layout = ({ children }) => {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: "232px",
          width: "calc(100% - 232px)",
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
          <Box sx={{ position: "relative", zIndex: 1 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
