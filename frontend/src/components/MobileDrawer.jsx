import React from "react";
import {
  Drawer,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import StorageIcon from "@mui/icons-material/Storage";
import DescriptionIcon from "@mui/icons-material/Description";
import ConstructionIcon from "@mui/icons-material/Construction";
import SearchIcon from "@mui/icons-material/Search";
import FolderCopyIcon from "@mui/icons-material/FolderCopy";
import ScienceIcon from "@mui/icons-material/Science";
import { tokens } from "../theme/tokens";
import { usePermissions } from "../hooks/usePermissions";
import PermissionGate from "./PermissionGate";
import { isFeatureEnabled } from "../config/featureFlags";

const MobileDrawer = ({ open, onClose }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const handleNavigation = (to) => {
    // Check for unsaved changes
    if (
      window.hasUnsavedChanges &&
      window.currentProjectPath &&
      (location.pathname.startsWith("/projects/") ||
        location.pathname.startsWith("/clients/") ||
        location.pathname.startsWith("/users/")) &&
      !to.startsWith("/projects/") &&
      !to.startsWith("/clients/") &&
      !to.startsWith("/users/")
    ) {
      window.pendingNavigation = to;
      if (window.showUnsavedChangesDialog) {
        window.showUnsavedChangesDialog();
      }
      return;
    }

    // If we're already on the exact same page, force a refresh
    if (location.pathname === to) {
      window.location.reload();
    } else {
      navigate(to);
    }
    onClose();
  };

  const MenuItem = ({ title, to, icon, requiredPermissions, fallback }) => {
    const isActive =
      location.pathname === to || location.pathname.startsWith(`${to}/`);

    const menuItem = (
      <ListItem disablePadding>
        <ListItemButton
          onClick={() => handleNavigation(to)}
          sx={{
            backgroundColor: isActive ? tokens.primary[50] : "transparent",
            "&:hover": {
              backgroundColor: isActive ? tokens.primary[100] : tokens.grey[50],
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: isActive ? tokens.primary[700] : tokens.grey[600],
              minWidth: 40,
            }}
          >
            {icon}
          </ListItemIcon>
          <ListItemText
            primary={title}
            primaryTypographyProps={{
              fontWeight: isActive ? "bold" : "normal",
              color: isActive ? tokens.primary[700] : tokens.grey[700],
            }}
          />
        </ListItemButton>
      </ListItem>
    );

    if (requiredPermissions) {
      return (
        <PermissionGate
          requiredPermissions={requiredPermissions}
          fallback={fallback}
        >
          {menuItem}
        </PermissionGate>
      );
    }

    return menuItem;
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box
        sx={{
          width: 280,
          height: "100%",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          pt: "40px", // Shift content down 30px to account for topbar
        }}
      >
        {/* Menu Items */}
        <Box sx={{ flex: 1, overflowY: "auto", pt: 1 }}>
          <List>
            <MenuItem title="Dashboard" to="/" icon={<HomeOutlinedIcon />} />

            <PermissionGate
              requiredPermissions={["admin.view"]}
              fallback={null}
            >
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/admin")}
                  sx={{
                    backgroundColor:
                      location.pathname === "/admin" ||
                      location.pathname.startsWith("/admin/")
                        ? tokens.primary[50]
                        : "transparent",
                    "&:hover": {
                      backgroundColor:
                        location.pathname === "/admin" ||
                        location.pathname.startsWith("/admin/")
                          ? tokens.primary[100]
                          : tokens.grey[50],
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        location.pathname === "/admin" ||
                        location.pathname.startsWith("/admin/")
                          ? tokens.primary[700]
                          : tokens.grey[600],
                      minWidth: 40,
                    }}
                  >
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Admin Interface"
                    primaryTypographyProps={{
                      fontWeight:
                        location.pathname === "/admin" ||
                        location.pathname.startsWith("/admin/")
                          ? "bold"
                          : "normal",
                      color:
                        location.pathname === "/admin" ||
                        location.pathname.startsWith("/admin/")
                          ? tokens.primary[700]
                          : tokens.grey[700],
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </PermissionGate>

            <PermissionGate requiredPermissions={["timesheets.view"]}>
              <MenuItem
                title="Timesheets"
                to="/timesheets/monthly"
                icon={<AccessTimeIcon />}
              />

              <MenuItem
                title="Active Projects"
                to="/projects"
                icon={<StorageIcon />}
              />
            </PermissionGate>

            <Divider sx={{ my: 1 }} />

            <MenuItem
              title="Clients"
              to="/clients"
              icon={<PeopleOutlinedIcon />}
            />

            <MenuItem
              title="Invoices"
              to="/invoices"
              icon={<AttachMoneyIcon />}
            />

            {isFeatureEnabled("ADVANCED.REPORTS") && (
              <MenuItem
                title="Project Reports"
                to="/reports"
                icon={<DescriptionIcon />}
              />
            )}

            {isAdmin && isFeatureEnabled("ADVANCED.RECORDS") && (
              <MenuItem
                title="Records"
                to="/records"
                icon={<FolderCopyIcon />}
              />
            )}

            <Divider sx={{ my: 1 }} />

            {isFeatureEnabled("ADVANCED.SURVEYS") && (
              <MenuItem title="SURVEYS" to="/surveys" icon={<SearchIcon />} />
            )}

            {isFeatureEnabled("ADVANCED.ASBESTOS_REMOVAL") && (
              <MenuItem
                title="Air Mon & Clearances"
                to="/asbestos-removal"
                icon={<ConstructionIcon />}
              />
            )}

            {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
              <MenuItem
                title="Fibre Identification"
                to="/fibre-id"
                icon={<ScienceIcon />}
              />
            )}

            <Divider sx={{ my: 1 }} />


            {isFeatureEnabled("ADVANCED.ASBESTOS_REMOVAL") && (
              <MenuItem
                title="Client Supplied"
                to="/client-supplied"
                icon={<ContactsOutlinedIcon />}
              />
            )}


          </List>
        </Box>
      </Box>
    </Drawer>
  );
};

export default MobileDrawer;
