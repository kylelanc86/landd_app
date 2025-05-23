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
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useTheme } from "@mui/material";
import { useAuth } from "../../context/AuthContext";

const Topbar = ({ toggleColorMode }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleSettingsClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleProfileClick = () => {
    navigate("/profile");
    handleClose();
  };

  return (
    <AppBar
      position="fixed"
      className="topbar"
      sx={{
        backgroundColor: theme.palette.background.paper,
        boxShadow: 1,
        width: "100%",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: "80px",
      }}
    >
      <Toolbar>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {currentUser?.email}
          </Typography>
          <Tooltip title="Toggle theme">
            <IconButton
              onClick={toggleColorMode}
              sx={{
                color: theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
              }}
            >
              {theme.palette.mode === "dark" ? (
                <LightModeIcon />
              ) : (
                <DarkModeIcon />
              )}
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
                  bgcolor: theme.palette.secondary.main,
                }}
              >
                <AccountCircleIcon />
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          onClick={handleClose}
        >
          <MenuItem onClick={handleProfileClick}>Profile</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
