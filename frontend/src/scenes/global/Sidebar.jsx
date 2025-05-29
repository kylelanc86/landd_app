import React, { useState, useEffect } from "react";
import "react-pro-sidebar/dist/css/styles.css";
import { ProSidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  Avatar,
  Divider,
} from "@mui/material";
import { Link } from "react-router-dom";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import AirOutlinedIcon from "@mui/icons-material/AirOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AccessibilityIcon from "@mui/icons-material/Accessibility";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";

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

const Item = ({ title, to, icon, selected, setSelected, isCollapsed }) => {
  const theme = useTheme();
  return (
    <MenuItem
      active={selected === title}
      style={{
        color:
          theme.palette.mode === "dark" ? tokens.grey[100] : tokens.grey[700],
        backgroundColor:
          selected === title
            ? theme.palette.mode === "dark"
              ? tokens.primary[600]
              : tokens.primary[100]
            : "transparent",
        borderRadius: "8px",
        margin: isCollapsed ? "2px 4px" : "4px 4px",
        transition: "all 0.3s ease",
        textAlign: "left",
        paddingLeft: isCollapsed ? "4px" : "10px",
      }}
      onClick={() => setSelected(title)}
      icon={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "transparent",
            boxShadow:
              theme.palette.mode === "dark"
                ? "none"
                : "0 2px 4px rgba(0,0,0,0.1)",
            mr: 1,
          }}
        >
          {icon}
        </Box>
      }
    >
      <Link
        to={to}
        style={{
          textDecoration: "none",
          color: "inherit",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: isCollapsed ? "4px 0" : "8px 0",
        }}
      >
        {!isCollapsed && (
          <Typography
            sx={{
              fontWeight: selected === title ? "bold" : "normal",
              color:
                selected === title
                  ? theme.palette.mode === "dark"
                    ? tokens.grey[100]
                    : tokens.primary[700]
                  : theme.palette.mode === "dark"
                  ? tokens.grey[100]
                  : tokens.grey[700],
              whiteSpace: "normal",
              wordBreak: "break-word",
              fontSize: "0.9rem",
              lineHeight: 1.2,
              textAlign: "left",
            }}
          >
            {title}
          </Typography>
        )}
      </Link>
    </MenuItem>
  );
};

const SectionDivider = ({ isCollapsed }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        my: isCollapsed ? 1 : 2,
        px: isCollapsed ? 1 : 2,
      }}
    >
      <Divider
        sx={{
          width: isCollapsed ? "30px" : "100%",
          borderColor:
            theme.palette.mode === "dark" ? tokens.grey[700] : tokens.grey[300],
        }}
      />
    </Box>
  );
};

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const theme = useTheme();
  const [selected, setSelected] = useState("Dashboard");
  const { currentUser } = useAuth();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .pro-sidebar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        height: 100vh !important;
        z-index: 1300 !important;
      }
      .pro-sidebar-inner {
        background: ${
          theme.palette.mode === "dark" ? "#1a1a1a" : "#ffffff"
        } !important;
        border-right: 1px solid ${
          theme.palette.mode === "dark" ? "#2d2d2d" : "#e0e0e0"
        } !important;
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
    <ProSidebar collapsed={isCollapsed}>
      <Menu iconShape="square">
        <MenuItem
          onClick={() => setIsCollapsed(!isCollapsed)}
          icon={
            isCollapsed ? (
              <img
                src="/logo_small.png"
                alt="L&D"
                style={{
                  height: "48px",
                  width: "auto",
                  display: "block",
                  margin: "0 auto",
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = "none";
                  const parent = e.target.parentNode;
                  const text = document.createElement("span");
                  text.textContent = "L&D";
                  text.style.fontSize = "24px";
                  text.style.fontWeight = "bold";
                  text.style.color =
                    theme.palette.mode === "dark" ? "#fff" : "#000";
                  parent.appendChild(text);
                }}
              />
            ) : undefined
          }
          style={{
            margin: "10px 0 50px 0",
            color:
              theme.palette.mode === "dark"
                ? tokens.grey[100]
                : tokens.grey[700],
          }}
        >
          {!isCollapsed && (
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              ml="10px"
            >
              <img
                src="/logo.png"
                alt="Lancaster and Dickenson Consulting"
                style={{
                  maxHeight: "62.5px",
                  width: "auto",
                  display: "block",
                  margin: "0 auto",
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = "none";
                  const parent = e.target.parentNode;
                  const text = document.createElement("span");
                  text.textContent = "L&D";
                  text.style.fontSize = "24px";
                  text.style.fontWeight = "bold";
                  text.style.color =
                    theme.palette.mode === "dark" ? "#fff" : "#000";
                  parent.appendChild(text);
                }}
              />
            </Box>
          )}
        </MenuItem>

        {!isCollapsed && (
          <Box mb="25px">
            <Box display="flex" justifyContent="center" alignItems="center">
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  backgroundColor: currentUser
                    ? getRandomColor(currentUser)
                    : "#757575",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                }}
              >
                {currentUser ? getInitials(currentUser) : "?"}
              </Box>
            </Box>
            <Box textAlign="center">
              <Typography
                variant="h2"
                color={theme.palette.mode === "dark" ? "#ffffff" : "#1a1a1a"}
                fontWeight="bold"
                sx={{ m: "10px 0 0 0" }}
              >
                {currentUser
                  ? `${currentUser.firstName} ${currentUser.lastName}`
                  : "Unknown User"}
              </Typography>
              <Typography
                variant="h5"
                color={theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32"}
                sx={{ textTransform: "capitalize" }}
              >
                {currentUser ? currentUser.role : "Guest"}
              </Typography>
            </Box>
          </Box>
        )}

        <Box paddingLeft={isCollapsed ? undefined : "5%"}>
          <Item
            title="Dashboard"
            to="/"
            icon={<HomeOutlinedIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
          <Item
            title="User Management"
            to="/users"
            icon={<AccessibilityIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
          <Item
            title="Timesheets"
            to="/timesheets"
            icon={<AccessTimeIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />

          {!isCollapsed ? (
            <Typography
              variant="h3"
              color={theme.palette.mode === "dark" ? "#ffffff" : "#1a1a1a"}
              sx={{
                m: "15px 0 5px 10px",
                fontSize: "1.2rem",
                fontWeight: "bold",
                opacity: 0.8,
                textAlign: "left",
                paddingLeft: "10px",
              }}
            >
              Pages
            </Typography>
          ) : (
            <SectionDivider isCollapsed={isCollapsed} />
          )}

          <Item
            title="Projects"
            to="/projects"
            icon={<MapOutlinedIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
          <Item
            title="Clients"
            to="/clients"
            icon={<ContactsOutlinedIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
          <Item
            title="Invoices"
            to="/invoices"
            icon={<ReceiptOutlinedIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
          <Item
            title="Scheduler"
            to="/calendar"
            icon={<CalendarTodayOutlinedIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />

          {!isCollapsed ? (
            <Typography
              variant="h3"
              color={theme.palette.mode === "dark" ? "#ffffff" : "#1a1a1a"}
              sx={{
                m: "15px 0 5px 10px",
                fontSize: "1.2rem",
                fontWeight: "bold",
                opacity: 0.8,
                textAlign: "left",
                paddingLeft: "10px",
              }}
            >
              Site Work
            </Typography>
          ) : (
            <SectionDivider isCollapsed={isCollapsed} />
          )}

          <Item
            title="Air Monitoring"
            to="/air-monitoring"
            icon={<AirOutlinedIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
          <Item
            title="Asbestos Assessment"
            to="/asbestos-assessment"
            icon={<AssessmentIcon />}
            selected={selected}
            setSelected={setSelected}
            isCollapsed={isCollapsed}
          />
        </Box>
      </Menu>
    </ProSidebar>
  );
};

export default Sidebar;
