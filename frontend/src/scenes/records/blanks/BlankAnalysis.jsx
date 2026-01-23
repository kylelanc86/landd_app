// Blank Analysis Component - Simplified version for Analytical Blank analysis

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Chip,
  CircularProgress,
  Checkbox,
} from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import { blankService } from "../../../services/blankService";
import { userService } from "../../../services/api";
import pcmMicroscopeService from "../../../services/pcmMicroscopeService";
import { equipmentService } from "../../../services/equipmentService";
import hseTestSlideService from "../../../services/hseTestSlideService";
import { graticuleService } from "../../../services/graticuleService";
import { useAuth } from "../../../context/AuthContext";
import { useSnackbar } from "../../../context/SnackbarContext";
import { formatDate } from "../../../utils/dateFormat";

const BlankAnalysis = () => {
  const { blankId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [blank, setBlank] = useState(null);
  const [allBlanks, setAllBlanks] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Analysis state
  const [analysisDetails, setAnalysisDetails] = useState({
    microscope: "",
    testSlide: "",
    testSlideLines: "",
  });

  const [analysis, setAnalysis] = useState({
    backgroundDust: "",
    fibreCounts: Array(5).fill().map(() => Array(20).fill("")),
    fibresCounted: 0,
    fieldsCounted: 0,
    comment: "",
  });

  const [analysedBy, setAnalysedBy] = useState(null);
  const [users, setUsers] = useState([]);
  const [pcmCalibrations, setPcmCalibrations] = useState([]);
  const [graticuleCalibrations, setGraticuleCalibrations] = useState([]);
  const [activeMicroscopes, setActiveMicroscopes] = useState([]);
  const [activeTestSlides, setActiveTestSlides] = useState([]);

  // Modal states
  const [fibreCountModalOpen, setFibreCountModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  const inputRefs = useRef({});

  // Generate blank reference
  const generateBlankReference = useCallback(() => {
    if (!blank || allBlanks.length === 0) return "";

    const dateObj = new Date(blank.blankDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const blankDateStr = `${year}${month}${day}`;

    const sameDateBlanks = allBlanks
      .filter((b) => {
        const blankDate = new Date(b.blankDate);
        return (
          blankDate.getDate() === dateObj.getDate() &&
          blankDate.getMonth() === dateObj.getMonth() &&
          blankDate.getFullYear() === dateObj.getFullYear()
        );
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const blankNumber =
      sameDateBlanks.findIndex(
        (b) => b._id === blank._id || b.id === blank.id
      ) + 1;

    return `LDAB${blankDateStr}-${blankNumber}`;
  }, [blank, allBlanks]);

  // Load data
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch blank and all blanks
        const [blankResponse, allBlanksResponse] = await Promise.all([
          blankService.getById(blankId),
          blankService.getAll(),
        ]);

        if (!isMounted) return;

        const fetchedBlank = blankResponse.data;
        const fetchedBlanks = allBlanksResponse.data || [];

        setBlank(fetchedBlank);
        setAllBlanks(fetchedBlanks);

        // Load analysis data
        if (fetchedBlank.analysis) {
          let fibreCounts = fetchedBlank.analysis.fibreCounts;
          if (
            !fibreCounts ||
            !Array.isArray(fibreCounts) ||
            fibreCounts.length !== 5
          ) {
            fibreCounts = Array(5)
              .fill()
              .map(() => Array(20).fill(""));
          } else {
            fibreCounts = fibreCounts.map((row) => {
              if (!Array.isArray(row) || row.length !== 20) {
                return Array(20).fill("");
              }
              return row.map((cell) => (cell !== null && cell !== undefined ? String(cell) : ""));
            });
          }

          setAnalysis({
            backgroundDust: fetchedBlank.analysis.backgroundDust || "",
            fibreCounts: fibreCounts,
            fibresCounted: fetchedBlank.analysis.fibresCounted || 0,
            fieldsCounted: fetchedBlank.analysis.fieldsCounted || 0,
            comment: fetchedBlank.analysis.comment || "",
          });

          setAnalysisDetails({
            microscope: fetchedBlank.analysis.microscope || "",
            testSlide: fetchedBlank.analysis.testSlide || "",
            testSlideLines: fetchedBlank.analysis.testSlideLines || "",
          });
        }

        if (fetchedBlank.analysedBy) {
          setAnalysedBy(
            typeof fetchedBlank.analysedBy === "object"
              ? fetchedBlank.analysedBy._id || fetchedBlank.analysedBy.id
              : fetchedBlank.analysedBy
          );
        } else if (currentUser?._id) {
          setAnalysedBy(currentUser._id);
        }

        // Fetch calibrations and equipment
        const [pcmResponse, graticuleResponse, equipmentResponse] =
          await Promise.all([
            pcmMicroscopeService.getAll(),
            graticuleService.getAll(),
            equipmentService.getAll(),
          ]);

        setPcmCalibrations(pcmResponse.data || pcmResponse || []);
        setGraticuleCalibrations(
          graticuleResponse.data || graticuleResponse || []
        );

        // Filter for active microscopes
        const allEquipment = equipmentResponse.equipment || [];
        const microscopeEquipment = allEquipment
          .filter((eq) => eq.equipmentType === "Phase Contrast Microscope")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Fetch calibration data for microscopes
        const microscopesWithCalibrations = await Promise.all(
          microscopeEquipment.map(async (microscope) => {
            try {
              const calibrationResponse =
                await pcmMicroscopeService.getByEquipment(
                  microscope.equipmentReference
                );
              const calibrations =
                calibrationResponse.calibrations || calibrationResponse || [];

              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.date).getTime()
                        )
                      )
                    )
                  : null;

              const calibrationDue =
                calibrations.length > 0
                  ? calibrations
                      .filter((cal) => cal.nextCalibration)
                      .map((cal) => new Date(cal.nextCalibration).getTime())
                      .length > 0
                    ? new Date(
                        Math.max(
                          ...calibrations
                            .filter((cal) => cal.nextCalibration)
                            .map((cal) =>
                              new Date(cal.nextCalibration).getTime()
                            )
                        )
                      )
                    : null
                  : null;

              return {
                ...microscope,
                lastCalibration,
                calibrationDue,
              };
            } catch (error) {
              console.error(
                `Error fetching calibrations for ${microscope.equipmentReference}:`,
                error
              );
              return {
                ...microscope,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Calculate status for equipment
        const calculateStatus = (equipment) => {
          if (!equipment || equipment.status === "out-of-service") {
            return "Out-of-Service";
          }
          if (!equipment.lastCalibration || !equipment.calibrationDue) {
            return "Out-of-Service";
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(equipment.calibrationDue);
          dueDate.setHours(0, 0, 0, 0);
          const timeDiff = dueDate.getTime() - today.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          if (daysDiff !== null && daysDiff < 0) {
            return "Calibration Overdue";
          }
          return "Active";
        };

        // Filter for active microscopes
        const active = microscopesWithCalibrations.filter(
          (eq) => calculateStatus(eq) === "Active"
        );

        setActiveMicroscopes(active);

        // Filter for HSE Test Slide equipment
        const testSlideEquipment = allEquipment
          .filter((eq) => eq.equipmentType === "HSE Test Slide")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Fetch calibration data for test slides
        const testSlidesWithCalibrations = await Promise.all(
          testSlideEquipment.map(async (testSlide) => {
            try {
              const calibrationResponse =
                await hseTestSlideService.getByEquipment(
                  testSlide.equipmentReference
                );
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.date).getTime()
                        )
                      )
                    )
                  : null;

              const calibrationDue =
                calibrations.length > 0
                  ? calibrations
                      .filter((cal) => cal.nextCalibration)
                      .map((cal) => new Date(cal.nextCalibration).getTime())
                      .length > 0
                    ? new Date(
                        Math.max(
                          ...calibrations
                            .filter((cal) => cal.nextCalibration)
                            .map((cal) =>
                              new Date(cal.nextCalibration).getTime()
                            )
                        )
                      )
                    : null
                  : null;

              return {
                ...testSlide,
                lastCalibration,
                calibrationDue,
              };
            } catch (error) {
              console.error(
                `Error fetching calibrations for ${testSlide.equipmentReference}:`,
                error
              );
              return {
                ...testSlide,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active test slides
        const activeTestSlides = testSlidesWithCalibrations.filter(
          (eq) => calculateStatus(eq) === "Active"
        );

        setActiveTestSlides(activeTestSlides);

        // Fetch users
        const usersResponse = await userService.getAll();
        setUsers(usersResponse.data || []);

        setError(null);
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

    return () => {
      isMounted = false;
    };
  }, [blankId, currentUser]);

  // Get microscope constant
  const getMicroscopeConstant = useCallback(
    (microscopeRef) => {
      if (!microscopeRef || graticuleCalibrations.length === 0) {
        return 50000;
      }

      const normalizedMicroscopeRef = microscopeRef.toLowerCase().trim();
      const matchingCalibrations = graticuleCalibrations.filter((cal) => {
        if (cal.microscopeReference) {
          return (
            cal.microscopeReference.toLowerCase().trim() ===
            normalizedMicroscopeRef
          );
        }
        if (
          cal.microscopeId &&
          typeof cal.microscopeId === "object" &&
          cal.microscopeId.equipmentReference
        ) {
          return (
            cal.microscopeId.equipmentReference.toLowerCase().trim() ===
            normalizedMicroscopeRef
          );
        }
        return false;
      });

      if (matchingCalibrations.length === 0) {
        return 50000;
      }

      const activeCalibrations = matchingCalibrations.filter(
        (cal) => cal.status === "Pass"
      );
      const calibrationsToUse =
        activeCalibrations.length > 0 ? activeCalibrations : matchingCalibrations;

      const latestCalibration = calibrationsToUse.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];

      if (!latestCalibration) {
        return 50000;
      }

      // For blanks, assume 25mm filter size
      return latestCalibration.constant25mm || 50000;
    },
    [graticuleCalibrations]
  );


  // Handle analysis change
  const handleAnalysisChange = (field, value) => {
    setAnalysis((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle fibre count change
  const handleFibreCountChange = useCallback(
    (rowIndex, colIndex, value) => {
      const newValue = value === "/" ? "0.5" : value;
      if (isNaN(newValue) && value !== "") return;

      setAnalysis((prev) => {
        const newFibreCounts = prev.fibreCounts.map((row) => [...row]);
        newFibreCounts[rowIndex][colIndex] = newValue;

        let fibresCounted = 0;
        let fieldsCounted = 0;
        newFibreCounts.forEach((row) => {
          row.forEach((cell) => {
            if (cell !== "" && cell !== null && cell !== undefined) {
              const numValue = parseFloat(cell);
              if (!isNaN(numValue)) {
                fibresCounted += numValue;
                fieldsCounted += 1;
              }
            }
          });
        });

        return {
          ...prev,
          fibreCounts: newFibreCounts,
          fibresCounted: parseFloat(fibresCounted.toFixed(1)),
          fieldsCounted,
        };
      });

      // Move to next cell
      const nextCol = colIndex + 1;
      if (nextCol < 20) {
        const nextInput = inputRefs.current[`${rowIndex}-${nextCol}`];
        if (nextInput) {
          nextInput.focus();
        }
      } else if (rowIndex < 4) {
        const nextInput = inputRefs.current[`${rowIndex + 1}-0`];
        if (nextInput) {
          nextInput.focus();
        }
      }
    },
    []
  );

  // Handle key down
  const handleKeyDown = useCallback((e, rowIndex, colIndex) => {
    if (
      e.key === " " ||
      e.key === "Spacebar" ||
      e.keyCode === 32 ||
      e.code === "Space"
    ) {
      e.preventDefault();
      setAnalysis((prev) => {
        const newFibreCounts = prev.fibreCounts.map((row) => [...row]);

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

        const updatedAnalysis = {
          ...prev,
          fibreCounts: newFibreCounts,
          fibresCounted: parseFloat(fibresCounted.toFixed(1)),
          fieldsCounted,
        };

        // Find next empty cell and focus on it
        let nextEmptyRow = lastFilledRow;
        let nextEmptyCol = lastFilledCol + 1;

        setTimeout(() => {
          while (nextEmptyRow < 5) {
            if (nextEmptyCol < 20) {
              const nextInput = inputRefs.current[`${nextEmptyRow}-${nextEmptyCol}`];
              if (nextInput) {
                nextInput.focus();
              }
              break;
            } else {
              nextEmptyRow += 1;
              nextEmptyCol = 0;
            }
          }
        }, 0);

        return updatedAnalysis;
      });
    }
  }, []);

  // Handle fill zeros
  const handleFillZeros = useCallback(() => {
    setAnalysis((prev) => {
      const newFibreCounts = Array(5)
        .fill()
        .map(() => Array(20).fill("0"));

      return {
        ...prev,
        fibreCounts: newFibreCounts,
        fibresCounted: 0,
        fieldsCounted: 100,
      };
    });
  }, []);

  // Handle clear table in modal
  const handleClearTableInModal = () => {
    setAnalysis((prev) => ({
      ...prev,
      fibreCounts: Array(5).fill().map(() => Array(20).fill("")),
      fibresCounted: 0,
      fieldsCounted: 0,
    }));
  };

  // Handle cancel fibre count modal
  const handleCancelFibreCountModal = () => {
    setFibreCountModalOpen(false);
  };

  // Handle save and close fibre count modal
  const handleSaveAndCloseFibreCountModal = () => {
    setFibreCountModalOpen(false);
  };


  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);

      const fibreCountsAsNumbers = analysis.fibreCounts.map((row) =>
        row.map((cell) => {
          if (cell === "" || cell === null || cell === undefined) {
            return 0;
          }
          const num = parseFloat(cell);
          return isNaN(num) ? 0 : num;
        })
      );

      const analysisData = {
        analysis: {
          microscope: analysisDetails.microscope || "",
          testSlide: analysisDetails.testSlide || "",
          testSlideLines: analysisDetails.testSlideLines || "",
          backgroundDust: analysis.backgroundDust || "",
          fibreCounts: fibreCountsAsNumbers,
          fibresCounted: analysis.fibresCounted,
          fieldsCounted: analysis.fieldsCounted,
          comment: analysis.comment || "",
        },
        analysedBy: analysedBy || undefined,
      };

      await blankService.update(blankId, analysisData);
      showSnackbar("Analysis saved successfully", "success");
    } catch (error) {
      console.error("Error saving analysis:", error);
      showSnackbar("Failed to save analysis", "error");
    } finally {
      setSaving(false);
    }
  };

  // Handle finalise
  const handleFinalise = async () => {
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines ||
      !analysis.backgroundDust
    ) {
      showSnackbar(
        "Please complete all required analysis fields before finalising",
        "warning"
      );
      return;
    }

    if (
      analysis.fibreCounts.some((row) =>
        row.some((cell) => cell === "" || cell === null || cell === undefined)
      )
    ) {
      showSnackbar(
        "Please complete all fibre counts before finalising",
        "warning"
      );
      return;
    }

    try {
      setSaving(true);

      const fibreCountsAsNumbers = analysis.fibreCounts.map((row) =>
        row.map((cell) => {
          if (cell === "" || cell === null || cell === undefined) {
            return 0;
          }
          const num = parseFloat(cell);
          return isNaN(num) ? 0 : num;
        })
      );

      // Determine status - Pass if fibresCounted is 2 or less, Fail if more than 2
      let status = "Pass";
      if (analysis.fibresCounted > 2) {
        status = "Fail";
      }

      const analysisData = {
        analysis: {
          microscope: analysisDetails.microscope || "",
          testSlide: analysisDetails.testSlide || "",
          testSlideLines: analysisDetails.testSlideLines || "",
          backgroundDust: analysis.backgroundDust || "",
          fibreCounts: fibreCountsAsNumbers,
          fibresCounted: analysis.fibresCounted,
          fieldsCounted: analysis.fieldsCounted,
          comment: analysis.comment || "",
        },
        status: status,
        analysedBy: analysedBy || undefined,
      };

      await blankService.update(blankId, analysisData);
      showSnackbar("Analysis finalised successfully", "success");
      navigate("/records/blanks");
    } catch (error) {
      console.error("Error finalising analysis:", error);
      showSnackbar("Failed to finalise analysis", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !blank) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error || "Blank not found"}</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/records/blanks")}
          sx={{ mt: 2 }}
        >
          Back to Blanks
        </Button>
      </Box>
    );
  }

  const isComplete =
    analysis.fibreCounts &&
    analysis.fibreCounts.every((row) =>
      row.every((cell) => cell !== "" && cell !== null && cell !== undefined)
    );

  const isReadOnly = blank.status === "Pass" || blank.status === "Fail";

  return (
    <Box sx={{ p: 3, maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Analytical Blank Analysis
          </Typography>
          <Typography variant="h5" color="text.secondary">
            {generateBlankReference()} ({formatDate(blank.blankDate)})
          </Typography>
        </Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/records/blanks")}
        >
          Back to Blanks
        </Button>
      </Box>

      {/* Analysis Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Analysis Details
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
          <FormControl component="fieldset">
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Microscope
            </Typography>
            <RadioGroup
              row
              name="microscope"
              value={analysisDetails.microscope}
              onChange={(e) =>
                setAnalysisDetails((prev) => ({
                  ...prev,
                  microscope: e.target.value,
                }))
              }
              disabled={isReadOnly}
            >
              {activeMicroscopes.length > 0 ? (
                activeMicroscopes.map((microscope) => (
                  <FormControlLabel
                    key={microscope._id}
                    value={microscope.equipmentReference}
                    control={<Radio />}
                    label={microscope.equipmentReference}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active Phase Contrast Microscope available
                </Typography>
              )}
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
              onChange={(e) =>
                setAnalysisDetails((prev) => ({
                  ...prev,
                  testSlide: e.target.value,
                }))
              }
              disabled={isReadOnly}
            >
              {activeTestSlides.length > 0 ? (
                activeTestSlides.map((testSlide) => (
                  <FormControlLabel
                    key={testSlide._id}
                    value={testSlide.equipmentReference}
                    control={<Radio />}
                    label={testSlide.equipmentReference}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active HSE Test Slide available
                </Typography>
              )}
            </RadioGroup>
          </FormControl>
          <Box sx={{ width: 24 }} />

          <FormControl component="fieldset" sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Test Slide Lines
            </Typography>
            <RadioGroup
              row
              name="testSlideLines"
              value={analysisDetails.testSlideLines}
              onChange={(e) =>
                setAnalysisDetails((prev) => ({
                  ...prev,
                  testSlideLines: e.target.value,
                }))
              }
              disabled={isReadOnly}
            >
              <FormControlLabel
                value="5"
                control={<Radio size="small" />}
                label="5"
              />
              <FormControlLabel
                value="Partial 6"
                control={<Radio size="small" />}
                label="Partial 6"
              />
            </RadioGroup>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Analysed By</InputLabel>
            <Select
              value={analysedBy || ""}
              onChange={(e) => setAnalysedBy(e.target.value)}
              disabled={isReadOnly}
              label="Analysed By"
            >
              {users.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Analysis Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Analysis
        </Typography>

        <Stack spacing={3}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <FormControl component="fieldset" sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Background Dust
              </Typography>
              <RadioGroup
                row
                value={analysis.backgroundDust}
                onChange={(e) =>
                  handleAnalysisChange("backgroundDust", e.target.value)
                }
                disabled={isReadOnly}
              >
                <FormControlLabel
                  value="pass"
                  control={<Radio size="small" />}
                  label="Pass"
                />
                <FormControlLabel
                  value="fail"
                  control={<Radio size="small" />}
                  label={<span style={{ color: "red" }}>Fail</span>}
                />
              </RadioGroup>
            </FormControl>
            <Stack spacing={1} alignItems="flex-end" sx={{ ml: 2 }}>
              {analysis.backgroundDust && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setFibreCountModalOpen(true)}
                  disabled={isReadOnly}
                  sx={{
                    backgroundColor: isComplete ? "success.main" : "grey.500",
                    "&:hover": {
                      backgroundColor: isComplete ? "success.dark" : "grey.600",
                    },
                  }}
                >
                  {isComplete ? "Edit Fibre Counts" : "Enter Fibre Counts"}
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                startIcon={<CommentIcon />}
                onClick={() => {
                  setCommentText(analysis.comment || "");
                  setCommentModalOpen(true);
                }}
                disabled={isReadOnly}
              >
                {analysis.comment ? "Edit Comment" : "Add Comment"}
              </Button>
            </Stack>
          </Box>

          {analysis.comment && (
            <Box
              sx={{
                mt: 1,
                mb: 2,
                p: 1.5,
                backgroundColor: "grey.100",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "grey.300",
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                Comment:
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {analysis.comment}
              </Typography>
            </Box>
          )}

          {isComplete && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Results
              </Typography>
              <Stack direction="row" spacing={2}>
                <Typography>
                  <strong>Fibres Counted:</strong> {analysis.fibresCounted}
                </Typography>
                <Typography>
                  <strong>Fields Counted:</strong> {analysis.fieldsCounted}
                </Typography>
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
        <Button
          variant="outlined"
          onClick={() => navigate("/records/blanks")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleFinalise}
          disabled={saving || isReadOnly}
        >
          {saving ? "Finalising..." : "Finalise Analysis"}
        </Button>
      </Box>

      {/* Fibre Count Modal */}
      <Dialog
        open={fibreCountModalOpen}
        onClose={handleCancelFibreCountModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Fibre Counts
        </DialogTitle>
        <DialogContent sx={{ position: "relative" }}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              "Spacebar" = 10 zeros, "/" = half fibre
            </Typography>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              {!isReadOnly && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={handleClearTableInModal}
                  size="small"
                  color="error"
                >
                  Clear Table
                </Button>
              )}
            </Box>

            <TableContainer>
              <Table size="small" sx={{ tableLayout: "fixed" }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{ width: "80px", position: "relative" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        Range
                        <Button
                          size="small"
                          onClick={handleFillZeros}
                          disabled={isReadOnly}
                          sx={{
                            minWidth: "auto",
                            width: "16px",
                            height: "16px",
                            p: 0,
                            backgroundColor: "success.main",
                            opacity: 0,
                            transition: "opacity 0.2s",
                            "&:hover": {
                              opacity: 1,
                            },
                            "&.Mui-disabled": {
                              opacity: 0,
                            },
                          }}
                          title="Fill all cells with 0"
                        />
                      </Box>
                    </TableCell>
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
                  {(() => {
                    let fibreCounts = analysis.fibreCounts;
                    
                    // Ensure fibreCounts is a valid 5x20 array
                    if (!fibreCounts || !Array.isArray(fibreCounts) || fibreCounts.length !== 5) {
                      fibreCounts = Array(5)
                        .fill()
                        .map(() => Array(20).fill(""));
                    } else {
                      // Ensure each row is a valid array of 20 elements
                      fibreCounts = fibreCounts.map((row) => {
                        if (!Array.isArray(row) || row.length !== 20) {
                          return Array(20).fill("");
                        }
                        return row.map((cell) => cell || "");
                      });
                    }
                    
                    return fibreCounts.map((row, rowIndex) => (
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
                              value={cell || ""}
                              onChange={(e) =>
                                handleFibreCountChange(
                                  rowIndex,
                                  colIndex,
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(
                                  e,
                                  rowIndex,
                                  colIndex
                                )
                              }
                              size="small"
                              disabled={isReadOnly}
                              inputRef={(el) => {
                                inputRefs.current[
                                  `${rowIndex}-${colIndex}`
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
                    ));
                  })()}
                  <TableRow>
                    <TableCell colSpan={21}>
                      <Stack
                        direction="row"
                        spacing={4}
                        justifyContent="center"
                      >
                        <Typography>
                          Fibres Counted: {analysis.fibresCounted || 0}
                        </Typography>
                        <Typography>
                          Fields Counted: {analysis.fieldsCounted || 0}
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelFibreCountModal}>Cancel</Button>
          <Button
            onClick={handleSaveAndCloseFibreCountModal}
            variant="contained"
          >
            Save & Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comment Modal */}
      <Dialog
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={isReadOnly}
            placeholder="Enter comment..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentModalOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              handleAnalysisChange("comment", commentText);
              setCommentModalOpen(false);
            }}
            variant="contained"
            disabled={isReadOnly}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BlankAnalysis;
