import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Grid,
  Button,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { projects, getProjectClient } from "../../data/mockData";

const JOBS_KEY = "ldc_jobs";

const AirMonJob = () => {
  const { jobId } = useParams();
  const theme = useTheme();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    // Load job data from localStorage
    const stored = localStorage.getItem(JOBS_KEY);
    if (stored) {
      const jobs = JSON.parse(stored);
      const foundJob = jobs.find((j) => j.id === parseInt(jobId));
      if (foundJob) {
        setJob(foundJob);
        const foundProject = projects.find((p) => p.id === foundJob.projectId);
        if (foundProject) {
          setProject(foundProject);
          setClient(getProjectClient(foundProject.id));
        }
      }
    }
  }, [jobId]);

  if (!job) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate("/air-monitoring")}>
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h4"
            sx={{
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
              fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
            }}
          >
            {job.name}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Job Details
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1">
                <strong>Project:</strong> {project?.name || "N/A"}
              </Typography>
              <Typography variant="body1">
                <strong>Client:</strong> {client?.name || "N/A"}
              </Typography>
              <Typography variant="body1">
                <strong>Status:</strong> {job.status}
              </Typography>
              <Typography variant="body1">
                <strong>Start Date:</strong> {job.startDate}
              </Typography>
              <Typography variant="body1">
                <strong>Location:</strong> {job.location}
              </Typography>
              <Typography variant="body1">
                <strong>Description:</strong> {job.description}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
              <Button
                variant="contained"
                onClick={() =>
                  navigate(`/air-monitoring/jobs/${job.id}/shifts`)
                }
              >
                View Shifts
              </Button>
              <Button variant="outlined">Print Report</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AirMonJob;
