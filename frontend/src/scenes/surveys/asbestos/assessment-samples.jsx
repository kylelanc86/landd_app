import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { PhotoCamera, ArrowBack, Description } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";

const AssessmentSamples = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [sampleNumber, setSampleNumber] = useState("");
  const [sampleLocation, setSampleLocation] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [asbestosContent, setAsbestosContent] = useState("");
  const [samples, setSamples] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsbestosContentChange = (event) => {
    setAsbestosContent(event.target.value);
  };

  const handleSaveAndClose = () => {
    // Save the sample data
    const newSample = {
      sampleNumber,
      sampleLocation,
      materialDescription,
      asbestosContent,
    };
    setSamples([...samples, newSample]);
    localStorage.setItem(
      "asbestos_samples",
      JSON.stringify([...samples, newSample])
    );
    navigate("/asbestos-assessment");
  };

  const handleBack = () => {
    navigate("/asbestos-assessment");
  };

  const handleGenerateChainOfCustody = async () => {
    try {
      setLoading(true);
      setError("");
      
      // For now, we'll use a mock assessment ID since the full assessment system isn't implemented yet
      // In a real implementation, this would come from the current assessment context
      const mockAssessmentId = "mock-assessment-id";
      
      const pdfBlob = await asbestosAssessmentService.generateChainOfCustody(mockAssessmentId);
      
      // Create a download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ChainOfCustody_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error generating Chain of Custody:', err);
      setError('Failed to generate Chain of Custody PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load samples from localStorage
    const storedSamples = localStorage.getItem("asbestos_samples");
    if (storedSamples) {
      setSamples(JSON.parse(storedSamples));
    }
  }, []);

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Assessment Samples
      </Typography>

      {/* Assessment Details Grid */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Assessment Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Job ID:</strong> 12345
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Site Address:</strong> 123 Main St, City
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Assessor:</strong> John Doe
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Sample Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add Sample
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Sample Number"
              value={sampleNumber}
              onChange={(e) => setSampleNumber(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Sample Location"
              value={sampleLocation}
              onChange={(e) => setSampleLocation(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Material Description"
              value={materialDescription}
              onChange={(e) => setMaterialDescription(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Asbestos Content</InputLabel>
              <Select
                value={asbestosContent}
                onChange={handleAsbestosContentChange}
                label="Asbestos Content"
              >
                <MenuItem value="no_asbestos">No Asbestos</MenuItem>
                <MenuItem value="chrysotile">Chrysotile Asbestos</MenuItem>
                <MenuItem value="amosite">Amosite Asbestos</MenuItem>
                <MenuItem value="crocidolite">Crocidolite Asbestos</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ mt: 1, display: "flex", gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => {
                  // Check if the device has a camera
                  if (
                    navigator.mediaDevices &&
                    navigator.mediaDevices.getUserMedia
                  ) {
                    navigator.mediaDevices
                      .getUserMedia({ video: true })
                      .then((stream) => {
                        // Camera is available, open it
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.capture = "environment"; // Use camera
                        input.onchange = (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            // Handle the photo file here
                            console.log("Photo taken:", file);
                          }
                        };
                        input.click();
                      })
                      .catch((err) => {
                        // Camera is not available
                        alert("Device camera not detected.");
                      });
                  } else {
                    alert("Device camera not detected.");
                  }
                }}
              >
                Take Photo
              </Button>
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => {
                  // Open file upload dialog
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      // Handle the photo file here
                      console.log("Photo uploaded:", file);
                    }
                  };
                  input.click();
                }}
              >
                Upload Photo
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Additional Asbestos Details Form */}
      {asbestosContent !== "no_asbestos" && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Asbestos Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Asbestos Type"
                placeholder="Enter asbestos type"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Condition"
                placeholder="Enter condition"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Risk" placeholder="Enter risk" />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Recommendations"
                placeholder="Enter recommendations"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleSaveAndClose}
          sx={{
            backgroundColor: theme.palette.primary[500],
            "&:hover": {
              backgroundColor: theme.palette.primary[600],
            },
          }}
        >
          Save and Close
        </Button>
        <Button
          variant="outlined"
          startIcon={<Description />}
          onClick={handleGenerateChainOfCustody}
          disabled={loading}
          sx={{
            borderColor: theme.palette.secondary[500],
            color: theme.palette.secondary[500],
            "&:hover": {
              borderColor: theme.palette.secondary[600],
              backgroundColor: theme.palette.secondary[50],
            },
          }}
        >
          {loading ? "Generating..." : "Generate Chain of Custody"}
        </Button>
      </Box>

      {/* Sample Summary Table */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sample Summary
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Sample Number</TableCell>
                <TableCell>Sample Location</TableCell>
                <TableCell>Material Description</TableCell>
                <TableCell>Asbestos Content</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {samples.map((sample, index) => (
                <TableRow key={index}>
                  <TableCell>{sample.sampleNumber}</TableCell>
                  <TableCell>{sample.sampleLocation}</TableCell>
                  <TableCell>{sample.materialDescription}</TableCell>
                  <TableCell>{sample.asbestosContent}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AssessmentSamples;
