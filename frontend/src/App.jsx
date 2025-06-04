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
import PermissionRoute from "./components/PermissionRoute";
import Login from "./scenes/login";
import ResetPassword from "./scenes/login/ResetPassword";
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
import ProjectInformation from "./scenes/projects/ProjectInformation";
import Timesheets from "./scenes/timesheets";
import TimesheetReview from "./scenes/timesheets/review";
import MonthlyTimesheet from "./scenes/timesheets/monthly";

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
              <Route path="/reset-password" element={<ResetPassword />} />

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
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.view"]}
                            >
                              <AirMonitoring />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/jobs/:jobId/shifts"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.view"]}
                            >
                              <Shifts />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.view"]}
                            >
                              <SampleList />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples/new"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.create"]}
                            >
                              <NewSample />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples/edit/:sampleId"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.edit"]}
                            >
                              <EditSample />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/analysis"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.view"]}
                            >
                              <Analysis />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/projects"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Projects />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/projects/:id"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <ProjectInformation />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/projects/new"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.create"]}
                            >
                              <ProjectInformation />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clients"
                          element={
                            <PermissionRoute
                              requiredPermissions={["clients.view"]}
                            >
                              <Clients />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/invoices"
                          element={
                            <PermissionRoute
                              requiredPermissions={["invoices.view"]}
                            >
                              <Invoices />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/calendar"
                          element={
                            <PermissionRoute
                              requiredPermissions={["calendar.view"]}
                            >
                              <Calendar />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/users"
                          element={
                            <PermissionRoute
                              requiredPermissions={["users.view"]}
                            >
                              <Users />
                            </PermissionRoute>
                          }
                        />
                        <Route path="/profile" element={<Profile />} />
                        <Route
                          path="/asbestos-assessment"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <AsbestosAssessment />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/asbestos-assessment/samples"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <AssessmentSamples />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/timesheets"
                          element={
                            <PermissionRoute
                              requiredPermissions={["timesheets.view"]}
                            >
                              <Navigate to="/timesheets/monthly" replace />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/timesheets/daily"
                          element={
                            <PermissionRoute
                              requiredPermissions={["timesheets.view"]}
                            >
                              <Timesheets />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/timesheets/monthly"
                          element={
                            <PermissionRoute
                              requiredPermissions={["timesheets.view"]}
                            >
                              <MonthlyTimesheet />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/timesheets/review"
                          element={
                            <PermissionRoute
                              requiredPermissions={["timesheets.review"]}
                            >
                              <TimesheetReview />
                            </PermissionRoute>
                          }
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
