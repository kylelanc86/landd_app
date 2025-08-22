import { createContext, useState, useMemo } from "react";
import { createTheme } from "@mui/material/styles";
import { tokens } from "./theme/tokens";

export const ColorModeContext = createContext();

export const useMode = () => {
  const [mode, setMode] = useState("light");

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prev) => (prev === "light" ? "light" : "light"));
      },
    }),
    []
  );

  const theme = useMemo(() => createTheme(themeSettings(mode)), [mode]);

  return [theme, colorMode];
};

// mui theme settings for clean light design
export const themeSettings = (mode) => {
  return {
    palette: {
      mode: mode,
      primary: {
        main: tokens.primary[500],
        light: tokens.primary[400],
        dark: tokens.primary[600],
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: tokens.secondary[500],
        light: tokens.secondary[400],
        dark: tokens.secondary[600],
        contrastText: "#FFFFFF",
      },
      neutral: {
        dark: tokens.neutral[700],
        main: tokens.neutral[500],
        light: tokens.neutral[100],
      },
      background: {
        default: tokens.background.light,
        paper: tokens.background.paper,
      },
      text: {
        primary: "#000000",
        secondary: tokens.neutral[600],
      },
      grey: tokens.grey,
    },
    typography: {
      fontFamily: '"Poppins", sans-serif',
      h1: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "2.5rem",
        fontWeight: 600,
        color: "#000000",
      },
      h2: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "2rem",
        fontWeight: 600,
        color: "#000000",
      },
      h3: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1.75rem",
        fontWeight: 600,
        color: "#000000",
      },
      h4: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1.5rem",
        fontWeight: 600,
        color: "#000000",
      },
      h5: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1.25rem",
        fontWeight: 500,
        color: "#000000",
      },
      h6: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1rem",
        fontWeight: 500,
        color: "#000000",
      },
      subtitle1: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1rem",
        fontWeight: 500,
        color: tokens.neutral[600],
      },
      subtitle2: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "0.875rem",
        fontWeight: 500,
        color: tokens.neutral[600],
      },
      body1: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "1rem",
        fontWeight: 400,
        color: "#000000",
      },
      body2: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "0.875rem",
        fontWeight: 400,
        color: tokens.neutral[600],
      },
      button: {
        fontFamily: '"Poppins", sans-serif',
        fontSize: "0.875rem",
        fontWeight: 500,
        textTransform: "none",
        color: "#000000",
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
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
            "&:hover": {
              boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.15)",
            },
          },
          contained: {
            backgroundColor: tokens.primary[500],
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: tokens.primary[600],
            },
          },
          outlined: {
            borderColor: tokens.primary[500],
            color: tokens.primary[500],
            "&:hover": {
              backgroundColor: tokens.primary[50],
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            borderRadius: 8,
            backgroundColor: "#FFFFFF",
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
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
            backgroundColor: "#FFFFFF",
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
            border: "1px solid #EEEEEE",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            padding: "12px 16px",
            borderBottom: "1px solid #EEEEEE",
            color: "#000000",
          },
          head: {
            backgroundColor: tokens.primary[500],
            color: "#FFFFFF",
            fontWeight: 600,
            borderBottom: "2px solid #E0E0E0",
          },
          body: {
            backgroundColor: "#FFFFFF",
            color: "#000000",
            "&:hover": {
              backgroundColor: tokens.grey[50],
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:hover": {
              backgroundColor: tokens.grey[50],
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            color: tokens.neutral[600],
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: "#FFFFFF",
            "& fieldset": {
              borderColor: "#E0E0E0",
            },
            "&:hover fieldset": {
              borderColor: tokens.primary[500],
            },
            "&.Mui-focused fieldset": {
              borderColor: tokens.primary[500],
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            color: "#000000",
            "&:hover": {
              backgroundColor: tokens.primary[50],
            },
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
            backgroundColor: "#FFFFFF",
            boxShadow: "0px 8px 32px rgba(0, 0, 0, 0.15)",
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            fontWeight: 600,
            color: "#000000",
            borderBottom: "1px solid #EEEEEE",
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            color: "#000000",
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: '16px 24px',
            borderTop: "1px solid #EEEEEE",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            backgroundColor: tokens.grey[100],
            color: "#000000",
            border: "1px solid #E0E0E0",
          },
          colorPrimary: {
            backgroundColor: tokens.primary[500],
            color: "#FFFFFF",
          },
          colorSecondary: {
            backgroundColor: tokens.secondary[500],
            color: "#FFFFFF",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: "#FFFFFF",
            color: "#000000",
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: "#FFFFFF",
            color: "#000000",
            borderRight: "1px solid #EEEEEE",
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: "none",
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid #EEEEEE",
              color: "#000000",
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: tokens.primary[500],
              color: "#FFFFFF",
              borderBottom: "none",
            },
            "& .MuiDataGrid-columnHeader": {
              color: "#FFFFFF",
              fontWeight: 600,
            },
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: "#FFFFFF",
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: "none",
              backgroundColor: tokens.primary[500],
              color: "#FFFFFF",
            },
            "& .MuiCheckbox-root": {
              color: `${tokens.secondary.main} !important`,
            },
          },
        },
      },
    },
  };
};