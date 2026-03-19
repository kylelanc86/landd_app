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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { asbestosAssessmentService } from "../../../services/api";
import customDataFieldGroupService from "../../../services/customDataFieldGroupService";
import { useSnackbar } from "../../../context/SnackbarContext";

const SAMPLE_TYPE_OPTIONS = [
  { value: "paint", label: "Paint" },
  { value: "dust", label: "Dust" },
  { value: "soil", label: "Soil" },
];

const PAINT_COLOUR_OPTIONS = [
  "White",
  "Beige",
  "Black",
  "Blue",
  "Brown",
  "Charcoal",
  "Cream",
  "Green",
  "Grey",
  "Light Grey",
  "Light Blue",
  "Light Green",
  "Orange",
  "Pink",
  "Purple",
  "Red",
  "Yellow",
];

const OCCUPANT_RATING_OPTIONS = [
  { value: 1, label: "Adult" },
  { value: 2, label: "Adolescent (high school)" },
  { value: 3, label: "Child (preschool & primary)" },
];

const LOCATION_RATING_OPTIONS = [
  { value: 1, label: "High-level/inaccessible surface (e.g. ceiling/top of cupboard)" },
  { value: 2, label: "Low contact surface (e.g. floor/wall/soil)" },
  { value: 3, label: "High contact surface (desk/door/window/playground equipment)" },
];

const ROOM_USE_OPTIONS = [
  { value: 1, label: "Occasional use (e.g. cleaners' cupboard)" },
  { value: 2, label: "Daily, infrequent use (e.g. bathrooms)" },
  { value: 3, label: "Daily, heavy use (e.g. office, classroom)" },
];

const CONDITION_RATING_OPTIONS = [
  { value: 1, label: "Good/stable condition" },
  { value: 2, label: "Minor flaking" },
  { value: 3, label: "Severe flaking/ loose flakes" },
  { value: 4, label: "Lead dust" },
];

function getRiskLevelLabel(product) {
  if (product == null || product < 7) return "VERY LOW RISK";
  if (product <= 18) return "LOW RISK";
  if (product <= 35) return "MEDIUM RISK";
  return "HIGH RISK";
}

const emptyReferredLocation = () => ({
  levelFloor: "",
  roomArea: "",
  surfaceDescription: "",
  occupantRating: "",
  locationRating: "",
  roomUseRating: "",
  conditionRating: "",
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
  const [surfaceDescriptionValues, setSurfaceDescriptionValues] = useState([]);
  const [leadSurfaceDescriptionOptions, setLeadSurfaceDescriptionOptions] = useState([]);
  const [surfaceDescriptionInput, setSurfaceDescriptionInput] = useState("");
  const [paintColour, setPaintColour] = useState("");
  const [leadContent] = useState("");
  const [occupantRating, setOccupantRating] = useState("");
  const [locationRating, setLocationRating] = useState("");
  const [roomUseRating, setRoomUseRating] = useState("");
  const [conditionRating, setConditionRating] = useState("");
  const [referredLocations, setReferredLocations] = useState([]);
  const [referredModalOpen, setReferredModalOpen] = useState(false);
  const [referredModalForm, setReferredModalForm] = useState(emptyReferredLocation());
  const [referredSurfaceInput, setReferredSurfaceInput] = useState("");

  const riskProduct =
    occupantRating !== "" &&
    locationRating !== "" &&
    roomUseRating !== "" &&
    conditionRating !== ""
      ? Number(occupantRating) * Number(locationRating) * Number(roomUseRating) * Number(conditionRating)
      : null;
  const riskLevelLabel = riskProduct != null ? getRiskLevelLabel(riskProduct) : null;

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

  useEffect(() => {
    let cancelled = false;
    const fetchLeadSurfaceDescriptions = async () => {
      try {
        const data = await customDataFieldGroupService.getFieldsByType("lead_surface_description");
        if (cancelled) return;
        const raw = Array.isArray(data) ? data : data?.data ?? data?.fields ?? data?.items ?? [];
        const options = raw
          .map((f) => (typeof f === "string" ? f : f?.text ?? f?.name ?? ""))
          .filter(Boolean);
        setLeadSurfaceDescriptionOptions([...new Set(options)].sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        if (!cancelled) setLeadSurfaceDescriptionOptions([]);
      }
    };
    fetchLeadSurfaceDescriptions();
    return () => { cancelled = true; };
  }, []);

  const assessmentTypes = assessment?.assessmentType ?? [];
  const sampleTypeOptions = SAMPLE_TYPE_OPTIONS.filter((opt) =>
    assessmentTypes.map((t) => String(t).toLowerCase()).includes(opt.value),
  );

  // If assessment supports only one sample type, auto-select it
  useEffect(() => {
    if (sampleTypeOptions.length === 1 && !sampleType) {
      setSampleType(sampleTypeOptions[0].value);
    }
  }, [sampleTypeOptions, sampleType]);

  const openReferredModal = () => {
    const defaultSurface = surfaceDescriptionValues
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
    setReferredSurfaceInput("");
    setReferredModalForm({
      ...emptyReferredLocation(),
      surfaceDescription: defaultSurface,
    });
    setReferredModalOpen(true);
  };

  const closeReferredModal = () => {
    setReferredModalOpen(false);
    setReferredModalForm(emptyReferredLocation());
  };

  const addReferredFromModal = () => {
    const r = referredModalForm;
    const hasAny = r.levelFloor?.trim() || r.roomArea?.trim() || r.surfaceDescription?.trim() ||
      r.occupantRating !== "" || r.locationRating !== "" || r.roomUseRating !== "" || r.conditionRating !== "";
    if (!hasAny) return;
    setReferredLocations((prev) => [...prev, { ...r }]);
    closeReferredModal();
  };

  const removeReferredRow = (index) => {
    setReferredLocations((prev) => prev.filter((_, i) => i !== index));
  };

  const getReferredRisk = (row) => {
    const o = row.occupantRating;
    const l = row.locationRating;
    const u = row.roomUseRating;
    const c = row.conditionRating;
    if (o === "" || o == null || l === "" || l == null || u === "" || u == null || c === "" || c == null) return null;
    const product = Number(o) * Number(l) * Number(u) * Number(c);
    return { product, label: getRiskLevelLabel(product) };
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
    if (!surfaceDescriptionValues || surfaceDescriptionValues.length === 0) {
      setSubmitError("At least one surface description is required.");
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
          r.occupantRating !== "" ||
          r.locationRating !== "" ||
          r.roomUseRating !== "" ||
          r.conditionRating !== "",
      );
      const fullSampleRef = sampleRef.trim() ? `LD-${sampleRef.trim()}` : "";
      const itemPayload = {
        sampleReference: fullSampleRef,
        levelFloor: levelFloor.trim() || undefined,
        roomArea: roomArea.trim() || undefined,
        locationDescription: surfaceDescriptionValues.map((s) => s.trim()).filter(Boolean).join(", "),
        materialType: sampleType.charAt(0).toUpperCase() + sampleType.slice(1),
        paintColour: paintColour.trim() || undefined,
        leadContent: leadContent.trim() || undefined,
        occupantRating: occupantRating !== "" ? Number(occupantRating) : undefined,
        locationRating: locationRating !== "" ? Number(locationRating) : undefined,
        roomUseRating: roomUseRating !== "" ? Number(roomUseRating) : undefined,
        conditionRating: conditionRating !== "" ? Number(conditionRating) : undefined,
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
          <Autocomplete
            freeSolo
            options={PAINT_COLOUR_OPTIONS}
            value={paintColour || null}
            onChange={(_, newValue) => setPaintColour(newValue || "")}
            onInputChange={(_, newInputValue) => setPaintColour(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Paint Colour"
                helperText="Choose a colour or type a custom value"
              />
            )}
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
          <Autocomplete
            multiple
            freeSolo
            options={leadSurfaceDescriptionOptions}
            value={surfaceDescriptionValues}
            onChange={(_, newValue) => setSurfaceDescriptionValues(newValue)}
            inputValue={surfaceDescriptionInput}
            onInputChange={(_, newInputValue) => setSurfaceDescriptionInput(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Surface Description"
                required={surfaceDescriptionValues.length === 0}
                helperText="Select from the list or type and press Enter to add a custom option"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const trimmed = surfaceDescriptionInput.trim();
                  if (!trimmed) return;
                  e.preventDefault();
                  setSurfaceDescriptionValues((prev) =>
                    prev.includes(trimmed) ? prev : [...prev, trimmed],
                  );
                  setSurfaceDescriptionInput("");
                }}
              />
            )}
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Risk Rating
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Occupant rating</InputLabel>
            <Select
              value={occupantRating}
              onChange={(e) => setOccupantRating(e.target.value)}
              label="Occupant rating"
            >
              {OCCUPANT_RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Location rating</InputLabel>
            <Select
              value={locationRating}
              onChange={(e) => setLocationRating(e.target.value)}
              label="Location rating"
            >
              {LOCATION_RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Room Use</InputLabel>
            <Select
              value={roomUseRating}
              onChange={(e) => setRoomUseRating(e.target.value)}
              label="Room Use"
            >
              {ROOM_USE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Condition</InputLabel>
            <Select
              value={conditionRating}
              onChange={(e) => setConditionRating(e.target.value)}
              label="Condition"
            >
              {CONDITION_RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        {riskProduct != null && (
          <Grid item xs={12}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 1,
                bgcolor:
                  riskLevelLabel === "HIGH RISK"
                    ? "error.light"
                    : riskLevelLabel === "MEDIUM RISK"
                      ? "warning.light"
                      : riskLevelLabel === "LOW RISK"
                        ? "info.light"
                        : "success.light",
                color:
                  riskLevelLabel === "HIGH RISK"
                    ? "error.contrastText"
                    : riskLevelLabel === "MEDIUM RISK"
                      ? "warning.contrastText"
                      : riskLevelLabel === "LOW RISK"
                        ? "info.contrastText"
                        : "success.contrastText",
                fontWeight: 600,
              }}
            >
              Risk rating: {riskProduct} — {riskLevelLabel}
            </Box>
          </Grid>
        )}
      </Grid>

      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Referred Locations
      </Typography>
      <Button
        startIcon={<AddIcon />}
        onClick={openReferredModal}
        size="small"
        sx={{ mb: 1 }}
      >
        Add Referred Location
      </Button>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
              <TableCell sx={{ fontWeight: "bold" }}>Level/Floor</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Room/Area</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Surface Description</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Risk</TableCell>
              <TableCell width={56} />
            </TableRow>
          </TableHead>
          <TableBody>
            {referredLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 2 }}>
                  No referred locations. Click &quot;Add Referred Location&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              referredLocations.map((row, index) => {
                const risk = getReferredRisk(row);
                return (
                  <TableRow key={index}>
                    <TableCell>{row.levelFloor || "—"}</TableCell>
                    <TableCell>{row.roomArea || "—"}</TableCell>
                    <TableCell>{row.surfaceDescription || "—"}</TableCell>
                    <TableCell>
                      {risk ? `${risk.product} — ${risk.label}` : "—"}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeReferredRow(index)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={referredModalOpen} onClose={closeReferredModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add Referred Location</Typography>
            <IconButton onClick={closeReferredModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Level/Floor"
            value={referredModalForm.levelFloor}
            onChange={(e) => setReferredModalForm((prev) => ({ ...prev, levelFloor: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Room/Area"
            value={referredModalForm.roomArea}
            onChange={(e) => setReferredModalForm((prev) => ({ ...prev, roomArea: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            freeSolo
            options={leadSurfaceDescriptionOptions}
            value={(referredModalForm.surfaceDescription
              ? referredModalForm.surfaceDescription.split(",").map((s) => s.trim()).filter(Boolean)
              : [])}
            onChange={(_, newValue) =>
              setReferredModalForm((prev) => ({
                ...prev,
                surfaceDescription: newValue.join(", "),
              }))
            }
            inputValue={referredSurfaceInput}
            onInputChange={(_, newInputValue) => setReferredSurfaceInput(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Surface Description"
                helperText="Select from the list or type and press Enter to add a custom option"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const trimmed = referredSurfaceInput.trim();
                  if (!trimmed) return;
                  e.preventDefault();
                  const current = referredModalForm.surfaceDescription
                    ? referredModalForm.surfaceDescription.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];
                  if (current.includes(trimmed)) {
                    setReferredSurfaceInput("");
                    return;
                  }
                  const next = [...current, trimmed];
                  setReferredModalForm((prev) => ({ ...prev, surfaceDescription: next.join(", ") }));
                  setReferredSurfaceInput("");
                }}
              />
            )}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" fontWeight="600" sx={{ mt: 2, mb: 1 }}>
            Risk Rating
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Occupant rating</InputLabel>
                <Select
                  value={referredModalForm.occupantRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, occupantRating: e.target.value }))}
                  label="Occupant rating"
                >
                  {OCCUPANT_RATING_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Location rating</InputLabel>
                <Select
                  value={referredModalForm.locationRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, locationRating: e.target.value }))}
                  label="Location rating"
                >
                  {LOCATION_RATING_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Room Use</InputLabel>
                <Select
                  value={referredModalForm.roomUseRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, roomUseRating: e.target.value }))}
                  label="Room Use"
                >
                  {ROOM_USE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Condition</InputLabel>
                <Select
                  value={referredModalForm.conditionRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, conditionRating: e.target.value }))}
                  label="Condition"
                >
                  {CONDITION_RATING_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeReferredModal}>Cancel</Button>
          <Button variant="contained" onClick={addReferredFromModal} sx={{ backgroundColor: "#9c27b0", "&:hover": { backgroundColor: "#7b1fa2" } }}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
 

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
            surfaceDescriptionValues.length === 0 ||
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
