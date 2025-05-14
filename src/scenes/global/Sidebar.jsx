import React, { useState, useEffect } from "react";
import { ProSidebar, Menu, MenuItem } from "react-pro-sidebar";
import "react-pro-sidebar/dist/css/styles.css";
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
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";

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

const Sidebar = () => {
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
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
        z-index: 999 !important;
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

  return (
    <ProSidebar collapsed={isCollapsed}>
      <Menu iconShape="square">
        {/* LOGO AND MENU ICON */}
        <MenuItem
          onClick={() => setIsCollapsed(!isCollapsed)}
          icon={isCollapsed ? <MenuOutlinedIcon /> : undefined}
          style={{
            margin: "10px 0 20px 0",
            color:
              theme.palette.mode === "dark"
                ? tokens.grey[100]
                : tokens.grey[700],
          }}
        >
          {!isCollapsed ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              ml="15px"
            >
              <img
                src="/logo.png"
                alt="Lancaster and Dickenson Consulting"
                style={{
                  maxHeight: "62.5px",
                  width: "auto",
                  display: "block",
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = "none";
                  const parent = e.target.parentNode;
                  if (parent && !parent.querySelector(".logo-error")) {
                    const msg = document.createElement("div");
                    msg.className = "logo-error";
                    msg.style.color =
                      theme.palette.mode === "dark"
                        ? tokens.grey[100]
                        : tokens.grey[700];
                    msg.style.fontSize = "12px";
                    msg.style.position = "absolute";
                    msg.style.top = "50%";
                    msg.style.left = "50%";
                    msg.style.transform = "translate(-50%, -50%)";
                    msg.innerText = "Logo not found";
                    parent.appendChild(msg);
                  }
                }}
              />
            </Box>
          ) : (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              ml="15px"
            >
              <IconButton
                onClick={() => setIsCollapsed(!isCollapsed)}
                sx={{
                  color:
                    theme.palette.mode === "dark"
                      ? tokens.grey[100]
                      : tokens.grey[700],
                }}
              >
                <MenuOutlinedIcon />
              </IconButton>
            </Box>
          )}
        </MenuItem>

        {!isCollapsed && (
          <Box mb="25px">
            <Box display="flex" justifyContent="center" alignItems="center">
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  bgcolor:
                    theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                }}
              >
                {currentUser ? currentUser.firstName.charAt(0) : "J"}
              </Avatar>
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
                  : "John Smith"}
              </Typography>
              <Typography
                variant="h5"
                color={theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32"}
              >
                {currentUser ? currentUser.userLevel : "Admin"}
              </Typography>
            </Box>
          </Box>
        )}

        <Box paddingLeft={isCollapsed ? undefined : "10%"}>
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

          {!isCollapsed ? (
            <Typography
              variant="h3"
              color={theme.palette.mode === "dark" ? "#ffffff" : "#1a1a1a"}
              sx={{
                m: "15px 0 5px 20px",
                fontSize: "1.2rem",
                fontWeight: "bold",
                opacity: 0.8,
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
                m: "15px 0 5px 20px",
                fontSize: "1.2rem",
                fontWeight: "bold",
                opacity: 0.8,
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
