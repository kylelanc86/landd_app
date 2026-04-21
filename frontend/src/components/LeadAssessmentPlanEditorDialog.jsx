import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Tabs,
  Tab,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionIcon from "@mui/icons-material/Description";
import SitePlanDrawing from "./SitePlanDrawing";
import asbestosAssessmentService from "../services/asbestosAssessmentService";
import { getLeadSampleMarkerMeta } from "../utils/leadSampleMarkerMeta";

function newLocalPlan(defaultFigureTitle) {
  return {
    _localId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    sitePlan: true,
    sitePlanFile: null,
    sitePlanLegend: [],
    sitePlanLegendTitle: "Key",
    sitePlanFigureTitle: defaultFigureTitle,
    sitePlanSource: null,
  };
}

function normalizeLoadedPlans(arr, defaultFigureTitle) {
  const list = Array.isArray(arr) ? arr.filter((p) => p && p.sitePlanFile) : [];
  if (list.length === 0) return [newLocalPlan(defaultFigureTitle)];
  return list.map((p, i) => ({
    _localId: `loaded-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sitePlan: true,
    sitePlanFile: p.sitePlanFile,
    sitePlanLegend: Array.isArray(p.sitePlanLegend) ? p.sitePlanLegend : [],
    sitePlanLegendTitle: p.sitePlanLegendTitle || "Key",
    sitePlanFigureTitle: p.sitePlanFigureTitle || defaultFigureTitle,
    sitePlanSource: p.sitePlanSource || "drawn",
  }));
}

function stripLocalForApi(plan) {
  return {
    sitePlan: true,
    sitePlanFile: plan.sitePlanFile,
    sitePlanLegend: Array.isArray(plan.sitePlanLegend) ? plan.sitePlanLegend : [],
    sitePlanLegendTitle: plan.sitePlanLegendTitle || "Key",
    sitePlanFigureTitle: plan.sitePlanFigureTitle || null,
    sitePlanSource: plan.sitePlanSource || "drawn",
  };
}

/**
 * Lead assessment: edit multiple site plan or assessment area plan appendices with tabbed SitePlanDrawing panes.
 */
export default function LeadAssessmentPlanEditorDialog({
  open,
  onClose,
  kind,
  assessmentId,
  assessment,
  items = [],
  /** Table drafts for lead content — keeps marker colours in sync with unsaved cells. */
  leadContentDrafts = {},
  onSaved,
  showSnackbar,
  readOnly = false,
}) {
  const defaultFigureTitle =
    kind === "assessment" ? "Assessment Area Plan" : "Lead Assessment Site Plan";
  const field =
    kind === "assessment" ? "leadAssessmentPlanAppendices" : "leadSitePlanAppendices";
  const dialogTitle =
    kind === "assessment" ? "Assessment area plans" : "Site plans (report appendix)";

  const [draftPlans, setDraftPlans] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const sitePlanDrawingRef = useRef(null);
  const [keyReminderOpen, setKeyReminderOpen] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState(null);

  useEffect(() => {
    if (!open || !assessment) return;
    const loaded = assessment[field];
    setDraftPlans(normalizeLoadedPlans(loaded, defaultFigureTitle));
    setActiveTab(0);
  }, [open, assessment, field, defaultFigureTitle]);

  const safeActiveIndex = Math.min(
    Math.max(0, activeTab),
    Math.max(0, draftPlans.length - 1),
  );

  const sampleMarkerOptions = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const it of items) {
      const ref = String(it.sampleReference || "").trim();
      if (!ref) continue;
      const mt = String(it.materialType || "").toLowerCase();
      if (!["paint", "paint-xrf", "dust", "soil"].includes(mt) || seen.has(ref)) continue;
      seen.add(ref);
      const effectiveLead = leadContentDrafts[it._id] ?? it.leadContent;
      const meta = getLeadSampleMarkerMeta(it, effectiveLead);
      out.push({
        value: meta.value,
        isPositive: meta.isPositive,
        statusKnown: meta.statusKnown,
      });
    }
    return out.sort((a, b) => a.value.localeCompare(b.value));
  }, [items, leadContentDrafts]);

  const blurActiveElement = useCallback(() => {
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
  }, []);

  const persistPlansToJob = useCallback(
    async (plans) => {
      if (!assessmentId || !assessment || readOnly) return;
      const payload = (Array.isArray(plans) ? plans : [])
        .filter((p) => p.sitePlanFile)
        .map(stripLocalForApi);
      try {
        await asbestosAssessmentService.update(assessmentId, {
          projectId: assessment.projectId?._id || assessment.projectId,
          assessmentDate: assessment.assessmentDate,
          status: assessment.status,
          [field]: payload,
        });
        onSaved?.({ field, plans: payload });
        showSnackbar?.(
          payload.length ? "Site plan saved to job." : "Plan appendices cleared on the job.",
          "success",
        );
      } catch (err) {
        showSnackbar?.(
          err.response?.data?.message || err.message || "Failed to save plans",
          "error",
        );
      }
    },
    [assessment, assessmentId, field, onSaved, readOnly, showSnackbar],
  );

  const applyTabDrawingSave = useCallback(
    async (sitePlanData) => {
      const imageData =
        typeof sitePlanData === "string" ? sitePlanData : sitePlanData?.imageData;
      if (!imageData) {
        showSnackbar?.("No plan image was produced.", "error");
        return;
      }
      const legendEntries = Array.isArray(sitePlanData?.legend)
        ? sitePlanData.legend.map((entry) => ({
            color: entry.color,
            description: entry.description,
          }))
        : [];
      const legendTitle =
        sitePlanData?.legendTitle && sitePlanData.legendTitle.trim()
          ? sitePlanData.legendTitle.trim()
          : "Key";
      const figureTitle =
        sitePlanData?.figureTitle && sitePlanData.figureTitle.trim()
          ? sitePlanData.figureTitle.trim()
          : defaultFigureTitle;

      const next = [...draftPlans];
      if (next.length === 0) {
        next.push(newLocalPlan(defaultFigureTitle));
      }
      const idx = Math.min(safeActiveIndex, next.length - 1);
      if (idx < 0) {
        showSnackbar?.("Unable to save this plan tab.", "error");
        return;
      }
      const cur = { ...(next[idx] || {}) };
      cur.sitePlanFile = imageData;
      cur.sitePlanLegend = legendEntries;
      cur.sitePlanLegendTitle = legendTitle;
      cur.sitePlanFigureTitle = figureTitle;
      cur.sitePlanSource = "drawn";
      next[idx] = cur;
      setDraftPlans(next);
      await persistPlansToJob(next);
    },
    [defaultFigureTitle, draftPlans, persistPlansToJob, safeActiveIndex, showSnackbar],
  );

  const handleDrawingSave = useCallback(
    (sitePlanData) => {
      const hasMissing =
        Array.isArray(sitePlanData?.legend) &&
        sitePlanData.legend.some((e) => !(e.description || "").trim());
      if (hasMissing) {
        setPendingPlanData(sitePlanData);
        setKeyReminderOpen(true);
        return;
      }
      applyTabDrawingSave(sitePlanData);
    },
    [applyTabDrawingSave],
  );

  const handleKeyReminderAddDescriptions = () => {
    setKeyReminderOpen(false);
    setPendingPlanData(null);
    sitePlanDrawingRef.current?.openLegendDialog?.();
  };

  const handleKeyReminderSaveAnyway = async () => {
    const data = pendingPlanData;
    setKeyReminderOpen(false);
    setPendingPlanData(null);
    if (data) await applyTabDrawingSave(data);
  };

  const handleAddTab = () => {
    setDraftPlans((prev) => {
      const next = [...prev, newLocalPlan(defaultFigureTitle)];
      setActiveTab(next.length - 1);
      return next;
    });
  };

  const handleRemoveCurrentTab = () => {
    const idx = safeActiveIndex;
    const prev = draftPlans;
    if (prev.length <= 1) {
      setDraftPlans([newLocalPlan(defaultFigureTitle)]);
      setActiveTab(0);
      return;
    }
    const filtered = prev.filter((_, i) => i !== idx);
    const next = filtered.length ? filtered : [newLocalPlan(defaultFigureTitle)];
    let nextTab = activeTab;
    if (nextTab >= next.length) nextTab = next.length - 1;
    else if (nextTab > idx) nextTab -= 1;
    setDraftPlans(next);
    setActiveTab(nextTab);
  };

  const currentPlan = draftPlans[safeActiveIndex];

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {
          blurActiveElement();
          onClose();
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: "90vh",
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{dialogTitle}</Typography>
            <IconButton
              onClick={() => {
                blurActiveElement();
                onClose();
              }}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 2, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box
            display="flex"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
            sx={{ borderBottom: 1, borderColor: "divider", pb: 1, mb: 1 }}
          >
            <Tabs
              value={safeActiveIndex}
              onChange={(_, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {draftPlans.map((p, i) => (
                <Tab key={p._localId} label={`Plan ${i + 1}`} />
              ))}
            </Tabs>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddTab}
              disabled={readOnly}
              sx={{ textTransform: "none" }}
            >
              Add plan
            </Button>
            {draftPlans.length > 1 && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleRemoveCurrentTab}
                disabled={readOnly}
                sx={{ textTransform: "none" }}
              >
                Remove tab
              </Button>
            )}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {currentPlan && (
              <SitePlanDrawing
                ref={sitePlanDrawingRef}
                key={currentPlan._localId}
                onSave={handleDrawingSave}
                onCancel={onClose}
                existingSitePlan={currentPlan.sitePlanFile || undefined}
                existingLegend={currentPlan.sitePlanLegend}
                existingLegendTitle={currentPlan.sitePlanLegendTitle}
                existingFigureTitle={currentPlan.sitePlanFigureTitle || defaultFigureTitle}
                hideMapSection={kind === "assessment"}
                enableSampleMarkers={kind === "site"}
                sampleMarkerOptions={kind === "site" ? sampleMarkerOptions : null}
                defaultLegendDescription={kind === "assessment" ? "Assessment Area" : ""}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog
        open={keyReminderOpen}
        onClose={() => {
          blurActiveElement();
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
            Some key items don&apos;t have descriptions. Add descriptions so the plan key is clear, or save
            without adding them.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleKeyReminderSaveAnyway} variant="outlined" color="inherit">
            Save anyway
          </Button>
          <Button onClick={handleKeyReminderAddDescriptions} variant="contained" startIcon={<DescriptionIcon />}>
            Add descriptions
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
