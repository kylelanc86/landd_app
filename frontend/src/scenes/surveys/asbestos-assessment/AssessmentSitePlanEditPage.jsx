import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionIcon from "@mui/icons-material/Description";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SitePlanDrawing from "../../../components/SitePlanDrawing";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import { useSnackbar } from "../../../context/SnackbarContext";
import {
  buildAssessmentUpdatePayload,
  DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE,
  getAsbestosSitePlanAppendices,
  getAssessmentSitePlansBasePath,
  stripPlanForApi,
} from "../../../utils/asbestosSitePlanAppendices";

export default function AssessmentSitePlanEditPage() {
  const { id, planIndex } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnackbar } = useSnackbar();
  const sitePlanDrawingRef = useRef(null);

  const isNew = planIndex === "new";
  const editIndex = isNew ? -1 : Number(planIndex);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [existingPlan, setExistingPlan] = useState(null);
  const [keyReminderOpen, setKeyReminderOpen] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState(null);

  const listPath = getAssessmentSitePlansBasePath(location.pathname, id);

  const isReportLocked = (() => {
    const v = assessment?.reportAuthorisedBy;
    if (v == null) return false;
    return typeof v === "string" ? v.trim() !== "" : !!v;
  })();

  const loadAssessment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await asbestosAssessmentService.getById(id, {
        omitPhotoData: true,
      });
      setAssessment(data);
      const plans = getAsbestosSitePlanAppendices(data);
      if (!isNew && (Number.isNaN(editIndex) || editIndex < 0 || editIndex >= plans.length)) {
        showSnackbar("Site plan not found.", "error");
        navigate(listPath);
        return;
      }
      setExistingPlan(isNew ? null : plans[editIndex]);
    } catch (err) {
      console.error("Error loading assessment:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to load assessment",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [id, isNew, editIndex, listPath, navigate, showSnackbar]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const buildPlanFromDrawingData = (sitePlanData) => {
    const imageData =
      typeof sitePlanData === "string" ? sitePlanData : sitePlanData?.imageData;
    const legendEntries = Array.isArray(sitePlanData?.legend)
      ? sitePlanData.legend.map((entry) => ({
          color: entry.color,
          description: (entry.description || "").trim(),
        }))
      : [];
    const legendTitle =
      sitePlanData?.legendTitle && sitePlanData.legendTitle.trim()
        ? sitePlanData.legendTitle.trim()
        : "Key";
    const figureTitle =
      sitePlanData?.figureTitle && sitePlanData.figureTitle.trim()
        ? sitePlanData.figureTitle.trim()
        : existingPlan?.sitePlanFigureTitle ||
          DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE;

    return {
      sitePlan: true,
      sitePlanFile: imageData,
      sitePlanLegend: legendEntries,
      sitePlanLegendTitle: legendTitle,
      sitePlanFigureTitle: figureTitle,
      sitePlanSource: "drawn",
    };
  };

  const performSave = async (sitePlanData) => {
    if (!assessment || isReportLocked) return;
    const savedPlan = buildPlanFromDrawingData(sitePlanData);
    const currentPlans = getAsbestosSitePlanAppendices(assessment);
    const nextPlans = isNew
      ? [...currentPlans, savedPlan]
      : currentPlans.map((p, i) => (i === editIndex ? savedPlan : p));

    try {
      setSaving(true);
      await asbestosAssessmentService.update(
        id,
        buildAssessmentUpdatePayload(assessment, {
          sitePlanAppendices: nextPlans.map(stripPlanForApi),
        }),
      );
      showSnackbar("Site plan saved.", "success");
      navigate(listPath);
    } catch (err) {
      console.error("Error saving site plan:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to save site plan",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (sitePlanData) => {
    const hasEmptyLegendDescriptions =
      Array.isArray(sitePlanData?.legend) &&
      sitePlanData.legend.some((e) => !(e.description || "").trim());

    if (hasEmptyLegendDescriptions) {
      setPendingPlanData(sitePlanData);
      setKeyReminderOpen(true);
      return;
    }

    await performSave(sitePlanData);
  };

  const handleKeyReminderAddDescriptions = () => {
    setKeyReminderOpen(false);
    setPendingPlanData(null);
    sitePlanDrawingRef.current?.openLegendDialog?.();
  };

  const handleKeyReminderSaveAnyway = async () => {
    setKeyReminderOpen(false);
    const data = pendingPlanData;
    setPendingPlanData(null);
    if (data) await performSave(data);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(listPath, { state: location.state })}
          sx={{ textTransform: "none" }}
        >
          Back to site plans
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          {isReportLocked ? "View site plan" : isNew ? "Draw site plan" : "Edit site plan"}
        </Typography>
        {saving && <CircularProgress size={22} />}
      </Box>

      {isReportLocked && (
        <Alert severity="info" sx={{ mx: 2, mt: 2 }}>
          This report is view only. The site plan cannot be changed.
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, p: 2, overflow: "auto" }}>
        {!isReportLocked ? (
          <SitePlanDrawing
            ref={sitePlanDrawingRef}
            onSave={handleSave}
            onCancel={() => navigate(listPath, { state: location.state })}
            existingSitePlan={existingPlan?.sitePlanFile}
            existingLegend={existingPlan?.sitePlanLegend}
            existingLegendTitle={existingPlan?.sitePlanLegendTitle}
            existingFigureTitle={
              existingPlan?.sitePlanFigureTitle || DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE
            }
          />
        ) : existingPlan?.sitePlanFile ? (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              {existingPlan.sitePlanFigureTitle || DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE}
            </Typography>
            {String(existingPlan.sitePlanFile).includes("application/pdf") ? (
              <Box
                component="iframe"
                title="Site plan"
                src={existingPlan.sitePlanFile}
                sx={{ width: "100%", height: "70vh", border: 0 }}
              />
            ) : (
              <Box
                component="img"
                alt={existingPlan.sitePlanFigureTitle || "Site plan"}
                src={existingPlan.sitePlanFile}
                sx={{ maxWidth: "100%", height: "auto", display: "block" }}
              />
            )}
            {Array.isArray(existingPlan.sitePlanLegend) &&
              existingPlan.sitePlanLegend.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {existingPlan.sitePlanLegendTitle || "Key"}
                  </Typography>
                  {existingPlan.sitePlanLegend.map((entry, index) => (
                    <Typography key={`${entry.color || "key"}-${index}`} variant="body2">
                      {entry.description || "No description"}
                    </Typography>
                  ))}
                </Box>
              )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No site plan file is available to view.
          </Typography>
        )}
      </Box>

      <Dialog
        open={keyReminderOpen}
        onClose={() => {
          setKeyReminderOpen(false);
          setPendingPlanData(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <DescriptionIcon color="primary" />
          <span>Add key descriptions</span>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Some key items don&apos;t have descriptions. Add descriptions so the site
            plan key is clear, or save without adding them.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 2 }}>
          <Button onClick={handleKeyReminderSaveAnyway} variant="outlined" color="inherit">
            Save anyway
          </Button>
          <Button
            onClick={handleKeyReminderAddDescriptions}
            variant="contained"
            startIcon={<DescriptionIcon />}
          >
            Add descriptions
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
