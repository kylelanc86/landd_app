import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import leadClearanceService from "../../services/leadClearanceService";
import {
  Box,
  Typography,
  Link,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Grid,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

const SURFACE_TYPE_OPTIONS = [
  "Criteria 1 - accessible interior surfaces",
  "Criteria 2 - exterior contact surfaces",
  "Criteria 3 - Inaccessible surfaces (high-level surfaces, behind heavy furniture etc.)",
];

const SAMPLE_AREA_OPTIONS = [
  { value: "100", label: "Small - 100cm² / 0.01m²" },
  { value: "258", label: "Medium - 258cm² / 0.0258m²" },
  { value: "900", label: "Large - 900cm² / 0.09m²" },
];

const ensureSampleReferencePrefix = (value) => {
  if (!value || value.trim() === "") return "";
  const trimmed = value.trim().toUpperCase();
  if (trimmed.startsWith("LD-")) return trimmed;
  return `LD-${trimmed}`;
};

const parseLeadContentForNumber = (leadContent) => {
  const trimmed = String(leadContent ?? "").trim();
  const hasLessThan = trimmed.startsWith("<");
  const numStr = hasLessThan ? trimmed.replace(/^<\s*/, "").trim() : trimmed;
  return { num: parseFloat(numStr), hasLessThan };
};

const calculateLeadConcentration = (leadContent, sampleArea, sampleType) => {
  const { num: lead, hasLessThan } = parseLeadContentForNumber(leadContent);
  const area = parseFloat(sampleArea);
  if (sampleType === "soil") {
    if (isNaN(lead)) return "";
    return hasLessThan ? `< ${lead}` : lead;
  }
  if (sampleType === "dust") {
    if (isNaN(lead) || isNaN(area) || area === 0) return "";
    const conc = lead / 1000 / (area / 1000);
    return hasLessThan ? `< ${conc}` : conc;
  }
  return "";
};

const LeadClearanceSampling = () => {
  const navigate = useNavigate();
  const { clearanceId } = useParams();

  const [preWorksSamples, setPreWorksSamples] = useState([]);
  const [validationSamples, setValidationSamples] = useState([]);
  const [clearanceItems, setClearanceItems] = useState([]);
  const [clearanceItemsLoading, setClearanceItemsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSample, setEditingSample] = useState(null);
  const [form, setForm] = useState({
    sampleType: "pre-works",
    sample: "dust",
    sampleRef: "",
    roomArea: "",
    locationDescription: "",
    surfaceType: "",
    sampleArea: "",
    leadContent: "",
    linkedPreWorksSampleId: "",
    linkedClearanceItemId: "",
  });

  useEffect(() => {
    if (!clearanceId) return;
    let cancelled = false;
    setClearanceItemsLoading(true);
    leadClearanceService
      .getItems(clearanceId)
      .then((items) => {
        if (!cancelled) setClearanceItems(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelled) setClearanceItems([]);
      })
      .finally(() => {
        if (!cancelled) setClearanceItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearanceId]);

  useEffect(() => {
    if (!clearanceId) return;
    let cancelled = false;
    leadClearanceService
      .getSampling(clearanceId)
      .then((data) => {
        if (!cancelled) {
          setPreWorksSamples(
            Array.isArray(data.preWorksSamples) ? data.preWorksSamples : [],
          );
          setValidationSamples(
            Array.isArray(data.validationSamples) ? data.validationSamples : [],
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreWorksSamples([]);
          setValidationSamples([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clearanceId]);

  const leadConcentration = useMemo(
    () =>
      calculateLeadConcentration(
        form.leadContent,
        form.sampleArea,
        form.sample,
      ),
    [form.leadContent, form.sampleArea, form.sample],
  );

  const validationSamplingClearanceItems = useMemo(
    () =>
      clearanceItems.filter(
        (item) =>
          item.leadValidationType ===
          "Visual inspection and validation sampling",
      ),
    [clearanceItems],
  );

  const resetForm = () => {
    setForm({
      sampleType: "pre-works",
      sample: "dust",
      sampleRef: "",
      roomArea: "",
      locationDescription: "",
      surfaceType: "",
      sampleArea: "",
      leadContent: "",
      linkedPreWorksSampleId: "",
      linkedClearanceItemId: "",
    });
    setEditingSample(null);
  };

  const requiredFieldsFilled =
    !!form.sampleRef?.trim() &&
    !!form.roomArea?.trim() &&
    !!form.locationDescription?.trim() &&
    !!form.surfaceType?.trim() &&
    !!form.sampleArea?.trim();
  const canSubmit =
    requiredFieldsFilled &&
    (form.sampleType !== "validation" || !!form.linkedClearanceItemId?.trim());

  const getSamplesForType = (type) =>
    type === "pre-works" ? preWorksSamples : validationSamples;

  const setSamplesForType = (type, samples) => {
    if (type === "pre-works") setPreWorksSamples(samples);
    else setValidationSamples(samples);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const fullRef = form.sampleRef.trim()
      ? ensureSampleReferencePrefix(form.sampleRef)
      : "";
    const { num: leadContentNum, hasLessThan } = parseLeadContentForNumber(
      form.leadContent,
    );
    const sampleAreaNum = parseFloat(form.sampleArea);
    const concValue =
      form.sample === "soil"
        ? leadContentNum
        : leadContentNum / 1000 / (sampleAreaNum / 1000);
    const conc =
      hasLessThan && !Number.isNaN(concValue) ? `< ${concValue}` : concValue;

    const sampleData = {
      id: editingSample?.id || Date.now().toString(),
      sampleType: form.sampleType,
      sample: form.sample,
      sampleRef: fullRef,
      roomArea: form.roomArea,
      locationDescription: form.locationDescription,
      surfaceType: form.surfaceType,
      sampleArea: form.sampleArea,
      leadContent: form.leadContent,
      leadConcentration: conc,
    };
    if (form.sampleType === "validation") {
      sampleData.linkedPreWorksSampleId = form.linkedPreWorksSampleId || null;
      sampleData.linkedClearanceItemId = form.linkedClearanceItemId || null;
    }

    let nextPreWorks = preWorksSamples;
    let nextValidation = validationSamples;

    if (editingSample) {
      const oldType = editingSample.sampleType;
      const newType = form.sampleType;
      if (oldType === newType) {
        const samples = getSamplesForType(newType);
        const updated = samples.map((s) =>
          s.id === editingSample.id ? sampleData : s,
        );
        if (newType === "pre-works") nextPreWorks = updated;
        else nextValidation = updated;
        setSamplesForType(newType, updated);
      } else {
        const oldSamples = getSamplesForType(oldType).filter(
          (s) => s.id !== editingSample.id,
        );
        const newSamples = [...getSamplesForType(newType), sampleData];
        if (oldType === "pre-works") nextPreWorks = oldSamples;
        else nextValidation = oldSamples;
        if (newType === "pre-works") nextPreWorks = newSamples;
        else nextValidation = newSamples;
        setSamplesForType(oldType, oldSamples);
        setSamplesForType(newType, newSamples);
      }
    } else {
      if (form.sampleType === "pre-works") {
        nextPreWorks = [...preWorksSamples, sampleData];
        setSamplesForType("pre-works", nextPreWorks);
      } else {
        nextValidation = [...validationSamples, sampleData];
        setSamplesForType("validation", nextValidation);
      }
    }

    leadClearanceService
      .updateSampling(clearanceId, {
        preWorksSamples: nextPreWorks,
        validationSamples: nextValidation,
      })
      .catch(() => {});

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (sample, sampleType) => {
    setEditingSample({ ...sample, sampleType });
    setForm({
      sampleType,
      sample: sample.sample || "dust",
      sampleRef: sample.sampleRef?.startsWith("LD-")
        ? sample.sampleRef.substring(3)
        : sample.sampleRef || "",
      roomArea: sample.roomArea || "",
      locationDescription: sample.locationDescription || "",
      surfaceType: sample.surfaceType || "",
      sampleArea:
        sample.sampleArea &&
        SAMPLE_AREA_OPTIONS.some((o) => o.value === String(sample.sampleArea))
          ? String(sample.sampleArea)
          : "",
      leadContent: sample.leadContent || "",
      linkedPreWorksSampleId: sample.linkedPreWorksSampleId || "",
      linkedClearanceItemId: sample.linkedClearanceItemId || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (sample, sampleType) => {
    const samples = getSamplesForType(sampleType);
    const next = samples.filter((s) => s.id !== sample.id);
    setSamplesForType(sampleType, next);
    const nextPreWorks = sampleType === "pre-works" ? next : preWorksSamples;
    const nextValidation =
      sampleType === "validation" ? next : validationSamples;
    leadClearanceService
      .updateSampling(clearanceId, {
        preWorksSamples: nextPreWorks,
        validationSamples: nextValidation,
      })
      .catch(() => {});
  };

  const SampleTable = ({ title, samples, sampleType }) => (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  background: "linear-gradient(to right, #045E1F, #96CC78)",
                  color: "white",
                }}
              >
                <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                  Sample ref.
                </TableCell>
                <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                  Sample Description
                </TableCell>
                <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                  Surface type
                </TableCell>
                <TableCell
                  sx={{ color: "inherit", fontWeight: "bold" }}
                  align="right"
                >
                  Sample Area
                </TableCell>
                <TableCell
                  sx={{ color: "inherit", fontWeight: "bold" }}
                  align="right"
                >
                  Lead content
                </TableCell>
                <TableCell
                  sx={{ color: "inherit", fontWeight: "bold" }}
                  align="right"
                >
                  Lead concentration
                </TableCell>
                <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!samples || samples.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 4, color: "text.secondary", fontStyle: "italic" }}
                  >
                    No samples added
                  </TableCell>
                </TableRow>
              ) : (
                samples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell>{sample.sampleRef || "—"}</TableCell>
                    <TableCell>
                      {[sample.roomArea, sample.locationDescription]
                        .filter(Boolean)
                        .join(" - ") || "—"}
                    </TableCell>
                    <TableCell>
                      {sample.surfaceType?.split(" - ")[0] ||
                        sample.surfaceType ||
                        "—"}
                    </TableCell>
                    <TableCell align="right">
                      {sample.sampleArea ? `${sample.sampleArea} cm²` : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {sample.leadContent}
                      {sample.sample === "dust" ? " µg" : " mg/kg"}
                    </TableCell>
                    <TableCell align="right">
                      {sample.sample === "dust"
                        ? (() => {
                            const n = Number(sample.leadConcentration);
                            return Number.isNaN(n)
                              ? sample.leadConcentration
                              : n.toFixed(4);
                          })()
                        : sample.leadContent}{" "}
                      {sample.sample === "dust" ? "mg/m²" : "mg/kg"}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(sample, sampleType)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(sample, sampleType)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  return (
    <Box m="20px">
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 2,
          }}
        >
          <Box>
            <Link
              component="button"
              variant="body1"
              onClick={() =>
                navigate(
                  clearanceId
                    ? `/lead-clearances/${clearanceId}/items`
                    : "/lead-removal",
                )
              }
              sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            >
              <ArrowBackIcon sx={{ mr: 1 }} />
              Back to Clearance Items
            </Link>
            <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
              Lead Clearance Sampling
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              startIcon={<AddIcon />}
              sx={{ mt: 2 }}
            >
              Add Sample
            </Button>
          </Box>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              minWidth: 280,
              maxWidth: 360,
              bgcolor: "grey.50",
            }}
          >
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Surface type criteria
            </Typography>
            <Typography
              variant="body2"
              component="div"
              sx={{ "& > div": { mt: 0.5 } }}
            >
              <Box>
                <strong>Criteria 1</strong> – accessible interior surfaces
              </Box>
              <Box>
                <strong>Criteria 2</strong> – exterior contact surfaces
              </Box>
              <Box>
                <strong>Criteria 3</strong> – inaccessible surfaces (high-level
                surfaces, behind heavy furniture, etc.)
              </Box>
            </Typography>
          </Paper>
        </Box>
      </Box>

      <SampleTable
        title="Pre-works Sampling"
        samples={preWorksSamples}
        sampleType="pre-works"
      />
      <SampleTable
        title="Validation Sampling"
        samples={validationSamples}
        sampleType="validation"
      />

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingSample ? "Edit Sample" : "Add Sample"}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Sample Type</FormLabel>
                  <RadioGroup
                    row
                    value={form.sampleType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setForm({
                        ...form,
                        sampleType: newType,
                        ...(newType === "validation"
                          ? {
                              linkedPreWorksSampleId: "",
                              linkedClearanceItemId: "",
                            }
                          : {}),
                      });
                    }}
                  >
                    <FormControlLabel
                      value="pre-works"
                      control={<Radio />}
                      label="Pre-works"
                    />
                    <FormControlLabel
                      value="validation"
                      control={<Radio />}
                      label="Validation"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Sample ref."
                  value={form.sampleRef}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (value.startsWith("LD-")) value = value.substring(3);
                    setForm({ ...form, sampleRef: value.toUpperCase() });
                  }}
                  onBlur={(e) => {
                    if (e.target.value?.trim()) {
                      const prefixed = ensureSampleReferencePrefix(
                        e.target.value,
                      );
                      const withoutPrefix = prefixed.startsWith("LD-")
                        ? prefixed.substring(3)
                        : prefixed;
                      setForm({ ...form, sampleRef: withoutPrefix });
                    }
                  }}
                  error={!form.sampleRef?.trim()}
                  helperText={
                    !form.sampleRef?.trim()
                      ? "Required"
                      : "'LD-' prefix will be added automatically"
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">LD-</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              {form.sampleType === "validation" && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      select
                      label="Link to pre-works sample (optional)"
                      value={form.linkedPreWorksSampleId || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          linkedPreWorksSampleId: e.target.value,
                        })
                      }
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">None</option>
                      {preWorksSamples.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sampleRef || `Sample ${s.id}`}
                        </option>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      select
                      label="Link to clearance item (required)"
                      value={form.linkedClearanceItemId || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          linkedClearanceItemId: e.target.value,
                        })
                      }
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      required
                      error={
                        form.sampleType === "validation" &&
                        !form.linkedClearanceItemId?.trim()
                      }
                      helperText={
                        form.sampleType === "validation" &&
                        !form.linkedClearanceItemId?.trim()
                          ? "Select a clearance item to link this validation sample to"
                          : clearanceItemsLoading
                            ? "Loading clearance items..."
                            : validationSamplingClearanceItems.length === 0
                              ? "No clearance items with validation sampling. Add items with 'Visual inspection and validation sampling' on the Clearance Items page first."
                              : ""
                      }
                    >
                      <option value="">Select clearance item...</option>
                      {validationSamplingClearanceItems.map((item) => (
                        <option key={item._id} value={item._id}>
                          {[item.roomArea, item.locationDescription]
                            .filter(Boolean)
                            .join(" - ") || item._id}
                        </option>
                      ))}
                    </TextField>
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Sample</FormLabel>
                  <RadioGroup
                    row
                    value={form.sample}
                    onChange={(e) =>
                      setForm({ ...form, sample: e.target.value })
                    }
                  >
                    <FormControlLabel
                      value="dust"
                      control={<Radio />}
                      label="Dust"
                    />
                    <FormControlLabel
                      value="soil"
                      control={<Radio />}
                      label="Soil"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Room/Area"
                  value={form.roomArea}
                  onChange={(e) =>
                    setForm({ ...form, roomArea: e.target.value })
                  }
                  error={!form.roomArea?.trim()}
                  helperText={!form.roomArea?.trim() ? "Required" : ""}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Location description"
                  value={form.locationDescription}
                  onChange={(e) =>
                    setForm({ ...form, locationDescription: e.target.value })
                  }
                  error={!form.locationDescription?.trim()}
                  helperText={
                    !form.locationDescription?.trim() ? "Required" : ""
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  select
                  label="Surface type"
                  value={form.surfaceType}
                  onChange={(e) =>
                    setForm({ ...form, surfaceType: e.target.value })
                  }
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                  error={!form.surfaceType?.trim()}
                  helperText={!form.surfaceType?.trim() ? "Required" : ""}
                >
                  <option value="">Select...</option>
                  {SURFACE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.split(" - ")[0]}
                    </option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  select
                  label="Sample Area"
                  value={form.sampleArea}
                  onChange={(e) =>
                    setForm({ ...form, sampleArea: e.target.value })
                  }
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                  error={!form.sampleArea?.trim()}
                  helperText={!form.sampleArea?.trim() ? "Required" : ""}
                >
                  <option value="">Select...</option>
                  {SAMPLE_AREA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <TextField
                    type="text"
                    label="Lead content"
                    value={form.leadContent}
                    onChange={(e) =>
                      setForm({ ...form, leadContent: e.target.value })
                    }
                    placeholder={
                      form.sample === "dust"
                        ? "e.g. 0.5 or < 0.5"
                        : "e.g. 0.5 or < 0.5"
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {form.sample === "dust" ? "µg" : "mg/kg"}
                        </InputAdornment>
                      ),
                    }}
                    sx={{ minWidth: 140, flex: "1 1 140px" }}
                  />
                  <Typography variant="body2" sx={{ pb: 1.5, flexShrink: 0 }}>
                    {form.sample === "dust" ? (
                      <>
                        Lead concentration:{" "}
                        {typeof leadConcentration === "number" &&
                        !Number.isNaN(leadConcentration)
                          ? `${leadConcentration.toFixed(4)} mg/m²`
                          : typeof leadConcentration === "string" &&
                              leadConcentration !== ""
                            ? `${leadConcentration} mg/m²`
                            : "—"}
                      </>
                    ) : (
                      <>
                        Lead concentration:{" "}
                        {form.leadContent ? `${form.leadContent} mg/kg` : "—"}
                      </>
                    )}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={!canSubmit}>
              {editingSample ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default LeadClearanceSampling;
