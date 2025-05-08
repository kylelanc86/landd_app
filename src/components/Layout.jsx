import React, { useState } from "react";
import {
  Box,
  IconButton,
  Toolbar,
  AppBar,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useTheme } from "@mui/material";
import Sidebar from "./Sidebar";

const Layout = ({ children, toggleColorMode, mode }) => {
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const navigate = useNavigate();

  const handleSettingsClick = (event) => setAnchorEl(event.currentTarget);
  const handleProfileClick = (event) => setProfileAnchorEl(event.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
    setProfileAnchorEl(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: isCollapsed ? "80px" : "250px",
          flexShrink: 0,
          transition: "width 0.3s ease",
          backgroundColor: theme.palette.primary[500],
          height: "100%",
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1500,
        }}
      >
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </Box>

      {/* Top Navigation Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: 1400,
          backgroundColor: theme.palette.background.paper,
          boxShadow: 1,
          width: "100%",
          left: 0,
          top: 0,
        }}
      >
        <Toolbar>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Tooltip title="Toggle theme">
              <IconButton onClick={toggleColorMode} color="inherit">
                {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={handleSettingsClick} color="inherit">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Profile">
              <IconButton onClick={handleProfileClick} color="inherit">
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: theme.palette.secondary[200],
                  }}
                >
                  <AccountCircleIcon />
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Settings Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        sx={{ zIndex: 1400 }}
      >
        <MenuItem onClick={handleClose}>General Settings</MenuItem>
        <MenuItem onClick={handleClose}>Notifications</MenuItem>
        <MenuItem onClick={handleClose}>Privacy</MenuItem>
        <MenuItem onClick={handleClose}>Help & Support</MenuItem>
      </Menu>

      {/* Profile Menu */}
      <Menu
        anchorEl={profileAnchorEl}
        open={Boolean(profileAnchorEl)}
        onClose={handleClose}
        sx={{ zIndex: 1400 }}
      >
        <MenuItem onClick={handleClose}>My Profile</MenuItem>
        <MenuItem onClick={handleClose}>Account Settings</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
      </Menu>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${isCollapsed ? 80 : 250}px)` },
          ml: { sm: `${isCollapsed ? 80 : 250}px` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
