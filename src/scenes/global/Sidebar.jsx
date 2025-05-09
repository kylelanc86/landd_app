import React, { useState, useEffect } from "react";
import { ProSidebar, Menu, MenuItem } from "react-pro-sidebar";
import "react-pro-sidebar/dist/css/styles.css";
import { Box, IconButton, Typography, useTheme, Avatar } from "@mui/material";
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

const USERS_KEY = "ldc_users";

const Item = ({ title, to, icon, selected, setSelected }) => {
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
        margin: "4px 4px",
        transition: "all 0.3s ease",
      }}
      onClick={() => setSelected(title)}
      icon={icon}
    >
      <Link
        to={to}
        style={{
          textDecoration: "none",
          color: "inherit",
          width: "100%",
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
        }}
      >
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
      </Link>
    </MenuItem>
  );
};

const Sidebar = () => {
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selected, setSelected] = useState("Dashboard");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadCurrentUser = () => {
      try {
        const stored = localStorage.getItem(USERS_KEY);
        if (stored) {
          const users = JSON.parse(stored);
          // Find John Smith (admin user)
          const johnSmith = users.find(
            (user) => user.firstName === "John" && user.lastName === "Smith"
          );
          if (johnSmith) {
            setCurrentUser(johnSmith);
          }
        }
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .main-content {
        margin-left: 250px;
        padding-top: 64px;
        transition: margin-left 0.3s ease;
      }
      .main-content.collapsed {
        margin-left: 80px;
      }
      .topbar-collapsed {
        left: 80px !important;
      }
    `;
    document.head.appendChild(style);

    const mainContent = document.querySelector(".main-content");
    const topbar = document.querySelector(".topbar");
    if (mainContent) {
      if (isCollapsed) {
        mainContent.classList.add("collapsed");
        topbar?.classList.add("topbar-collapsed");
      } else {
        mainContent.classList.remove("collapsed");
        topbar?.classList.remove("topbar-collapsed");
      }
    }

    return () => {
      document.head.removeChild(style);
    };
  }, [isCollapsed]);

  return (
    <Box
      sx={{
        "& .pro-sidebar-inner": {
          background:
            theme.palette.mode === "dark"
              ? "#1a1a1a"
              : "#ffffff" + " !important",
          borderRight: `1px solid ${
            theme.palette.mode === "dark" ? "#2d2d2d" : "#e0e0e0"
          }`,
        },
        "& .pro-icon-wrapper": {
          backgroundColor: "transparent !important",
        },
        "& .pro-inner-item": {
          padding: "5px 20px 5px 10px !important",
        },
        "& .pro-inner-item:hover": {
          color:
            theme.palette.mode === "dark"
              ? "#4CAF50"
              : "#2E7D32" + " !important",
        },
        "& .pro-menu-item.active": {
          color:
            theme.palette.mode === "dark"
              ? "#4CAF50"
              : "#2E7D32" + " !important",
        },
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999,
        "& .pro-sidebar": {
          height: "100vh",
        },
      }}
    >
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
            />
            <Item
              title="User Management"
              to="/users"
              icon={<AccessibilityIcon />}
              selected={selected}
              setSelected={setSelected}
            />

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
            <Item
              title="Projects"
              to="/projects"
              icon={<MapOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Clients"
              to="/clients"
              icon={<ContactsOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Invoices"
              to="/invoices"
              icon={<ReceiptOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Scheduler"
              to="/calendar"
              icon={<CalendarTodayOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />

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
            <Item
              title="Air Monitoring"
              to="/air-monitoring"
              icon={<AirOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Asbestos Assessment"
              to="/asbestos-assessment"
              icon={<AssessmentIcon />}
              selected={selected}
              setSelected={setSelected}
            />
          </Box>
        </Menu>
      </ProSidebar>
    </Box>
  );
};

export default Sidebar;
