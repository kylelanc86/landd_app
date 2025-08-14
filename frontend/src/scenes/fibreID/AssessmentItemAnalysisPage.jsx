import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Container,
  Paper,
  Breadcrumbs,
  Link,
  Grid,
  Card,
  CardContent,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Chip,
  Checkbox,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { asbestosAssessmentService } from "../../services/api";

const AssessmentItemAnalysisPage = () => {
  const navigate = useNavigate();
  const { assessmentId, itemNumber } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [assessmentItem, setAssessmentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Analysis state
  const [microscope, setMicroscope] = useState("LD-PLM-1");
  const [sampleDescription, setSampleDescription] = useState("");
  const [sampleType, setSampleType] = useState("mass");
  const [sampleMass, setSampleMass] = useState("");
  const [sampleDimensions, setSampleDimensions] = useState({
    x: "",
    y: "",
    z: "",
  });
  const [ashing, setAshing] = useState("no");
  const [crucibleNo, setCrucibleNo] = useState("");
  const [fibres, setFibres] = useState([]);
  const [finalResult, setFinalResult] = useState("");
  const [noFibreDetected, setNoFibreDetected] = useState(false);

  useEffect(() => {
    if (assessmentId && itemNumber) {
      fetchAssessmentDetails();
    }
  }, [assessmentId, itemNumber]);

  const fetchAssessmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(
        "Fetching assessment details for ID:",
        assessmentId,
        "Item:",
        itemNumber
      );

      const response = await asbestosAssessmentService.getJob(assessmentId);
      console.log("Assessment response:", response);

      if (!response) {
        throw new Error("Invalid response format from server");
      }

      setAssessment(response);

      // Find the specific assessment item
      const item = response.items.find(
        (item) => item.itemNumber === parseInt(itemNumber)
      );
      if (!item) {
        throw new Error(`Assessment item ${itemNumber} not found`);
      }

      setAssessmentItem(item);

      // Load saved analysis data if it exists
      if (item.analysisData && Object.keys(item.analysisData).length > 0) {
        const savedData = item.analysisData;
        console.log("Loading saved analysis data:", savedData);

        // Populate form fields with saved data
        setMicroscope(savedData.microscope || "LD-PLM-1");
        setSampleDescription(savedData.sampleDescription || "");
        setSampleType(savedData.sampleType || "mass");
        setSampleMass(savedData.sampleMass || "");
        setSampleDimensions(
          savedData.sampleDimensions || { x: "", y: "", z: "" }
        );
        setAshing(savedData.ashing || "no");
        setCrucibleNo(savedData.crucibleNo || "");
        setFibres(savedData.fibres || []);
        setFinalResult(savedData.finalResult || "");
      } else {
        // Pre-populate sample description if available
        if (item.sampleReference) {
          setSampleDescription(
            `Sample ${item.sampleReference} - ${item.locationDescription}`
          );
        }
      }
    } catch (error) {
      console.error("Error fetching assessment details:", error);

      // Handle specific error cases
      if (error.response?.status === 404) {
        console.error("Assessment or item not found");
        setError("Assessment or item not found. Please check the URL.");
      } else if (error.response?.status === 500) {
        console.error("Server error while fetching assessment");
        setError("Server error while fetching assessment data.");
      } else {
        setError(error.message || "Failed to fetch assessment details");
      }

      // Set assessment to null to prevent further errors
      setAssessment(null);
      setAssessmentItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToAssessment = () => {
    navigate(`/fibre-id/assessment/${assessmentId}/items`);
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const addFibre = () => {
    if (fibres.length >= 4) {
      return; // Maximum 4 fibres allowed
    }
    const fibreLetter = String.fromCharCode(65 + fibres.length); // A, B, C, etc.
    const newFibre = {
      id: Date.now(),
      name: `Fibre ${fibreLetter}`,
      morphology: "",
      disintegrates: "",
      riLiquid: "",
      colour: "",
      pleochrism: "",
      birefringence: "",
      extinction: "",
      signOfElongation: "",
      fibreParallel: "",
      fibrePerpendicular: "",
      result: "",
    };
    setFibres([...fibres, newFibre]);
  };

  const updateFibre = (fibreId, field, value) => {
    setFibres(
      fibres.map((fibre) => {
        if (fibre.id === fibreId) {
          const updatedFibre = { ...fibre, [field]: value };

          // Clear any existing automated result when conditions change
          if (field === "morphology" || field === "disintegrates") {
            updatedFibre.result = "";
          }

          // Auto-calculate result based on disintegrates and morphology
          if (updatedFibre.disintegrates === "yes") {
            if (updatedFibre.morphology === "curly") {
              updatedFibre.result = "Organic fibres detected";
            } else if (updatedFibre.morphology === "straight") {
              updatedFibre.result = "SMF detected";
            }
          } else if (updatedFibre.disintegrates === "no") {
            // For non-disintegrating fibres, result should be manually selected
            // Don't auto-set anything, let user choose
          }

          return updatedFibre;
        }
        return fibre;
      })
    );
  };

  const removeFibre = (fibreId) => {
    setFibres(fibres.filter((fibre) => fibre.id !== fibreId));
  };

  const calculateFinalResult = () => {
    if (fibres.length === 0) {
      return "No fibres Detected";
    }

    // Get all unique fibre results
    const uniqueResults = [
      ...new Set(
        fibres.map((fibre) => fibre.result).filter((result) => result)
      ),
    ];

    if (uniqueResults.length === 0) {
      return "Analysis Incomplete";
    }

    return uniqueResults.join(", ");
  };

  const handleSaveAnalysis = async () => {
    try {
      console.log("Starting to save analysis...");

      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions: sampleType === "dimensions" ? sampleDimensions : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres,
        finalResult: noFibreDetected ? "No fibres detected" : finalResult,
      };

      // Update the assessment item with analysis data
      const response = await asbestosAssessmentService.updateItemAnalysis(
        assessmentId,
        itemNumber,
        analysisData
      );

      console.log("Analysis saved successfully:", response);

      // Update local state
      setAssessmentItem((prev) => ({
        ...prev,
        analysisData: {
          ...prev.analysisData,
          ...analysisData,
          isAnalyzed: true,
        },
      }));

      // Show success message and navigate to assessment items page
      alert("Analysis saved successfully!");
      navigate(`/fibre-id/assessment/${assessmentId}/items`);
    } catch (error) {
      console.error("Error saving analysis:", error);
      console.error("Error details:", error.response?.data);
      // You could add an error notification here
      alert(`Error saving analysis: ${error.message}`);
    }
  };

  const handleMarkAsAnalyzed = async () => {
    try {
      console.log("Marking item as analyzed...");

      // Create analysis data with current form values
      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions: sampleType === "dimensions" ? sampleDimensions : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres,
        finalResult: noFibreDetected ? "No fibres detected" : finalResult,
        isAnalyzed: true,
        analyzedAt: new Date(),
      };

      // Update the assessment item with analysis data
      const response = await asbestosAssessmentService.updateItemAnalysis(
        assessmentId,
        itemNumber,
        analysisData
      );

      console.log("Item marked as analyzed successfully:", response);

      // Update local state
      setAssessmentItem((prev) => ({
        ...prev,
        analysisData: {
          ...prev.analysisData,
          ...analysisData,
        },
      }));

      // You could add a success notification here
      alert("Item marked as analyzed successfully!");
    } catch (error) {
      console.error("Error marking item as analyzed:", error);
      console.error("Error details:", error.response?.data);
      // You could add an error notification here
      alert(`Error marking item as analyzed: ${error.message}`);
    }
  };

  useEffect(() => {
    setFinalResult(calculateFinalResult());
  }, [fibres]);

  useEffect(() => {
    if (noFibreDetected) {
      setMicroscope("N/A");
      setFinalResult("No fibres detected");
    }
  }, [noFibreDetected]);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center">
            Loading assessment details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !assessment || !assessmentItem) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            {error || "Assessment not found"}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/fibre-id")}
            sx={{ mt: 2, display: "block", mx: "auto" }}
          >
            Return to Fibre ID Home
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 2 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Fibre ID Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToAssessment}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Assessment Items
          </Link>
          <Typography color="text.primary">
            {assessmentItem.sampleReference}
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Fibre Analysis
          </Typography>
        </Box>
      </Box>

      {/* Assessment Item Information Card */}
      <Paper sx={{ mb: 2, p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Assessment Item Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Sample Reference
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {assessmentItem.sampleReference || "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Location
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {assessmentItem.locationDescription || "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Material Type
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {assessmentItem.materialType || "N/A"}
            </Typography>
          </Grid>
          {/* <Grid item xs={12} md={3}>
               <Typography variant="subtitle2" color="text.secondary">
                 Asbestos Content
               </Typography>
               <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                 {assessmentItem.asbestosContent || "N/A"}
               </Typography>
             </Grid> */}
        </Grid>
      </Paper>

      {/* Sample Details */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Grid container spacing={3}>
          {/* Sample Description - Full Row */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Sample Description"
              value={sampleDescription}
              onChange={(e) => setSampleDescription(e.target.value)}
            />
          </Grid>

          {/* Sample Type + Mass/Dimensions + Ashing - Same Row */}
          <Grid item xs={12} md={3}>
            <FormControl component="fieldset">
              <RadioGroup
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
              >
                <FormControlLabel
                  value="mass"
                  control={<Radio />}
                  label="Mass"
                />
                <FormControlLabel
                  value="dimensions"
                  control={<Radio />}
                  label="Dimensions (mm)"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            {sampleType === "mass" ? (
              <TextField
                fullWidth
                label="Sample Mass (g)"
                value={sampleMass}
                onChange={(e) => setSampleMass(e.target.value)}
              />
            ) : (
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="D"
                    value={sampleDimensions.x}
                    onChange={(e) =>
                      setSampleDimensions({
                        ...sampleDimensions,
                        x: e.target.value,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="L"
                    value={sampleDimensions.y}
                    onChange={(e) =>
                      setSampleDimensions({
                        ...sampleDimensions,
                        y: e.target.value,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="W"
                    value={sampleDimensions.z}
                    onChange={(e) =>
                      setSampleDimensions({
                        ...sampleDimensions,
                        z: e.target.value,
                      })
                    }
                  />
                </Grid>
              </Grid>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl component="fieldset">
              <RadioGroup
                value={ashing}
                onChange={(e) => setAshing(e.target.value)}
              >
                <FormControlLabel
                  value="no"
                  control={<Radio />}
                  label="Ashing NOT Required"
                />
                <FormControlLabel
                  value="yes"
                  control={<Radio />}
                  label="Ashing Required"
                />
              </RadioGroup>
            </FormControl>

            {ashing === "yes" && (
              <TextField
                label="Crucible Number"
                value={crucibleNo}
                onChange={(e) => setCrucibleNo(e.target.value)}
                sx={{ width: "150px", ml: 2 }}
              />
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Analysis Process */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Analysis Process
        </Typography>

        {/* Microscope and No Fibre Detected */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={noFibreDetected}
                    onChange={(e) => setNoFibreDetected(e.target.checked)}
                  />
                }
                label="No fibres detected"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              {!noFibreDetected && (
                <FormControl fullWidth>
                  <InputLabel>Microscope</InputLabel>
                  <Select
                    value={microscope}
                    onChange={(e) => setMicroscope(e.target.value)}
                    label="Microscope"
                  >
                    <MenuItem value="LD-PLM-1">LD-PLM-1</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Fibre Analysis Box */}
      {!noFibreDetected && (
        <Paper sx={{ mb: 2, p: 3 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 3 }}
          >
            <Typography variant="h6">Fibre Analysis</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addFibre}
              disabled={fibres.length >= 4}
              size="small"
            >
              Add Fibre
            </Button>
          </Box>

          {fibres.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No fibres added yet. Click "Add Fibre" to begin analysis.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    {fibres.map((fibre, index) => (
                      <TableCell key={fibre.id} align="center">
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography
                            variant="subtitle2"
                            color="black"
                            fontWeight="bold"
                          >
                            {fibre.name}
                          </Typography>
                          <Button
                            variant="outlined"
                            color="error"
                            sx={{ backgroundColor: "white" }}
                            size="small"
                            onClick={() => removeFibre(fibre.id)}
                          >
                            Remove
                          </Button>
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Morphology
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.morphology}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "morphology",
                                e.target.value
                              )
                            }
                            size="small"
                          >
                            <MenuItem value="curly">Curly</MenuItem>
                            <MenuItem value="straight">Straight</MenuItem>
                            <MenuItem value="irregular">Irregular</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Disintegrates
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.disintegrates}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "disintegrates",
                                e.target.value
                              )
                            }
                            size="small"
                          >
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        RI Liquid
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.riLiquid}
                          onChange={(e) =>
                            updateFibre(fibre.id, "riLiquid", e.target.value)
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Colour
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.colour}
                          onChange={(e) =>
                            updateFibre(fibre.id, "colour", e.target.value)
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Pleochrism
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.pleochrism}
                          onChange={(e) =>
                            updateFibre(fibre.id, "pleochrism", e.target.value)
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Birefringence
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.birefringence}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "birefringence",
                              e.target.value
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Extinction
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.extinction}
                          onChange={(e) =>
                            updateFibre(fibre.id, "extinction", e.target.value)
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Sign of Elongation
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.signOfElongation}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "signOfElongation",
                              e.target.value
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Fibre Parallel
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.fibreParallel}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "fibreParallel",
                              e.target.value
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Fibre Perpendicular
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.fibrePerpendicular}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "fibrePerpendicular",
                              e.target.value
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Result
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell key={fibre.id} align="center">
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.result}
                          onChange={(e) =>
                            updateFibre(fibre.id, "result", e.target.value)
                          }
                          placeholder="Auto-calculated or manual"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Final Result Box */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Final Result
        </Typography>
        <TextField
          fullWidth
          label="Final Analysis Result"
          value={finalResult}
          onChange={(e) => setFinalResult(e.target.value)}
          multiline
          rows={3}
          placeholder={
            noFibreDetected
              ? "No fibres detected"
              : "Summary of all fibre analysis results"
          }
          disabled={noFibreDetected}
        />
      </Paper>

      {/* Action Buttons */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          variant="outlined"
          color="success"
          onClick={handleMarkAsAnalyzed}
          size="large"
          disabled={
            !assessmentItem?.analysisData ||
            assessmentItem?.analysisData?.isAnalyzed
          }
        >
          {assessmentItem?.analysisData?.isAnalyzed
            ? "Already Analyzed"
            : "Mark as Analyzed"}
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveAnalysis}
          size="large"
        >
          Save Analysis
        </Button>
      </Box>
    </Container>
  );
};

export default AssessmentItemAnalysisPage;
