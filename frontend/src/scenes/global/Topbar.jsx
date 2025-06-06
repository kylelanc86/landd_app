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
  Divider,
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
        backgroundColor:
          theme.palette.mode === "dark"
            ? theme.palette.background.dark
            : theme.palette.background.light,
        boxShadow: 1,
        width: "100%",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: "50px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Toolbar
        sx={{
          minHeight: "50px !important",
          height: "50px",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          width: "100%",
          justifyContent: "flex-end",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mr: 2 }}>
          <Typography
            variant="subtitle1"
            sx={{
              color: theme.palette.mode === "dark" ? "#ffffff" : "#1a1a1a",
              fontWeight: "medium",
            }}
          >
            {currentUser
              ? `${currentUser.firstName} ${currentUser.lastName}`
              : "Unknown User"}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
              textTransform: "capitalize",
            }}
          >
            {currentUser ? currentUser.role : "Guest"}
          </Typography>
        </Box>
        <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
