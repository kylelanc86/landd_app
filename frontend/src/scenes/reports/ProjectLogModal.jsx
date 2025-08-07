import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Stack,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Close as CloseIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { format } from "date-fns";
import {
  timesheetService,
  jobService,
  clientSuppliedJobsService,
} from "../../services/api";
import asbestosClearanceReportService from "../../services/asbestosClearanceReportService";
import reportService from "../../services/reportService";

// Helper function to calculate hours between two time strings (HH:mm format)
const calculateHours = (startTime, endTime) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const totalMinutes =
    endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  return (totalMinutes / 60).toFixed(2);
};

const ProjectLogModal = ({ open, onClose, project }) => {
  const [timesheets, setTimesheets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(async () => {
    console.log("Project data received:", project);
    if (!project?._id) {
      console.log("No project ID available");
      return;
    }

    setLoading(true);
    try {
      // Load timesheets
      console.log("Loading timesheets for project:", project._id);
      let timesheetData = [];
      try {
        const timesheetResponse = await timesheetService.getByProject(
          project._id,
          {
            startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
            endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
          }
        );
        console.log("Timesheet response in modal:", timesheetResponse);

        // Handle different response structures
        if (timesheetResponse?.data?.data) {
          // Response has nested data property
          timesheetData = timesheetResponse.data.data;
        } else if (Array.isArray(timesheetResponse?.data)) {
          // Response data is directly an array
          timesheetData = timesheetResponse.data;
        } else if (typeof timesheetResponse?.data === "object") {
          // Response data might be in a different property
          const possibleArrays = Object.values(timesheetResponse.data).filter(
            Array.isArray
          );
          if (possibleArrays.length > 0) {
            timesheetData = possibleArrays[0];
          }
        }

        console.log("Processed timesheet data:", {
          originalResponse: timesheetResponse?.data,
          processedData: timesheetData,
          length: timesheetData.length,
        });
      } catch (error) {
        console.error("Error fetching timesheets:", error);
      }

      // Load jobs - get all types of jobs for this project
      console.log("Loading jobs for project:", project._id);
      const [airMonitoringJobs, clientSuppliedJobs] = await Promise.all([
        jobService.getAll(),
        clientSuppliedJobsService.getByProject(project._id),
      ]);
      console.log("Air monitoring jobs response:", airMonitoringJobs);
      console.log("Client supplied jobs response:", clientSuppliedJobs);

      // Filter air monitoring jobs for this project
      const airMonitoringProjectJobs =
        airMonitoringJobs.data?.filter(
          (job) =>
            job.projectId === project._id || job.projectId?._id === project._id
        ) || [];

      // Combine all job types
      const projectJobs = [
        ...airMonitoringProjectJobs,
        ...(clientSuppliedJobs.data || []),
      ];

      // Load reports for this project
      const allReports = [];

      // Get asbestos assessment reports
      try {
        console.log(
          "Loading asbestos assessment reports for project:",
          project._id
        );
        const assessmentResponse = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/reports/asbestos-assessment/${project._id}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        console.log("Assessment response status:", assessmentResponse.status);
        if (assessmentResponse.ok) {
          const assessmentReports = await assessmentResponse.json();
          allReports.push(
            ...assessmentReports.map((report) => ({
              ...report,
              type: "Asbestos Assessment",
              category: "assessment",
            }))
          );
        }
      } catch (error) {
        console.error("Error loading assessment reports:", error);
      }

      // Get clearance reports
      try {
        console.log("Loading clearance reports for project:", project._id);
        const clearanceReports = await asbestosClearanceReportService.getAll({
          projectId: project._id,
        });
        console.log("Clearance reports response:", clearanceReports);
        if (clearanceReports.reports) {
          allReports.push(
            ...clearanceReports.reports.map((report) => ({
              ...report,
              type: "Asbestos Clearance",
              category: "clearance",
            }))
          );
        }
      } catch (error) {
        console.error("Error loading clearance reports:", error);
      }

      // Get fibre ID reports
      try {
        const fibreIdReports = await reportService.getFibreIdReports(
          project._id
        );
        allReports.push(
          ...fibreIdReports.map((report) => ({
            ...report,
            type: "Fibre ID Analysis",
            category: "fibre_id",
          }))
        );
      } catch (error) {
        console.error("Error loading fibre ID reports:", error);
      }

      // Get invoices
      try {
        const invoicesResponse = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/reports/invoices/${project._id}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        if (invoicesResponse.ok) {
          const invoicesData = await invoicesResponse.json();
          allReports.push(
            ...invoicesData.map((invoice) => ({
              ...invoice,
              type: "Invoice",
              category: "invoice",
            }))
          );
        }
      } catch (error) {
        console.error("Error loading invoices:", error);
      }

      // Set the processed timesheet data
      console.log("Setting final timesheet data:", timesheetData);
      setTimesheets(timesheetData);
      setJobs(projectJobs || []);
      setReports(allReports || []);
    } catch (error) {
      console.error("Error loading project log data:", error);
    } finally {
      setLoading(false);
    }
  }, [project?._id, startDate, endDate]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, project, startDate, endDate, loadData]);

  const handleExportCSV = () => {
    // Prepare timesheet data
    const timesheetRows = timesheets.map((entry) => ({
      Date: format(new Date(entry.date), "dd/MM/yyyy"),
      "Employee Name": `${entry.userId?.firstName} ${entry.userId?.lastName}`,
      "Start Time": entry.startTime,
      "End Time": entry.endTime,
      "Total Hours": entry.totalHours,
      Description: entry.description,
      Type: "Timesheet Entry",
      Category: "Timesheet",
    }));

    // Prepare jobs data
    const jobRows = jobs.map((job) => ({
      Date: format(new Date(job.createdAt), "dd/MM/yyyy"),
      "Job ID": job.jobID,
      Name: job.name,
      Status: job.status,
      Type: "Job",
      Category: "Job",
    }));

    // Prepare reports data
    const reportRows = reports.map((report) => ({
      Date: format(new Date(report.date || report.createdAt), "dd/MM/yyyy"),
      "Report ID": report.id || report._id,
      "Report Type": report.type,
      Status: report.status || "Unknown",
      Description: report.description || report.name || "N/A",
      Type: "Report",
      Category: report.category || "Report",
    }));

    // Combine all rows
    const allRows = [...timesheetRows, ...jobRows, ...reportRows];

    // Get all unique headers
    const headers = Array.from(
      new Set(allRows.flatMap((row) => Object.keys(row)))
    );

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...allRows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || "";
            // Escape commas and quotes
            return `"${value.toString().replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${project.projectID}_project_log.csv`;
    link.click();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">
            Project Log: {project?.projectID} - {project?.name}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
              slots={{ textField: TextField }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              slots={{ textField: TextField }}
            />
          </LocalizationProvider>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
            disabled={
              loading || (!timesheets.length && !jobs.length && !reports.length)
            }
          >
            Export to CSV
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
              <Tab label={`Timesheets (${timesheets.length})`} />
              <Tab label={`Jobs (${jobs.length})`} />
              <Tab label={`Reports (${reports.length})`} />
            </Tabs>

            {activeTab === 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Timesheet Entries
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 4 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Employee</TableCell>
                        <TableCell>Start Time</TableCell>
                        <TableCell>End Time</TableCell>
                        <TableCell>Total Hours</TableCell>
                        <TableCell>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timesheets.map((entry) => (
                        <TableRow key={entry._id}>
                          <TableCell>
                            {format(new Date(entry.date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {entry.userId?.firstName}{" "}
                            {entry.userId?.lastName || entry.userId}
                          </TableCell>
                          <TableCell>{entry.startTime}</TableCell>
                          <TableCell>{entry.endTime}</TableCell>
                          <TableCell>
                            {entry.totalHours ||
                              (entry.startTime && entry.endTime
                                ? calculateHours(entry.startTime, entry.endTime)
                                : "N/A")}
                          </TableCell>
                          <TableCell>
                            {entry.description ||
                              (entry.isBreak ? "Break" : "Work")}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!timesheets.length && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            No timesheet entries found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {activeTab === 1 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Jobs
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Job ID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Created Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job._id}>
                          <TableCell>{job.jobID}</TableCell>
                          <TableCell>{job.name}</TableCell>
                          <TableCell>
                            {format(new Date(job.createdAt), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{job.status}</TableCell>
                        </TableRow>
                      ))}
                      {!jobs.length && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            No jobs found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {activeTab === 2 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Reports
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Report Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id || report._id}>
                          <TableCell>
                            {format(
                              new Date(report.date || report.createdAt),
                              "dd/MM/yyyy"
                            )}
                          </TableCell>
                          <TableCell>{report.type}</TableCell>
                          <TableCell>{report.status || "Unknown"}</TableCell>
                          <TableCell>
                            {report.description || report.name || "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!reports.length && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            No reports found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectLogModal;
