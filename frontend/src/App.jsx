import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import { AuthProvider } from "./context/AuthContext";
import { Suspense, lazy, useState, useEffect } from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";
import PerformanceMonitor from "./components/PerformanceMonitor";

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
import Calibrations from "./scenes/calibrations";
import AirPumpPage from "./scenes/calibrations/AirPumpPage.jsx";
import AirPumpCalibrationPage from "./scenes/calibrations/AirPumpCalibrationPage.jsx";
import FlowmeterPage from "./scenes/calibrations/FlowmeterPage.jsx";
import EFAPage from "./scenes/calibrations/EFAPage.jsx";
import MicroscopePage from "./scenes/calibrations/MicroscopePage.jsx";
import AcetoneVaporiserPage from "./scenes/calibrations/AcetoneVaporiserPage.jsx";
import GraticulePage from "./scenes/calibrations/GraticulePage.jsx";
import PrimaryFlowmeterPage from "./scenes/calibrations/PrimaryFlowmeterPage.jsx";
import EquipmentList from "./scenes/records/EquipmentList.jsx";
import FibreIdIndex from "./scenes/fibreID/index.jsx";
import AnalysisPage from "./scenes/fibreID/AnalysisPage.jsx";
import ClientSuppliedJobs from "./scenes/fibreID/ClientSuppliedJobs.jsx";
import AsbestosAssessmentJobs from "./scenes/fibreID/AsbestosAssessmentJobs.jsx";
import AsbestosAssessmentSamples from "./scenes/fibreID/AsbestosAssessmentSamples.jsx";
import ClientSuppliedSamples from "./scenes/fibreID/ClientSuppliedSamples.jsx";
import AssessmentJobsPage from "./scenes/surveys/asbestos";
import AssessmentItemsPage from "./scenes/surveys/asbestos/AssessmentItems";

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

const AsbestosClearance = lazy(() =>
  import("./scenes/clearances/AsbestosClearance")
);

const ClearanceItems = lazy(() => import("./scenes/clearances/ClearanceItems"));

const ClearanceReports = lazy(() =>
  import("./scenes/clearances/AsbestosClearance")
);

const Clients = lazy(() => import("./scenes/clients"));
const AdminDashboard = lazy(() => import("./scenes/admin/AdminDashboard"));
const ReportTemplates = lazy(() => import("./scenes/admin/ReportTemplates"));

const TemplateTestPage = lazy(() => import("./scenes/admin/TemplateTestPage"));

// New lazy loaded components for missing pages
const LeadAssessment = lazy(() =>
  import("./scenes/surveys/lead/LeadAssessment")
);

// New survey page components
const ResidentialAsbestosAssessment = lazy(() =>
  import("./scenes/surveys/residential-asbestos")
);
const AsbestosManagementPlan = lazy(() =>
  import("./scenes/surveys/asbestos-management-plan")
);
const HazardousMaterialsManagementPlan = lazy(() =>
  import("./scenes/surveys/hazardous-materials-management-plan")
);
const MouldMoistureAssessment = lazy(() =>
  import("./scenes/surveys/mould-moisture")
);
const LeadClearance = lazy(() => import("./scenes/clearances/LeadClearance"));
const MouldValidation = lazy(() =>
  import("./scenes/clearances/MouldValidation")
);

// New dashboard components
const SurveysDashboard = lazy(() => import("./scenes/surveys"));
const ClearancesDashboard = lazy(() => import("./scenes/clearances"));
const LaboratoryDashboard = lazy(() => import("./scenes/laboratory"));

// New landing page components
const Databases = lazy(() => import("./scenes/databases"));
const Reports = lazy(() => import("./scenes/reports"));
const Records = lazy(() => import("./scenes/records"));
const AsbestosRemoval = lazy(() => import("./scenes/asbestos-removal"));

// Records pages
const TrainingRecords = lazy(() => import("./scenes/records/training"));
const StaffMeetings = lazy(() => import("./scenes/records/staff-meetings"));
const DocumentRegister = lazy(() =>
  import("./scenes/records/document-register")
);
const ApprovedSuppliers = lazy(() =>
  import("./scenes/records/approved-suppliers")
);
const AssetRegister = lazy(() => import("./scenes/records/asset-register"));
const Incidents = lazy(() => import("./scenes/records/incidents"));
const OHSEnvironmental = lazy(() =>
  import("./scenes/records/ohs-environmental")
);
const ImpartialityRisks = lazy(() =>
  import("./scenes/records/impartiality-risks")
);
const Feedback = lazy(() => import("./scenes/records/feedback"));
const QualityControl = lazy(() => import("./scenes/records/quality-control"));
const IndoorAirQuality = lazy(() =>
  import("./scenes/records/indoor-air-quality")
);
const Blanks = lazy(() => import("./scenes/records/blanks"));
const Audits = lazy(() => import("./scenes/records/audits"));

const ProjectReports = lazy(() =>
  import("./scenes/reports/ProjectReports.jsx")
);

function App() {
  const [theme, colorMode] = useMode();
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);

  // Enable performance monitor in development or when SHIFT+P is pressed
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.shiftKey && event.key === "P") {
        setShowPerformanceMonitor((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route
                          path="/clients"
                          element={
                            <PermissionRoute
                              requiredPermissions={["clients.view"]}
                            >
                              <Navigate to="/databases?db=clients" replace />
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
                              <Navigate to="/databases?db=projects" replace />
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
                              <Navigate to="/databases?db=invoices" replace />
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
                          path="/surveys"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <SurveysDashboard />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />

                        <Route
                          path="/surveys/lead"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <LeadAssessment />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/surveys/residential-asbestos"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ResidentialAsbestosAssessment />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/surveys/asbestos-management-plan"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AsbestosManagementPlan />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/surveys/hazardous-materials-management-plan"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <HazardousMaterialsManagementPlan />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/surveys/mould-moisture"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <MouldMoistureAssessment />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances/asbestos"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AsbestosClearance />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances/lead"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <LeadClearance />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances/mould"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <MouldValidation />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances/:id/details"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AsbestosClearance />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances/:clearanceId/reports"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ClearanceReports />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances/:clearanceId/items"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ClearanceItems />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/clearances"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ClearancesDashboard />
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
                          path="/calibrations/pump/:pumpId"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <AirPumpCalibrationPage />
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
                          path="/laboratory-equipment"
                          element={
                            <ProtectedRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <EquipmentList />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/fibre-id"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <FibreIdIndex />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/fibre-id/client-supplied"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <ClientSuppliedJobs />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/fibre-id/ldjobs"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <AsbestosAssessmentJobs />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/fibre-id/ldjobs/:assessmentId/samples"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AsbestosAssessmentSamples />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/fibre-id/client-supplied/:jobId/samples"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ClientSuppliedSamples />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/fibre-id/analysis/:sampleId"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AnalysisPage />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/assessments"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <AssessmentJobsPage />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/assessments/:id/items"
                          element={
                            <PermissionRoute
                              requiredPermissions={["asbestos.view"]}
                            >
                              <AssessmentItemsPage />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/admin"
                          element={
                            <PermissionRoute
                              requiredPermissions={["admin.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AdminDashboard />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/admin/report-templates"
                          element={
                            <PermissionRoute
                              requiredPermissions={["admin.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ReportTemplates />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />

                        <Route
                          path="/admin/template-test"
                          element={
                            <PermissionRoute
                              requiredPermissions={["admin.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <TemplateTestPage />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/laboratory"
                          element={
                            <PermissionRoute
                              requiredPermissions={["fibre.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <LaboratoryDashboard />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/databases"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Databases />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/reports"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Reports />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/reports/project/:projectId"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ProjectReports />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Records />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/laboratory/equipment"
                          element={
                            <PermissionRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <EquipmentList />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/laboratory/calibrations"
                          element={
                            <PermissionRoute
                              requiredPermissions={["calibrations.view"]}
                            >
                              <Calibrations />
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/training"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <TrainingRecords />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/staff-meetings"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <StaffMeetings />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/document-register"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <DocumentRegister />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/approved-suppliers"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ApprovedSuppliers />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/asset-register"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AssetRegister />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/incidents"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Incidents />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/ohs-environmental"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <OHSEnvironmental />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/impartiality-risks"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <ImpartialityRisks />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/feedback"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Feedback />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/quality-control"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <QualityControl />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/indoor-air-quality"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <IndoorAirQuality />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/blanks"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Blanks />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/records/audits"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <Audits />
                              </Suspense>
                            </PermissionRoute>
                          }
                        />
                        <Route
                          path="/asbestos-removal"
                          element={
                            <PermissionRoute
                              requiredPermissions={["projects.view"]}
                            >
                              <Suspense fallback={<LoadingSpinner />}>
                                <AsbestosRemoval />
                              </Suspense>
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
          <PerformanceMonitor show={showPerformanceMonitor} />
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
