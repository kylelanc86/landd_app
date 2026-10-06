import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Typography,
  Alert,
} from "@mui/material";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import MapIcon from "@mui/icons-material/Map";
import UploadIcon from "@mui/icons-material/Upload";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "../context/SnackbarContext";
import {
  getSitePlanAppendices,
  stripPlanForApi,
} from "../utils/sitePlanAppendices";

/**
 * Reusable multi site-plan manager (list, reorder, upload, delete).
 *
 * @param {{
 *   loadEntity: () => Promise<object>,
 *   savePlans: (entity: object, plans: object[]) => Promise<void>,
 *   getPlans: (entity: object) => object[],
 *   isLocked?: (entity: object) => boolean,
 *   lockedMessage?: string,
 *   backPath: string,
 *   getEditPath: (planIndex: string) => string,
 *   defaultFigureTitle: string,
 *   pageTitle?: string,
 *   description?: string,
 *   backLabel?: string,
 * }} props
 */
export default function SitePlansManagerPage({
  loadEntity,
  savePlans,
  getPlans = (entity) => getSitePlanAppendices(entity),
  isLocked = () => false,
  lockedMessage = "This report is locked and site plans cannot be edited.",
  backPath,
  getEditPath,
  defaultFigureTitle = "Site Plan",
  pageTitle = "Site plans",
  description = "Add, draw, or upload site plans. Drag to reorder — this order is used in the PDF report.",
  backLabel = "Back",
}) {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entity, setEntity] = useState(null);
  const [plans, setPlans] = useState([]);
  const [deleteIndex, setDeleteIndex] = useState(null);

  const locked = entity ? isLocked(entity) : false;

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadEntity();
      setEntity(data);
      setPlans(getPlans(data));
    } catch (err) {
      console.error("Error loading entity:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to load",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [loadEntity, getPlans, showSnackbar]);

  useEffect(() => {
    reload();
  }, [reload]);

  const persistPlans = async (nextPlans, successMessage) => {
    if (!entity || locked) return false;
    try {
      setSaving(true);
      const payload = nextPlans.map(stripPlanForApi);
      await savePlans(entity, payload);
      setPlans(nextPlans);
      showSnackbar(successMessage, "success");
      return true;
    } catch (err) {
      console.error("Error saving site plans:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to save site plans",
        "error",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination || locked || saving) return;
    const next = Array.from(plans);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    await persistPlans(next, "Site plan order updated.");
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadFiles = async (fileList) => {
    if (!fileList?.length || locked || saving) return;
    try {
      setSaving(true);
      const uploaded = [];
      for (const file of Array.from(fileList)) {
        const dataUrl = await readFileAsDataUrl(file);
        uploaded.push({
          sitePlan: true,
          sitePlanFile: dataUrl,
          sitePlanLegend: [],
          sitePlanLegendTitle: "Key",
          sitePlanFigureTitle: defaultFigureTitle,
          sitePlanSource: "uploaded",
        });
      }
      const next = [...plans, ...uploaded];
      const ok = await persistPlans(
        next,
        uploaded.length === 1
          ? "Site plan uploaded."
          : `${uploaded.length} site plans uploaded.`,
      );
      if (ok) await reload();
    } catch (err) {
      console.error("Error uploading site plan:", err);
      showSnackbar("Failed to read uploaded file", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteIndex == null || locked) return;
    const next = plans.filter((_, i) => i !== deleteIndex);
    setDeleteIndex(null);
    const ok = await persistPlans(
      next,
      next.length ? "Site plan removed." : "All site plans removed.",
    );
    if (ok) await reload();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box m="8px">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backPath)}
          sx={{ textTransform: "none" }}
        >
          {backLabel}
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>
          {pageTitle}
        </Typography>
      </Box>
      
      

      {locked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {lockedMessage}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={locked || saving}
          onClick={() => navigate(getEditPath("new"))}
          sx={{ textTransform: "none" }}
        >
          Draw new plan
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          disabled={locked || saving}
          onClick={() => fileInputRef.current?.click()}
          sx={{ textTransform: "none" }}
        >
          Upload plan
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => {
            handleUploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </Box>

      {plans.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="site-plans-manager">
            {(provided) => (
              <List
                dense
                disablePadding
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {plans.map((plan, index) => (
                  <Draggable
                    key={`plan-${index}`}
                    draggableId={`plan-${index}`}
                    index={index}
                    isDragDisabled={locked || saving}
                  >
                    {(dragProvided, snapshot) => (
                      <ListItem
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        secondaryAction={
                          !locked ? (
                            <Box>
                              <IconButton
                                edge="end"
                                aria-label="Edit site plan"
                                onClick={() => navigate(getEditPath(String(index)))}
                                size="small"
                                sx={{ mr: 0.5 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                edge="end"
                                aria-label="Delete site plan"
                                onClick={() => setDeleteIndex(index)}
                                size="small"
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : null
                        }
                        sx={{
                          bgcolor: snapshot.isDragging
                            ? "action.selected"
                            : "background.paper",
                          borderBottom:
                            index < plans.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                          py: 1.5,
                        }}
                      >
                        <Box
                          {...dragProvided.dragHandleProps}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            color: locked || saving ? "action.disabled" : "text.secondary",
                            mr: 1,
                            cursor: locked || saving ? "default" : "grab",
                          }}
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                        <MapIcon
                          fontSize="small"
                          color="secondary"
                          sx={{ mr: 1, flexShrink: 0 }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          title={plan.sitePlanFigureTitle}
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          {index + 1}. {plan.sitePlanFigureTitle}
                        </Typography>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No site plans yet. Draw a new plan or upload an existing file.
        </Typography>
      )}

      {saving && (
        <Box display="flex" alignItems="center" gap={1} mt={2}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Saving…
          </Typography>
        </Box>
      )}

      <Dialog
        open={deleteIndex != null}
        onClose={() => setDeleteIndex(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete site plan</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Are you sure you want to remove this site plan? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteIndex(null)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
