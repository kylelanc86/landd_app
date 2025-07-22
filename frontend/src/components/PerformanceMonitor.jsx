import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
  Alert,
  LinearProgress,
  Grid,
  Paper,
} from "@mui/material";
import {
  Speed as SpeedIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import performanceMonitor from "../utils/performanceMonitor";
import pdfPerformanceMonitor from "../utils/pdfPerformanceMonitor";

const PerformanceMonitor = ({ show = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [performanceData, setPerformanceData] = useState({
    pageLoads: {},
    timers: {},
    pdfGenerations: {},
  });

  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!show) return;

    const updatePerformanceData = () => {
      // Get performance data from monitors
      const pageLoads = performanceMonitor.pageLoads;
      const timers = performanceMonitor.timers;
      const pdfGenerations = pdfPerformanceMonitor.pdfGenerations;

      setPerformanceData({
        pageLoads,
        timers,
        pdfGenerations,
      });
      setLastUpdate(new Date());
    };

    // Update immediately
    updatePerformanceData();

    // Update every 2 seconds
    const interval = setInterval(updatePerformanceData, 2000);

    return () => clearInterval(interval);
  }, [show]);

  const getPerformanceStatus = (duration) => {
    if (duration > 10000)
      return { status: "critical", color: "error", icon: <WarningIcon /> };
    if (duration > 5000)
      return { status: "warning", color: "warning", icon: <WarningIcon /> };
    return { status: "good", color: "success", icon: <CheckCircleIcon /> };
  };

  const formatDuration = (duration) => {
    if (duration < 1000) return `${duration.toFixed(0)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const clearAllData = () => {
    performanceMonitor.clearTimers();
    performanceMonitor.clearPageLoads();
    pdfPerformanceMonitor.clearTimers();
    pdfPerformanceMonitor.clearStages();
    pdfPerformanceMonitor.clearPDFGenerations();
    setPerformanceData({
      pageLoads: {},
      timers: {},
      pdfGenerations: {},
    });
  };

  if (!show) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        maxWidth: 400,
      }}
    >
      <Card sx={{ boxShadow: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SpeedIcon color="primary" />
              <Typography variant="h6" component="h2">
                Performance Monitor
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton size="small" onClick={clearAllData}>
                <RefreshIcon />
              </IconButton>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Typography>

          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              {/* Page Loads */}
              {Object.keys(performanceData.pageLoads).length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Page Loads
                  </Typography>
                  <List dense>
                    {Object.entries(performanceData.pageLoads).map(
                      ([name, data]) => {
                        const status = getPerformanceStatus(data.duration || 0);
                        return (
                          <ListItem key={name} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={name}
                              secondary={`${formatDuration(
                                data.duration || 0
                              )}`}
                            />
                            <Chip
                              icon={status.icon}
                              label={status.status}
                              color={status.color}
                              size="small"
                            />
                          </ListItem>
                        );
                      }
                    )}
                  </List>
                </Paper>
              )}

              {/* Active Timers */}
              {Object.keys(performanceData.timers).length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Active Timers
                  </Typography>
                  <List dense>
                    {Object.entries(performanceData.timers).map(
                      ([name, data]) => {
                        const elapsed = data.start
                          ? Date.now() - data.start
                          : 0;
                        const status = getPerformanceStatus(elapsed);
                        return (
                          <ListItem key={name} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={name}
                              secondary={`${formatDuration(elapsed)} (running)`}
                            />
                            <Chip
                              icon={status.icon}
                              label="active"
                              color={status.color}
                              size="small"
                            />
                          </ListItem>
                        );
                      }
                    )}
                  </List>
                </Paper>
              )}

              {/* PDF Generations */}
              {Object.keys(performanceData.pdfGenerations).length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    PDF Generations
                  </Typography>
                  <List dense>
                    {Object.entries(performanceData.pdfGenerations).map(
                      ([id, data]) => {
                        const elapsed = data.start
                          ? Date.now() - data.start
                          : 0;
                        const status = getPerformanceStatus(elapsed);
                        return (
                          <ListItem key={id} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={`${data.type} (${data.dataSize} items)`}
                              secondary={`${formatDuration(elapsed)} (${
                                data.completedStages
                              }/${data.totalStages} stages)`}
                            />
                            <Chip
                              icon={status.icon}
                              label="generating"
                              color={status.color}
                              size="small"
                            />
                          </ListItem>
                        );
                      }
                    )}
                  </List>
                </Paper>
              )}

              {Object.keys(performanceData.pageLoads).length === 0 &&
                Object.keys(performanceData.timers).length === 0 &&
                Object.keys(performanceData.pdfGenerations).length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No performance data available. Navigate between pages or
                    generate PDFs to see metrics.
                  </Alert>
                )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PerformanceMonitor;
