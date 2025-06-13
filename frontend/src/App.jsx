import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import { AuthProvider } from "./context/AuthContext";
import { Suspense, lazy } from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";

// Regular imports
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Dashboard from "./scenes/dashboard";
import Invoices from "./scenes/invoices";
import Calendar from "./scenes/calendar";
import Login from "./scenes/login";
import ResetPassword from "./scenes/login/ResetPassword";
import AirMonitoring from "./scenes/air-monitoring";
import Shifts from "./scenes/air-monitoring/shifts";
import ProjectInformation from "./scenes/projects/ProjectInformation";
import Timesheets from "./scenes/timesheets";
import TimesheetReview from "./scenes/timesheets/review";
import MonthlyTimesheet from "./scenes/timesheets/monthly";
import Calibrations from "./scenes/calibrations/air-mon-calibrations";
import AirPumpPage from "./scenes/calibrations/air-mon-calibrations/pages/AirPumpPage";
import FlowmeterPage from "./scenes/calibrations/air-mon-calibrations/pages/FlowmeterPage";
import EFAPage from "./scenes/calibrations/air-mon-calibrations/pages/EFAPage";
import MicroscopePage from "./scenes/calibrations/air-mon-calibrations/pages/MicroscopePage";
import AcetoneVaporiserPage from "./scenes/calibrations/air-mon-calibrations/pages/AcetoneVaporiserPage";
import GraticulePage from "./scenes/calibrations/air-mon-calibrations/pages/GraticulePage";
import PrimaryFlowmeterPage from "./scenes/calibrations/air-mon-calibrations/pages/PrimaryFlowmeterPage";
import AnalysisPage from "./scenes/fibre/pages/AnalysisPage";
import CalibrationsFibreID from "./scenes/calibrations/fibre-id-calibrations/index";

// Lazy loaded components
const Projects = lazy(() => import("./scenes/projects"));
const SampleList = lazy(() =>
  import("./scenes/air-monitoring/air-monitoring-sample-list")
);
const NewSample = lazy(() => import("./scenes/air-monitoring/new-sample"));
const EditSample = lazy(() => import("./scenes/air-monitoring/edit-sample"));
const Analysis = lazy(() => import("./scenes/air-monitoring/analysis"));
const Users = lazy(() => import("./scenes/users"));
const Profile = lazy(() => import("./scenes/profile"));
const AsbestosAssessment = lazy(() => import("./scenes/asbestos-assessment"));
const ResidentialAssessment = lazy(() =>
  import("./scenes/asbestos-assessment/ResidentialAssessment")
);
const AssessmentSamples = lazy(() =>
  import("./scenes/asbestos-assessment/assessment-samples")
);
const Clients = lazy(() => import("./scenes/clients"));

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
                          path="/clients"
                          element={
                            <PermissionRoute
                              requiredPermissions={["clients.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Clients />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
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
                              <Suspense fallback={<LoadingSpinner />}>
                                <SampleList />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples/new"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.create"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <NewSample />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/samples/edit/:sampleId"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.edit"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <EditSample />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/air-monitoring/shift/:shiftId/analysis"
                          element={
                            <PermissionRoute
                              requiredPermissions={["jobs.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Analysis />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/projects"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Projects />
                              </Suspense>
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
                              <Suspense fallback={<LoadingSpinner />}>
                                <Users />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/profile"
                          element={
                            <Suspense fallback={<LoadingSpinner />}>
                              <Profile />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/asbestos-assessment"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AsbestosAssessment />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/asbestos-assessment/residential"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ResidentialAssessment />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/asbestos-assessment/samples"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AssessmentSamples />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/timesheets"
                          element={
                            <PermissionRoute
                              requiredPermissions={["timesheets.view"]}
                            >
                              <Timesheets />
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
                          path="/calibrations"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <Calibrations />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/air-pump"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <AirPumpPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/flowmeter"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <FlowmeterPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/efa"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <EFAPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/microscope"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <MicroscopePage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/acetone-vaporiser"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <AcetoneVaporiserPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/graticule"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <GraticulePage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/calibrations/primary-flowmeter"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <PrimaryFlowmeterPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/fibreID/analysis"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <AnalysisPage />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/fibreID/calibrations"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <CalibrationsFibreID />
                            </ProtectedRoute>
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
