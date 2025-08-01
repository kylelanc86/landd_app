import React, { useEffect } from "react";
import "react-pro-sidebar/dist/css/styles.css";
import { ProSidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Box, Typography, useTheme, Divider } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ScienceIcon from "@mui/icons-material/Science";
import HomeIcon from "@mui/icons-material/Home";
import StorageIcon from "@mui/icons-material/Storage";
import MonitorIcon from "@mui/icons-material/Monitor";
import DescriptionIcon from "@mui/icons-material/Description";
import ConstructionIcon from "@mui/icons-material/Construction";
import SearchIcon from '@mui/icons-material/Search';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";

const getRandomColor = (user) => {
  const colors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFD93D", // golden yellow
    "#FF8B94", // soft pink
    "#6C5CE7", // purple
    "#00B894", // mint green
    "#FDCB6E", // amber
    "#E17055", // terracotta
    "#0984E3", // ocean blue
    "#6C5CE7", // royal purple
    "#00B894", // emerald
    "#FDCB6E", // marigold
    "#E17055", // rust
    "#00CEC9", // teal
    "#FF7675", // salmon
    "#74B9FF", // light blue
    "#A29BFE", // lavender
    "#55EFC4", // mint
  ];

  let identifier = "";
  if (user.firstName && user.lastName) {
    identifier = `${user.firstName} ${user.lastName}`;
  } else if (user.name) {
    identifier = user.name;
  } else if (user._id) {
    identifier = user._id;
  } else {
    identifier = Math.random().toString();
  }

  const hash = identifier.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const Item = ({ title, to, icon }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive =
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  // Handle navigation with refresh
  const handleNavigation = () => {
    // If we're already on the exact same page, force a refresh
    if (location.pathname === to) {
      window.location.reload();
    } else {
      // Navigate to the new page
      navigate(to);
    }
  };

  const menuItemContent = (
    <Box
      onClick={handleNavigation}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        color: isActive ? "#000000" : tokens.grey[600],
        backgroundColor: isActive ? tokens.primary[50] : "transparent",
        borderRadius: "4px",
        margin: "1px 8px",
        padding: "12px 10px",
        cursor: "pointer",
        transition: "background-color 0.2s",
        "&:hover": {
          backgroundColor: isActive ? tokens.primary[100] : tokens.grey[50],
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minWidth: "24px",
          marginRight: "8px",
        }}
      >
        {icon}
      </Box>

      {/* Text */}
      <Typography
        sx={{
          fontWeight: isActive ? "bold" : "normal",
          color: "inherit",
          whiteSpace: "normal",
          wordBreak: "break-word",
          fontSize: "1rem",
          lineHeight: 1.2,
          textAlign: "left",
          flex: 1,
        }}
      >
        {title}
      </Typography>
    </Box>
  );

  return menuItemContent;
};

const SectionDivider = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        my: 1,
        px: 2,
      }}
    >
      <Divider
        sx={{
          width: "100%",
          borderColor: tokens.grey[300],
        }}
      />
    </Box>
  );
};

const CollapsibleSection = ({ title, to, icon, defaultExpanded = true }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive =
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  // Handle navigation with refresh
  const handleNavigation = () => {
    // If we're already on the exact same page, force a refresh
    if (location.pathname === to) {
      window.location.reload();
    } else {
      // Navigate to the new page
      navigate(to);
    }
  };

  return (
    <Box
      onClick={handleNavigation}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        cursor: "pointer",
        p: "12px 10px",
        m: "12px 10px 0px 10px",
        borderRadius: "4px",
        color: isActive
          ? theme.palette.mode === "dark"
            ? tokens.grey[100]
            : tokens.primary[700]
          : theme.palette.mode === "dark"
          ? tokens.grey[100]
          : tokens.grey[700],
        backgroundColor: isActive
          ? theme.palette.mode === "dark"
            ? tokens.primary[900]
            : tokens.primary[100]
          : "transparent",
        transition: "background-color 0.2s",
        "&:hover": {
          backgroundColor: isActive
            ? theme.palette.mode === "dark"
              ? tokens.primary[800]
              : tokens.primary[200]
            : theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.04)",
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minWidth: "24px",
          marginRight: "8px",
        }}
      >
        {icon}
      </Box>

      {/* Text */}
      <Typography
        sx={{
          fontWeight: isActive ? "bold" : "normal",
          color: "inherit",
          whiteSpace: "normal",
          wordBreak: "break-word",
          fontSize: "1rem",
          lineHeight: 1.2,
          textAlign: "left",
          flex: 1,
        }}
      >
        {title}
      </Typography>
    </Box>
  );
};

const Sidebar = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const location = useLocation();
  const showHidden = true; // Set to true to show hidden components

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .pro-sidebar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        height: 100vh !important;
        z-index: 1300 !important;
        width: 242px !important;
      }
      .pro-sidebar-inner {
        background: #ffffff !important;
        border-right: 1px solid #e0e0e0 !important;
        width: 242px !important;
        position: relative !important;
      }
      
      /* Reduce spacing between menu items */
      .pro-menu-item {
        margin: 2px 0 !important;
        padding: 2px 8px !important;
      }

      /* Remove padding from logo container */
      .pro-inner-item {
        padding: 5px 15px !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [theme.palette.mode]);

  const getInitials = (user) => {
    if (!user) return "?";
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(
        0
      )}`.toUpperCase();
    }
    if (user.name) {
      return user.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase();
    }
    return "?";
  };

  return (
    <ProSidebar collapsed={false}>
      <Menu
        iconShape="square"
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <MenuItem
          style={{
            margin: "10px 0 20px 0",
            color: tokens.grey[700],
          }}
        >
          <Box
            display="flex"
            justifyContent="flex-start"
            alignItems="center"
            ml="5px"
            mr="5px"
            sx={{
              width: "100%",
              overflow: "visible",
              cursor: "default",
            }}
          >
            <img
              src="/logo.png"
              alt="Lancaster and Dickenson Consulting"
              style={{
                maxHeight: "75px",
                maxWidth: "190px",
                width: "auto",
                height: "auto",
                display: "block",
                margin: "0",
                objectFit: "contain",
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
                const parent = e.target.parentNode;
                const text = document.createElement("span");
                text.textContent = "L&D";
                text.style.fontSize = "28px";
                text.style.fontWeight = "bold";
                text.style.color = "#000000";
                parent.appendChild(text);
              }}
            />
          </Box>
        </MenuItem>

        <Box paddingLeft="5%">
          <Item title="Dashboard" to="/" icon={<HomeOutlinedIcon />} />

          <PermissionGate requiredPermissions={["timesheets.view"]}>
            <Item
              title="Timesheets"
              to="/timesheets/monthly"
              icon={<AccessTimeIcon />}
            />
          </PermissionGate>

          {/* 
          <PermissionGate requiredPermissions={["calendar.view"]}>
            <Item
              title="Scheduler"
              to="/calendar"
              icon={<CalendarTodayOutlinedIcon />}
            />
          </PermissionGate> */}

          <SectionDivider />

          {/* Collapsible Sections */}
          <CollapsibleSection
            title="DATABASES"
            to="/databases"
            icon={<StorageIcon />}
          />

          {/* <CollapsibleSection
            title="REPORTS"
            to="/reports"
            icon={<DescriptionIcon />}
          /> */}

          <CollapsibleSection
            title="RECORDS"
            to="/records"
            icon={<FolderCopyIcon />}
          />

          <SectionDivider />

          <CollapsibleSection
            title="SURVEYS"
            to="/surveys"
            icon={<SearchIcon />}
          />

          <CollapsibleSection
            title="ASBESTOS REMOVAL"
            to="/asbestos-removal"
            icon={<ConstructionIcon />}
          />

          <CollapsibleSection
            title="FIBRE ID"
            to="/fibre-id"
            icon={<ScienceIcon />}
          />
        </Box>

        <Box
          sx={{
            p: 2,
            backgroundColor: "#ffffff",
                       marginTop: "auto",
          }}
        >
          <SectionDivider />
          <PermissionGate requiredPermissions={["admin.view"]} fallback={null}>
            <Item title="Admin" to="/admin" icon={<SettingsIcon />} />
          </PermissionGate>
        </Box>
      </Menu>
    </ProSidebar>
  );
};

export default Sidebar;
