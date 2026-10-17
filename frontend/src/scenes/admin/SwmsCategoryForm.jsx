import React, { useEffect, useState } from "react";
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Collapse,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import { CATEGORIES } from "../../data/formOptions";
import swmsCategoryService from "../../services/swmsCategoryService";
import {
  PROBABILITY_OPTIONS,
  SEVERITY_OPTIONS,
  RATING_COLOURS,
  getSwmsRiskRating,
} from "../../utils/swmsRiskMatrix";

const newItem = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  procedure: "",
  hazard: "",
  beforeProbability: "",
  beforeSeverity: "",
  control: "",
  afterProbability: "",
  afterSeverity: "",
  responsibility: "",
});

const itemFromApi = (item) => ({
  key: item._id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  procedure: item.procedure || item.text || "",
  hazard: item.hazard || "",
  beforeProbability: item.riskBefore?.probability
    ? String(item.riskBefore.probability)
    : "",
  beforeSeverity: item.riskBefore?.severity
    ? String(item.riskBefore.severity)
    : "",
  control: item.control || "",
  afterProbability: item.riskAfter?.probability
    ? String(item.riskAfter.probability)
    : "",
  afterSeverity: item.riskAfter?.severity ? String(item.riskAfter.severity) : "",
  responsibility: item.responsibility || "",
});

const itemHasContent = (item) =>
  Boolean(
    item.procedure.trim() ||
      item.hazard.trim() ||
      item.control.trim() ||
      item.responsibility.trim() ||
      item.beforeProbability ||
      item.beforeSeverity ||
      item.afterProbability ||
      item.afterSeverity
  );

const itemTextFieldSx = {
  "& .MuiInputBase-input": {
    fontSize: "0.75rem",
    lineHeight: 1.35,
  },
};

const levelOptions = (options) => [
  <MenuItem key="none" value="">
    Select
  </MenuItem>,
  ...options.map((option) => (
    <MenuItem key={option.value} value={String(option.value)}>
      {option.value} - {option.label}
    </MenuItem>
  )),
];

const RiskInputs = ({ probability, severity, onChange }) => {
  const result = getSwmsRiskRating(probability, severity);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 180 }}>
      <TextField
        select
        size="small"
        label="Probability"
        value={probability}
        onChange={(event) => onChange({ probability: event.target.value })}
      >
        {levelOptions(PROBABILITY_OPTIONS)}
      </TextField>
      <TextField
        select
        size="small"
        label="Severity"
        value={severity}
        onChange={(event) => onChange({ severity: event.target.value })}
      >
        {levelOptions(SEVERITY_OPTIONS)}
      </TextField>
      {result ? (
        <Chip
          size="small"
          label={`${result.rating} (${result.score})`}
          sx={{
            ...RATING_COLOURS[result.rating],
            fontWeight: 700,
            alignSelf: "flex-start",
          }}
        />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Rating appears after both are selected
        </Typography>
      )}
    </Box>
  );
};

const SwmsCategoryForm = () => {
  const { categoryId } = useParams();
  const isNew = !categoryId;
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [name, setName] = useState("");
  const [workTypes, setWorkTypes] = useState([]);
  const [items, setItems] = useState([newItem()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);

  useEffect(() => {
    if (isNew) return undefined;

    let active = true;
    const loadCategory = async () => {
      try {
        setLoading(true);
        const response = await swmsCategoryService.getById(categoryId);
        if (!active) return;
        const category = response.data;
        setName(category.name || "");
        setWorkTypes(category.workTypes || []);
        setItems(
          category.items?.length ? category.items.map(itemFromApi) : [newItem()]
        );
      } catch (error) {
        console.error("Error loading SWMS category:", error);
        showSnackbar(
          error.response?.data?.message || "Failed to load SWMS category",
          "error"
        );
        navigate("/admin/swms");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCategory();
    return () => {
      active = false;
    };
    // showSnackbar is recreated when the snackbar opens, so it stays out of the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, isNew, navigate]);

  const updateItem = (key, changes) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item))
    );
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      showSnackbar("Category name is required", "warning");
      return;
    }
    if (workTypes.length === 0) {
      showSnackbar("Select at least one work type", "warning");
      return;
    }

    const payload = {
      name: trimmedName,
      workTypes,
      items: items.filter(itemHasContent).map((item) => ({
        procedure: item.procedure.trim(),
        hazard: item.hazard.trim(),
        riskBefore: {
          probability: item.beforeProbability,
          severity: item.beforeSeverity,
        },
        control: item.control.trim(),
        riskAfter: {
          probability: item.afterProbability,
          severity: item.afterSeverity,
        },
        responsibility: item.responsibility.trim(),
      })),
    };

    try {
      setSaving(true);
      if (isNew) {
        await swmsCategoryService.create(payload);
        showSnackbar("SWMS category created", "success");
      } else {
        await swmsCategoryService.update(categoryId, payload);
        showSnackbar("SWMS category updated", "success");
      }
      navigate("/admin/swms");
    } catch (error) {
      showSnackbar(
        error.response?.data?.message || "Failed to save SWMS category",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box m="20px">
        <Typography>Loading SWMS category...</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px" component="form" onSubmit={handleSave}>
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        {isNew ? "Add SWMS Category" : "Edit SWMS Category"}
      </Typography>

      <Box sx={{ mt: 4, mb: 3 }}>
        <Breadcrumbs>
          <Link
            component="button"
            type="button"
            variant="body1"
            onClick={() => navigate("/admin")}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Admin Home
          </Link>
          <Link
            component="button"
            type="button"
            variant="body1"
            onClick={() => navigate("/admin/swms")}
            sx={{ cursor: "pointer" }}
          >
            SWMS
          </Link>
          <Typography color="text.primary">
            {isNew ? "Add Category" : name || "Edit Category"}
          </Typography>
        </Breadcrumbs>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          <TextField
            label="Category name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            fullWidth
            autoFocus
          />
          <Autocomplete
            multiple
            options={CATEGORIES}
            value={workTypes}
            onChange={(event, newValue) => setWorkTypes(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Work types"
                placeholder={workTypes.length ? "" : "Select work types"}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return <Chip key={key} label={option} {...tagProps} />;
              })
            }
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
          mb={2}
          flexWrap="wrap"
        >
          <Box>
            <Typography variant="h5">SWMS items</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Risk rating uses the 5×5 matrix. Probability × severity gives the score.
            </Typography>
          </Box>
          <Button
            type="button"
            onClick={() => setMatrixOpen((open) => !open)}
            endIcon={matrixOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Risk matrix
          </Button>
        </Box>

        <Collapse in={matrixOpen}>
          <TableContainer sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                  <TableCell>Probability \ Severity</TableCell>
                  {SEVERITY_OPTIONS.map((severity) => (
                    <TableCell key={severity.value}>
                      {severity.value} {severity.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {PROBABILITY_OPTIONS.map((probability) => (
                  <TableRow key={probability.value}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {probability.value} {probability.label}
                    </TableCell>
                    {SEVERITY_OPTIONS.map((severity) => {
                      const result = getSwmsRiskRating(
                        probability.value,
                        severity.value
                      );
                      return (
                        <TableCell key={severity.value}>
                          <Chip
                            size="small"
                            label={`${result.rating} (${result.score})`}
                            sx={{
                              ...RATING_COLOURS[result.rating],
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1500 }}>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell sx={{ width: 48 }}>#</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Specific Work Procedures</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Hazard</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Risk Before Controls</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Control</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Risk After Controls</TableCell>
                <TableCell sx={{ minWidth: 160 }}>Responsibility</TableCell>
                <TableCell sx={{ width: 56 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.key} sx={{ verticalAlign: "top" }}>
                  <TableCell sx={{ fontWeight: 700, verticalAlign: "top" }}>
                    {index + 1}
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <TextField
                      value={item.procedure}
                      onChange={(event) =>
                        updateItem(item.key, { procedure: event.target.value })
                      }
                      placeholder="Specific work procedures"
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      sx={itemTextFieldSx}
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <TextField
                      value={item.hazard}
                      onChange={(event) =>
                        updateItem(item.key, { hazard: event.target.value })
                      }
                      placeholder="Hazard"
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      sx={itemTextFieldSx}
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <RiskInputs
                      probability={item.beforeProbability}
                      severity={item.beforeSeverity}
                      onChange={(changes) =>
                        updateItem(item.key, {
                          beforeProbability:
                            changes.probability ?? item.beforeProbability,
                          beforeSeverity: changes.severity ?? item.beforeSeverity,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <TextField
                      value={item.control}
                      onChange={(event) =>
                        updateItem(item.key, { control: event.target.value })
                      }
                      placeholder="Control"
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      sx={itemTextFieldSx}
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <RiskInputs
                      probability={item.afterProbability}
                      severity={item.afterSeverity}
                      onChange={(changes) =>
                        updateItem(item.key, {
                          afterProbability:
                            changes.probability ?? item.afterProbability,
                          afterSeverity: changes.severity ?? item.afterSeverity,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <TextField
                      value={item.responsibility}
                      onChange={(event) =>
                        updateItem(item.key, {
                          responsibility: event.target.value,
                        })
                      }
                      placeholder="Responsibility"
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      sx={itemTextFieldSx}
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <IconButton
                      type="button"
                      color="error"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((row) => row.key !== item.key)
                        )
                      }
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box display="flex" justifyContent="space-between" gap={2} mt={2} flexWrap="wrap">
          <Button
            type="button"
            startIcon={<AddIcon />}
            onClick={() => setItems((current) => [...current, newItem()])}
          >
            Add item
          </Button>
          <Box display="flex" gap={1}>
            <Button type="button" onClick={() => navigate("/admin/swms")} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              sx={{
                backgroundColor: "#1976d2",
                "&:hover": { backgroundColor: "#1565c0" },
              }}
            >
              {saving ? "Saving..." : "Save Category"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default SwmsCategoryForm;
