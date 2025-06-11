import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  Radio,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import { sampleService, shiftService } from "../../services/api";
import { userService } from "../../services/api";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

const SAMPLES_KEY = "ldc_samples";
const ANALYSIS_PROGRESS_KEY = "ldc_analysis_progress";

// Memoized Sample Form Component
const SampleForm = React.memo(
  ({
    sample,
    analysis,
    onAnalysisChange,
    onFibreCountChange,
    onKeyDown,
    onClearTable,
    isFilterUncountable,
    calculateConcentration,
    getReportedConcentration,
    inputRefs,
    isReadOnly,
  }) => {
    const theme = useTheme();

    // Memoize the fibre counts table to prevent unnecessary re-renders
    const fibreCountsTable = useMemo(
      () => (
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
              {analysis.fibreCounts.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell sx={{ p: 0.5 }}>
                    {`${rowIndex * 20 + 1}-${(rowIndex + 1) * 20}`}
                  </TableCell>
                  {row.map((cell, colIndex) => (
                    <TableCell key={colIndex} align="center" sx={{ p: 0.5 }}>
                      <TextField
                        type="text"
                        value={cell}
                        onChange={(e) =>
                          onFibreCountChange(
                            sample._id,
                            rowIndex,
                            colIndex,
                            e.target.value
                          )
                        }
                        onKeyDown={(e) =>
                          onKeyDown(e, sample._id, rowIndex, colIndex)
                        }
                        size="small"
                        disabled={isFilterUncountable(sample._id) || isReadOnly}
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
                            WebkitTextFillColor: "rgba(0, 0, 0, 0.6)",
                          },
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={21}>
                  <Stack direction="row" spacing={4} justifyContent="center">
                    <Typography>
                      Fibres Counted: {analysis.fibresCounted || 0}
                    </Typography>
                    <Typography>
                      Fields Counted: {analysis.fieldsCounted || 0}
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
                      <Typography variant="subtitle2" color="text.secondary">
                        Calculated Concentration
                      </Typography>
                      <Typography variant="h4">
                        {calculateConcentration(sample._id) || "N/A"} fibres/mL
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Reported Concentration
                      </Typography>
                      <Typography variant="h4">
                        {getReportedConcentration(sample._id)} fibres/mL
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ),
      [
        analysis,
        sample._id,
        onFibreCountChange,
        onKeyDown,
        isFilterUncountable,
        calculateConcentration,
        getReportedConcentration,
      ]
    );

    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h3">
            {sample.fullSampleID} : Cowl {sample.cowlNo}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
              {/* Edges/Distribution and Background Dust only */}
              <FormControl component="fieldset">
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Edges/Distribution
                </Typography>
                <RadioGroup
                  row
                  value={analysis.edgesDistribution || ""}
                  onChange={(e) =>
                    onAnalysisChange(
                      sample._id,
                      "edgesDistribution",
                      e.target.value
                    )
                  }
                >
                  <FormControlLabel
                    value="pass"
                    control={<Radio />}
                    label="Pass"
                    disabled={isReadOnly}
                  />
                  <FormControlLabel
                    value="fail"
                    control={<Radio />}
                    label={<span style={{ color: "red" }}>Fail</span>}
                    disabled={isReadOnly}
                  />
                </RadioGroup>
              </FormControl>
              <Box sx={{ width: 24 }} />
              <FormControl component="fieldset">
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Background Dust
                </Typography>
                <RadioGroup
                  row
                  value={analysis.backgroundDust || ""}
                  onChange={(e) =>
                    onAnalysisChange(
                      sample._id,
                      "backgroundDust",
                      e.target.value
                    )
                  }
                >
                  <FormControlLabel
                    value="low"
                    control={<Radio />}
                    label="Low"
                    disabled={isReadOnly}
                  />
                  <FormControlLabel
                    value="medium"
                    control={<Radio />}
                    label="Medium"
                    disabled={isReadOnly}
                  />
                  <FormControlLabel
                    value="high"
                    control={<Radio />}
                    label="High"
                    disabled={isReadOnly}
                  />
                  <FormControlLabel
                    value="fail"
                    control={<Radio />}
                    label={<span style={{ color: "red" }}>Fail</span>}
                    disabled={isReadOnly}
                  />
                </RadioGroup>
              </FormControl>
            </Stack>
          </Stack>

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
              <Typography variant="subtitle2">"Spacebar" = 10 zeros, "/" = half fibre</Typography>

              
              {!isReadOnly && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={() => onClearTable(sample._id)}
                  disabled={isFilterUncountable(sample._id)}
                  size="small"
                  color="error"
                >
                  Clear
                </Button>
              )}
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
            {fibreCountsTable}
          </Box>
        </Stack>
      </Paper>
    );
  }
);

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
  const [isRendered, setIsRendered] = useState(false);
  const [users, setUsers] = useState([]);
  const [analysedBy, setAnalysedBy] = useState("");
  const [shiftStatus, setShiftStatus] = useState("");

  // Monitor initial render time
  useEffect(() => {
    const renderStart = performance.now();
    setIsRendered(true);
    console.log(`Initial render took ${performance.now() - renderStart}ms`);
  }, []);

  // Load samples and in-progress analysis data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const startTime = performance.now();
      try {
        setLoading(true);

        console.log("Starting data fetch...");
        const fetchStart = performance.now();

        // Always fetch fresh data
        const samplesResponse = await sampleService.getByShift(shiftId);
        const shiftResponse = await shiftService.getById(shiftId);

        if (!isMounted) return;

        // Set shift status
        setShiftStatus(shiftResponse.data.status);

        console.log(`API fetch took ${performance.now() - fetchStart}ms`);
        console.log("Sample count:", samplesResponse.data.length);

        const sortStart = performance.now();
        // Sort samples by the numeric part after the last hyphen
        const sortedSamples = samplesResponse.data.sort((a, b) => {
          const aMatch = a.fullSampleID.match(/-(\d+)$/);
          const bMatch = b.fullSampleID.match(/-(\d+)$/);
          const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
          const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
          return aNum - bNum;
        });
        console.log(`Sorting took ${performance.now() - sortStart}ms`);

        const initStart = performance.now();
        // Initialize analyses for each sample
        const initialAnalyses = {};
        sortedSamples.forEach((sample) => {
          if (sample.analysis) {
            initialAnalyses[sample._id] = {
              microscope: sample.analysis.microscope || "",
              testSlide: sample.analysis.testSlide || "",
              testSlideLines: sample.analysis.testSlideLines || "",
              edgesDistribution: sample.analysis.edgesDistribution || "",
              backgroundDust: sample.analysis.backgroundDust || "",
              fibreCounts:
                Array.isArray(sample.analysis.fibreCounts) &&
                sample.analysis.fibreCounts.length === 5
                  ? sample.analysis.fibreCounts.map((row) =>
                      Array.isArray(row) && row.length === 20
                        ? row
                        : Array(20).fill("")
                    )
                  : Array(5)
                      .fill()
                      .map(() => Array(20).fill("")),
              fibresCounted: sample.analysis.fibresCounted || 0,
              fieldsCounted: sample.analysis.fieldsCounted || 0,
            };
          } else {
            initialAnalyses[sample._id] = {
              microscope: "",
              testSlide: "",
              testSlideLines: "",
              edgesDistribution: "",
              backgroundDust: "",
              fibreCounts: Array(5)
                .fill()
                .map(() => Array(20).fill("")),
              fibresCounted: 0,
              fieldsCounted: 0,
            };
          }
        });

        // Set analysis details from the first sample that has them
        const firstSampleWithAnalysis = sortedSamples.find(
          (s) => s.analysis?.microscope
        );
        if (firstSampleWithAnalysis?.analysis) {
          setAnalysisDetails({
            microscope: firstSampleWithAnalysis.analysis.microscope || "",
            testSlide: firstSampleWithAnalysis.analysis.testSlide || "",
            testSlideLines:
              firstSampleWithAnalysis.analysis.testSlideLines || "",
          });
        }

        // Set analyst from shift data
        if (shiftResponse.data?.analysedBy) {
          setAnalysedBy(shiftResponse.data.analysedBy);
        }

        console.log(`Initialization took ${performance.now() - initStart}ms`);

        const storageStart = performance.now();
        // Load in-progress analysis data if present
        const progressData = localStorage.getItem(ANALYSIS_PROGRESS_KEY);
        if (progressData) {
          const parsed = JSON.parse(progressData);
          if (parsed.shiftId === shiftId) {
            // Only merge if we don't have existing data
            if (!firstSampleWithAnalysis?.analysis) {
              setAnalysisDetails(parsed.analysisDetails);
            }
            // Merge saved analyses with all samples (preserve backend, add new)
            const mergedAnalyses = { ...initialAnalyses };
            Object.keys(parsed.sampleAnalyses).forEach((sampleId) => {
              if (mergedAnalyses[sampleId]) {
                mergedAnalyses[sampleId] = {
                  ...mergedAnalyses[sampleId],
                  ...parsed.sampleAnalyses[sampleId],
                };
              }
            });
            setSampleAnalyses(mergedAnalyses);
          } else {
            setSampleAnalyses(initialAnalyses);
          }
        } else {
          setSampleAnalyses(initialAnalyses);
        }
        console.log(
          `Storage operations took ${performance.now() - storageStart}ms`
        );

        setSamples(sortedSamples);
        setError(null);

        console.log(
          `Total data operations took ${performance.now() - startTime}ms`
        );
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [shiftId]);

  // Monitor render time when samples change
  useEffect(() => {
    if (samples.length > 0) {
      const renderStart = performance.now();
      requestAnimationFrame(() => {
        console.log(`Samples render took ${performance.now() - renderStart}ms`);
      });
    }
  }, [samples]);

  // Fetch users for analyst dropdown
  useEffect(() => {
    userService.getAll().then((res) => {
      setUsers(res.data || []);
    });
  }, []);

  const handleAnalysisDetailsChange = (e) => {
    setAnalysisDetails({
      ...analysisDetails,
      [e.target.name]: e.target.value,
    });
  };

  // Memoize handlers to prevent unnecessary re-renders
  const handleSampleAnalysisChange = useCallback((sampleId, field, value) => {
    setSampleAnalyses((prev) => ({
      ...prev,
      [sampleId]: {
        ...prev[sampleId],
        [field]: value,
      },
    }));
  }, []);

  const handleFibreCountChange = useCallback(
    (sampleId, rowIndex, colIndex, value) => {
      const newValue = value === "/" ? "0.5" : value;
      if (isNaN(newValue) && value !== "") return;

      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];
        newFibreCounts[rowIndex][colIndex] = newValue;

        // Calculate fibres counted and fields counted
        let fibresCounted = 0;
        let fieldsCounted = 0;
        newFibreCounts.forEach((row) => {
          row.forEach((cell) => {
            if (cell !== "") {
              const numValue = parseFloat(cell);
              if (!isNaN(numValue)) {
                fibresCounted += numValue;
                fieldsCounted += 1;
              }
            }
          });
        });

        newAnalyses[sampleId] = {
          ...newAnalyses[sampleId],
          fibreCounts: newFibreCounts,
          fibresCounted: parseFloat(fibresCounted.toFixed(1)),
          fieldsCounted,
        };
        return newAnalyses;
      });

      // Move to next cell
      const nextCol = colIndex + 1;
      const nextRow = rowIndex;
      if (nextCol < 20) {
        // Move to next column in same row
        const nextInput =
          inputRefs.current[`${sampleId}-${nextRow}-${nextCol}`];
        if (nextInput) {
          nextInput.focus();
        }
      } else if (rowIndex < 4) {
        // Move to first column of next row
        const nextInput = inputRefs.current[`${sampleId}-${nextRow + 1}-0`];
        if (nextInput) {
          nextInput.focus();
        }
      }
    },
    []
  );

  const handleKeyDown = useCallback((e, sampleId, rowIndex, colIndex) => {
    if (e.key === " ") {
      e.preventDefault();
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];

        // Fill next 10 cells with 0
        let lastFilledRow = rowIndex;
        let lastFilledCol = colIndex;
        for (let i = 0; i < 10; i++) {
          const nextCol = colIndex + i;
          if (nextCol < 20) {
            newFibreCounts[rowIndex][nextCol] = "0";
            lastFilledRow = rowIndex;
            lastFilledCol = nextCol;
          } else {
            const nextRow = rowIndex + 1;
            if (nextRow < 5) {
              newFibreCounts[nextRow][nextCol - 20] = "0";
              lastFilledRow = nextRow;
              lastFilledCol = nextCol - 20;
            }
          }
        }

        // Calculate new totals
        let fibresCounted = 0;
        let fieldsCounted = 0;
        newFibreCounts.forEach((row) => {
          row.forEach((cell) => {
            if (cell !== "") {
              const numValue = parseFloat(cell);
              if (!isNaN(numValue)) {
                fibresCounted += numValue;
                fieldsCounted += 1;
              }
            }
          });
        });

        newAnalyses[sampleId] = {
          ...newAnalyses[sampleId],
          fibreCounts: newFibreCounts,
          fibresCounted: parseFloat(fibresCounted.toFixed(1)),
          fieldsCounted,
        };

        // Find next empty cell after the last filled cell
        let nextEmptyRow = lastFilledRow;
        let nextEmptyCol = lastFilledCol + 1;

        while (nextEmptyRow < 5) {
          while (nextEmptyCol < 20) {
            if (newFibreCounts[nextEmptyRow][nextEmptyCol] === "") {
              const nextInput =
                inputRefs.current[
                  `${sampleId}-${nextEmptyRow}-${nextEmptyCol}`
                ];
              if (nextInput) {
                setTimeout(() => {
                  nextInput.focus();
                }, 0);
                break;
              }
            }
            nextEmptyCol++;
          }
          if (nextEmptyCol < 20) break;
          nextEmptyRow++;
          nextEmptyCol = 0;
        }

        return newAnalyses;
      });
    }
  }, []);

  const handleClearTable = useCallback((sampleId) => {
    setSelectedSampleId(sampleId);
    setConfirmDialogOpen(true);
  }, []);

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
    const fibresCounted = parseFloat(analysis.fibresCounted) || 0;
    const fieldsCounted = parseInt(analysis.fieldsCounted) || 0;
    const averageFlowrate = parseFloat(sample.averageFlowrate) || 0;
    const minutes = calculateDuration(sample.startTime, sample.endTime);

    if (fieldsCounted === 0 || averageFlowrate === 0 || minutes === 0)
      return null;

    const fibresForCalculation = fibresCounted < 10 ? 10 : fibresCounted;
    const concentration =
      microscopeConstant *
      (fibresForCalculation / fieldsCounted) *
      (1 / (averageFlowrate * 1000 * minutes));

    return parseFloat(concentration.toFixed(3));
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
      console.log("Starting analysis submission...");
      console.log("Analysis Details:", analysisDetails);
      console.log("Sample Analyses:", sampleAnalyses);

      // Update each sample with its analysis data
      const updatePromises = samples.map(async (sample) => {
        const analysis = sampleAnalyses[sample._id];
        if (analysis) {
          const analysisData = {
            analysis: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: analysis.fibresCounted,
              fieldsCounted: analysis.fieldsCounted,
              reportedConcentration: getReportedConcentration(sample._id),
            },
          };
          console.log(
            `Updating sample ${sample.fullSampleID} with data:`,
            JSON.stringify(analysisData, null, 2)
          );
          try {
            const response = await sampleService.update(
              sample._id,
              analysisData
            );
            console.log(
              `Update response for ${sample.fullSampleID}:`,
              response
            );
            return response;
          } catch (error) {
            console.error(
              `Error updating sample ${sample.fullSampleID}:`,
              error.response?.data || error
            );
            throw error;
          }
        }
      });

      // Wait for all sample updates to complete
      const results = await Promise.all(updatePromises);
      console.log("All sample updates completed:", results);

      // Get shift data to get job ID
      const shiftResponse = await shiftService.getById(shiftId);
      const shift = shiftResponse.data;
      const jobId = shift?.job?._id;

      // Update shift status to analysis_complete
      await shiftService.update(shiftId, {
        status: "analysis_complete",
        analysedBy,
        analysisDate: new Date().toISOString(),
      });

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
    console.log("Checking analysis completion...");

    // Check analysis details
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      console.log("Analysis details incomplete:", {
        microscope: analysisDetails.microscope,
        testSlide: analysisDetails.testSlide,
        testSlideLines: analysisDetails.testSlideLines,
      });
      return false;
    }

    // Check all samples
    const incompleteSamples = samples.filter((sample) => {
      const analysis = sampleAnalyses[sample._id];
      if (!analysis) {
        console.log(`No analysis found for sample ${sample.fullSampleID}`);
        return true;
      }

      if (!analysis.edgesDistribution || !analysis.backgroundDust) {
        console.log(
          `Sample ${sample.fullSampleID} missing edges/distribution or background dust:`,
          {
            edgesDistribution: analysis.edgesDistribution,
            backgroundDust: analysis.backgroundDust,
          }
        );
        return true;
      }

      // If filter is uncountable, skip fibre counts
      if (
        analysis.edgesDistribution === "fail" ||
        analysis.backgroundDust === "fail"
      ) {
        console.log(
          `Sample ${sample.fullSampleID} is uncountable, skipping fibre counts`
        );
        return false;
      }

      // Check fibre counts
      const hasEmptyCells = analysis.fibreCounts.some((row, rowIndex) => {
        const emptyCells = row.filter(
          (cell) => cell === "" || cell === null || typeof cell === "undefined"
        );
        if (emptyCells.length > 0) {
          console.log(
            `Sample ${sample.fullSampleID} has empty cells in row ${
              rowIndex + 1
            }:`,
            emptyCells
          );
        }
        return emptyCells.length > 0;
      });

      if (hasEmptyCells) {
        console.log(
          `Sample ${sample.fullSampleID} has empty fibre count cells`
        );
        return true;
      }

      return false;
    });

    if (incompleteSamples.length > 0) {
      console.log(
        "Incomplete samples:",
        incompleteSamples.map((s) => s.fullSampleID)
      );
      return false;
    }

    console.log("All samples are complete!");
    return true;
  };

  // Render a single sample form
  const renderSampleForm = useCallback(
    ({ index, style }) => {
      const sample = samples[index];
      return (
        <div style={style}>
          <SampleForm
            key={sample._id}
            sample={sample}
            analysis={sampleAnalyses[sample._id]}
            onAnalysisChange={handleSampleAnalysisChange}
            onFibreCountChange={handleFibreCountChange}
            onKeyDown={handleKeyDown}
            onClearTable={handleClearTable}
            isFilterUncountable={isFilterUncountable}
            calculateConcentration={calculateConcentration}
            getReportedConcentration={getReportedConcentration}
            inputRefs={inputRefs}
            isReadOnly={shiftStatus === "analysis_complete"}
          />
        </div>
      );
    },
    [
      samples,
      sampleAnalyses,
      handleSampleAnalysisChange,
      handleFibreCountChange,
      handleKeyDown,
      handleClearTable,
      isFilterUncountable,
      calculateConcentration,
      getReportedConcentration,
      shiftStatus,
    ]
  );

  // Render sample forms based on count
  const renderSampleForms = () => {
    if (samples.length <= 5) {
      // For small sample counts, render directly without virtualization
      return samples.map((sample) => (
        <SampleForm
          key={sample._id}
          sample={sample}
          analysis={sampleAnalyses[sample._id]}
          onAnalysisChange={handleSampleAnalysisChange}
          onFibreCountChange={handleFibreCountChange}
          onKeyDown={handleKeyDown}
          onClearTable={handleClearTable}
          isFilterUncountable={isFilterUncountable}
          calculateConcentration={calculateConcentration}
          getReportedConcentration={getReportedConcentration}
          inputRefs={inputRefs}
          isReadOnly={shiftStatus === "analysis_complete"}
        />
      ));
    }

    // For larger sample counts, use virtual scrolling
    return (
      <Box sx={{ height: "calc(100vh - 300px)", minHeight: "500px" }}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={samples.length}
              itemSize={400}
              overscanCount={2}
            >
              {renderSampleForm}
            </List>
          )}
        </AutoSizer>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/air-monitoring/shift/${shiftId}/samples`)}
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
        Microscope Calibration
      </Typography>

      {/* Analyst Dropdown - moved to top */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
        mb={3}
      >
        <FormControl fullWidth sx={{ maxWidth: 300 }}>
          <InputLabel>Analyst</InputLabel>
          <Select
            value={analysedBy}
            label="Analyst"
            onChange={(e) => setAnalysedBy(e.target.value)}
            disabled={shiftStatus === "analysis_complete"}
          >
            {users.map((user) => (
              <MenuItem
                key={user._id}
                value={user.firstName + " " + user.lastName}
              >
                {user.firstName} {user.lastName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          {/* Analysis Details Section */}
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h3">Microscope Calibration</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                <FormControl component="fieldset">
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Microscope
                  </Typography>
                  <RadioGroup
                    row
                    name="microscope"
                    value={analysisDetails.microscope}
                    onChange={handleAnalysisDetailsChange}
                  >
                    <FormControlLabel
                      value="PCM1"
                      control={<Radio />}
                      label="PCM1"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                    <FormControlLabel
                      value="PCM2"
                      control={<Radio />}
                      label="PCM2"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                  </RadioGroup>
                </FormControl>
                <Box sx={{ width: 24 }} />
                <FormControl component="fieldset">
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Test Slide
                  </Typography>
                  <RadioGroup
                    row
                    name="testSlide"
                    value={analysisDetails.testSlide}
                    onChange={handleAnalysisDetailsChange}
                  >
                    <FormControlLabel
                      value="LD-TS1"
                      control={<Radio />}
                      label="LD-TS1"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                    <FormControlLabel
                      value="LD-TS2"
                      control={<Radio />}
                      label="LD-TS2"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                  </RadioGroup>
                </FormControl>
                <Box sx={{ width: 24 }} />
                <FormControl component="fieldset">
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Test Slide Lines
                  </Typography>
                  <RadioGroup
                    row
                    name="testSlideLines"
                    value={analysisDetails.testSlideLines}
                    onChange={handleAnalysisDetailsChange}
                  >
                    <FormControlLabel
                      value="partial 5"
                      control={<Radio />}
                      label="Partial 5"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                    <FormControlLabel
                      value="6"
                      control={<Radio />}
                      label="6"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                  </RadioGroup>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {/* Sample Forms */}
          {renderSampleForms()}

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
            {shiftStatus !== "analysis_complete" && (
              <>
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
              </>
            )}
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
