import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Dashboard from "./scenes/dashboard";
import Team from "./scenes/team";
import Invoices from "./scenes/invoices";
import Contacts from "./scenes/contacts";
import Bar from "./scenes/bar";
import Form from "./scenes/form";
import Line from "./scenes/line";
import Pie from "./scenes/pie";
import FAQ from "./scenes/faq";
import Geography from "./scenes/geography";
import Calendar from "./scenes/calendar";
import { AuthProvider } from "./context/AuthContext";
import Login from "./scenes/login";
import Register from "./scenes/register";
import GlobalSnackbar from "./components/GlobalSnackbar";

function App() {
  const [theme, colorMode] = useMode();
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Function to show snackbar from anywhere in the app
  const showGlobalSnackbar = (message, severity = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setShowSnackbar(true);
  };

  const handleSidebarCollapse = (collapsed) => {
    setIsSidebarCollapsed(collapsed);
  };

  return (
    <>
      <GlobalSnackbar
        open={showSnackbar}
        message={snackbarMessage}
        severity={snackbarSeverity}
        onClose={() => setShowSnackbar(false)}
      />
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <BrowserRouter>
              <Box sx={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar onCollapse={handleSidebarCollapse} />
                <Box
                  component="main"
                  sx={{
                    flexGrow: 1,
                    ml: isSidebarCollapsed ? '80px' : '240px',
                    transition: 'margin-left 0.3s ease',
                    p: 3,
                    width: `calc(100% - ${isSidebarCollapsed ? '80px' : '240px'})`,
                    minHeight: '100vh',
                    backgroundColor: theme.palette.background.default,
                  }}
                >
                  <Topbar />
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/invoices" element={<Invoices showSnackbar={showGlobalSnackbar} />} />
                    <Route path="/form" element={<Form />} />
                    <Route path="/bar" element={<Bar />} />
                    <Route path="/pie" element={<Pie />} />
                    <Route path="/line" element={<Line />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/geography" element={<Geography />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                  </Routes>
                </Box>
              </Box>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
}

export default App; 