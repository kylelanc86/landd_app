import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Breadcrumbs,
  Link,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { useSnackbar } from "../../context/SnackbarContext";
import { impartialityRiskService } from "../../services/impartialityRiskService";

const CONSEQUENCE_OPTIONS = [
  "Severe",
  "Major",
  "Moderate",
  "Minor",
  "Insignificant",
];

const LIKELIHOOD_OPTIONS = [
  "Almost Certain",
  "Likely",
  "Possible",
  "Unlikely",
  "Rare",
];

// Risk matrix: likelihood -> consequence -> risk rating
const RISK_MATRIX = {
  "Almost Certain": {
    Insignificant: "Medium",
    Minor: "High",
    Moderate: "High",
    Major: "Extreme",
    Severe: "Extreme",
  },
  Likely: {
    Insignificant: "Medium",
    Minor: "High",
    Moderate: "High",
    Major: "Extreme",
    Severe: "Extreme",
  },
  Possible: {
    Insignificant: "Low",
    Minor: "Medium",
    Moderate: "Medium",
    Major: "High",
    Severe: "Extreme",
  },
  Unlikely: {
    Insignificant: "Low",
    Minor: "Medium",
    Moderate: "Medium",
    Major: "High",
    Severe: "High",
  },
  Rare: {
    Insignificant: "Low",
    Minor: "Low",
    Moderate: "Medium",
    Major: "Medium",
    Severe: "High",
  },
};

function getRiskRating(likelihood, consequence) {
  if (!likelihood || !consequence) return "";
  const row = RISK_MATRIX[likelihood];
  return row ? row[consequence] || "" : "";
}

const ImpartialityRisks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();

  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    const fetchRisks = async () => {
      try {
        setLoading(true);
        const response = await impartialityRiskService.getAll();
        if (!cancelled) setRisks(response.data || []);
      } catch (err) {
        if (cancelled) return;
        const isNetworkError =
          err?.code === "ERR_NETWORK" || err?.message === "Network Error";
        const message = isNetworkError
          ? "Could not connect to server. Make sure the backend is running (e.g. npm start in backend folder)."
          : err.response?.data?.message || "Failed to load impartiality risks";
        showSnackbar(message, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRisks();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fetch on mount
  }, []);

  // Form state
  const [activity, setActivity] = useState("");
  const [riskToImpartiality, setRiskToImpartiality] = useState("");
  const [consequenceRating, setConsequenceRating] = useState("");
  const [likelihood, setLikelihood] = useState("");
  const [controlsToMitigate, setControlsToMitigate] = useState("");
  const [residualConsequence, setResidualConsequence] = useState("");
  const [residualLikelihood, setResidualLikelihood] = useState("");
  const [furtherControlsRequired, setFurtherControlsRequired] = useState("");

  const riskRating = useMemo(
    () => getRiskRating(likelihood, consequenceRating),
    [likelihood, consequenceRating],
  );
  const residualRiskRating = useMemo(
    () => getRiskRating(residualLikelihood, residualConsequence),
    [residualLikelihood, residualConsequence],
  );

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleOpenAddModal = () => {
    setActivity("");
    setRiskToImpartiality("");
    setConsequenceRating("");
    setLikelihood("");
    setControlsToMitigate("");
    setResidualConsequence("");
    setResidualLikelihood("");
    setFurtherControlsRequired("");
    setFormErrors({});
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!activity?.trim()) errors.activity = "Activity is required";
    if (!riskToImpartiality?.trim())
      errors.riskToImpartiality = "Risk to Impartiality is required";
    if (!consequenceRating)
      errors.consequenceRating = "Consequence Rating is required";
    if (!likelihood) errors.likelihood = "Likelihood is required";
    if (!controlsToMitigate?.trim())
      errors.controlsToMitigate = "Controls to Mitigate Risk is required";
    if (!residualConsequence)
      errors.residualConsequence = "Residual Consequence Rating is required";
    if (!residualLikelihood)
      errors.residualLikelihood = "Residual Likelihood is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      const payload = {
        activity: activity.trim(),
        riskToImpartiality: riskToImpartiality.trim(),
        consequenceRating,
        likelihood,
        riskRating: riskRating || null,
        controlsToMitigate: controlsToMitigate.trim(),
        residualConsequence,
        residualLikelihood,
        residualRiskRating: residualRiskRating || null,
        furtherControlsRequired: furtherControlsRequired?.trim() || "",
      };
      const response = await impartialityRiskService.create(payload);
      setRisks((prev) => [response.data, ...prev]);
      showSnackbar("Impartiality risk added", "success");
      handleCloseModal();
    } catch (err) {
      console.error("Error creating impartiality risk:", err);
      showSnackbar(
        err.response?.data?.message || "Failed to add impartiality risk",
        "error",
      );
    }
  };

  return (
    <Box m="20px">
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Impartiality Risks
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddModal}
        >
          Add Impartiality Risk
        </Button>
      </Box>
      <Box sx={{ mt: 2, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            General Records
          </Link>
          <Typography color="text.primary">Impartiality Risks</Typography>
        </Breadcrumbs>

        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Impartiality Risks
          </Typography>
          {loading ? (
            <Typography variant="body1" color="text.secondary">
              Loading…
            </Typography>
          ) : risks.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No impartiality risks yet. Use &quot;Add Impartiality Risk&quot;
              to add one.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white" }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Activity
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Risk to Impartiality
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Initial Risk
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Residual Risk
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {risks.map((r) => (
                    <TableRow key={r._id} hover>
                      <TableCell>{r.activity}</TableCell>
                      <TableCell>{r.riskToImpartiality}</TableCell>
                      <TableCell>{r.riskRating || "—"}</TableCell>
                      <TableCell>{r.residualRiskRating || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Add Impartiality Risk Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add Impartiality Risk</Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <TextField
              label="Activity"
              required
              fullWidth
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              error={!!formErrors.activity}
              helperText={formErrors.activity}
              multiline
              minRows={1}
            />
            <TextField
              label="Risk to Impartiality"
              required
              fullWidth
              value={riskToImpartiality}
              onChange={(e) => setRiskToImpartiality(e.target.value)}
              error={!!formErrors.riskToImpartiality}
              helperText={formErrors.riskToImpartiality}
              multiline
              minRows={2}
            />

            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Risk Assessment
            </Typography>
            <FormControl fullWidth error={!!formErrors.consequenceRating}>
              <InputLabel>Consequence Rating</InputLabel>
              <Select
                value={consequenceRating}
                onChange={(e) => setConsequenceRating(e.target.value)}
                label="Consequence Rating"
              >
                {CONSEQUENCE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.consequenceRating && (
                <FormHelperText>{formErrors.consequenceRating}</FormHelperText>
              )}
            </FormControl>
            <FormControl fullWidth error={!!formErrors.likelihood}>
              <InputLabel>Likelihood</InputLabel>
              <Select
                value={likelihood}
                onChange={(e) => setLikelihood(e.target.value)}
                label="Likelihood"
              >
                {LIKELIHOOD_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.likelihood && (
                <FormHelperText>{formErrors.likelihood}</FormHelperText>
              )}
            </FormControl>
            <TextField
              label="Risk Rating"
              fullWidth
              value={riskRating}
              InputProps={{ readOnly: true }}
              helperText="Calculated from Consequence and Likelihood"
            />
            <TextField
              label="Controls to Mitigate Risk"
              required
              fullWidth
              value={controlsToMitigate}
              onChange={(e) => setControlsToMitigate(e.target.value)}
              error={!!formErrors.controlsToMitigate}
              helperText={formErrors.controlsToMitigate}
              multiline
              minRows={2}
            />

            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Residual Risk Assessment
            </Typography>
            <FormControl fullWidth error={!!formErrors.residualConsequence}>
              <InputLabel>Consequence Rating</InputLabel>
              <Select
                value={residualConsequence}
                onChange={(e) => setResidualConsequence(e.target.value)}
                label="Consequence Rating"
              >
                {CONSEQUENCE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.residualConsequence && (
                <FormHelperText>
                  {formErrors.residualConsequence}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl fullWidth error={!!formErrors.residualLikelihood}>
              <InputLabel>Likelihood</InputLabel>
              <Select
                value={residualLikelihood}
                onChange={(e) => setResidualLikelihood(e.target.value)}
                label="Likelihood"
              >
                {LIKELIHOOD_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.residualLikelihood && (
                <FormHelperText>{formErrors.residualLikelihood}</FormHelperText>
              )}
            </FormControl>
            <TextField
              label="Risk Rating"
              fullWidth
              value={residualRiskRating}
              InputProps={{ readOnly: true }}
              helperText="Calculated from Consequence and Likelihood"
            />
            <TextField
              label="Further Controls Required"
              fullWidth
              value={furtherControlsRequired}
              onChange={(e) => setFurtherControlsRequired(e.target.value)}
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Add Risk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImpartialityRisks;
