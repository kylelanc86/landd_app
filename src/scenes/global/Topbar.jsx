import { Box, IconButton, useTheme } from "@mui/material";
import { useContext } from "react";
import { ColorModeContext } from "../../theme";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

const Topbar = () => {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  return (
    <Box
      display="flex"
      justifyContent="flex-end"
      p={2}
      sx={{
        position: "fixed",
        top: 0,
        right: 0,
        left: "250px",
        zIndex: 998,
        backgroundColor: theme.palette.mode === "dark" ? "#1a1a1a" : "#ffffff",
        borderBottom: `1px solid ${
          theme.palette.mode === "dark" ? "#2d2d2d" : "#e0e0e0"
        }`,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        transition: "left 0.3s ease",
      }}
    >
      <Box display="flex" gap={1}>
        <IconButton
          onClick={colorMode.toggleColorMode}
          sx={{
            color: theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
          }}
        >
          {theme.palette.mode === "dark" ? (
            <DarkModeOutlinedIcon />
          ) : (
            <LightModeOutlinedIcon />
          )}
        </IconButton>
        <IconButton
          sx={{
            color: theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
          }}
        >
          <NotificationsOutlinedIcon />
        </IconButton>
        <IconButton
          sx={{
            color: theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
          }}
        >
          <SettingsOutlinedIcon />
        </IconButton>
        <IconButton
          sx={{
            color: theme.palette.mode === "dark" ? "#4CAF50" : "#2E7D32",
          }}
        >
          <PersonOutlinedIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default Topbar;
