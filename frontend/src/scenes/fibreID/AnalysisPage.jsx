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
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { sampleItemsService } from "../../services/api";

const AnalysisPage = () => {
  const navigate = useNavigate();
  const { sampleId } = useParams();
  const [sample, setSample] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (sampleId) {
      fetchSampleDetails();
    }
  }, [sampleId]);

  const fetchSampleDetails = async () => {
    try {
      setLoading(true);
      const response = await sampleItemsService.getById(sampleId);
      setSample(response.data);

      // Load saved analysis data if it exists
      if (response.data.analysisData) {
        const savedData = response.data.analysisData;
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
        if (response.data.sampleDescription) {
          setSampleDescription(response.data.sampleDescription);
        }
      }
    } catch (error) {
      console.error("Error fetching sample details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSamples = () => {
    if (sample?.jobId) {
      navigate(`/fibre-id/client-supplied/${sample.jobId}/samples`);
    } else if (sample?.projectId) {
      navigate("/fibre-id/client-supplied");
    } else {
      navigate("/fibre-id");
    }
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
      return "No fibre Detected";
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
        microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions: sampleType === "dimensions" ? sampleDimensions : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres,
        finalResult,
        analyzedAt: new Date(),
      };

      // Update the sample with analysis data and sample description
      const updateData = {
        analysisData,
        analysisResult: finalResult,
        sampleDescription: sampleDescription, // Save to main record
      };

      const response = await sampleItemsService.update(sampleId, updateData);

      console.log("Analysis saved successfully");

      // You could add a success notification here
      alert("Analysis saved successfully!");
    } catch (error) {
      console.error("Error saving analysis:", error);
      console.error("Error details:", error.response?.data);
      // You could add an error notification here
      alert(`Error saving analysis: ${error.message}`);
    }
  };

  useEffect(() => {
    setFinalResult(calculateFinalResult());
  }, [fibres]);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center">
            Loading sample details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!sample) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            Sample not found
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
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
            onClick={handleBackToSamples}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Sample Items
          </Link>
          <Typography color="text.primary">Fibre Analysis</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Fibre Analysis
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Sample analysis and results for fibre identification
          </Typography>
        </Box>

        {/* Sample Information Card - Compact */}
        <Paper sx={{ mb: 4, p: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Sample Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Lab Reference
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                {sample.labReference || "N/A"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Client Reference
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                {sample.clientReference || "N/A"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Analyst
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                {sample.analyzedBy || "Not assigned"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Analysis Date
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                {sample.analyzedAt
                  ? new Date(sample.analyzedAt).toLocaleDateString("en-GB")
                  : "Not set"}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Analysis Process */}
        <Paper sx={{ mb: 4, p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Analysis Process
          </Typography>

          {/* Microscope and Sample Details */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 2 }}>
              Microscope and Sample Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Microscope</InputLabel>
                  <Select
                    value={microscope}
                    onChange={(e) => setMicroscope(e.target.value)}
                    label="Microscope"
                  >
                    <MenuItem value="LD-PLM-1">LD-PLM-1</MenuItem>
                    <MenuItem value="LD-PLM-2">LD-PLM-2</MenuItem>
                    <MenuItem value="LD-PLM-3">LD-PLM-3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Sample Description"
                  value={sampleDescription}
                  onChange={(e) => setSampleDescription(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Sample Type</InputLabel>
                  <Select
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value)}
                    label="Sample Type"
                  >
                    <MenuItem value="mass">Sample Mass (g)</MenuItem>
                    <MenuItem value="dimensions">
                      Sample Dimensions (cm³)
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {sampleType === "mass" ? (
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Sample Mass (g)"
                    type="number"
                    value={sampleMass}
                    onChange={(e) => setSampleMass(e.target.value)}
                  />
                </Grid>
              ) : (
                <>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="X (cm)"
                      type="number"
                      value={sampleDimensions.x}
                      onChange={(e) =>
                        setSampleDimensions({
                          ...sampleDimensions,
                          x: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Y (cm)"
                      type="number"
                      value={sampleDimensions.y}
                      onChange={(e) =>
                        setSampleDimensions({
                          ...sampleDimensions,
                          y: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Z (cm)"
                      type="number"
                      value={sampleDimensions.z}
                      onChange={(e) =>
                        setSampleDimensions({
                          ...sampleDimensions,
                          z: e.target.value,
                        })
                      }
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Ashing Process */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 2 }}>
              Ashing Process
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Ashing Required?</FormLabel>
                  <RadioGroup
                    row
                    value={ashing}
                    onChange={(e) => setAshing(e.target.value)}
                  >
                    <FormControlLabel
                      value="yes"
                      control={<Radio />}
                      label="Yes"
                    />
                    <FormControlLabel
                      value="no"
                      control={<Radio />}
                      label="No"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>
              {ashing === "yes" && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Crucible No."
                    type="number"
                    value={crucibleNo}
                    onChange={(e) => setCrucibleNo(e.target.value)}
                  />
                </Grid>
              )}
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Analytical Process */}
          <Box sx={{ mb: 4 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="subtitle1">Analytical Process</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addFibre}
                disabled={fibres.length >= 4}
              >
                Add Fibre ({fibres.length}/4)
              </Button>
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
              {fibres.map((fibre, index) => {
                console.log(`Rendering fibre ${index}: ${fibre.name}`);
                return (
                  <Paper
                    key={fibre.id}
                    sx={{
                      p: 2,
                      minWidth: "360px",
                      flex: "1 1 360px",
                      maxWidth: "calc(100% - 16px)",
                      minHeight: "400px",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6">{fibre.name}</Typography>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => removeFibre(fibre.id)}
                      >
                        Remove
                      </Button>
                    </Box>

                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell
                              sx={{ fontWeight: "bold", width: "40%" }}
                            >
                              Property
                            </TableCell>
                            <TableCell sx={{ fontWeight: "bold" }}>
                              Value
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Morphology</TableCell>
                            <TableCell>
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
                                >
                                  <MenuItem value="">Select...</MenuItem>
                                  <MenuItem value="straight">Straight</MenuItem>
                                  <MenuItem value="curly">Curly</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Disintegrates? (Y/N)</TableCell>
                            <TableCell>
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
                                >
                                  <MenuItem value="">Select...</MenuItem>
                                  <MenuItem value="yes">Yes</MenuItem>
                                  <MenuItem value="no">No</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                          </TableRow>

                          {fibre.disintegrates === "no" && (
                            <>
                              <TableRow>
                                <TableCell>R.I Liquid</TableCell>
                                <TableCell>
                                  <FormControl fullWidth size="small">
                                    <Select
                                      value={fibre.riLiquid}
                                      onChange={(e) =>
                                        updateFibre(
                                          fibre.id,
                                          "riLiquid",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <MenuItem value="">Select...</MenuItem>
                                      <MenuItem value="1.55">1.55</MenuItem>
                                      <MenuItem value="1.67">1.67</MenuItem>
                                      <MenuItem value="1.70">1.70</MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Colour</TableCell>
                                <TableCell>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    value={fibre.colour}
                                    onChange={(e) =>
                                      updateFibre(
                                        fibre.id,
                                        "colour",
                                        e.target.value
                                      )
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Pleochrism</TableCell>
                                <TableCell>
                                  <FormControl fullWidth size="small">
                                    <Select
                                      value={fibre.pleochrism}
                                      onChange={(e) =>
                                        updateFibre(
                                          fibre.id,
                                          "pleochrism",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <MenuItem value="">Select...</MenuItem>
                                      <MenuItem value="None">None</MenuItem>
                                      <MenuItem value="Low">Low</MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Birefringence</TableCell>
                                <TableCell>
                                  <FormControl fullWidth size="small">
                                    <Select
                                      value={fibre.birefringence}
                                      onChange={(e) =>
                                        updateFibre(
                                          fibre.id,
                                          "birefringence",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <MenuItem value="">Select...</MenuItem>
                                      <MenuItem value="Low">Low</MenuItem>
                                      <MenuItem value="Medium">Medium</MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Extinction</TableCell>
                                <TableCell>
                                  <FormControl fullWidth size="small">
                                    <Select
                                      value={fibre.extinction}
                                      onChange={(e) =>
                                        updateFibre(
                                          fibre.id,
                                          "extinction",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <MenuItem value="">Select...</MenuItem>
                                      <MenuItem value="Partial">
                                        Partial
                                      </MenuItem>
                                      <MenuItem value="Complete">
                                        Complete
                                      </MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Sign of Elongation</TableCell>
                                <TableCell>
                                  <FormControl fullWidth size="small">
                                    <Select
                                      value={fibre.signOfElongation}
                                      onChange={(e) =>
                                        updateFibre(
                                          fibre.id,
                                          "signOfElongation",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <MenuItem value="">Select...</MenuItem>
                                      <MenuItem value="Length-fast">
                                        Length-fast
                                      </MenuItem>
                                      <MenuItem value="Length-slow">
                                        Length-slow
                                      </MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Fibre Parallel</TableCell>
                                <TableCell>
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
                              </TableRow>
                              <TableRow>
                                <TableCell>Fibre Perpendicular</TableCell>
                                <TableCell>
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
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Manual Result Selection for Non-Disintegrating Fibres */}
                    {fibre.disintegrates === "no" && (
                      <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth>
                          <InputLabel>Fibre Result</InputLabel>
                          <Select
                            value={fibre.result}
                            onChange={(e) =>
                              updateFibre(fibre.id, "result", e.target.value)
                            }
                            label="Fibre Result"
                          >
                            <MenuItem value="">Select result...</MenuItem>
                            <MenuItem value="Chrysotile Asbestos">
                              Chrysotile Asbestos
                            </MenuItem>
                            <MenuItem value="Amosite Asbestos">
                              Amosite Asbestos
                            </MenuItem>
                            <MenuItem value="Crocidolite Asbestos">
                              Crocidolite Asbestos
                            </MenuItem>
                            <MenuItem value="Organic Fibre">
                              Organic Fibre
                            </MenuItem>
                            <MenuItem value="SMF">SMF</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    )}

                    {/* Auto-calculated Result Display */}
                    {fibre.result && (
                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label={`Result: ${fibre.result}`}
                          color={
                            fibre.disintegrates === "yes"
                              ? "success"
                              : "primary"
                          }
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Box>

          {/* Save Button */}
          <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSaveAnalysis}
              sx={{ px: 4, py: 1.5 }}
            >
              Save Analysis
            </Button>
          </Box>

          {/* Final Result */}
          <Box sx={{ mt: 4, p: 3, bgcolor: "grey.50", borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Report Result
            </Typography>
            <Chip
              label={finalResult}
              color={
                finalResult === "No fibre Detected" ? "default" : "success"
              }
              size="large"
              sx={{ fontSize: "1.1rem", p: 1 }}
            />
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AnalysisPage;
