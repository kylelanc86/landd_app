import React, { useState, useEffect, useCallback } from "react";
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
  MenuItem,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import projectStatusService from "../../services/projectStatusService";
import { useProjectStatuses } from "../../context/ProjectStatusesContext";

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
  const { refreshStatuses } = useProjectStatuses();
  const [tabValue, setTabValue] = useState(0);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [locationDescriptions, setLocationDescriptions] = useState([]);
  const [materialsDescriptions, setMaterialsDescriptions] = useState([]);
  const [roomAreas, setRoomAreas] = useState([]);
  const [legislation, setLegislation] = useState([]);
  const [projectStatuses, setProjectStatuses] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [newLegislationTitle, setNewLegislationTitle] = useState("");
  const [newJurisdiction, setNewJurisdiction] = useState("ACT");
  const [newIsActiveStatus, setNewIsActiveStatus] = useState(true);
  const [newStatusColor, setNewStatusColor] = useState("#1976d2");
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

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        asbestosData,
        locationData,
        materialsData,
        roomAreaData,
        legislationData,
        projectStatusesData,
      ] = await Promise.all([
        customDataFieldGroupService.getFieldsByType("asbestos_removalist"),
        customDataFieldGroupService.getFieldsByType("location_description"),
        customDataFieldGroupService.getFieldsByType("materials_description"),
        customDataFieldGroupService.getFieldsByType("room_area"),
        customDataFieldGroupService.getFieldsByType("legislation"),
        customDataFieldGroupService.getProjectStatuses(),
      ]);

      setAsbestosRemovalists(asbestosData || []);
      setLocationDescriptions(locationData || []);
      setMaterialsDescriptions(materialsData || []);
      setRoomAreas(roomAreaData || []);
      setLegislation(legislationData || []);
      // Handle project statuses data which might be an object with activeStatuses and inactiveStatuses
      if (
        projectStatusesData &&
        typeof projectStatusesData === "object" &&
        !Array.isArray(projectStatusesData)
      ) {
        setProjectStatuses(projectStatusesData);
      } else {
        setProjectStatuses(projectStatusesData || []);
      }
    } catch (error) {
      console.error("❌ Error fetching custom data fields:", error);
      showSnackbar("Failed to load custom data fields", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data from database on component mount
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

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
    return [...data].sort((a, b) => {
      const textA = a?.text || a?.name || "";
      const textB = b?.text || b?.name || "";
      return textA.localeCompare(textB);
    });
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
        case 4:
          return {
            data: legislation,
            setter: setLegislation,
            title: "Legislation",
          };
        case 5:
          return {
            data: Array.isArray(projectStatuses)
              ? projectStatuses
              : (projectStatuses?.activeStatuses || []).concat(
                  projectStatuses?.inactiveStatuses || []
                ),
            setter: setProjectStatuses,
            title: "Projects Status",
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
    setNewLegislationTitle("");
    setNewJurisdiction("ACT"); // Reset jurisdiction on add
    setNewIsActiveStatus(true); // Reset isActiveStatus on add
    setDialogOpen(true);
  };

  const handleEditItem = (item) => {
    const { title } = getCurrentData();
    setCurrentTab(title);
    setEditingItem(item);
    setNewItemText(item.text || item.name || "");
    setNewLegislationTitle(item.legislationTitle || "");
    setNewJurisdiction(item.jurisdiction || "ACT"); // Set jurisdiction on edit
    setNewIsActiveStatus(
      item.isActiveStatus !== undefined ? item.isActiveStatus : true
    ); // Set isActiveStatus on edit
    setNewStatusColor(item.statusColor || "#1976d2"); // Set status color on edit
    setDialogOpen(true);
  };

  const handleDeleteItem = async (itemId) => {
    const { data, setter, title } = getCurrentData();
    try {
      // For all custom data field types, we need to update the backend group
      if (
        [
          "Projects Status",
          "Legislation",
          "Asbestos Removalists",
          "Room/Area",
          "Location Descriptions",
          "Materials Descriptions",
        ].includes(title)
      ) {
        // Get the current group
        const groupType = getTypeFromTitle(title);
        const group = await customDataFieldGroupService.getGroupByType(
          groupType
        );

        console.log(`${title} group response:`, group);

        if (!group) {
          showSnackbar(`${title} group not found`, "error");
          return;
        }

        // Remove the field from the group's fields array
        const updatedFields = group.fields.filter(
          (field) => field._id.toString() !== itemId.toString()
        );

        // Update the group with the new fields array
        await customDataFieldGroupService.updateGroup(group._id, {
          name: group.name,
          description: group.description,
          fields: updatedFields,
        });

        // For project statuses, refresh the project statuses context
        if (title === "Projects Status") {
          refreshStatuses();
          // Sync hardcoded colors with database after deletion
          await projectStatusService.syncHardcodedColorsWithDatabase();
        }

        // Refresh the data from backend
        await fetchAllData();

        showSnackbar(`${title} deleted successfully`);
      } else {
        // For other types, just remove from local state for now
        const updatedData = data.filter((item) => item._id !== itemId);
        setter(updatedData);
        showSnackbar(
          `${title} removed from display (backend deletion not implemented for this type)`
        );
      }
    } catch (error) {
      console.error(`Error removing ${title}:`, error);
      showSnackbar(`Failed to remove ${title}`, "error");
    }
  };

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
      case "Legislation":
        return "legislation";
      case "Projects Status":
        return "project_status";
      default:
        return "asbestos_removalist";
    }
  };

  const handleSaveItem = async () => {
    if (!newItemText.trim()) return;

    // For legislation, both fields are required
    if (currentTab === "Legislation" && !newLegislationTitle.trim()) return;
    if (currentTab === "Legislation" && !newJurisdiction.trim()) return;

    const { data, setter, title } = getCurrentData();

    if (editingItem) {
      // Edit existing item
      try {
        const updateData = { text: newItemText.trim() };

        // For legislation, include the title field and ensure jurisdiction is always set
        if (title === "Legislation") {
          updateData.legislationTitle = newLegislationTitle.trim();
          updateData.jurisdiction = newJurisdiction.trim();
        }

        // For project status, include the isActiveStatus field
        if (title === "Projects Status") {
          updateData.isActiveStatus = newIsActiveStatus;
          updateData.statusColor = newStatusColor;
        }

        // For all custom data field types, update the backend group
        if (
          [
            "Projects Status",
            "Legislation",
            "Asbestos Removalists",
            "Room/Area",
            "Location Descriptions",
            "Materials Descriptions",
          ].includes(title)
        ) {
          // Get the current group
          const groupType = getTypeFromTitle(title);
          const group = await customDataFieldGroupService.getGroupByType(
            groupType
          );

          if (!group) {
            showSnackbar(`${title} group not found`, "error");
            return;
          }

          // Update the specific field in the group's fields array
          const updatedFields = group.fields.map((field) => {
            if (field._id.toString() === editingItem._id.toString()) {
              return {
                ...field,
                ...updateData,
                updatedAt: new Date(),
              };
            }
            return field;
          });

          // Update the group with the new fields array
          await customDataFieldGroupService.updateGroup(group._id, {
            name: group.name,
            description: group.description,
            fields: updatedFields,
          });

          // Update local state
          const updatedItem = { ...editingItem, ...updateData };
          const updatedData = data.map((item) =>
            item._id === editingItem._id ? updatedItem : item
          );
          setter(updatedData);

          // For project statuses, refresh the project statuses context
          if (title === "Projects Status") {
            refreshStatuses();

            // Update hardcoded colors when status color is changed
            if (updateData.statusColor) {
              const colorUpdate = {
                [updatedItem.text]: updateData.statusColor,
              };
              projectStatusService.updateHardcodedColors(colorUpdate);
            }

            // Sync hardcoded colors with database to ensure consistency
            await projectStatusService.syncHardcodedColorsWithDatabase();
          }

          // Refresh the data from backend
          await fetchAllData();

          showSnackbar(`${title} updated successfully`);
        } else {
          // For other types, just update local state
          const updatedItem = { ...editingItem, ...updateData };
          const updatedData = data.map((item) =>
            item._id === editingItem._id ? updatedItem : item
          );
          setter(updatedData);

          showSnackbar(`${title} updated in display`);
        }
      } catch (error) {
        console.error(`Error updating ${title}:`, error);
        showSnackbar(`Failed to update ${title}`, "error");
        return;
      }
    } else {
      // Add new item
      try {
        const type = getTypeFromTitle(title);
        const newItemData = {
          text: newItemText.trim(),
          type: type,
        };

        // For legislation, include the title field and ensure jurisdiction is always set
        if (title === "Legislation") {
          newItemData.legislationTitle = newLegislationTitle.trim();
          newItemData.jurisdiction = newJurisdiction.trim();
        }

        // For project status, include the isActiveStatus field
        if (title === "Projects Status") {
          newItemData.isActiveStatus = newIsActiveStatus;
          newItemData.statusColor = newStatusColor;
        }

        // For all custom data field types, add to the backend group
        if (
          [
            "Projects Status",
            "Legislation",
            "Asbestos Removalists",
            "Room/Area",
            "Location Descriptions",
            "Materials Descriptions",
          ].includes(title)
        ) {
          try {
            // Get the current group
            const groupType = getTypeFromTitle(title);
            const group = await customDataFieldGroupService.getGroupByType(
              groupType
            );

            if (!group) {
              showSnackbar(`${title} group not found`, "error");
              return;
            }

            // Create new field with proper structure
            const newField = {
              text: newItemData.text,
              order: group.fields.length, // Add to end
              isActive: true,
              createdBy: "currentUser", // This will be replaced by the backend
              createdAt: new Date(),
              // Add type-specific fields
              ...(newItemData.legislationTitle && {
                legislationTitle: newItemData.legislationTitle,
              }),
              ...(newItemData.jurisdiction && {
                jurisdiction: newItemData.jurisdiction,
              }),
              ...(newItemData.isActiveStatus !== undefined && {
                isActiveStatus: newItemData.isActiveStatus,
              }),
              ...(newItemData.statusColor && {
                statusColor: newItemData.statusColor,
              }),
            };

            // Add the new field to the group's fields array
            const updatedFields = [...group.fields, newField];

            // Update the group with the new fields array
            await customDataFieldGroupService.updateGroup(group._id, {
              name: group.name,
              description: group.description,
              fields: updatedFields,
            });

            // Create new item for local state
            const newItem = {
              _id: Date.now().toString(), // Temporary ID
              ...newItemData,
              isActive: true,
              createdBy: { firstName: "User", lastName: "User" },
              createdAt: new Date(),
            };
            const updatedData = [...data, newItem];
            setter(updatedData);

            // For project statuses, refresh the project statuses context
            if (title === "Projects Status") {
              refreshStatuses();

              // Update hardcoded colors when new status color is added
              if (newItemData.statusColor) {
                const colorUpdate = { [newItem.text]: newItemData.statusColor };
                projectStatusService.updateHardcodedColors(colorUpdate);
              }

              // Sync hardcoded colors with database to ensure consistency
              await projectStatusService.syncHardcodedColorsWithDatabase();
            }

            // Refresh the data from backend
            await fetchAllData();

            showSnackbar(`${title} added successfully`);
          } catch (error) {
            console.error(`Error adding ${title} to backend:`, error);
            showSnackbar(`Failed to add ${title} to backend`, "error");
            return;
          }
        }
      } catch (error) {
        console.error(`Error adding new ${title} to display:`, error);
        showSnackbar(`Failed to add new ${title} to display`, "error");
        return;
      }
    }

    setDialogOpen(false);
    setEditingItem(null);
    setNewItemText("");
    setNewLegislationTitle("");
    setNewJurisdiction("ACT"); // Reset jurisdiction on save
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setNewItemText("");
    setNewLegislationTitle("");
    setNewJurisdiction("ACT"); // Reset jurisdiction on close
    setNewIsActiveStatus(true); // Reset isActiveStatus on close
    setNewStatusColor("#1976d2"); // Reset status color on close
  };

  const renderTabContent = (data, title) => {
    // Special handling for legislation tab
    if (title === "Legislation") {
      return renderLegislationContent(data, title);
    }

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
                <ListItemText
                  primary={item.text || item.name || "Unnamed Item"}
                />
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

  const renderProjectStatusContent = () => {
    // Handle the new structure where projectStatuses is an object with activeStatuses and inactiveStatuses arrays
    const activeStatuses = Array.isArray(projectStatuses)
      ? projectStatuses.filter((status) => status.isActiveStatus === true)
      : projectStatuses?.activeStatuses || [];
    const inactiveStatuses = Array.isArray(projectStatuses)
      ? projectStatuses.filter((status) => status.isActiveStatus === false)
      : projectStatuses?.inactiveStatuses || [];

    return (
      <Box>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Projects Status</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            size="small"
          >
            Add Project Status
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1">Loading Project Statuses...</Typography>
          </Box>
        ) : projectStatuses.length === 0 ? (
          <Paper
            sx={{
              p: 3,
              textAlign: "center",
              backgroundColor: theme.palette.grey[200],
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No project statuses added yet. Click "Add Project Status" to get
              started.
            </Typography>
          </Paper>
        ) : (
          <Box>
            {/* Active Statuses Section */}
            <Paper sx={{ mb: 3, overflow: "hidden" }}>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  Active Statuses
                </Typography>
                <Typography variant="body2" sx={{ color: "white" }}>
                  {activeStatuses.length} status
                  {activeStatuses.length !== 1 ? "es" : ""}
                </Typography>
              </Box>

              <Box sx={{ overflow: "auto" }}>
                {activeStatuses.length > 0 ? (
                  <List>
                    {getSortedData(activeStatuses).map((item) => (
                      <ListItem
                        key={item._id}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 1,
                          mb: 1,
                          backgroundColor: theme.palette.background.paper,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: "16px",
                                  height: "16px",
                                  borderRadius: "50%",
                                  backgroundColor:
                                    item.statusColor || "#1976d2",
                                  border: "1px solid",
                                  borderColor: theme.palette.divider,
                                  flexShrink: 0,
                                }}
                              />
                              {item.text || item.name || "Unnamed Status"}
                            </Box>
                          }
                        />
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
                ) : (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No active statuses found.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Inactive Statuses Section */}
            <Paper sx={{ mb: 3, overflow: "hidden" }}>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.grey[600],
                  color: theme.palette.grey[100],
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  Inactive Statuses
                </Typography>
                <Typography variant="body2" sx={{ color: "white" }}>
                  {inactiveStatuses.length} status
                  {inactiveStatuses.length !== 1 ? "es" : ""}
                </Typography>
              </Box>

              <Box sx={{ overflow: "auto" }}>
                {inactiveStatuses.length > 0 ? (
                  <List>
                    {getSortedData(inactiveStatuses).map((item) => (
                      <ListItem
                        key={item._id}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 1,
                          mb: 1,
                          backgroundColor: theme.palette.background.paper,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: "16px",
                                  height: "16px",
                                  borderRadius: "50%",
                                  backgroundColor:
                                    item.statusColor || "#1976d2",
                                  border: "1px solid",
                                  borderColor: theme.palette.divider,
                                  flexShrink: 0,
                                }}
                              />
                              {item.text || item.name || "Unnamed Status"}
                            </Box>
                          }
                        />
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
                ) : (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No inactive statuses found.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    );
  };

  const renderLegislationContent = (data, title) => {
    // Group legislation by jurisdiction
    const groupedLegislation = data.reduce((acc, item) => {
      const jurisdiction = item.jurisdiction || "Unknown";
      if (!acc[jurisdiction]) {
        acc[jurisdiction] = [];
      }
      acc[jurisdiction].push(item);
      return acc;
    }, {});

    // Sort jurisdictions alphabetically
    const sortedJurisdictions = Object.keys(groupedLegislation).sort();

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
          <Box>
            {sortedJurisdictions.map((jurisdiction) => (
              <Paper key={jurisdiction} sx={{ mb: 2, overflow: "hidden" }}>
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    {jurisdiction}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    {groupedLegislation[jurisdiction].length} item
                    {groupedLegislation[jurisdiction].length !== 1 ? "s" : ""}
                  </Typography>
                </Box>

                <Box sx={{ overflow: "auto" }}>
                  <Box sx={{ minWidth: 800 }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "120px 1fr 1fr auto",
                        gap: 1,
                        p: 2,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.grey[50],
                        fontWeight: "bold",
                      }}
                    >
                      <Typography variant="subtitle2">Jurisdiction</Typography>
                      <Typography variant="subtitle2">
                        Legislation Type
                      </Typography>
                      <Typography variant="subtitle2">
                        Legislation Title
                      </Typography>
                      <Typography
                        variant="subtitle2"
                        sx={{ width: 100, textAlign: "center" }}
                      >
                        Actions
                      </Typography>
                    </Box>

                    {getSortedData(groupedLegislation[jurisdiction]).map(
                      (item) => (
                        <Box
                          key={item._id}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "120px 1fr 1fr auto",
                            gap: 1,
                            p: 2,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            alignItems: "center",
                            "&:hover": {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <Typography variant="body2">
                            {item.jurisdiction || "N/A"}
                          </Typography>
                          <Typography variant="body2">
                            {item.text || item.name || "Unnamed Item"}
                          </Typography>
                          <Typography variant="body2">
                            {item.legislationTitle || "N/A"}
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              width: 100,
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleEditItem(item)}
                              sx={{ mr: 1 }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteItem(item._id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      )
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Custom Data Fields
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
            <Tab label="Legislation" />
            <Tab label="Projects Status" />
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

          <TabPanel value={tabValue} index={4}>
            {renderTabContent(legislation, "Legislation")}
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            {renderProjectStatusContent()}
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
            {currentTab === "Legislation" && (
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mr: 1 }}>
                  Jurisdiction:
                </Typography>
                <TextField
                  select
                  fullWidth
                  variant="outlined"
                  value={newJurisdiction}
                  onChange={(e) => setNewJurisdiction(e.target.value)}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="ACT">ACT</MenuItem>
                  <MenuItem value="NSW">NSW</MenuItem>
                  <MenuItem value="VIC">VIC</MenuItem>
                  <MenuItem value="QLD">QLD</MenuItem>
                  <MenuItem value="SA">SA</MenuItem>
                  <MenuItem value="TAS">TAS</MenuItem>
                  <MenuItem value="WA">WA</MenuItem>
                </TextField>
              </Box>
            )}
            <TextField
              autoFocus
              margin="dense"
              label={
                currentTab === "Legislation"
                  ? "Legislation Type"
                  : `${currentTab} Name`
              }
              fullWidth
              variant="outlined"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSaveItem()}
              sx={{ mb: currentTab === "Legislation" ? 2 : 0 }}
            />
            {currentTab === "Legislation" && (
              <TextField
                margin="dense"
                label="Legislation Title"
                fullWidth
                variant="outlined"
                value={newLegislationTitle}
                onChange={(e) => setNewLegislationTitle(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSaveItem()}
              />
            )}

            {currentTab === "Projects Status" && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Status Type:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="radio"
                      id="active-status"
                      name="status-type"
                      value="true"
                      checked={newIsActiveStatus === true}
                      onChange={(e) =>
                        setNewIsActiveStatus(e.target.value === "true")
                      }
                      style={{ marginRight: "8px" }}
                    />
                    <label htmlFor="active-status">Active Status</label>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="radio"
                      id="inactive-status"
                      name="status-type"
                      value="false"
                      checked={newIsActiveStatus === false}
                      onChange={(e) =>
                        setNewIsActiveStatus(e.target.value === "true")
                      }
                      style={{ marginRight: "8px" }}
                    />
                    <label htmlFor="inactive-status">Inactive Status</label>
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Status Color:
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <input
                      type="color"
                      value={newStatusColor}
                      onChange={(e) => setNewStatusColor(e.target.value)}
                      style={{
                        width: "40px",
                        height: "40px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {newStatusColor}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
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
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
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
