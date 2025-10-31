import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import { AuthProvider } from "./context/AuthContext";
import { PermissionDeniedProvider } from "./context/PermissionDeniedContext";
import { ProjectStatusesProvider } from "./context/ProjectStatusesContext";
import { SnackbarProvider } from "./context/SnackbarContext";

import { Suspense, lazy, useState, useEffect } from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";
import { isFeatureEnabled } from "./config/featureFlags";

// Regular imports
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Dashboard from "./scenes/dashboard";
import Invoices from "./scenes/invoices";
import Login from "./scenes/login";
import ResetPassword from "./scenes/login/ResetPassword";
import SetupPassword from "./scenes/auth/SetupPassword";
import AirMonitoring from "./scenes/air-monitoring";
import ProjectInformation from "./scenes/projects/ProjectInformation";
import Timesheets from "./scenes/timesheets";
import TimesheetReview from "./scenes/timesheets/review";
import MonthlyTimesheet from "./scenes/timesheets/monthly";
import Calibrations from "./scenes/records/calibrations";
import CalibrationFrequency from "./scenes/records/calibrations/CalibrationFrequency.jsx";
import AirPumpPage from "./scenes/records/calibrations/AirPumpPage.jsx";
import AirPumpCalibrationPage from "./scenes/records/calibrations/AirPumpCalibrationPage.jsx";
import FlowmeterPage from "./scenes/records/calibrations/FlowmeterPage.jsx";
import EFAPage from "./scenes/records/calibrations/EFAPage.jsx";
import PCMMicroscopePage from "./scenes/records/calibrations/PCMMicroscopePage.jsx";
import AcetoneVaporiserPage from "./scenes/records/calibrations/AcetoneVaporiserPage.jsx";
import GraticulePage from "./scenes/records/calibrations/GraticulePage.jsx";
import GraticuleHistoryPage from "./scenes/records/calibrations/GraticuleHistoryPage.jsx";
import PrimaryFlowmeterPage from "./scenes/records/calibrations/PrimaryFlowmeterPage.jsx";
import EquipmentList from "./scenes/records/EquipmentList.jsx";
import FibreIdIndex from "./scenes/fibreID/index.jsx";
import ClientSuppliedJobs from "./scenes/fibreID/ClientSuppliedJobs.jsx";
import LDsuppliedJobs from "./scenes/fibreID/LDsuppliedJobs.jsx";
import ClientSuppliedSamples from "./scenes/fibreID/ClientSuppliedSamples.jsx";
import ClientSuppliedFibreCountAnalysis from "./scenes/fibreID/ClientSuppliedFibreCountAnalysis.jsx";
import AssessmentItemsPage from "./scenes/surveys/asbestos/AssessmentItems";
import LDsuppliedAnalysisPage from "./scenes/fibreID/LDsuppliedAnalysisPage.jsx";
import LDsuppliedItems from "./scenes/fibreID/LDsuppliedItems.jsx";
import AssessmentJobsPage from "./scenes/surveys/asbestos";
import UserManual from "./scenes/userManual/UserManual";

// Lazy loaded components
const Projects = lazy(() => import("./scenes/projects"));
const DraftInvoicePage = lazy(() =>
  import("./scenes/invoices/DraftInvoicePage")
);
const EditInvoicePage = lazy(() => import("./scenes/invoices/EditInvoicePage"));
const SampleList = lazy(() =>
  import("./scenes/air-monitoring/air-monitoring-sample-list")
);
const NewSample = lazy(() => import("./scenes/air-monitoring/new-sample"));
const EditSample = lazy(() => import("./scenes/air-monitoring/edit-sample"));
const Analysis = lazy(() => import("./scenes/air-monitoring/analysis"));
const Users = lazy(() => import("./scenes/users"));
const EditUserPage = lazy(() => import("./scenes/users/EditUserPage"));
const AddUserPage = lazy(() => import("./scenes/users/AddUserPage"));
const Profile = lazy(() => import("./scenes/profile"));

const ClearanceItems = lazy(() => import("./scenes/clearances/ClearanceItems"));

const Clients = lazy(() => import("./scenes/clients"));
const ClientDetails = lazy(() => import("./scenes/clients/ClientDetails"));
const AdminDashboard = lazy(() => import("./scenes/admin/AdminDashboard"));
const ReportTemplates = lazy(() => import("./scenes/admin/ReportTemplates"));

const TemplateTestPage = lazy(() => import("./scenes/admin/TemplateTestPage"));
const InvoiceItems = lazy(() => import("./scenes/admin/InvoiceItems"));
const CustomDataFields = lazy(() => import("./scenes/admin/CustomDataFields"));
const ArchivedData = lazy(() => import("./scenes/admin/ArchivedData"));

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
const LaboratoryDashboard = lazy(() => import("./scenes/laboratory"));

// New landing page components
const Reports = lazy(() => import("./scenes/reports"));
const Records = lazy(() => import("./scenes/records"));
const AsbestosRemoval = lazy(() => import("./scenes/asbestos-removal"));
const AsbestosRemovalJobDetails = lazy(() =>
  import("./scenes/asbestos-removal/AsbestosRemovalJobDetails")
);

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

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <PermissionDeniedProvider>
            <SnackbarProvider>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/setup-password" element={<SetupPassword />} />

                  {/* Protected routes */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <ProjectStatusesProvider>
                          <Layout>
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
                                path="/clients/:id"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["clients.view"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <ClientDetails />
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
                                path="/projects/add-new"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["projects.create"]}
                                  >
                                    <ProjectInformation />
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
                                path="/invoices"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["invoices.view"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <Invoices />
                                    </Suspense>
                                  </PermissionRoute>
                                }
                              />
                              <Route
                                path="/invoices/draft"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["invoices.create"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <DraftInvoicePage />
                                    </Suspense>
                                  </PermissionRoute>
                                }
                              />
                              <Route
                                path="/invoices/edit/:invoiceId"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["invoices.edit"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <EditInvoicePage />
                                    </Suspense>
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
                                path="/users/edit/:userId"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["users.edit"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <EditUserPage />
                                    </Suspense>
                                  </PermissionRoute>
                                }
                              />
                              <Route
                                path="/users/add"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["users.create"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <AddUserPage />
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
                                path="/user-manual"
                                element={<UserManual />}
                              />

                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}

                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled(
                                "ADVANCED.ASBESTOS_REMOVAL"
                              ) && (
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
                              )}

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
                                path="/records/laboratory/calibrations/list"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <Calibrations />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/air-pump"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <AirPumpPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/pump/:pumpId"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <AirPumpCalibrationPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/flowmeter"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <FlowmeterPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/efa"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <EFAPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/microscope"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <PCMMicroscopePage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/acetone-vaporiser"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <AcetoneVaporiserPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/graticule"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <GraticulePage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/graticule/history"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["calibrations.view"]}
                                  >
                                    <GraticuleHistoryPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/frequency"
                                element={
                                  <ProtectedRoute
                                    requiredPermissions={["admin.access"]}
                                  >
                                    <CalibrationFrequency />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/records/laboratory/calibrations/primary-flowmeter"
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
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
                                <Route
                                  path="/fibre-id/ldjobs"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["fibre.view"]}
                                    >
                                      <LDsuppliedJobs />
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
                                <Route
                                  path="/fibre-id/assessment/:assessmentId/items"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["fibre.view"]}
                                    >
                                      <Suspense fallback={<LoadingSpinner />}>
                                        <LDsuppliedItems />
                                      </Suspense>
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
                                <Route
                                  path="/fibre-id/assessment/:assessmentId/item/:itemNumber/analysis"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["fibre.view"]}
                                    >
                                      <Suspense fallback={<LoadingSpinner />}>
                                        <LDsuppliedAnalysisPage />
                                      </Suspense>
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
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
                              )}
                              {isFeatureEnabled(
                                "ADVANCED.ASBESTOS_REMOVAL"
                              ) && (
                                <Route
                                  path="/client-supplied/:jobId/analysis"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["projects.view"]}
                                    >
                                      <Suspense fallback={<LoadingSpinner />}>
                                        <ClientSuppliedFibreCountAnalysis />
                                      </Suspense>
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled("ADVANCED.FIBRE_ID") && (
                                <Route
                                  path="/fibre-id/client-supplied/:jobId/analysis"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["fibre.view"]}
                                    >
                                      <Suspense fallback={<LoadingSpinner />}>
                                        <ClientSuppliedFibreCountAnalysis />
                                      </Suspense>
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.SURVEYS") && (
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
                              )}
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
                              {isFeatureEnabled(
                                "ADMIN.TEMPLATE_MANAGEMENT"
                              ) && (
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
                              )}

                              {isFeatureEnabled(
                                "ADMIN.TEMPLATE_MANAGEMENT"
                              ) && (
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
                              )}
                              <Route
                                path="/admin/invoice-items"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["admin.view"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <InvoiceItems />
                                    </Suspense>
                                  </PermissionRoute>
                                }
                              />
                              <Route
                                path="/admin/custom-data-fields"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["admin.view"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <CustomDataFields />
                                    </Suspense>
                                  </PermissionRoute>
                                }
                              />
                              <Route
                                path="/admin/archived-data"
                                element={
                                  <PermissionRoute
                                    requiredPermissions={["admin.view"]}
                                  >
                                    <Suspense fallback={<LoadingSpinner />}>
                                      <ArchivedData />
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

                              {isFeatureEnabled("ADVANCED.REPORTS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.REPORTS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
                                <Route
                                  path="/records/laboratory/equipment"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={[
                                        "calibrations.view",
                                      ]}
                                    >
                                      <EquipmentList />
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
                                <>
                                  <Route
                                    path="/records/laboratory/calibrations"
                                    element={
                                      <PermissionRoute
                                        requiredPermissions={[
                                          "calibrations.view",
                                        ]}
                                      >
                                        <Calibrations />
                                      </PermissionRoute>
                                    }
                                  />
                                  <Route
                                    path="/records/laboratory/calibrations/frequency"
                                    element={
                                      <PermissionRoute
                                        requiredPermissions={["admin.access"]}
                                      >
                                        <CalibrationFrequency />
                                      </PermissionRoute>
                                    }
                                  />
                                </>
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled("ADVANCED.RECORDS") && (
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
                              )}
                              {isFeatureEnabled(
                                "ADVANCED.ASBESTOS_REMOVAL"
                              ) && (
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
                              )}
                              {isFeatureEnabled(
                                "ADVANCED.ASBESTOS_REMOVAL"
                              ) && (
                                <Route
                                  path="/asbestos-removal/jobs/:jobId/details"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["projects.view"]}
                                    >
                                      <Suspense fallback={<LoadingSpinner />}>
                                        <AsbestosRemovalJobDetails />
                                      </Suspense>
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled(
                                "ADVANCED.ASBESTOS_REMOVAL"
                              ) && (
                                <Route
                                  path="/client-supplied"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["projects.view"]}
                                    >
                                      <ClientSuppliedJobs />
                                    </PermissionRoute>
                                  }
                                />
                              )}
                              {isFeatureEnabled(
                                "ADVANCED.ASBESTOS_REMOVAL"
                              ) && (
                                <Route
                                  path="/client-supplied/:jobId/samples"
                                  element={
                                    <PermissionRoute
                                      requiredPermissions={["projects.view"]}
                                    >
                                      <Suspense fallback={<LoadingSpinner />}>
                                        <ClientSuppliedSamples />
                                      </Suspense>
                                    </PermissionRoute>
                                  }
                                />
                              )}
                            </Routes>
                          </Layout>
                        </ProjectStatusesProvider>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </BrowserRouter>
            </SnackbarProvider>
          </PermissionDeniedProvider>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
