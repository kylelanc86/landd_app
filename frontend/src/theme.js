import { createContext, useState, useMemo } from "react";
import { createTheme } from "@mui/material/styles";

export const ColorModeContext = createContext();

export const useMode = () => {
  const [mode, setMode] = useState("dark");

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prev) => (prev === "light" ? "dark" : "light"));
      },
    }),
    []
  );

  const theme = useMemo(() => createTheme(themeSettings(mode)), [mode]);

  return [theme, colorMode];
};

// color design tokens
export const tokens = {
  primary: {
    50: "#E6F4F8",
    100: "#CCE9F1",
    200: "#99D3E3",
    300: "#66BDD5",
    400: "#33A7C7",
    500: "#74B3CE", // Main color
    600: "#4A8BA8",
    700: "#3A6F86",
    800: "#2B5364",
    900: "#1B3742",
  },
  secondary: {
    50: "#E6F7F3",
    100: "#CCEFE7",
    200: "#99DFCF",
    300: "#66CFB7",
    400: "#33BF9F",
    500: "#09BC8A", // Main color
    600: "#068B6A",
    700: "#056A52",
    800: "#034A3A",
    900: "#022A22",
  },
  neutral: {
    50: "#F0F2F5",
    100: "#E1E5EA",
    200: "#C3CBD5",
    300: "#A5B1C0",
    400: "#8797AB",
    500: "#508991", // Muted blue
    600: "#3D6B71",
    700: "#2B4D51",
    800: "#1A2E31",
    900: "#172A3A", // Dark blue
  },
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
  blueAccent: {
    50: "#E3F2FD",
    100: "#BBDEFB",
    200: "#90CAF9",
    300: "#64B5F6",
    400: "#42A5F5",
    500: "#2196F3",
    600: "#1E88E5",
    700: "#1976D2",
    800: "#1565C0",
    900: "#0D47A1",
  },
  background: {
    light: "#FFFFFF",
    main: "#F5F5F5",
    dark: "#172A3A",
    paper: "#004346",
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
              light: tokens.primary[400],
              dark: tokens.primary[600],
              contrastText: "#fff",
            },
            secondary: {
              main: tokens.secondary[500],
              light: tokens.secondary[400],
              dark: tokens.secondary[600],
              contrastText: "#fff",
            },
            neutral: {
              dark: tokens.neutral[700],
              main: tokens.neutral[500],
              light: tokens.neutral[100],
            },
            background: {
              default: tokens.background.dark,
              paper: tokens.background.paper,
            },
            text: {
              primary: "#FFFFFF",
              secondary: tokens.primary[500],
            },
          }
        : {
            // palette values for light mode
            primary: {
              main: tokens.primary[500],
              light: tokens.primary[400],
              dark: tokens.primary[600],
              contrastText: "#fff",
            },
            secondary: {
              main: tokens.secondary[500],
              light: tokens.secondary[400],
              dark: tokens.secondary[600],
              contrastText: "#fff",
            },
            neutral: {
              dark: tokens.neutral[700],
              main: tokens.neutral[500],
              light: tokens.neutral[100],
            },
            background: {
              default: tokens.background.light,
              paper: tokens.background.main,
            },
            text: {
              primary: tokens.neutral[900],
              secondary: tokens.neutral[500],
            },
          }),
    },
    typography: {
      fontFamily: '"Poppins", sans-serif',
      h1: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "2.5rem",
        fontWeight: 600,
      },
      h2: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "2rem",
        fontWeight: 600,
      },
      h3: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1.75rem",
        fontWeight: 600,
      },
      h4: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1.5rem",
        fontWeight: 600,
      },
      h5: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1.25rem",
        fontWeight: 500,
      },
      h6: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1rem",
        fontWeight: 500,
      },
      subtitle1: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1rem",
        fontWeight: 500,
      },
      subtitle2: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "0.875rem",
        fontWeight: 500,
      },
      body1: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1rem",
        fontWeight: 400,
      },
      body2: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "0.875rem",
        fontWeight: 400,
      },
      button: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "0.875rem",
        fontWeight: 500,
        textTransform: "none",
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 8,
            fontFamily: '"Poppins", sans-serif',
            fontWeight: 500,
            padding: "8px 16px",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            borderRadius: 8,
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            padding: "12px 16px",
            borderBottom: "1px solid rgba(224, 224, 224, 0.2)",
          },
          head: {
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? tokens.background.paper
                : tokens.primary[50],
            color: (theme) =>
              theme.palette.mode === "dark"
                ? tokens.grey[100]
                : tokens.primary[700],
            fontWeight: 600,
          },
          body: {
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? tokens.background.dark
                : tokens.grey[0],
            color: (theme) =>
              theme.palette.mode === "dark"
                ? tokens.grey[100]
                : tokens.grey[700],
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            fontWeight: 600,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: '16px 24px',
          },
        },
      },
    },
  };
}; 