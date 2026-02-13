import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import PermissionGate from "../../components/PermissionGate";
import reportTemplateService from "../../services/reportTemplateService";
import { useSnackbar } from "../../context/SnackbarContext";

const ReportTemplatesIndex = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [companyDetails, setCompanyDetails] = useState({});
  const [editData, setEditData] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState({
    show: false,
    message: "",
    severity: "success",
  });

  // Load templates to get company details
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const allTemplates = await reportTemplateService.getAllTemplates();
        const templatesObj = {};
        allTemplates.forEach((template) => {
          templatesObj[template.templateType] = template;
        });
        setTemplates(templatesObj);

        // Get company details from first template (they're shared across all templates)
        const firstTemplate = Object.values(templatesObj)[0];
        if (firstTemplate?.companyDetails) {
          setCompanyDetails(firstTemplate.companyDetails);
        }
      } catch (error) {
        console.error("Error loading templates:", error);
        setSaveStatus({
          show: true,
          message: "Error loading templates. Please refresh the page.",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const handleEditCompanyDetails = () => {
    setEditData({ ...companyDetails });
    setOpenDialog(true);
  };

  const handleSaveCompanyDetails = async () => {
    try {
      // Update company details in all templates
      const templateTypes = Object.keys(templates);
      const updatePromises = templateTypes.map((templateType) =>
        reportTemplateService.updateTemplate(templateType, {
          companyDetails: editData,
        }),
      );

      await Promise.all(updatePromises);

      setCompanyDetails(editData);
      setOpenDialog(false);
      showSnackbar("Company details updated successfully", "success");
    } catch (error) {
      console.error("Error updating company details:", error);
      showSnackbar("Failed to update company details", "error");
    }
  };

  const handleCancel = () => {
    setOpenDialog(false);
    setEditData({});
  };

  const renderCompanyDetails = () => {
    if (!companyDetails || Object.keys(companyDetails).length === 0) {
      return null;
    }

    const entries = Object.entries(companyDetails);
    const leftColumn = entries.slice(0, Math.ceil(entries.length / 2));
    const rightColumn = entries.slice(Math.ceil(entries.length / 2));

    return (
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" color="text.primary">
                Company Details
              </Typography>
              <IconButton
                onClick={handleEditCompanyDetails}
                size="small"
                color="primary"
              >
                <EditIcon />
              </IconButton>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {leftColumn.map(([key, value]) => (
                    <Box
                      key={key}
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{ ml: 2 }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {rightColumn.map(([key, value]) => (
                    <Box
                      key={key}
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{ ml: 2 }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const modules = [
    {
      id: "clearances",
      title: "Asbestos Clearances",
      description:
        "Manage report templates for asbestos clearance reports including Non-Friable, Friable, and Vehicle/Equipment clearances.",
      icon: <DescriptionIcon sx={{ fontSize: 60 }} />,
      color: "#FF6B6B",
      route: "/admin/report-templates/clearances",
    },
    {
      id: "surveys",
      title: "Asbestos/HAZMAT Surveys",
      description:
        "Manage report templates for asbestos assessment and hazardous materials survey reports.",
      icon: <AssessmentIcon sx={{ fontSize: 60 }} />,
      color: "#4ECDC4",
      route: "/admin/report-templates/surveys",
    },
  ];

  return (
    <PermissionGate requiredPermissions={["admin.view"]}>
      <Box m="20px">
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Report Templates
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Select a module to manage report templates for different report types.
        </Typography>

        {/* Company Details Box */}
        {saveStatus.show && (
          <Alert severity={saveStatus.severity} sx={{ mb: 3 }}>
            {saveStatus.message}
          </Alert>
        )}

        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "200px",
              mb: 3,
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ mb: 4 }}>
            <Grid container spacing={3}>
              {renderCompanyDetails()}
            </Grid>
          </Box>
        )}

        <Grid container spacing={3}>
          {modules.map((module) => (
            <Grid item xs={12} md={6} key={module.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 6,
                  },
                  cursor: "pointer",
                }}
                onClick={() => navigate(module.route)}
              >
                <CardContent
                  sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    p: 3,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 100,
                      height: 100,
                      borderRadius: "50%",
                      backgroundColor: `${module.color}20`,
                      color: module.color,
                      mb: 3,
                      mx: "auto",
                    }}
                  >
                    {module.icon}
                  </Box>
                  <Typography
                    variant="h5"
                    component="h2"
                    gutterBottom
                    sx={{ fontWeight: 600, textAlign: "center", mb: 2 }}
                  >
                    {module.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center", mb: 3, flexGrow: 1 }}
                  >
                    {module.description}
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      backgroundColor: module.color,
                      "&:hover": {
                        backgroundColor: module.color,
                        opacity: 0.9,
                      },
                      mt: "auto",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(module.route);
                    }}
                  >
                    Manage Templates
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Edit Company Details Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCancel}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Company Details</DialogTitle>
          <DialogContent>
            <Box
              sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}
            >
              {Object.keys(editData).map((key) => (
                <TextField
                  key={key}
                  label={
                    key.charAt(0).toUpperCase() +
                    key.slice(1).replace(/([A-Z])/g, " $1")
                  }
                  value={editData[key] || ""}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  fullWidth
                  variant="outlined"
                />
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel} startIcon={<CancelIcon />}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCompanyDetails}
              variant="contained"
              startIcon={<SaveIcon />}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default ReportTemplatesIndex;
