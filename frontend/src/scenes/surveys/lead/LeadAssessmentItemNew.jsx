import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Grid,
  InputAdornment,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { asbestosAssessmentService } from "../../../services/api";
import { useSnackbar } from "../../../context/SnackbarContext";

const SAMPLE_TYPE_OPTIONS = [
  { value: "paint", label: "Paint" },
  { value: "dust", label: "Dust" },
  { value: "soil", label: "Soil" },
];

const emptyReferredRow = () => ({
  levelFloor: "",
  roomArea: "",
  surfaceDescription: "",
  condition: "",
});

const LeadAssessmentItemNew = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [sampleType, setSampleType] = useState("");
  const [sampleRef, setSampleRef] = useState("");
  const [levelFloor, setLevelFloor] = useState("");
  const [roomArea, setRoomArea] = useState("");
  const [surfaceDescription, setSurfaceDescription] = useState("");
  const [paintColour, setPaintColour] = useState("");
  const [condition, setCondition] = useState("");
  const [leadContent, setLeadContent] = useState("");
  const [referredLocations, setReferredLocations] = useState([emptyReferredRow()]);

  useEffect(() => {
    let cancelled = false;
    const fetchAssessment = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const response = await asbestosAssessmentService.getAsbestosAssessmentById(id);
        const data = response?.data || response;
        if (cancelled) return;
        setAssessment(data);
      } catch (err) {
        if (!cancelled) setAssessment(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAssessment();
    return () => { cancelled = true; };
  }, [id]);

  const assessmentTypes = assessment?.assessmentType ?? [];
  const sampleTypeOptions = SAMPLE_TYPE_OPTIONS.filter((opt) =>
    assessmentTypes.map((t) => String(t).toLowerCase()).includes(opt.value),
  );

  const addReferredRow = () => {
    setReferredLocations((prev) => [...prev, emptyReferredRow()]);
  };

  const removeReferredRow = (index) => {
    setReferredLocations((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [emptyReferredRow()] : next;
    });
  };

  const updateReferredRow = (index, field, value) => {
    setReferredLocations((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const handleSubmit = async () => {
    if (!sampleType) {
      setSubmitError("Please select a sample type.");
      return;
    }
    if (!sampleRef || !sampleRef.trim()) {
      setSubmitError("Sample reference is required.");
      return;
    }
    if (!surfaceDescription || !surfaceDescription.trim()) {
      setSubmitError("Surface description is required.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);

    try {
      const referred = referredLocations.filter(
        (r) =>
          r.levelFloor?.trim() ||
          r.roomArea?.trim() ||
          r.surfaceDescription?.trim() ||
          r.condition?.trim(),
      );
      const fullSampleRef = sampleRef.trim() ? `LD-${sampleRef.trim()}` : "";
      const itemPayload = {
        sampleReference: fullSampleRef,
        levelFloor: levelFloor.trim() || undefined,
        roomArea: roomArea.trim() || undefined,
        locationDescription: surfaceDescription.trim(),
        materialType: sampleType.charAt(0).toUpperCase() + sampleType.slice(1),
        condition: condition.trim() || undefined,
        paintColour: paintColour.trim() || undefined,
        leadContent: leadContent.trim() || undefined,
        referredLocations: referred.length ? referred : undefined,
      };
      await asbestosAssessmentService.addItem(id, itemPayload);
      showSnackbar("Assessment item added.", "success");
      navigate(`/surveys/lead/${id}/items`);
    } catch (err) {
      console.error("Error adding lead assessment item:", err);
      setSubmitError(
        err.response?.data?.message || err.message || "Failed to add item",
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/surveys/lead/${id}/items`);
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={24} />
          <Typography>Loading…</Typography>
        </Box>
      </Box>
    );
  }

  if (!assessment || assessment.jobType !== "lead-assessment") {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/surveys/lead")} sx={{ mb: 2 }}>
          Back to Lead Assessment
        </Button>
        <Typography color="text.secondary">Assessment not found or not a lead assessment.</Typography>
      </Box>
    );
  }

  const projectID = assessment?.projectId?.projectID ?? "";
  const projectName = assessment?.projectId?.name ?? "";

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, width: "100%" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleCancel}
        sx={{ mb: 2 }}
      >
        Back to Lead Assessment Items
      </Button>

      <Typography variant="h4" component="h1" gutterBottom>
        Add Lead Assessment Item
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {projectID}
        {projectName ? ` – ${projectName}` : ""}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth required>
            <InputLabel>Sample Type</InputLabel>
            <Select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value)}
              label="Sample Type"
            >
              {sampleTypeOptions.length === 0 ? (
                <MenuItem disabled value="">
                  No types (set assessment types on the job first)
                </MenuItem>
              ) : (
                sampleTypeOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Sample Reference"
            value={sampleRef}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("LD-")) setSampleRef(v.slice(3));
              else setSampleRef(v);
            }}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">LD-</InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Paint Colour"
            value={paintColour}
            onChange={(e) => setPaintColour(e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Lead Content"
            value={leadContent}
            onChange={(e) => setLeadContent(e.target.value)}
          />
        </Grid>
        </Grid>
        <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Sample Location
        </Typography>
        <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Level/Floor"
            value={levelFloor}
            onChange={(e) => setLevelFloor(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Room/Area"
            value={roomArea}
            onChange={(e) => setRoomArea(e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Surface Description"
            value={surfaceDescription}
            onChange={(e) => setSurfaceDescription(e.target.value)}
            required
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Referred Locations
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>Level/Floor</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Room/Area</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Surface Description</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Condition</TableCell>
              <TableCell width={56} />
            </TableRow>
          </TableHead>
          <TableBody>
            {referredLocations.map((row, index) => (
              <TableRow key={index}>
                <TableCell padding="none">
                  <TextField
                    size="small"
                    fullWidth
                    value={row.levelFloor}
                    onChange={(e) =>
                      updateReferredRow(index, "levelFloor", e.target.value)
                    }
                    variant="standard"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell padding="none">
                  <TextField
                    size="small"
                    fullWidth
                    value={row.roomArea}
                    onChange={(e) =>
                      updateReferredRow(index, "roomArea", e.target.value)
                    }
                    variant="standard"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell padding="none">
                  <TextField
                    size="small"
                    fullWidth
                    value={row.surfaceDescription}
                    onChange={(e) =>
                      updateReferredRow(index, "surfaceDescription", e.target.value)
                    }
                    variant="standard"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell padding="none">
                  <TextField
                    size="small"
                    fullWidth
                    value={row.condition}
                    onChange={(e) =>
                      updateReferredRow(index, "condition", e.target.value)
                    }
                    variant="standard"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell padding="none">
                  <IconButton
                    size="small"
                    onClick={() => removeReferredRow(index)}
                    disabled={referredLocations.length === 1}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        startIcon={<AddIcon />}
        onClick={addReferredRow}
        size="small"
        sx={{ mb: 3 }}
      >
        Add row
      </Button>

      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Button onClick={handleCancel} disabled={submitLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            submitLoading ||
            !sampleType ||
            !sampleRef?.trim() ||
            !surfaceDescription?.trim() ||
            sampleTypeOptions.length === 0
          }
          sx={{
            backgroundColor: "#9c27b0",
            "&:hover": { backgroundColor: "#7b1fa2" },
          }}
        >
          {submitLoading ? "Adding…" : "Add Item"}
        </Button>
      </Box>
    </Box>
  );
};

export default LeadAssessmentItemNew;
