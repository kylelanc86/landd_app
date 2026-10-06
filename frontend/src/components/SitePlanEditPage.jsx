import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNavigate, useParams } from "react-router-dom";
import SitePlanDrawing from "./SitePlanDrawing";
import { useSnackbar } from "../context/SnackbarContext";
import {
  getSitePlanAppendices,
  stripPlanForApi,
} from "../utils/sitePlanAppendices";

/**
 * Full-page site plan editor (draw / edit one plan in a multi-plan list).
 *
 * @param {{
 *   loadEntity: () => Promise<object>,
 *   savePlans: (entity: object, plans: object[]) => Promise<void>,
 *   getPlans?: (entity: object) => object[],
 *   isLocked?: (entity: object) => boolean,
 *   lockedMessage?: string,
 *   listPath: string,
 *   defaultFigureTitle: string,
 *   sitePlanDrawingProps?: object,
 * }} props
 */
export default function SitePlanEditPage({
  loadEntity,
  savePlans,
  getPlans = (entity) => getSitePlanAppendices(entity),
  isLocked = () => false,
  lockedMessage = "This report is locked and site plans cannot be edited.",
  listPath,
  defaultFigureTitle = "Site Plan",
  sitePlanDrawingProps = {},
}) {
  const { planIndex } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const sitePlanDrawingRef = useRef(null);

  const isNew = planIndex === "new";
  const editIndex = isNew ? -1 : Number(planIndex);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entity, setEntity] = useState(null);
  const [existingPlan, setExistingPlan] = useState(null);
  const [keyReminderOpen, setKeyReminderOpen] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState(null);

  const locked = entity ? isLocked(entity) : false;

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadEntity();
      setEntity(data);
      const plans = getPlans(data);
      if (!isNew && (Number.isNaN(editIndex) || editIndex < 0 || editIndex >= plans.length)) {
        showSnackbar("Site plan not found.", "error");
        navigate(listPath);
        return;
      }
      setExistingPlan(isNew ? null : plans[editIndex]);
    } catch (err) {
      console.error("Error loading entity:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to load",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [loadEntity, getPlans, isNew, editIndex, listPath, navigate, showSnackbar]);

  useEffect(() => {
    reload();
  }, [reload]);

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
        : existingPlan?.sitePlanFigureTitle || defaultFigureTitle;

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
    if (!entity || locked) return;
    const savedPlan = buildPlanFromDrawingData(sitePlanData);
    const currentPlans = getPlans(entity);
    const nextPlans = isNew
      ? [...currentPlans, savedPlan]
      : currentPlans.map((p, i) => (i === editIndex ? savedPlan : p));

    try {
      setSaving(true);
      await savePlans(entity, nextPlans.map(stripPlanForApi));
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
          onClick={() => navigate(listPath)}
          sx={{ textTransform: "none" }}
        >
          Back to site plans
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          {isNew ? "Draw site plan" : "Edit site plan"}
        </Typography>
        {saving && <CircularProgress size={22} />}
      </Box>

      {locked && (
        <Alert severity="info" sx={{ mx: 2, mt: 2 }}>
          {lockedMessage}
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        {!locked ? (
          <SitePlanDrawing
            ref={sitePlanDrawingRef}
            onSave={handleSave}
            onCancel={() => navigate(listPath)}
            existingSitePlan={existingPlan?.sitePlanFile}
            existingLegend={existingPlan?.sitePlanLegend}
            existingLegendTitle={existingPlan?.sitePlanLegendTitle}
            existingFigureTitle={
              existingPlan?.sitePlanFigureTitle || defaultFigureTitle
            }
            {...sitePlanDrawingProps}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Site plans cannot be edited.
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
