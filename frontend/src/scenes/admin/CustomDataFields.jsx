import React, { useState, useEffect, useCallback } from "react";
import { useSnackbar } from "../../context/SnackbarContext";
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
  const [itemDescriptionsTabValue, setItemDescriptionsTabValue] = useState(0); // For nested tabs within Item Descriptions
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [locationDescriptions, setLocationDescriptions] = useState([]);
  const [materialsDescriptions, setMaterialsDescriptions] = useState([]);
  const [materialsDescriptionsNonACM, setMaterialsDescriptionsNonACM] =
    useState([]);
  const [roomAreas, setRoomAreas] = useState([]);
  const [legislation, setLegislation] = useState([]);
  const [projectStatuses, setProjectStatuses] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [fibreIdSamplesDescriptions, setFibreIdSamplesDescriptions] = useState(
    [],
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [newLegislationTitle, setNewLegislationTitle] = useState("");
  const [newJurisdiction, setNewJurisdiction] = useState("ACT");
  const [newIsActiveStatus, setNewIsActiveStatus] = useState(true);
  const [newStatusColor, setNewStatusColor] = useState("#1976d2");
  const [newAsbestosType, setNewAsbestosType] = useState("");
  const [newRecommendationName, setNewRecommendationName] = useState("");
  const [newGlossaryName, setNewGlossaryName] = useState("");
  const [newGlossaryDescription, setNewGlossaryDescription] = useState("");
  const [currentTab, setCurrentTab] = useState("");
  const [loading, setLoading] = useState(false);
  const { showSnackbar } = useSnackbar();

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
        materialsNonACMData,
        roomAreaData,
        legislationData,
        projectStatusesData,
        recommendationsData,
        glossaryData,
        fibreIdSamplesDescriptionsData,
      ] = await Promise.all([
        customDataFieldGroupService.getFieldsByType("asbestos_removalist"),
        customDataFieldGroupService.getFieldsByType("location_description"),
        customDataFieldGroupService.getFieldsByType("materials_description"),
        customDataFieldGroupService.getFieldsByType(
          "materials_description_non_acm",
        ),
        customDataFieldGroupService.getFieldsByType("room_area"),
        customDataFieldGroupService.getFieldsByType("legislation"),
        customDataFieldGroupService.getProjectStatuses(),
        customDataFieldGroupService.getFieldsByType("recommendation"),
        customDataFieldGroupService.getFieldsByType("glossary"),
        customDataFieldGroupService.getFieldsByType(
          "fibre_id_samples_description",
        ),
      ]);

      setAsbestosRemovalists(asbestosData || []);
      setLocationDescriptions(locationData || []);
      setMaterialsDescriptions(materialsData || []);
      setMaterialsDescriptionsNonACM(materialsNonACMData || []);
      setRoomAreas(roomAreaData || []);
      setLegislation(legislationData || []);
      setRecommendations(recommendationsData || []);
      setGlossary(glossaryData || []);
      setFibreIdSamplesDescriptions(fibreIdSamplesDescriptionsData || []);
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
    // Reset nested tab when switching away from Item Descriptions
    if (newValue !== 1) {
      setItemDescriptionsTabValue(0);
    }
  };

  const handleItemDescriptionsTabChange = (event, newValue) => {
    setItemDescriptionsTabValue(newValue);
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
          // Item Descriptions tab - use nested tab value
          switch (itemDescriptionsTabValue) {
            case 0:
              return {
                data: roomAreas,
                setter: setRoomAreas,
                title: "Room/Area",
              };
            case 1:
              return {
                data: locationDescriptions,
                setter: setLocationDescriptions,
                title: "Location Descriptions",
              };
            case 2:
              return {
                data: materialsDescriptions,
                setter: setMaterialsDescriptions,
                title: "Materials Descriptions",
              };
            case 3:
              return {
                data: materialsDescriptionsNonACM,
                setter: setMaterialsDescriptionsNonACM,
                title: "Materials Descriptions (non-ACM)",
              };
            default:
              return { data: [], setter: () => {}, title: "" };
          }
        case 2:
          return {
            data: legislation,
            setter: setLegislation,
            title: "Legislation",
          };
        case 3:
          return {
            data: Array.isArray(projectStatuses)
              ? projectStatuses
              : (projectStatuses?.activeStatuses || []).concat(
                  projectStatuses?.inactiveStatuses || [],
                ),
            setter: setProjectStatuses,
            title: "Projects Status",
          };
        case 4:
          return {
            data: recommendations,
            setter: setRecommendations,
            title: "Recommendations",
          };
        case 5:
          return {
            data: glossary,
            setter: setGlossary,
            title: "Glossary",
          };
        case 6:
          return {
            data: fibreIdSamplesDescriptions,
            setter: setFibreIdSamplesDescriptions,
            title: "Fibre ID Samples Descriptions",
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
    setNewAsbestosType(""); // Reset asbestos type on add
    setNewRecommendationName(""); // Reset recommendation name on add
    setNewGlossaryName(""); // Reset glossary name on add
    setNewGlossaryDescription(""); // Reset glossary description on add
    setDialogOpen(true);
  };

  const handleEditItem = (item) => {
    const { title } = getCurrentData();
    setCurrentTab(title);
    setEditingItem(item);
    setNewItemText(
      currentTab === "Recommendations"
        ? item.text || ""
        : currentTab === "Glossary"
          ? item.text || ""
          : item.text || item.name || "",
    );
    setNewLegislationTitle(item.legislationTitle || "");
    setNewJurisdiction(item.jurisdiction || "ACT"); // Set jurisdiction on edit
    setNewIsActiveStatus(
      item.isActiveStatus !== undefined ? item.isActiveStatus : true,
    ); // Set isActiveStatus on edit
    setNewStatusColor(item.statusColor || "#1976d2"); // Set status color on edit
    setNewAsbestosType(item.asbestosType || ""); // Set asbestos type on edit
    setNewRecommendationName(item.name || ""); // Set recommendation name on edit
    setNewGlossaryName(currentTab === "Glossary" ? item.name || "" : "");
    setNewGlossaryDescription(currentTab === "Glossary" ? item.text || "" : "");
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
          "Materials Descriptions (non-ACM)",
          "Glossary",
          "Fibre ID Samples Descriptions",
        ].includes(title)
      ) {
        // Get the current group
        const groupType = getTypeFromTitle(title);
        const group =
          await customDataFieldGroupService.getGroupByType(groupType);

        console.log(`${title} group response:`, group);

        if (!group) {
          showSnackbar(`${title} group not found`, "error");
          return;
        }

        // Remove the field from the group's fields array
        const updatedFields = group.fields.filter(
          (field) => field._id.toString() !== itemId.toString(),
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
          `${title} removed from display (backend deletion not implemented for this type)`,
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
      case "Materials Descriptions (non-ACM)":
        return "materials_description_non_acm";
      case "Legislation":
        return "legislation";
      case "Projects Status":
        return "project_status";
      case "Recommendations":
        return "recommendation";
      case "Glossary":
        return "glossary";
      case "Fibre ID Samples Descriptions":
        return "fibre_id_samples_description";
      default:
        return "asbestos_removalist";
    }
  };

  const handleSaveItem = async () => {
    // For recommendations, validate both fields separately
    if (currentTab === "Recommendations") {
      if (!newRecommendationName.trim()) {
        showSnackbar("Recommendation name is required", "error");
        return;
      }
      if (!newItemText.trim()) {
        showSnackbar("Recommendation content is required", "error");
        return;
      }
    } else if (currentTab === "Glossary") {
      if (!newGlossaryName.trim()) {
        showSnackbar("Glossary term (name) is required", "error");
        return;
      }
      if (!newGlossaryDescription.trim()) {
        showSnackbar("Glossary description is required", "error");
        return;
      }
    } else {
      // For other tabs, validate the main text field
      if (!newItemText.trim()) return;
    }

    // For legislation, both fields are required
    if (currentTab === "Legislation" && !newLegislationTitle.trim()) return;
    if (currentTab === "Legislation" && !newJurisdiction.trim()) return;

    // For materials descriptions, asbestos type is required
    if (currentTab === "Materials Descriptions" && !newAsbestosType.trim()) {
      showSnackbar(
        "Asbestos type is required for Materials Descriptions",
        "error",
      );
      return;
    }

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

        // For materials descriptions, include the asbestos type field
        if (title === "Materials Descriptions") {
          updateData.asbestosType = newAsbestosType.trim();
        }

        // For recommendations, include the name field
        if (title === "Recommendations") {
          updateData.name = newRecommendationName.trim();
        }

        // For glossary, include name (term) and text (description)
        if (title === "Glossary") {
          updateData.name = newGlossaryName.trim();
          updateData.text = newGlossaryDescription.trim();
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
            "Materials Descriptions (non-ACM)",
            "Recommendations",
            "Glossary",
            "Fibre ID Samples Descriptions",
          ].includes(title)
        ) {
          // Get the current group
          const groupType = getTypeFromTitle(title);
          let group;
          try {
            group = await customDataFieldGroupService.getGroupByType(groupType);
          } catch (getError) {
            // If group doesn't exist (404), create it
            if (
              getError.response?.status === 404 ||
              getError.response?.status === 400
            ) {
              try {
                const groupName = title;
                const groupDescription = `${title} custom data fields`;
                group = await customDataFieldGroupService.createGroup({
                  name: groupName,
                  description: groupDescription,
                  type: groupType,
                  fields: [],
                });
              } catch (createError) {
                console.error(`Error creating ${title} group:`, createError);
                const createErrorMessage =
                  createError.response?.data?.message ||
                  createError.message ||
                  `Failed to create ${title} group`;
                showSnackbar(createErrorMessage, "error");
                return;
              }
            } else {
              throw getError;
            }
          }

          if (!group) {
            showSnackbar(`${title} group not found`, "error");
            return;
          }

          // Update the specific field in the group's fields array
          // Clean fields to only include necessary properties
          const updatedFields = group.fields.map((field) => {
            const cleanedField = {
              _id: field._id,
              text: field.text,
              order: field.order,
              isActive: field.isActive,
              ...(field.legislationTitle && {
                legislationTitle: field.legislationTitle,
              }),
              ...(field.jurisdiction && { jurisdiction: field.jurisdiction }),
              ...(field.isActiveStatus !== undefined && {
                isActiveStatus: field.isActiveStatus,
              }),
              ...(field.statusColor && { statusColor: field.statusColor }),
              ...(field.asbestosType && { asbestosType: field.asbestosType }),
              ...(field.name && { name: field.name }),
              ...(field.createdBy && { createdBy: field.createdBy }),
            };

            if (field._id.toString() === editingItem._id.toString()) {
              return {
                ...cleanedField,
                ...updateData,
              };
            }
            return cleanedField;
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
            item._id === editingItem._id ? updatedItem : item,
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
            item._id === editingItem._id ? updatedItem : item,
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

        // For materials descriptions, include the asbestos type field
        if (title === "Materials Descriptions") {
          newItemData.asbestosType = newAsbestosType.trim();
        }

        // For recommendations, include the name field
        if (title === "Recommendations") {
          newItemData.name = newRecommendationName.trim();
        }

        // For glossary, use name (term) and text (description)
        if (title === "Glossary") {
          newItemData.name = newGlossaryName.trim();
          newItemData.text = newGlossaryDescription.trim();
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
            "Materials Descriptions (non-ACM)",
            "Recommendations",
            "Glossary",
            "Fibre ID Samples Descriptions",
          ].includes(title)
        ) {
          try {
            // Get the current group
            const groupType = getTypeFromTitle(title);
            let group;
            try {
              group =
                await customDataFieldGroupService.getGroupByType(groupType);
            } catch (getError) {
              // If group doesn't exist (404), create it
              if (
                getError.response?.status === 404 ||
                getError.response?.status === 400
              ) {
                try {
                  const groupName = title;
                  const groupDescription = `${title} custom data fields`;
                  group = await customDataFieldGroupService.createGroup({
                    name: groupName,
                    description: groupDescription,
                    type: groupType,
                    fields: [],
                  });
                } catch (createError) {
                  console.error(`Error creating ${title} group:`, createError);
                  const createErrorMessage =
                    createError.response?.data?.message ||
                    createError.message ||
                    `Failed to create ${title} group`;
                  showSnackbar(createErrorMessage, "error");
                  return;
                }
              } else {
                // Re-throw if it's a different error
                throw getError;
              }
            }

            if (!group) {
              showSnackbar(`${title} group not found`, "error");
              return;
            }

            // Create new field with proper structure
            const newField = {
              text: newItemData.text,
              order: group.fields.length, // Add to end
              isActive: true,
              // Don't include createdBy - let the backend handle it
              // Don't include createdAt - let the backend handle it
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
              ...(newItemData.asbestosType && {
                asbestosType: newItemData.asbestosType,
              }),
              ...(newItemData.name && {
                name: newItemData.name,
              }),
            };

            // Clean existing fields to only include necessary properties
            const cleanedFields = group.fields.map((field) => ({
              _id: field._id,
              text: field.text,
              order: field.order,
              isActive: field.isActive,
              ...(field.legislationTitle && {
                legislationTitle: field.legislationTitle,
              }),
              ...(field.jurisdiction && { jurisdiction: field.jurisdiction }),
              ...(field.isActiveStatus !== undefined && {
                isActiveStatus: field.isActiveStatus,
              }),
              ...(field.statusColor && { statusColor: field.statusColor }),
              ...(field.asbestosType && { asbestosType: field.asbestosType }),
              ...(field.name && { name: field.name }),
              ...(field.createdBy && { createdBy: field.createdBy }),
            }));

            // Add the new field to the group's fields array
            const updatedFields = [...cleanedFields, newField];

            // Update the group with the new fields array
            const updatePayload = {
              name: group.name,
              description: group.description,
              fields: updatedFields,
            };

            console.log(
              "Adding recommendation - Update payload:",
              JSON.stringify(updatePayload, null, 2),
            );
            console.log("New field being added:", newField);

            await customDataFieldGroupService.updateGroup(
              group._id,
              updatePayload,
            );

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
            const errorMessage =
              error.response?.data?.message ||
              error.message ||
              `Failed to add ${title} to backend`;
            console.error("Full error details:", error.response?.data);
            showSnackbar(errorMessage, "error");
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
    setNewAsbestosType(""); // Reset asbestos type on save
    setNewRecommendationName(""); // Reset recommendation name on save
    setNewGlossaryName("");
    setNewGlossaryDescription("");
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setNewItemText("");
    setNewLegislationTitle("");
    setNewJurisdiction("ACT"); // Reset jurisdiction on close
    setNewIsActiveStatus(true); // Reset isActiveStatus on close
    setNewStatusColor("#1976d2"); // Reset status color on close
    setNewAsbestosType(""); // Reset asbestos type on close
    setNewRecommendationName(""); // Reset recommendation name on close
    setNewGlossaryName("");
    setNewGlossaryDescription("");
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
                  primary={
                    (title === "Recommendations" || title === "Glossary") &&
                    item.name ? (
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: "bold" }}
                      >
                        {item.name}
                      </Typography>
                    ) : (
                      item.text || item.name || "Unnamed Item"
                    )
                  }
                  secondary={
                    title === "Materials Descriptions" && item.asbestosType
                      ? `Asbestos Type: ${item.asbestosType}`
                      : title === "Recommendations" && item.text
                        ? item.text
                        : title === "Glossary" && item.text
                          ? item.text
                          : null
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
                      ),
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
            <Tab label="Item Descriptions" />
            <Tab label="Legislation" />
            <Tab label="Projects Status" />
            <Tab label="Recommendations" />
            <Tab label="Glossary" />
            <Tab label="Fibre ID Samples Descriptions" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {renderTabContent(asbestosRemovalists, "Asbestos Removalists")}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box>
              <Tabs
                value={itemDescriptionsTabValue}
                onChange={handleItemDescriptionsTabChange}
                aria-label="item descriptions tabs"
                sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
              >
                <Tab label="Room/Area" />
                <Tab label="Location Descriptions" />
                <Tab label="Materials Descriptions" />
                <Tab label="Materials Descriptions (non-ACM)" />
              </Tabs>

              <TabPanel value={itemDescriptionsTabValue} index={0}>
                {renderTabContent(roomAreas, "Room/Area")}
              </TabPanel>

              <TabPanel value={itemDescriptionsTabValue} index={1}>
                {renderTabContent(
                  locationDescriptions,
                  "Location Descriptions",
                )}
              </TabPanel>

              <TabPanel value={itemDescriptionsTabValue} index={2}>
                {renderTabContent(
                  materialsDescriptions,
                  "Materials Descriptions",
                )}
              </TabPanel>

              <TabPanel value={itemDescriptionsTabValue} index={3}>
                {renderTabContent(
                  materialsDescriptionsNonACM,
                  "Materials Descriptions (non-ACM)",
                )}
              </TabPanel>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {renderTabContent(legislation, "Legislation")}
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {renderProjectStatusContent()}
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            {renderTabContent(recommendations, "Recommendations")}
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            {renderTabContent(glossary, "Glossary")}
          </TabPanel>

          <TabPanel value={tabValue} index={6}>
            {renderTabContent(
              fibreIdSamplesDescriptions,
              "Fibre ID Samples Descriptions",
            )}
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
            {currentTab !== "Recommendations" && currentTab !== "Glossary" && (
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
                sx={{
                  mb:
                    currentTab === "Legislation" ||
                    currentTab === "Materials Descriptions"
                      ? 2
                      : 0,
                }}
              />
            )}
            {currentTab === "Glossary" && (
              <>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Name (Term)"
                  fullWidth
                  variant="outlined"
                  value={newGlossaryName}
                  onChange={(e) => setNewGlossaryName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSaveItem()}
                  required
                  error={!newGlossaryName.trim()}
                  helperText={!newGlossaryName.trim() ? "Name is required" : ""}
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="dense"
                  label="Description"
                  fullWidth
                  variant="outlined"
                  value={newGlossaryDescription}
                  onChange={(e) => setNewGlossaryDescription(e.target.value)}
                  multiline
                  rows={3}
                  required
                  error={!newGlossaryDescription.trim()}
                  helperText={
                    !newGlossaryDescription.trim()
                      ? "Description is required"
                      : ""
                  }
                />
              </>
            )}
            {currentTab === "Recommendations" && (
              <>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Recommendation Name"
                  fullWidth
                  variant="outlined"
                  value={newRecommendationName}
                  onChange={(e) => setNewRecommendationName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSaveItem()}
                  required
                  error={!newRecommendationName.trim()}
                  helperText={
                    !newRecommendationName.trim() ? "Name is required" : ""
                  }
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="dense"
                  label="Recommendation Content"
                  fullWidth
                  variant="outlined"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  multiline
                  rows={3}
                  required
                  error={!newItemText.trim()}
                  helperText={!newItemText.trim() ? "Content is required" : ""}
                />
              </>
            )}
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
            {currentTab === "Materials Descriptions" && (
              <TextField
                select
                margin="dense"
                label="Asbestos Type"
                fullWidth
                variant="outlined"
                value={newAsbestosType}
                onChange={(e) => setNewAsbestosType(e.target.value)}
                required
                error={!newAsbestosType}
                helperText={!newAsbestosType ? "Asbestos type is required" : ""}
              >
                <MenuItem value="Friable">Friable</MenuItem>
                <MenuItem value="Non-friable">Non-friable</MenuItem>
              </TextField>
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
      </Box>
    </Box>
  );
};

export default CustomDataFields;
