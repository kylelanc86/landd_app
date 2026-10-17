import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import swmsCategoryService from "../../services/swmsCategoryService";

const SwmsCategories = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await swmsCategoryService.getAll();
      setCategories(response.data || []);
    } catch (error) {
      console.error("Error fetching SWMS categories:", error);
      showSnackbar("Failed to load SWMS categories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    try {
      setSaving(true);
      await swmsCategoryService.delete(categoryToDelete._id);
      showSnackbar("SWMS category deleted", "success");
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      await loadCategories();
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to delete SWMS category";
      showSnackbar(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        SWMS Categories
      </Typography>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate("/admin")}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Admin Home
          </Link>
          <Typography color="text.primary">SWMS</Typography>
        </Breadcrumbs>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
          mb={2}
        >
          <Box>
            <Typography variant="h5">Categories</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Each category groups SWMS items for the selected work types.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/admin/swms/new")}
            sx={{
              backgroundColor: "#1976d2",
              "&:hover": { backgroundColor: "#1565c0" },
              flexShrink: 0,
            }}
          >
            Add Category
          </Button>
        </Box>

        {loading ? (
          <Typography>Loading SWMS categories...</Typography>
        ) : categories.length === 0 ? (
          <Typography color="text.secondary">
            No SWMS categories yet.
          </Typography>
        ) : (
          categories.map((category) => (
            <Accordion
              key={category._id}
              disableGutters
              sx={{
                mb: 1,
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: "8px !important",
                "&:before": { display: "none" },
                overflow: "hidden",
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  display="flex"
                  alignItems="center"
                  width="100%"
                  gap={1}
                  pr={1}
                >
                  <Box flexGrow={1} minWidth={0}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {category.name}
                    </Typography>
                    {category.workTypes?.length ? (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {category.workTypes.join(", ")}
                      </Typography>
                    ) : null}
                  </Box>
                  <Chip
                    size="small"
                    label={`${category.items?.length || 0} ${
                      category.items?.length === 1 ? "item" : "items"
                    }`}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Edit ${category.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/admin/swms/${category._id}`);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${category.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {category.items?.length ? (
                  <List dense disablePadding>
                    {category.items.map((item, index) => (
                      <ListItem key={item._id || index} disablePadding>
                        <ListItemText
                          primary={`${item.itemNumber || index + 1}. ${
                            item.procedure || item.text || "Untitled item"
                          }`}
                          secondary={
                            item.riskBefore?.rating
                              ? `Risk before controls: ${item.riskBefore.rating}${
                                  item.riskBefore.score
                                    ? ` (${item.riskBefore.score})`
                                    : ""
                                }`
                              : null
                          }
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No items in this category yet.
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Paper>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!saving) {
            setDeleteDialogOpen(false);
            setCategoryToDelete(null);
          }
        }}
      >
        <DialogTitle>Delete SWMS category</DialogTitle>
        <DialogContent>
          <Typography>
            Delete {categoryToDelete?.name || "this category"} and its SWMS
            items?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setCategoryToDelete(null);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={saving}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SwmsCategories;
