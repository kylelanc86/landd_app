import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Chip,
  Checkbox,
} from "@mui/material";
import {
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  Delete as DeletePhotoIcon,
} from "@mui/icons-material";
import {
  compressImage,
  needsCompression,
} from "../../../utils/imageCompression";
import { generateAssessmentPDF } from "../../../utils/templatePDFGenerator";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PictureAsPdfIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { useParams, useNavigate } from "react-router-dom";
import assessmentService from "../../../services/assessmentService";
import {
  projectService,
  asbestosAssessmentService,
} from "../../../services/api";
import PDFLoadingOverlay from "../../../components/PDFLoadingOverlay";

const AssessmentItemsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    itemNumber: "",
    sampleReference: "",
    locationDescription: "",
    materialType: "",
    asbestosContent: "",
    asbestosType: "",
    condition: "",
    risk: "",
    photograph: "",
    recommendationActions: "",
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [itemsData, assessmentData] = await Promise.all([
          assessmentService.getItems(id),
          assessmentService.getJob(id),
        ]);

        setItems(itemsData || []);
        setAssessment(assessmentData);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleAddItem = () => {
    setForm({
      itemNumber: getNextItemNumber(),
      sampleReference: "",
      locationDescription: "",
      materialType: "",
      asbestosContent: "",
      asbestosType: "",
      condition: "",
      risk: "",
      photograph: "",
      recommendationActions: "",
    });
    setPhotoPreview(null);
    setPhotoFile(null);
    setCompressionStatus(null);
    setAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setAddDialogOpen(false);
    setForm({
      itemNumber: "",
      sampleReference: "",
      locationDescription: "",
      materialType: "",
      asbestosContent: "",
      asbestosType: "",
      condition: "",
      risk: "",
      photograph: "",
      recommendationActions: "",
    });
    setPhotoPreview(null);
    setPhotoFile(null);
    setCompressionStatus(null);
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await assessmentService.addItem(id, form);
      handleDialogClose();
      // Refresh items
      const updatedItems = await assessmentService.getItems(id);
      setItems(updatedItems);
    } catch (err) {
      alert(err.message || "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPhotoFile(file);
      setCompressionStatus({
        type: "processing",
        message: "Processing image...",
      });

      try {
        const originalSizeKB = Math.round(file.size / 1024);

        // Check if compression is needed
        const shouldCompress = needsCompression(file, 300); // 300KB threshold

        if (shouldCompress) {
          console.log("Compressing image...");
          setCompressionStatus({
            type: "compressing",
            message: "Compressing image...",
          });

          const compressedImage = await compressImage(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.75,
            maxSizeKB: 300,
          });

          const compressedSizeKB = Math.round(
            (compressedImage.length * 0.75) / 1024
          );
          const reduction = Math.round(
            ((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100
          );

          setPhotoPreview(compressedImage);
          setForm({ ...form, photograph: compressedImage });
          setCompressionStatus({
            type: "success",
            message: `Compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${reduction}% reduction)`,
          });

          console.log("Image compressed successfully");
        } else {
          // Use original if no compression needed
          const reader = new FileReader();
          reader.onload = (e) => {
            setPhotoPreview(e.target.result);
            setForm({ ...form, photograph: e.target.result });
            setCompressionStatus({
              type: "info",
              message: `No compression needed (${originalSizeKB}KB)`,
            });
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Error processing image:", error);
        // Fallback to original image if compression fails
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreview(e.target.result);
          setForm({ ...form, photograph: e.target.result });
          setCompressionStatus({
            type: "warning",
            message: "Compression failed, using original image",
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleTakePhoto = () => {
    // Create a file input for camera access
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // Use back camera
    input.onchange = handlePhotoUpload;
    input.click();
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setForm({ ...form, photograph: "" });
    setCompressionStatus(null);
  };

  // Function to get next item number
  const getNextItemNumber = () => {
    if (items.length === 0) return 1;
    const maxNumber = Math.max(...items.map((item) => item.itemNumber || 0));
    return maxNumber + 1;
  };

  const handleEditItem = (itemId) => {
    // TODO: Implement edit item logic/modal
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await assessmentService.deleteItem(id, itemId);
        // Refresh items
        const updatedItems = await assessmentService.getItems(id);
        setItems(updatedItems);
      } catch (err) {
        alert(err.message || "Failed to delete item");
      }
    }
  };

  const handleGeneratePDF = async () => {
    try {
      console.log('Starting PDF generation, setting loading state to true');
      setGeneratingPDF(true);

      // Get the full assessment data with populated project and items
      console.log('Fetching assessment data...');
      const fullAssessment = await assessmentService.getJob(id);
      console.log('Assessment data:', fullAssessment);
      
      console.log('Fetching assessment items...');
      const assessmentItems = await assessmentService.getItems(id);
      console.log('Assessment items:', assessmentItems);

      // Combine assessment data with items
      const assessmentData = {
        ...fullAssessment,
        items: assessmentItems,
      };
      console.log('Combined assessment data:', assessmentData);

      // Generate PDF
      console.log('Calling generateAssessmentPDF...');
      const fileName = await generateAssessmentPDF(assessmentData);
      console.log('PDF generation completed:', fileName);

      alert(`PDF generated successfully: ${fileName}`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Failed to generate PDF: " + err.message);
    } finally {
      console.log('Setting loading state to false');
      setGeneratingPDF(false);
    }
  };

  const handleMarkReadyForAnalysis = async () => {
    if (
      window.confirm(
        "Are you sure you want to mark the entire assessment as ready for analysis?"
      )
    ) {
      try {
        await asbestosAssessmentService.markAssessmentReadyForAnalysis(id);
        // Refresh assessment status
        const updatedAssessment = await assessmentService.getJob(id);
        setAssessment(updatedAssessment);
        setStatusMessage({
          type: "success",
          text: "Assessment marked as ready for analysis.",
        });
      } catch (err) {
        console.error("Error marking assessment ready for analysis:", err);
        setStatusMessage({
          type: "error",
          text: "Failed to mark assessment ready for analysis.",
        });
      }
    }
  };

  return (
    <Box m="20px">
      {/* PDF Loading Overlay */}
      <PDFLoadingOverlay
        open={generatingPDF}
        message="Generating Asbestos Assessment PDF..."
      />

      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/assessments")}
          sx={{ mb: 2 }}
        >
          Back to Assessment Jobs
        </Button>
      </Box>

      {/* Header and Project Details */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h2" fontWeight="bold" sx={{ mb: "5px" }}>
            Assessment Items
          </Typography>
          {assessment && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="h6" color="text.secondary">
                Project ID: {assessment.projectId?.projectID || "N/A"}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Site Name: {assessment.projectId?.name || "N/A"}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleGeneratePDF}
            disabled={generatingPDF}
          >
            {generatingPDF ? "Generating PDF..." : "Generate PDF"}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleMarkReadyForAnalysis}
            disabled={assessment?.status === "ready-for-analysis"}
          >
            Mark Job Ready for Analysis
          </Button>
        </Box>
      </Box>

      {statusMessage && (
        <Alert severity={statusMessage.type} sx={{ mt: 2 }}>
          {statusMessage.text}
        </Alert>
      )}

      {/* Abbreviations Box */}
      <Box
        sx={{
          border: "2px solid #16b12b",
          borderRadius: "6px",
          padding: "16px",
          marginBottom: "16px",
          backgroundColor: "#f8f8f8",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: "#16b12b",
            fontWeight: "bold",
            marginBottom: "12px",
            textTransform: "uppercase",
            fontSize: "0.9rem",
          }}
        >
          Abbreviations
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            gap: "12px",
            fontSize: "0.875rem",
          }}
        >
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: "bold", color: "#333", marginBottom: "4px" }}
            >
              Material Type
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.4 }}
            >
              CHR = Chrysotile asbestos
              <br />
              AMO = Amosite asbestos
              <br />
              CROC = Crocidolite asbestos
              <br />
              NAD = No asbestos detected
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: "bold", color: "#333", marginBottom: "4px" }}
            >
              Asbestos Type
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.4 }}
            >
              NF = Non-friable
              <br />
              Fr = Friable
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: "bold", color: "#333", marginBottom: "4px" }}
            >
              Condition
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.4 }}
            >
              VG = Very good
              <br />
              G = Good
              <br />
              F = Fair
              <br />P = Poor
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: "bold", color: "#333", marginBottom: "4px" }}
            >
              Risk
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.4 }}
            >
              VL = Very low
              <br />
              L = Low
              <br />
              M = Medium
              <br />H = High
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box mt={4}>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ height: "120px" }}>
                  <TableCell
                    sx={{
                      verticalAlign: "middle",
                      maxWidth: "70px",
                      minWidth: "70px",
                    }}
                  >
                    Item #
                  </TableCell>
                  <TableCell
                    sx={{
                      verticalAlign: "middle",
                      maxWidth: "100px",
                      minWidth: "100px",
                    }}
                  >
                    Sample Ref
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "middle" }}>
                    Location/Description
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "middle" }}>
                    Material Type
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "40px",
                      minWidth: "40px",
                      maxWidth: "40px",
                      padding: "8px 4px",
                      height: "120px",
                      textAlign: "center",
                      verticalAlign: "middle",
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                        whiteSpace: "nowrap",
                        width: "100px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "absolute",
                        left: "-20px",
                        top: "50%",
                        marginTop: "-10px",
                        lineHeight: "0.9",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Asbestos
                      <br />
                      Content
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "40px",
                      minWidth: "40px",
                      maxWidth: "40px",
                      padding: "8px 4px",
                      height: "120px",
                      textAlign: "center",
                      verticalAlign: "middle",
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                        whiteSpace: "nowrap",
                        width: "100px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "absolute",
                        left: "-20px",
                        top: "50%",
                        marginTop: "-10px",
                        lineHeight: "0.9",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Asbestos
                      <br />
                      Type
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "40px",
                      minWidth: "40px",
                      maxWidth: "40px",
                      padding: "8px 4px",
                      height: "120px",
                      textAlign: "center",
                      verticalAlign: "middle",
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                        whiteSpace: "nowrap",
                        // fontWeight: "bold",
                        width: "100px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "absolute",
                        left: "-20px",
                        top: "50%",
                        marginTop: "-10px",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Condition
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "40px",
                      minWidth: "40px",
                      maxWidth: "40px",
                      padding: "8px 4px",
                      height: "120px",
                      textAlign: "center",
                      verticalAlign: "middle",
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                        whiteSpace: "nowrap",
                        width: "100px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "absolute",
                        left: "-20px",
                        top: "50%",
                        marginTop: "-10px",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Risk
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{ verticalAlign: "middle", textAlign: "center" }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  // Function to get abbreviation for asbestos content
                  const getAsbestosContentAbbr = (content) => {
                    if (!content) return "";
                    if (
                      content.includes("Chrysotile") &&
                      content.includes("Amosite") &&
                      content.includes("Crocidolite")
                    )
                      return "CHR, AMO, CROC";
                    if (
                      content.includes("Chrysotile") &&
                      content.includes("Amosite")
                    )
                      return "CHR, AMO";
                    if (content.includes("Chrysotile")) return "CHR";
                    if (content.includes("Amosite")) return "AMO";
                    if (content.includes("Crocidolite")) return "CROC";
                    if (content.includes("No asbestos detected")) return "NAD";
                    return content;
                  };

                  // Function to get abbreviation for asbestos type
                  const getAsbestosTypeAbbr = (type) => {
                    if (!type) return "";
                    if (type === "Non-friable") return "NF";
                    if (type === "Friable") return "Fr";
                    return type;
                  };

                  // Function to get abbreviation for condition
                  const getConditionAbbr = (condition) => {
                    if (!condition) return "";
                    if (condition === "Very good") return "VG";
                    if (condition === "Good") return "G";
                    if (condition === "Fair") return "F";
                    if (condition === "Poor") return "P";
                    return condition;
                  };

                  // Function to get abbreviation for risk
                  const getRiskAbbr = (risk) => {
                    if (!risk) return "";
                    if (risk === "Very low") return "VL";
                    if (risk === "Low") return "L";
                    if (risk === "Medium") return "M";
                    if (risk === "High") return "H";
                    return risk;
                  };

                  return (
                    <TableRow key={item._id}>
                      <TableCell>{item.itemNumber || ""}</TableCell>
                      <TableCell>{item.sampleReference}</TableCell>
                      <TableCell>{item.locationDescription}</TableCell>
                      <TableCell>{item.materialType}</TableCell>
                      <TableCell title={item.asbestosContent}>
                        {getAsbestosContentAbbr(item.asbestosContent)}
                      </TableCell>
                      <TableCell title={item.asbestosType}>
                        {getAsbestosTypeAbbr(item.asbestosType)}
                      </TableCell>
                      <TableCell title={item.condition}>
                        {getConditionAbbr(item.condition)}
                      </TableCell>
                      <TableCell title={item.risk}>
                        {getRiskAbbr(item.risk)}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          color="primary"
                          onClick={() => handleEditItem(item._id)}
                          title="Edit"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteItem(item._id)}
                          title="Delete"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Add Item Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Assessment Item</DialogTitle>
        <form onSubmit={handleFormSubmit}>
          <DialogContent>
            <Box
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}
            >
              <TextField
                label="Item Number"
                name="itemNumber"
                value={form.itemNumber}
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                required
                disabled
              />
              <TextField
                label="Sample Reference"
                name="sampleReference"
                value={form.sampleReference}
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Location/Description"
                name="locationDescription"
                value={form.locationDescription}
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Material Type"
                name="materialType"
                value={form.materialType}
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                required
                placeholder="Enter material type"
              />
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Asbestos Content</InputLabel>
                <Select
                  name="asbestosContent"
                  value={form.asbestosContent}
                  onChange={handleFormChange}
                  label="Asbestos Content"
                >
                  <MenuItem value="Chrysotile asbestos">
                    Chrysotile asbestos
                  </MenuItem>
                  <MenuItem value="Amosite asbestos">Amosite asbestos</MenuItem>
                  <MenuItem value="Crocidolite asbestos">
                    Crocidolite asbestos
                  </MenuItem>
                  <MenuItem value="Chrysotile & Amosite Asbestos">
                    Chrysotile & Amosite Asbestos
                  </MenuItem>
                  <MenuItem value="Chrysotile, Amosite & Crocidolite asbestos">
                    Chrysotile, Amosite & Crocidolite asbestos
                  </MenuItem>
                  <MenuItem value="No asbestos detected">
                    No asbestos detected
                  </MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Asbestos Type</InputLabel>
                <Select
                  name="asbestosType"
                  value={form.asbestosType}
                  onChange={handleFormChange}
                  label="Asbestos Type"
                >
                  <MenuItem value="Non-friable">Non-friable</MenuItem>
                  <MenuItem value="Friable">Friable</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Condition</InputLabel>
                <Select
                  name="condition"
                  value={form.condition}
                  onChange={handleFormChange}
                  label="Condition"
                >
                  <MenuItem value="Very good">Very good</MenuItem>
                  <MenuItem value="Good">Good</MenuItem>
                  <MenuItem value="Fair">Fair</MenuItem>
                  <MenuItem value="Poor">Poor</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Risk</InputLabel>
                <Select
                  name="risk"
                  value={form.risk}
                  onChange={handleFormChange}
                  label="Risk"
                >
                  <MenuItem value="Very low">Very low</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                </Select>
              </FormControl>

              {/* Photo Section */}
              <Box sx={{ gridColumn: "1 / -1", mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Photo
                </Typography>
                <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={handleTakePhoto}
                  >
                    Take Photo
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    component="label"
                  >
                    Upload Photo
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </Button>
                  {photoPreview && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeletePhotoIcon />}
                      onClick={handleRemovePhoto}
                    >
                      Remove Photo
                    </Button>
                  )}
                </Box>

                {compressionStatus && (
                  <Alert severity={compressionStatus.type} sx={{ mb: 2 }}>
                    {compressionStatus.message}
                  </Alert>
                )}

                {photoPreview && (
                  <Box sx={{ mt: 2 }}>
                    <img
                      src={photoPreview}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "200px",
                        objectFit: "contain",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                      }}
                    />
                  </Box>
                )}
              </Box>

              <TextField
                label="Recommendation Actions/Comments"
                name="recommendationActions"
                value={form.recommendationActions}
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                multiline
                rows={3}
                sx={{ gridColumn: "1 / -1" }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Add Item"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default AssessmentItemsPage;
