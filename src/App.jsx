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
import Readings from "./scenes/air-monitoring/readings";
import Projects from "./scenes/projects";

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
                  path="/air-monitoring/shifts/:shiftId/samples"
                  element={<Samples />}
                />
                <Route
                  path="/air-monitoring/samples/:sampleId/readings"
                  element={<Readings />}
                />
                <Route path="/projects" element={<Projects />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/invoices" element={<Invoices />} />
              </Routes>
            </main>
          </BrowserRouter>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
