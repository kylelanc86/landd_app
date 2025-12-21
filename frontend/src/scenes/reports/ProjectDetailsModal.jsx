import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
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

// Helper function to calculate hours between two time strings (HH:mm format)
const calculateHours = (startTime, endTime) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const totalMinutes =
    endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  return (totalMinutes / 60).toFixed(2);
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90%",
  maxHeight: "90vh",
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
  overflow: "auto",
};

const ProjectDetailsModal = ({ open, onClose, project }) => {
  const [timesheets, setTimesheets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [updatingJob, setUpdatingJob] = useState(null);

  const loadData = useCallback(async () => {
    if (!project?._id) return;

    setLoading(true);
    try {
      // Load timesheets
      const timesheetResponse = await timesheetService.getByProject(
        project._id,
        {
          startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
          endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
        }
      );

      // Load jobs - get all types of jobs for this project
      const [airMonitoringJobs, clientSuppliedJobs] = await Promise.all([
        jobService.getAll(),
        clientSuppliedJobsService.getByProject(project._id),
      ]);

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

      setTimesheets(timesheetResponse.data || []);
      setJobs(projectJobs || []);
    } catch (error) {
      console.error("Error loading project details:", error);
    } finally {
      setLoading(false);
    }
  }, [project?._id, startDate, endDate]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, project, startDate, endDate, loadData]);

  const handleCompleteJob = async (job) => {
    if (updatingJob) return;

    setUpdatingJob(job._id);
    try {
      if (job.type === "air_monitoring") {
        await jobService.update(job._id, { ...job, status: "complete" });
      } else if (job.type === "client_supplied") {
        await clientSuppliedJobsService.update(job._id, {
          ...job,
          status: "complete",
        });
      }

      // Refresh the data
      await loadData();
    } catch (error) {
      console.error("Error completing job:", error);
    } finally {
      setUpdatingJob(null);
    }
  };

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
    }));

    // Prepare jobs data
    const jobRows = jobs.map((job) => ({
      Date: format(new Date(job.createdAt), "dd/MM/yyyy"),
      "Job ID": job.jobID,
      Name: job.name,
      Status: job.status,
      Type: "Job",
    }));

    // Combine all rows
    const allRows = [...timesheetRows, ...jobRows];

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
    link.download = `${project.projectID}_details.csv`;
    link.click();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h5" component="h2">
            Project Details: {project?.projectID} - {project?.name}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

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
            disabled={loading || (!timesheets.length && !jobs.length)}
          >
            Export to CSV
          </Button>
        </Stack>

        <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
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
                <TableCell>Time Logged</TableCell>
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
                    {entry.userId?.firstName} {entry.userId?.lastName}
                  </TableCell>
                  <TableCell>{entry.startTime}</TableCell>
                  <TableCell>{entry.endTime}</TableCell>
                  <TableCell>
                    {entry.totalHours ||
                      (entry.startTime && entry.endTime
                        ? calculateHours(entry.startTime, entry.endTime)
                        : "N/A")}
                  </TableCell>
                  <TableCell>{entry.description}</TableCell>
                </TableRow>
              ))}
              {timesheets.length > 0 && (
                <TableRow
                  sx={{
                    backgroundColor: "rgba(0, 0, 0, 0.04)",
                    fontWeight: "bold",
                  }}
                >
                  <TableCell colSpan={4} align="right">
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                      Total Hours:
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                      {timesheets
                        .reduce((total, entry) => {
                          const hours =
                            entry.totalHours ||
                            (entry.startTime && entry.endTime
                              ? parseFloat(
                                  calculateHours(entry.startTime, entry.endTime)
                                )
                              : 0);
                          return (
                            total +
                            (typeof hours === "number"
                              ? hours
                              : parseFloat(hours) || 0)
                          );
                        }, 0)
                        .toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
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
                <TableCell align="center">Actions</TableCell>
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
                  <TableCell align="center">
                    {job.status !== "complete" && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="success"
                        onClick={() => handleCompleteJob(job)}
                        disabled={loading || updatingJob === job._id}
                      >
                        Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!jobs.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No jobs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Modal>
  );
};

export default ProjectDetailsModal;
