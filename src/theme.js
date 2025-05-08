import { createContext, useState, useMemo } from "react";
import { createTheme } from "@mui/material/styles";

// color design tokens
export const tokens = {
  grey: {
    0: "#FFFFFF",
    10: "#F6F6F6",
    50: "#F0F0F0",
    100: "#E0E0E0",
    200: "#C2C2C2",
    300: "#A3A3A3",
    400: "#858585",
    500: "#666666",
    600: "#4D4D4D",
    700: "#333333",
    800: "#1A1A1A",
    900: "#0A0A0A",
    1000: "#000000",
  },
  primary: {
    50: "#E6FBFF",
    100: "#CCF7FE",
    200: "#99EEFD",
    300: "#66E6FC",
    400: "#33DDFB",
    500: "#00D5FA",
    600: "#00A0BC",
    700: "#006B7D",
    800: "#00353F",
    900: "#001519",
  },
  secondary: {
    50: "#F0F7FF",
    100: "#C6E3FF",
    200: "#8ABEFF",
    300: "#4E99FF",
    400: "#1274FF",
    500: "#0066FF",
    600: "#0052CC",
    700: "#003D99",
    800: "#002966",
    900: "#001433",
  },
  tertiary: {
    50: "#E6FAF5",
    100: "#CCF5EB",
    200: "#99EBD7",
    300: "#66E0C3",
    400: "#33D6AF",
    500: "#00CC9B",
    600: "#009A74",
    700: "#00674D",
    800: "#003527",
    900: "#001A13",
  },
  background: {
    light: "#FFFFFF",
    main: "#1F2026",
  },
};

// mui theme settings
export const themeSettings = (mode) => {
  return {
    palette: {
      mode: mode,
      ...(mode === "dark"
        ? {
            // palette values for dark mode
            primary: {
              main: tokens.primary[500],
            },
            secondary: {
              main: tokens.secondary[500],
            },
            neutral: {
              dark: tokens.grey[700],
              main: tokens.grey[500],
              light: tokens.grey[100],
            },
            background: {
              default: tokens.background.main,
              alt: tokens.background.main,
            },
          }
        : {
            // palette values for light mode
            primary: {
              main: tokens.primary[500],
            },
            secondary: {
              main: tokens.secondary[500],
            },
            neutral: {
              dark: tokens.grey[700],
              main: tokens.grey[500],
              light: tokens.grey[100],
            },
            background: {
              default: tokens.background.light,
              alt: tokens.background.light,
            },
          }),
    },
    typography: {
      fontFamily: ["Inter", "sans-serif"].join(","),
      fontSize: 12,
      h1: {
        fontFamily: ["Inter", "sans-serif"].join(","),
        fontSize: 32,
      },
      h2: {
        fontFamily: ["Inter", "sans-serif"].join(","),
        fontSize: 24,
      },
      h3: {
        fontFamily: ["Inter", "sans-serif"].join(","),
        fontSize: 20,
        fontWeight: 600,
        color: tokens.grey[200],
      },
      h4: {
        fontFamily: ["Inter", "sans-serif"].join(","),
        fontSize: 14,
        fontWeight: 600,
        color: tokens.grey[300],
      },
      h5: {
        fontFamily: ["Inter", "sans-serif"].join(","),
        fontSize: 12,
        fontWeight: 500,
      },
      h6: {
        fontFamily: ["Inter", "sans-serif"].join(","),
        fontSize: 10,
      },
    },
  };
};

// context for color mode
export const ColorModeContext = createContext({
  toggleColorMode: () => {},
});

export const useMode = () => {
  const [mode, setMode] = useState("dark");

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () =>
        setMode((prev) => (prev === "light" ? "dark" : "light")),
    }),
    []
  );

  const theme = useMemo(() => createTheme(themeSettings(mode)), [mode]);
  return [theme, colorMode];
}; 