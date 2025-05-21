import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import { sampleService, shiftService } from "../../services/api";

const SAMPLES_KEY = "ldc_samples";
const ANALYSIS_PROGRESS_KEY = "ldc_analysis_progress";

const Analysis = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [analysisDetails, setAnalysisDetails] = useState({
    microscope: "",
    testSlide: "",
    testSlideLines: "",
  });
  const [sampleAnalyses, setSampleAnalyses] = useState({});
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState(null);
  const inputRefs = useRef({});
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load samples and in-progress analysis data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch samples for this shift
        const samplesResponse = await sampleService.getByShift(shiftId);
        // Sort samples by the number after the hyphen
        const sortedSamples = samplesResponse.data.sort((a, b) => {
          const aNum = parseInt(a.sampleNumber.split("-")[1]);
          const bNum = parseInt(b.sampleNumber.split("-")[1]);
          return aNum - bNum;
        });
        setSamples(sortedSamples);

        // Initialize analyses for each sample
        const initialAnalyses = {};
        sortedSamples.forEach((sample) => {
          initialAnalyses[sample._id] = {
            edgesDistribution: "",
            backgroundDust: "",
            fibreCounts: Array(5)
              .fill()
              .map(() => Array(20).fill("")),
            fibresCounted: 0,
            fieldsCounted: 0,
          };
        });

        // Load in-progress analysis data if present
        const progressData = localStorage.getItem(ANALYSIS_PROGRESS_KEY);
        if (progressData) {
          const parsed = JSON.parse(progressData);
          if (parsed.shiftId === shiftId) {
            setAnalysisDetails(parsed.analysisDetails);
            // Merge saved analyses with new samples
            const mergedAnalyses = { ...initialAnalyses };
            Object.keys(parsed.sampleAnalyses).forEach((sampleId) => {
              if (mergedAnalyses[sampleId]) {
                mergedAnalyses[sampleId] = parsed.sampleAnalyses[sampleId];
              }
            });
            setSampleAnalyses(mergedAnalyses);
          } else {
            setSampleAnalyses(initialAnalyses);
          }
        } else {
          setSampleAnalyses(initialAnalyses);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shiftId]);

  const handleAnalysisDetailsChange = (e) => {
    setAnalysisDetails({
      ...analysisDetails,
      [e.target.name]: e.target.value,
    });
  };

  const handleSampleAnalysisChange = (sampleId, field, value) => {
    setSampleAnalyses((prev) => ({
      ...prev,
      [sampleId]: {
        ...prev[sampleId],
        [field]: value,
      },
    }));
  };

  const handleFibreCountChange = (sampleId, row, col, value) => {
    const newValue = value === "" ? "" : parseInt(value);
    if (isNaN(newValue) && value !== "") return;

    setSampleAnalyses((prev) => {
      const newAnalyses = { ...prev };
      const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];
      newFibreCounts[row][col] = newValue;

      // Calculate fibres counted and fields counted
      const fibresCounted = newFibreCounts
        .flat()
        .reduce((sum, val) => sum + (val || 0), 0);
      const fieldsCounted = newFibreCounts
        .flat()
        .filter((val) => val !== "").length;

      newAnalyses[sampleId] = {
        ...newAnalyses[sampleId],
        fibreCounts: newFibreCounts,
        fibresCounted,
        fieldsCounted,
      };

      return newAnalyses;
    });

    // Move to next cell
    const nextCol = col + 1;
    const nextRow = row;
    if (nextCol < 20) {
      // Move to next column in same row
      const nextInput = inputRefs.current[`${sampleId}-${nextRow}-${nextCol}`];
      if (nextInput) {
        nextInput.focus();
      }
    } else if (row < 4) {
      // Move to first column of next row
      const nextInput = inputRefs.current[`${sampleId}-${nextRow + 1}-0`];
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleClearTable = (sampleId) => {
    setSelectedSampleId(sampleId);
    setConfirmDialogOpen(true);
  };

  const confirmClearTable = () => {
    if (selectedSampleId) {
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        newAnalyses[selectedSampleId] = {
          ...newAnalyses[selectedSampleId],
          fibreCounts: Array(5)
            .fill()
            .map(() => Array(20).fill("")),
          fibresCounted: 0,
          fieldsCounted: 0,
        };
        return newAnalyses;
      });
    }
    setConfirmDialogOpen(false);
    setSelectedSampleId(null);
  };

  const isFilterUncountable = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    return (
      analysis?.edgesDistribution === "fail" ||
      analysis?.backgroundDust === "fail"
    );
  };

  const handleKeyDown = (e, sampleId, row, col) => {
    if (e.key === " ") {
      e.preventDefault();
      const newAnalyses = { ...sampleAnalyses };
      const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];

      // Fill next 10 cells with 0
      let lastFilledRow = row;
      let lastFilledCol = col;
      for (let i = 0; i < 10; i++) {
        const nextCol = col + i;
        if (nextCol < 20) {
          newFibreCounts[row][nextCol] = 0;
          lastFilledRow = row;
          lastFilledCol = nextCol;
        } else {
          const nextRow = row + 1;
          if (nextRow < 5) {
            newFibreCounts[nextRow][nextCol - 20] = 0;
            lastFilledRow = nextRow;
            lastFilledCol = nextCol - 20;
          }
        }
      }

      // Calculate new totals
      const fibresCounted = newFibreCounts
        .flat()
        .reduce((sum, val) => sum + (val || 0), 0);
      const fieldsCounted = newFibreCounts
        .flat()
        .filter((val) => val !== "").length;

      newAnalyses[sampleId] = {
        ...newAnalyses[sampleId],
        fibreCounts: newFibreCounts,
        fibresCounted,
        fieldsCounted,
      };

      setSampleAnalyses(newAnalyses);

      // Find next empty cell
      let nextEmptyRow = lastFilledRow;
      let nextEmptyCol = lastFilledCol + 1;

      while (nextEmptyRow < 5) {
        while (nextEmptyCol < 20) {
          if (newFibreCounts[nextEmptyRow][nextEmptyCol] === "") {
            const nextInput =
              inputRefs.current[`${sampleId}-${nextEmptyRow}-${nextEmptyCol}`];
            if (nextInput) {
              nextInput.focus();
              return;
            }
          }
          nextEmptyCol++;
        }
        nextEmptyRow++;
        nextEmptyCol = 0;
      }
    }
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    // Handle case where end time is on the next day
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    return Math.round((end - start) / (1000 * 60));
  };

  const calculateConcentration = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    const sample = samples.find((s) => s._id === sampleId);

    if (!analysis || !sample) return null;

    const microscopeConstant = 50000; // This will be dynamic based on microscope selection in future
    const fibresCounted = analysis.fibresCounted || 0;
    const fieldsCounted = analysis.fieldsCounted || 0;
    const averageFlowrate = parseFloat(sample.averageFlowrate) || 0;
    const minutes = calculateDuration(sample.startTime, sample.endTime);

    if (fieldsCounted === 0 || averageFlowrate === 0 || minutes === 0)
      return null;

    const fibresForCalculation = fibresCounted < 10 ? 10 : fibresCounted;
    const concentration =
      microscopeConstant *
      (fibresForCalculation / fieldsCounted) *
      (1 / (averageFlowrate * 1000 * minutes));

    return concentration.toFixed(3);
  };

  const getReportedConcentration = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    const calculatedConc = parseFloat(calculateConcentration(sampleId));

    if (!calculatedConc) return "N/A";

    if (calculatedConc < 0.0149 && analysis.fibresCounted < 10) {
      return "<0.01";
    }

    return calculatedConc.toFixed(3);
  };

  const isFormComplete = () => {
    // Check if any analysis details are filled
    if (
      analysisDetails.microscope ||
      analysisDetails.testSlide ||
      analysisDetails.testSlideLines
    ) {
      return true;
    }

    // Check if any sample analyses have data
    return samples.some((sample) => {
      const analysis = sampleAnalyses[sample._id];
      if (!analysis) return false;

      // Check if any fields are filled
      if (analysis.edgesDistribution || analysis.backgroundDust) {
        return true;
      }

      // Check if any fibre counts are entered
      if (analysis.fibresCounted > 0 || analysis.fieldsCounted > 0) {
        return true;
      }

      return false;
    });
  };

  const handleSaveAnalysis = () => {
    console.log("Save Analysis button clicked");
    console.log("Current analysis details:", analysisDetails);
    console.log("Current sample analyses:", sampleAnalyses);

    // Save in-progress data
    const progressData = {
      shiftId: shiftId,
      analysisDetails,
      sampleAnalyses,
      timestamp: new Date().toISOString(),
    };
    console.log("Saving progress data:", progressData);

    try {
      localStorage.setItem(ANALYSIS_PROGRESS_KEY, JSON.stringify(progressData));
      console.log("Progress data saved successfully");
    } catch (error) {
      console.error("Error saving progress data:", error);
    }
  };

  const handleSaveAndClose = () => {
    console.log("Save and Close button clicked");
    // Save in-progress data
    const progressData = {
      shiftId: shiftId,
      analysisDetails,
      sampleAnalyses,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ANALYSIS_PROGRESS_KEY, JSON.stringify(progressData));
      console.log("Progress data saved successfully");
      // Navigate back to samples page
      navigate(-1);
    } catch (error) {
      console.error("Error saving progress data:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Save analysis data
      await handleSaveAnalysis();

      // Get shift data to get job ID
      const shiftResponse = await shiftService.getById(shiftId);
      const shift = shiftResponse.data;
      const jobId = shift?.job?._id;

      // Update shift status to analysis_complete
      await shiftService.update(shiftId, { status: "analysis_complete" });

      // Navigate back to shifts page
      if (jobId) {
        navigate(`/air-monitoring/jobs/${jobId}/shifts`);
      } else {
        navigate("/air-monitoring/shifts");
      }
    } catch (error) {
      console.error("Error finalizing analysis:", error);
      setError("Failed to finalize analysis. Please try again.");
    }
  };

  const handleCancel = () => {
    if (isFormComplete()) {
      setCancelDialogOpen(true);
    } else {
      navigate(-1);
    }
  };

  // Helper to check if all required fields are filled
  const isAllAnalysisComplete = () => {
    // Check analysis details
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      return false;
    }
    // Check all samples
    return samples.every((sample) => {
      const analysis = sampleAnalyses[sample._id];
      if (!analysis) return false;
      if (!analysis.edgesDistribution || !analysis.backgroundDust) return false;
      // If filter is uncountable, skip fibre counts
      if (
        analysis.edgesDistribution === "fail" ||
        analysis.backgroundDust === "fail"
      )
        return true;
      // All fibre count cells must be filled
      for (let row of analysis.fibreCounts) {
        for (let cell of row) {
          if (cell === "" || cell === null || typeof cell === "undefined")
            return false;
        }
      }
      return true;
    });
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 4 }}
      >
        Back to Samples
      </Button>

      <Typography
        variant="h2"
        sx={{
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 4,
        }}
      >
        Analysis Details
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          {/* Analysis Details Section */}
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h3">Analysis Details</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                <FormControl fullWidth>
                  <InputLabel>Microscope</InputLabel>
                  <Select
                    name="microscope"
                    value={analysisDetails.microscope}
                    onChange={handleAnalysisDetailsChange}
                    label="Microscope"
                  >
                    <MenuItem value="PCM1">PCM1</MenuItem>
                    <MenuItem value="PCM2">PCM2</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Test Slide</InputLabel>
                  <Select
                    name="testSlide"
                    value={analysisDetails.testSlide}
                    onChange={handleAnalysisDetailsChange}
                    label="Test Slide"
                  >
                    <MenuItem value="LD-TS1">LD-TS1</MenuItem>
                    <MenuItem value="LD-TS2">LD-TS2</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Test Slide Lines</InputLabel>
                  <Select
                    name="testSlideLines"
                    value={analysisDetails.testSlideLines}
                    onChange={handleAnalysisDetailsChange}
                    label="Test Slide Lines"
                  >
                    <MenuItem value="partial 5">Partial 5</MenuItem>
                    <MenuItem value="6">6</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {/* Sample Analysis Forms */}
          {samples.map((sample) => (
            <Paper key={sample._id} sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Typography variant="h3">
                  {sample.sampleNumber} : Cowl {sample.cowlNo}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                  <FormControl fullWidth>
                    <InputLabel>Edges/Distribution</InputLabel>
                    <Select
                      value={
                        sampleAnalyses[sample._id]?.edgesDistribution || ""
                      }
                      onChange={(e) =>
                        handleSampleAnalysisChange(
                          sample._id,
                          "edgesDistribution",
                          e.target.value
                        )
                      }
                      label="Edges/Distribution"
                    >
                      <MenuItem value="pass">Pass</MenuItem>
                      <MenuItem value="fail">Fail</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Background Dust</InputLabel>
                    <Select
                      value={sampleAnalyses[sample._id]?.backgroundDust || ""}
                      onChange={(e) =>
                        handleSampleAnalysisChange(
                          sample._id,
                          "backgroundDust",
                          e.target.value
                        )
                      }
                      label="Background Dust"
                    >
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="fail">Fail</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                {/* Fibre Counts Table */}
                <Box sx={{ position: "relative" }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography variant="subtitle1">Fibre Counts</Typography>
                    <Button
                      startIcon={<ClearIcon />}
                      onClick={() => handleClearTable(sample._id)}
                      disabled={isFilterUncountable(sample._id)}
                      size="small"
                      color="error"
                    >
                      Clear
                    </Button>
                  </Box>
                  {isFilterUncountable(sample._id) && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          color: "error.main",
                          fontWeight: "bold",
                          textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
                        }}
                      >
                        Filter Uncountable
                      </Typography>
                    </Box>
                  )}
                  <TableContainer>
                    <Table size="small" sx={{ tableLayout: "fixed" }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: "80px" }}>Range</TableCell>
                          {Array.from({ length: 20 }, (_, i) => (
                            <TableCell
                              key={i}
                              align="center"
                              sx={{ width: "40px", p: 0.5 }}
                            >
                              {i + 1}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sampleAnalyses[sample._id]?.fibreCounts.map(
                          (row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              <TableCell sx={{ p: 0.5 }}>
                                {`${rowIndex * 20 + 1}-${(rowIndex + 1) * 20}`}
                              </TableCell>
                              {row.map((cell, colIndex) => (
                                <TableCell
                                  key={colIndex}
                                  align="center"
                                  sx={{ p: 0.5 }}
                                >
                                  <TextField
                                    type="text"
                                    value={cell}
                                    onChange={(e) =>
                                      handleFibreCountChange(
                                        sample._id,
                                        rowIndex,
                                        colIndex,
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(
                                        e,
                                        sample._id,
                                        rowIndex,
                                        colIndex
                                      )
                                    }
                                    size="small"
                                    disabled={isFilterUncountable(sample._id)}
                                    inputRef={(el) => {
                                      inputRefs.current[
                                        `${sample._id}-${rowIndex}-${colIndex}`
                                      ] = el;
                                    }}
                                    sx={{
                                      width: "40px",
                                      "& .MuiInputBase-input": {
                                        p: 0.5,
                                        textAlign: "center",
                                      },
                                      "& .MuiInputBase-input.Mui-disabled": {
                                        WebkitTextFillColor:
                                          "rgba(0, 0, 0, 0.6)",
                                      },
                                    }}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          )
                        )}
                        <TableRow>
                          <TableCell colSpan={21}>
                            <Stack
                              direction="row"
                              spacing={4}
                              justifyContent="center"
                            >
                              <Typography>
                                Fibres Counted:{" "}
                                {sampleAnalyses[sample._id]?.fibresCounted || 0}
                              </Typography>
                              <Typography>
                                Fields Counted:{" "}
                                {sampleAnalyses[sample._id]?.fieldsCounted || 0}
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={21}>
                            <Stack
                              direction="row"
                              spacing={4}
                              justifyContent="center"
                              sx={{ mt: 2 }}
                            >
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  color="text.secondary"
                                >
                                  Calculated Concentration
                                </Typography>
                                <Typography variant="h4">
                                  {calculateConcentration(sample._id) || "N/A"}{" "}
                                  fibres/mL
                                </Typography>
                              </Box>
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  color="text.secondary"
                                >
                                  Reported Concentration
                                </Typography>
                                <Typography variant="h4">
                                  {getReportedConcentration(sample._id)}{" "}
                                  fibres/mL
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Confirmation Dialog */}
                <Dialog
                  open={confirmDialogOpen}
                  onClose={() => setConfirmDialogOpen(false)}
                >
                  <DialogTitle>Clear Fibre Counts</DialogTitle>
                  <DialogContent>
                    <Typography>
                      Are you sure you want to clear all fibre counts for this
                      sample?
                    </Typography>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={confirmClearTable} color="error" autoFocus>
                      Clear
                    </Button>
                  </DialogActions>
                </Dialog>
              </Stack>
            </Paper>
          ))}

          <Box
            sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 2 }}
          >
            <Button
              variant="outlined"
              onClick={handleCancel}
              sx={{
                color: theme.palette.primary.main,
                borderColor: theme.palette.primary.main,
                "&:hover": {
                  borderColor: theme.palette.primary.dark,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveAndClose}
              sx={{
                backgroundColor: theme.palette.primary[400],
                "&:hover": {
                  backgroundColor: theme.palette.primary[500],
                },
              }}
            >
              Save & Close
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!isAllAnalysisComplete()}
              sx={{
                backgroundColor: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                "&.Mui-disabled": {
                  backgroundColor: theme.palette.grey[700],
                  color: theme.palette.grey[500],
                },
              }}
            >
              Finalise Analysis
            </Button>
          </Box>

          {/* Cancel Confirmation Dialog */}
          <Dialog
            open={cancelDialogOpen}
            onClose={() => setCancelDialogOpen(false)}
          >
            <DialogTitle>Discard Changes?</DialogTitle>
            <DialogContent>
              <Typography>
                You have unsaved changes. Are you sure you want to discard them?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCancelDialogOpen(false)}>
                Continue Editing
              </Button>
              <Button onClick={() => navigate(-1)} color="error">
                Discard Changes
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>
    </Box>
  );
};

export default Analysis;
