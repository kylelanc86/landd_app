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
import { useNotificationCentre } from "../../context/NotificationCentreContext";
import MobileDrawer from "../../components/MobileDrawer";

const Topbar = () => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { urgentCount: notificationBadgeCount } = useNotificationCentre();

  // Detect tablet and mobile screens - show hamburger menu
  // iPads in landscape can be up to ~1366px wide (iPad Pro 12.9"), so we use 1280px breakpoint
  const isMobileOrTablet = useMediaQuery("(max-width: 1280px)");
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // true below 900px (layout breakpoint)
  const showTopbarNotificationBadge =
    isMobileOrTablet && notificationBadgeCount > 0;

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
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 2,
              mr: showTopbarNotificationBadge ? 0 : 2,
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
                display: { xs: "none", md: "block" },
              }}
            >
              {currentUser
                ? currentUser.role === "super_admin"
                  ? "Super Admin"
                  : currentUser.role
                : "Guest"}
            </Typography>
          </Box>
          {showTopbarNotificationBadge && (
            <Tooltip title="Notification Centre">
              <Box
                component="button"
                type="button"
                aria-label={`${notificationBadgeCount} urgent notifications`}
                onClick={() => navigate("/notifications")}
                sx={{
                  minWidth: "22px",
                  height: "22px",
                  borderRadius: "11px",
                  backgroundColor: "#d32f2f",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  px: 0.75,
                  ml: { xs: 0, md: 1 },
                  mr: { xs: 0, md: 1 },
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1,
                  fontFamily: "inherit",
                  "&:hover": {
                    backgroundColor: "#b71c1c",
                  },
                }}
              >
                {notificationBadgeCount > 99 ? "99+" : notificationBadgeCount}
              </Box>
            </Tooltip>
          )}
          <Divider
            orientation="vertical"
            flexItem
            sx={{
              mx: 2,
              borderColor: "rgba(255,255,255,0.3)",
              display: { xs: "none", md: "block" },
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  color: "#FFF",
                  display: { xs: "none", md: "inline-flex" },
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
