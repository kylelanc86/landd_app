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
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useTheme } from "@mui/material";
import { useAuth } from "../../context/AuthContext";

const Topbar = () => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleProfileClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleProfileSettingsClick = () => {
    navigate("/profile");
    handleClose();
  };

  const handleUserManualClick = () => {
    navigate("/user-manual");
    handleClose();
  };

  return (
    <AppBar
      position="fixed"
      className="topbar"
      sx={{
        backgroundColor: `${theme.palette.primary.main} !important`, // Force green background
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
        width: "100%",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: "50px",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #EEEEEE",
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
              color: "#FFFFFF", // White text for user name
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
              fontStyle: "bold",
              color: "black",
              textTransform: "capitalize",
            }}
          >
            {currentUser ? currentUser.role : "Guest"}
          </Typography>
        </Box>
        <Divider
          orientation="vertical"
          flexItem
          sx={{ mx: 2, borderColor: "rgba(255,255,255,0.3)" }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Tooltip title="Profile">
            <IconButton onClick={handleProfileClick} sx={{ color: "#FFF" }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: "#FFF0", // Transparent so icon color shows
                  color: "#FFF", // White icon
                  border: `2px solid ${theme.palette.primary.light}`,
                }}
              >
                <AccountCircleIcon
                  sx={{ color: "#FFF", width: 28, height: 28 }}
                />
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
          <MenuItem onClick={handleProfileSettingsClick}>Profile</MenuItem>
          <MenuItem onClick={handleUserManualClick}>User Manual</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
