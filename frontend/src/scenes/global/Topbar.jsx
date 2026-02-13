import React, { useState, useEffect } from "react";
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
  useMediaQuery,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import MenuIcon from "@mui/icons-material/Menu";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTheme } from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import MobileDrawer from "../../components/MobileDrawer";

const Topbar = () => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  // Detect tablet and mobile screens - show hamburger menu
  // iPads in landscape can be up to ~1366px wide (iPad Pro 12.9"), so we use 1280px breakpoint
  const isMobileOrTablet = useMediaQuery("(max-width: 1280px)");
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // true below 600px

  // Check if sidebar is collapsed
  useEffect(() => {
    const checkSidebarCollapsed = () => {
      const sidebar = document.querySelector(".pro-sidebar");
      setIsSidebarCollapsed(sidebar?.classList.contains("collapsed") || false);
    };

    // Check initially
    checkSidebarCollapsed();

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(checkSidebarCollapsed);
    const sidebar = document.querySelector(".pro-sidebar");
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, []);

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

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <AppBar
      position="fixed"
      className="topbar"
      sx={{
        background: `linear-gradient(to right, #045E1F, #96CC78) !important`,
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
        width: "100%",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: "50px",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #EEEEEE",
        "@media (max-width: 1280px)": {
          borderRadius: 0,
        },
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
          justifyContent: "space-between",
        }}
      >
        {/* Hamburger menu for tablets/mobile - far left */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isMobileOrTablet && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={(e) => {
                setMobileDrawerOpen((prev) => !prev);
                // Unfocus the button after toggling
                e.currentTarget.blur();
              }}
              sx={{
                color: "#FFF",
                ml: -1,
                mr: 1,
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {/* Logo text to the right of hamburger icon when sidebar is collapsed or on mobile/tablet */}
          {(isMobileOrTablet || isSidebarCollapsed) && (
            <Typography
              variant="h6"
              sx={{
                color: "#FFF",
                fontWeight: 600,
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
              }}
            >
              {isMobile ? "L&D CONSULTING" : "L&D CONSULTING"}
            </Typography>
          )}
        </Box>

        {/* User info on the right */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              display: { xs: "none", sm: "flex" },
              alignItems: "center",
              gap: 2,
              mr: 2,
            }}
          >
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
                display: { xs: "none", sm: "block" },
              }}
            >
              {currentUser
                ? currentUser.role === "super_admin"
                  ? "Super Admin"
                  : currentUser.role
                : "Guest"}
            </Typography>
          </Box>
          <Divider
            orientation="vertical"
            flexItem
            sx={{
              mx: 2,
              borderColor: "rgba(255,255,255,0.3)",
              display: { xs: "none", sm: "block" },
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  color: "#FFF",
                  display: { xs: "none", sm: "inline-flex" },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
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

      {/* Mobile Drawer */}
      {isMobileOrTablet && (
        <MobileDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        />
      )}
    </AppBar>
  );
};

export default Topbar;
