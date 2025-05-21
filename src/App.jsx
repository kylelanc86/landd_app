import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Dashboard from "./scenes/dashboard";
import Invoices from "./scenes/invoices";
import Clients from "./scenes/clients";
import Calendar from "./scenes/calendar";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./scenes/login";
import AirMonitoring from "./scenes/air-monitoring";
import Shifts from "./scenes/air-monitoring/shifts";
import Projects from "./scenes/projects";
import SampleList from "./scenes/air-monitoring/air-monitoring-sample-list";
import NewSample from "./scenes/air-monitoring/new-sample";
import EditSample from "./scenes/air-monitoring/edit-sample";
import Analysis from "./scenes/air-monitoring/analysis";
import AsbestosAssessment from "./scenes/asbestos-assessment";
import AssessmentSamples from "./scenes/asbestos-assessment/assessment-samples";
import Users from "./scenes/users";
import Profile from "./scenes/profile";
import Layout from "./components/Layout";

function App() {
  const [theme, colorMode] = useMode();

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout
                      toggleColorMode={colorMode.toggleColorMode}
                      mode={theme.palette.mode}
                    >
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route
                          path="/air-monitoring"
                          element={<AirMonitoring />}
                        />
                        <Route
                          path="/air-monitoring/jobs/:jobId/shifts"
                          element={<Shifts />}
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples"
                          element={<SampleList />}
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples/new"
                          element={<NewSample />}
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples/edit/:sampleId"
                          element={<EditSample />}
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/analysis"
                          element={<Analysis />}
                        />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route
                          path="/asbestos-assessment"
                          element={<AsbestosAssessment />}
                        />
                        <Route
                          path="/asbestos-assessment/samples"
                          element={<AssessmentSamples />}
                        />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
