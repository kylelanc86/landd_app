import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Dashboard from "./scenes/dashboard";
import Invoices from "./scenes/invoices";
import Clients from "./scenes/clients";
import Calendar from "./scenes/calendar";
import AirMonitoring from "./scenes/air-monitoring";
import Shifts from "./scenes/air-monitoring/shifts";
import Samples from "./scenes/air-monitoring/samples";
import Projects from "./scenes/projects";
import SampleList from "./scenes/air-monitoring/air-monitoring-sample-list";
import NewSample from "./scenes/air-monitoring/new-sample";
import EditSample from "./scenes/air-monitoring/edit-sample";
import Analysis from "./scenes/air-monitoring/analysis";
import AsbestosAssessment from "./scenes/asbestos-assessment";
import AssessmentSamples from "./scenes/asbestos-assessment/assessment-samples";

function App() {
  const [theme, colorMode] = useMode();

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app">
          <BrowserRouter>
            <Sidebar />
            <main className="main-content">
              <div className="topbar">
                <Topbar />
              </div>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/air-monitoring" element={<AirMonitoring />} />
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
                <Route path="/asbestos-assessment" element={<AsbestosAssessment />} />
                <Route path="/asbestos-assessment/samples" element={<AssessmentSamples />} />

              </Routes>
            </main>
          </BrowserRouter>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
