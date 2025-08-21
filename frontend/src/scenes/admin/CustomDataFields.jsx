import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import customDataFieldService from "../../services/customDataFieldService";

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`custom-data-tabpanel-${index}`}
      aria-labelledby={`custom-data-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CustomDataFields = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [locationDescriptions, setLocationDescriptions] = useState([]);
  const [materialsDescriptions, setMaterialsDescriptions] = useState([]);
  const [roomAreas, setRoomAreas] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [currentTab, setCurrentTab] = useState("");
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  // Load data from database on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [asbestosData, locationData, materialsData, roomAreaData] =
        await Promise.all([
          customDataFieldService.getByType("asbestos_removalist"),
          customDataFieldService.getByType("location_description"),
          customDataFieldService.getByType("materials_description"),
          customDataFieldService.getByType("room_area"),
        ]);

      setAsbestosRemovalists(asbestosData || []);
      setLocationDescriptions(locationData || []);
      setMaterialsDescriptions(materialsData || []);
      setRoomAreas(roomAreaData || []);
    } catch (error) {
      console.error("Error fetching custom data fields:", error);
      showSnackbar("Failed to load custom data fields", "error");
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const closeSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  // Helper function to sort data alphabetically
  const sortDataAlphabetically = (data) => {
    return [...data].sort((a, b) => a.text.localeCompare(b.text));
  };

  // Get sorted data for display
  const getSortedData = (data) => {
    return sortDataAlphabetically(data);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const getCurrentData = () => {
    const result = (() => {
      switch (tabValue) {
        case 0:
          return {
            data: asbestosRemovalists,
            setter: setAsbestosRemovalists,
            title: "Asbestos Removalists",
          };
        case 1:
          return {
            data: roomAreas,
            setter: setRoomAreas,
            title: "Room/Area",
          };
        case 2:
          return {
            data: locationDescriptions,
            setter: setLocationDescriptions,
            title: "Location Descriptions",
          };
        case 3:
          return {
            data: materialsDescriptions,
            setter: setMaterialsDescriptions,
            title: "Materials Descriptions",
          };
        default:
          return { data: [], setter: () => {}, title: "" };
      }
    })();

    return result;
  };

  const handleAddItem = () => {
    const { setter, title } = getCurrentData();
    setCurrentTab(title);
    setEditingItem(null);
    setNewItemText("");
    setDialogOpen(true);
  };

  const handleEditItem = (item) => {
    const { title } = getCurrentData();
    setCurrentTab(title);
    setEditingItem(item);
    setNewItemText(item.text);
    setDialogOpen(true);
  };

  const handleDeleteItem = async (itemId) => {
    const { data, setter, title } = getCurrentData();
    try {
      await customDataFieldService.delete(itemId);
      const updatedData = data.filter((item) => item._id !== itemId);
      setter(updatedData);
      showSnackbar(`${title} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting ${title}:`, error);
      showSnackbar(`Failed to delete ${title}`, "error");
    }
  };

  const handleSaveItem = async () => {
    if (!newItemText.trim()) return;

    const { data, setter, title } = getCurrentData();

    // Map title to API type
    const getTypeFromTitle = (title) => {
      switch (title) {
        case "Asbestos Removalists":
          return "asbestos_removalist";
        case "Room/Area":
          return "room_area";
        case "Location Descriptions":
          return "location_description";
        case "Materials Descriptions":
          return "materials_description";
        default:
          return "asbestos_removalist";
      }
    };

    if (editingItem) {
      // Edit existing item
      try {
        const updatedItem = await customDataFieldService.update(
          editingItem._id,
          { text: newItemText.trim() }
        );
        const updatedData = data.map((item) =>
          item._id === editingItem._id ? updatedItem : item
        );
        setter(updatedData);
        showSnackbar(`${title} updated successfully`);
      } catch (error) {
        console.error(`Error updating ${title}:`, error);
        showSnackbar(`Failed to update ${title}`, "error");
        return;
      }
    } else {
      // Add new item
      try {
        const type = getTypeFromTitle(title);
        const newItem = await customDataFieldService.create({
          text: newItemText.trim(),
          type: type,
        });
        const updatedData = [...data, newItem];
        setter(updatedData);
        showSnackbar(`${title} added successfully`);
      } catch (error) {
        console.error(`Error adding new ${title}:`, error);
        showSnackbar(`Failed to add new ${title}`, "error");
        return;
      }
    }

    setDialogOpen(false);
    setEditingItem(null);
    setNewItemText("");
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setNewItemText("");
  };

  const renderTabContent = (data, title) => {
    return (
      <Box>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">{title}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            size="small"
          >
            Add {title}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1">Loading {title}...</Typography>
          </Box>
        ) : data.length === 0 ? (
          <Paper
            sx={{
              p: 3,
              textAlign: "center",
              backgroundColor: theme.palette.grey[50],
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No {title.toLowerCase()} added yet. Click "Add {title}" to get
              started.
            </Typography>
          </Paper>
        ) : (
          <List>
            {getSortedData(data).map((item) => (
              <ListItem
                key={item._id}
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: theme.palette.background.paper,
                }}
              >
                <ListItemText primary={item.text} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    onClick={() => handleEditItem(item)}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteItem(item._id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    );
  };

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Custom Data Fields Management
      </Typography>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToAdmin}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Admin Home
          </Link>
          <Typography color="text.primary">Custom Data Fields</Typography>
        </Breadcrumbs>

        <Paper sx={{ mt: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="custom data fields tabs"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Asbestos Removalists" />
            <Tab label="Room/Area" />
            <Tab label="Location Descriptions" />
            <Tab label="Materials Descriptions" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {renderTabContent(asbestosRemovalists, "Asbestos Removalists")}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {renderTabContent(roomAreas, "Room/Area")}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {renderTabContent(locationDescriptions, "Location Descriptions")}
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {renderTabContent(materialsDescriptions, "Materials Descriptions")}
          </TabPanel>
        </Paper>

        {/* Add/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingItem ? `Edit ${currentTab}` : `Add ${currentTab}`}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={`${currentTab} Name`}
              fullWidth
              variant="outlined"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSaveItem()}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button onClick={handleSaveItem} variant="contained">
              {editingItem ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Alert
            onClose={closeSnackbar}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default CustomDataFields;
