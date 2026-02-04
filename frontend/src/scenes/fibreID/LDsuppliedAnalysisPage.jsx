import React, { useState, useEffect, useMemo } from "react";
import { useSnackbar } from "../../context/SnackbarContext";
import {
  Box,
  Typography,
  Container,
  Paper,
  Breadcrumbs,
  Link,
  Grid,
  Card,
  CardContent,
  Divider,
  TextField,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Chip,
  Checkbox,
  Alert,
  IconButton,
  Menu,
  Stack,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { asbestosAssessmentService, userService } from "../../services/api";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";

const LDsuppliedAnalysisPage = () => {
  const navigate = useNavigate();
  const { assessmentId, itemNumber } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [assessmentItem, setAssessmentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Analysis state
  const [microscope, setMicroscope] = useState("LD-PLM-1");
  const [sampleDescription, setSampleDescription] = useState("");
  const [sampleType, setSampleType] = useState("mass");
  const [sampleMass, setSampleMass] = useState("");
  const [sampleDimensions, setSampleDimensions] = useState({
    x: "",
    y: "",
    z: "",
  });
  const [ashing, setAshing] = useState("no");
  const [crucibleNo, setCrucibleNo] = useState("");
  const [fibres, setFibres] = useState([]);
  const [finalResult, setFinalResult] = useState("");
  const [noFibreDetected, setNoFibreDetected] = useState(false);
  const [traceAsbestos, setTraceAsbestos] = useState("no");
  const [traceAsbestosContent, setTraceAsbestosContent] = useState("");
  const [traceCount, setTraceCount] = useState("");
  const [analysisDate, setAnalysisDate] = useState(new Date());
  const [analysts, setAnalysts] = useState([]);
  const [analyst, setAnalyst] = useState("");
  const [comments, setComments] = useState("");
  const { showSnackbar } = useSnackbar();
  const [asbestosMenuAnchor, setAsbestosMenuAnchor] = useState(null);
  const [selectedFibreId, setSelectedFibreId] = useState(null);
  const [fibreIdSampleDescriptions, setFibreIdSampleDescriptions] = useState(
    [],
  );
  // When analysis is already finalised, Finalise button is disabled until user saves an edit
  const [
    hasSampleBeenEditedSinceFinalise,
    setHasSampleBeenEditedSinceFinalise,
  ] = useState(false);

  useEffect(() => {
    if (assessmentId && itemNumber) {
      fetchAssessmentDetails();
    }
    fetchAnalysts();
  }, [assessmentId, itemNumber]);

  useEffect(() => {
    const loadFibreIdSampleDescriptions = async () => {
      try {
        const data = await customDataFieldGroupService.getFieldsByType(
          "fibre_id_samples_description",
        );
        setFibreIdSampleDescriptions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Could not load fibre ID sample descriptions:", err);
        setFibreIdSampleDescriptions([]);
      }
    };
    loadFibreIdSampleDescriptions();
  }, []);

  const fetchAnalysts = async () => {
    try {
      const response = await userService.getAll(true); // Get all users including inactive
      const fibreIdentificationAnalysts = response.data.filter(
        (user) => user.labApprovals?.fibreIdentification === true,
      );
      setAnalysts(fibreIdentificationAnalysts);
    } catch (error) {
      console.error("Error fetching analysts:", error);
    }
  };

  useEffect(() => {
    // Ensure there's always at least one fibre when the component loads
    if (!noFibreDetected && fibres.length === 0) {
      ensureOneFibre();
    }
  }, [noFibreDetected, fibres.length]);

  const fetchAssessmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(
        "Fetching assessment details for ID:",
        assessmentId,
        "Item:",
        itemNumber,
      );

      const response = await asbestosAssessmentService.getJob(assessmentId);
      console.log("Assessment response:", response);

      if (!response) {
        throw new Error("Invalid response format from server");
      }

      // getJob already returns res.data, so response is the assessment data directly
      const assessmentData = response;
      setAssessment(assessmentData);

      // Debug: Check if items have analysedBy populated
      if (assessmentData?.items) {
        assessmentData.items.forEach((item, idx) => {
          if (item.analysedBy) {
            console.log(
              `Item ${idx} (${item.itemNumber || idx + 1}) has analysedBy:`,
              {
                type: typeof item.analysedBy,
                value: item.analysedBy,
                isObject: typeof item.analysedBy === "object",
                hasFirstName: item.analysedBy?.firstName,
                firstName: item.analysedBy?.firstName,
                lastName: item.analysedBy?.lastName,
              },
            );
          }
        });
      }

      // Debug: Check if assessment has analyst
      if (assessmentData?.analyst) {
        console.log("Assessment has analyst:", {
          type: typeof assessmentData.analyst,
          value: assessmentData.analyst,
          isObject: typeof assessmentData.analyst === "object",
          hasFirstName: assessmentData.analyst?.firstName,
          firstName: assessmentData.analyst?.firstName,
          lastName: assessmentData.analyst?.lastName,
        });
      }

      // Find the specific assessment item
      // Try to find by itemNumber first, then fall back to array index
      let item = assessmentData.items?.find(
        (item) => item.itemNumber === parseInt(itemNumber),
      );

      // If not found by itemNumber, try by array index (itemNumber - 1 for 1-based indexing)
      if (!item && assessmentData.items && assessmentData.items.length > 0) {
        const index = parseInt(itemNumber) - 1;
        if (index >= 0 && index < assessmentData.items.length) {
          item = assessmentData.items[index];
        }
      }

      if (!item) {
        throw new Error(`Assessment item ${itemNumber} not found`);
      }

      // Referred items (same sampleReference as another item, not first occurrence) are not samples for analysis - redirect to first sampled item if current item is referred
      const itemsList = assessmentData.items || [];
      const isVisuallyAssessed = (i) =>
        i.asbestosContent === "Visually Assessed as Asbestos" ||
        i.asbestosContent === "Visually Assessed as Non-Asbestos" ||
        i.asbestosContent === "Visually Assessed as Non-asbestos";
      const isFirstOccurrenceOfRef = (i, index) => {
        if (!i.sampleReference?.trim()) return false;
        if (isVisuallyAssessed(i)) return false;
        const ref = i.sampleReference.trim();
        const firstIndex = itemsList.findIndex(
          (x) => (x.sampleReference || "").trim() === ref,
        );
        return index === firstIndex;
      };
      const currentIndex = itemsList.findIndex((i) => i === item);
      const isReferredOrNotSampled =
        currentIndex < 0 || !isFirstOccurrenceOfRef(item, currentIndex);
      if (isReferredOrNotSampled) {
        const firstSampledIndex = itemsList.findIndex((i, idx) =>
          isFirstOccurrenceOfRef(i, idx),
        );
        if (firstSampledIndex >= 0) {
          setLoading(false);
          navigate(
            `/fibre-id/assessment/${assessmentId}/item/${firstSampledIndex + 1}/analysis`,
            { replace: true },
          );
          return;
        }
      }

      setAssessmentItem(item);

      // Load saved analysis data if it exists
      if (item.analysisData && Object.keys(item.analysisData).length > 0) {
        const savedData = item.analysisData;
        console.log("Loading saved analysis data:", savedData);

        // Only check "no fibres detected" when explicitly saved as such (unchecked by default)
        const wasNoFibreDetected =
          savedData.finalResult === "No fibres detected" ||
          savedData.noFibreDetected === true;

        setNoFibreDetected(wasNoFibreDetected);

        // Populate form fields with saved data
        setMicroscope(savedData.microscope || "LD-PLM-1");
        setSampleDescription(savedData.sampleDescription || "");
        setSampleType(savedData.sampleType || "mass");
        setSampleMass(savedData.sampleMass || "");
        setSampleDimensions(
          savedData.sampleDimensions || { x: "", y: "", z: "" },
        );
        setAshing(savedData.ashing || "no");
        setCrucibleNo(savedData.crucibleNo || "");
        setFibres(savedData.fibres || []);
        setFinalResult(savedData.finalResult || "");
        setTraceAsbestos(savedData.traceAsbestos || "no");
        setTraceAsbestosContent(savedData.traceAsbestosContent || "");
        setTraceCount(savedData.traceCount || "");
        setComments(savedData.comments || "");
        setAnalysisDate(
          savedData.analysedAt ? new Date(savedData.analysedAt) : new Date(),
        );

        // Load analyst from assessment level (analyst is set for all samples in the job)
        // Fall back to item level if assessment analyst is not set
        if (assessmentData.analyst) {
          if (
            typeof assessmentData.analyst === "object" &&
            assessmentData.analyst._id
          ) {
            setAnalyst(assessmentData.analyst._id);
            console.log(
              "Loaded analyst from assessment.analyst (object):",
              assessmentData.analyst,
            );
          } else if (typeof assessmentData.analyst === "string") {
            setAnalyst(assessmentData.analyst);
            console.log(
              "Loaded analyst from assessment.analyst (string):",
              assessmentData.analyst,
            );
          }
        } else if (item.analysedBy) {
          // Fallback to item-level analyst
          if (typeof item.analysedBy === "object" && item.analysedBy._id) {
            setAnalyst(item.analysedBy._id);
            console.log(
              "Loaded analyst from item.analysedBy (object):",
              item.analysedBy,
            );
          } else if (typeof item.analysedBy === "string") {
            setAnalyst(item.analysedBy);
            console.log(
              "Loaded analyst from item.analysedBy (string):",
              item.analysedBy,
            );
          }
        } else {
          console.log("No analyst found on assessment or item");
        }
      } else {
        // Pre-populate sample description if available
        if (item.sampleReference) {
          setSampleDescription(
            `Sample ${item.sampleReference} - ${item.locationDescription}`,
          );
        }
        // Set analysis date to today for new analysis
        setAnalysisDate(new Date());

        // Don't auto-select analyst - user must choose from dropdown
      }
    } catch (error) {
      console.error("Error fetching assessment details:", error);

      // Handle specific error cases
      if (error.response?.status === 404) {
        console.error("Assessment or item not found");
        setError("Assessment or item not found. Please check the URL.");
      } else if (error.response?.status === 500) {
        console.error("Server error while fetching assessment");
        setError("Server error while fetching assessment data.");
      } else {
        setError(error.message || "Failed to fetch assessment details");
      }

      // Set assessment to null to prevent further errors
      setAssessment(null);
      setAssessmentItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToJobs = () => {
    navigate("/surveys/asbestos-assessment");
  };

  const handleBackToHome = () => {
    navigate("/surveys/asbestos-assessment");
  };

  const addFibre = () => {
    if (fibres.length >= 4) {
      return; // Maximum 4 fibres allowed
    }
    const fibreLetter = String.fromCharCode(65 + fibres.length); // A, B, C, etc.
    const newFibre = {
      id: Date.now(),
      name: `Fibre ${fibreLetter}`,
      morphology: "",
      disintegrates: "",
      riLiquid: "",
      colour: "",
      pleochrism: "None",
      birefringence: "",
      extinction: "",
      signOfElongation: "",
      fibreParallel: "",
      fibrePerpendicular: "",
      result: "",
    };
    setFibres([...fibres, newFibre]);
  };

  const ensureOneFibre = () => {
    if (fibres.length === 0) {
      const newFibre = {
        id: Date.now(),
        name: "Fibre A",
        morphology: "",
        disintegrates: "",
        riLiquid: "",
        colour: "",
        pleochrism: "None",
        birefringence: "",
        extinction: "",
        signOfElongation: "",
        fibreParallel: "",
        fibrePerpendicular: "",
        result: "",
      };
      setFibres([newFibre]);
    }
  };

  const updateFibre = (fibreId, field, value) => {
    setFibres(
      fibres.map((fibre) => {
        if (fibre.id === fibreId) {
          const updatedFibre = { ...fibre, [field]: value };

          // Clear any existing automated result when conditions change
          if (field === "morphology" || field === "disintegrates") {
            updatedFibre.result = "";
          }

          // Auto-calculate result based on disintegrates and morphology
          if (updatedFibre.disintegrates === "yes") {
            if (updatedFibre.morphology === "curly") {
              updatedFibre.result = "Organic fibres";
            } else if (updatedFibre.morphology === "straight") {
              updatedFibre.result = "SMF";
            }
          } else if (updatedFibre.disintegrates === "no") {
            // For non-disintegrating fibres, result should be manually selected
            // Don't auto-set anything, let user choose
          }

          return updatedFibre;
        }
        return fibre;
      }),
    );
  };

  const removeFibre = (fibreId) => {
    setFibres(fibres.filter((fibre) => fibre.id !== fibreId));
  };

  const handleAsbestosMenuOpen = (event, fibreId) => {
    setAsbestosMenuAnchor(event.currentTarget);
    setSelectedFibreId(fibreId);
  };

  const handleAsbestosMenuClose = () => {
    setAsbestosMenuAnchor(null);
    setSelectedFibreId(null);
  };

  const applyAsbestosPreset = (AsbestosContent) => {
    if (!selectedFibreId) return;

    // Define preset values for each asbestos type
    const presets = {
      Chrysotile: {
        morphology: "curly",
        disintegrates: "no",
        riLiquid: "1.55",
        colour: "White",
        pleochrism: "None",
        birefringence: "low",
        extinction: "complete",
        signOfElongation: "Length-slow",
        fibreParallel: "Blue",
        fibrePerpendicular: "Magenta",
        result: "Chrysotile Asbestos",
      },
      Amosite: {
        morphology: "straight",
        disintegrates: "no",
        riLiquid: "1.67",
        colour: "Brown",
        pleochrism: "Low",
        birefringence: "moderate",
        extinction: "complete",
        signOfElongation: "Length-slow",
        fibreParallel: "Magenta",
        fibrePerpendicular: "Yellow",
        result: "Amosite Asbestos",
      },
      Crocidolite: {
        morphology: "straight",
        disintegrates: "no",
        riLiquid: "1.70",
        colour: "Blue",
        pleochrism: "Low",
        birefringence: "low",
        extinction: "complete",
        signOfElongation: "Length-fast",
        fibreParallel: "Blue",
        fibrePerpendicular: "Blue",
        result: "Crocidolite Asbestos",
      },
    };

    const preset = presets[AsbestosContent];
    if (!preset) return;

    // Update the fibre with the preset values
    setFibres(
      fibres.map((fibre) => {
        if (fibre.id === selectedFibreId) {
          return {
            ...fibre,
            ...preset,
          };
        }
        return fibre;
      }),
    );

    handleAsbestosMenuClose();
  };

  const calculateFinalResult = () => {
    // Check if trace analysis has been completed
    if (traceAsbestos === "yes" && traceCount && traceAsbestosContent) {
      // Determine result based on trace count
      if (traceCount === "< 5 unequivocal") {
        return "No asbestos detected";
      } else if (traceCount === "5-19 unequivocal") {
        return `Trace ${traceAsbestosContent} detected`;
      } else if (traceCount === "20+ unequivocal <100 visible") {
        return `Trace ${traceAsbestosContent} detected`;
      } else if (traceCount === "100+ visible") {
        return `${traceAsbestosContent} detected`;
      }
    }

    // If no fibres detected checkbox is checked
    if (noFibreDetected) {
      return "No asbestos detected";
    }

    // If no fibres in the array
    if (fibres.length === 0) {
      return "No fibres Detected";
    }

    // Get all unique fibre results
    const uniqueResults = [
      ...new Set(
        fibres.map((fibre) => fibre.result).filter((result) => result),
      ),
    ];

    if (uniqueResults.length === 0) {
      return "Analysis Incomplete";
    }

    return uniqueResults.join(", ");
  };

  const isMassDimensionsValid = () => {
    if (sampleType === "mass") {
      return sampleMass && sampleMass.trim() !== "";
    } else if (sampleType === "dimensions") {
      // At least one dimension must be filled
      return (
        (sampleDimensions.x && sampleDimensions.x.trim() !== "") ||
        (sampleDimensions.y && sampleDimensions.y.trim() !== "") ||
        (sampleDimensions.z && sampleDimensions.z.trim() !== "")
      );
    }
    return false;
  };

  const isAnalysisComplete = () => {
    // Check sample description validation
    if (!sampleDescription || !sampleDescription.trim()) {
      return false;
    }

    // Check mass/dimensions validation
    if (!isMassDimensionsValid()) {
      return false;
    }

    if (noFibreDetected) {
      return true; // No fibres detected means analysis is complete
    }
    return (
      fibres.length > 0 &&
      fibres.every((fibre) => fibre.result && fibre.result.trim() !== "")
    );
  };

  // Sampled items = first occurrence of each unique sampleReference (actual samples for analysis). Referred items (later items with same sampleReference) are excluded.
  const { sampledItems, isSampledItem } = useMemo(() => {
    if (!assessment?.items?.length)
      return { sampledItems: [], isSampledItem: () => false };
    const items = assessment.items;
    const isVA = (item) =>
      item.asbestosContent === "Visually Assessed as Asbestos" ||
      item.asbestosContent === "Visually Assessed as Non-Asbestos" ||
      item.asbestosContent === "Visually Assessed as Non-asbestos";
    // Include only the first item per unique sampleReference (the actual sample); referred items (same ref, later in list) are excluded
    const sampled = items.filter((item, index) => {
      if (!item.sampleReference?.trim()) return false;
      if (isVA(item)) return false;
      const ref = item.sampleReference.trim();
      const firstIndexWithRef = items.findIndex(
        (i) => (i.sampleReference || "").trim() === ref,
      );
      return index === firstIndexWithRef;
    });
    const sampledSet = new Set(sampled);
    const isSampled = (item) => item && sampledSet.has(item);
    return { sampledItems: sampled, isSampledItem: isSampled };
  }, [assessment?.items]);

  const areAllItemsAnalysed = () => {
    if (!assessment || !assessment.items || assessment.items.length === 0) {
      console.log("areAllItemsAnalysed: No assessment or items");
      return false;
    }

    const items = assessment.items;

    if (sampledItems.length === 0) {
      console.log("areAllItemsAnalysed: No sampled items found");
      return false;
    }

    // Check if all sampled items have been analysed
    const itemsStatus = sampledItems.map((item) => ({
      sampleRef: item.sampleReference,
      hasAnalysisData: !!item.analysisData,
      isAnalysed: item.analysisData?.isAnalysed,
    }));
    console.log("areAllItemsAnalysed check:", {
      totalItems: items.length,
      sampledItemsCount: sampledItems.length,
      itemsStatus,
    });
    const allAnalysed = sampledItems.every(
      (item) => item.analysisData && item.analysisData.isAnalysed === true,
    );
    console.log("areAllItemsAnalysed result:", allAnalysed);
    return allAnalysed;
  };

  const handleSaveAnalysis = async () => {
    try {
      console.log("Starting to save analysis...");

      // Validate sample description first
      if (!sampleDescription || !sampleDescription.trim()) {
        showSnackbar(
          "Sample Description is required. Please enter a value before saving.",
          "warning",
        );
        return;
      }

      // Validate analyst is required
      if (!analyst || !String(analyst).trim()) {
        showSnackbar(
          "Analyst is required. Please select an analyst before saving.",
          "warning",
        );
        return;
      }

      // Validate mass/dimensions
      if (!isMassDimensionsValid()) {
        const fieldName =
          sampleType === "mass" ? "Sample Mass" : "Sample Dimensions";
        showSnackbar(
          `${fieldName} is required. Please enter a value before saving.`,
          "warning",
        );
        return;
      }

      // Check if analysis is complete (all fibres have results or no fibres detected)
      const analysisComplete = isAnalysisComplete();

      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions: sampleType === "dimensions" ? sampleDimensions : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres: noFibreDetected ? [] : fibres, // Clear fibres array when no fibres detected
        finalResult: finalResult,
        traceAsbestos,
        traceAsbestosContent:
          traceAsbestos === "yes" ? traceAsbestosContent : null,
        traceCount: traceAsbestos === "yes" ? traceCount : null,
        comments: comments || null,
        // Automatically mark as analysed when analysis is complete
        isAnalysed: analysisComplete,
        analysedAt: analysisComplete
          ? analysisDate
          : assessmentItem?.analysisData?.analysedAt || null,
      };

      // Get analyst user object if analyst is selected
      let analystUser = null;
      if (analyst) {
        analystUser = analysts.find((a) => a._id === analyst);
      }

      console.log("Saving analysis - Analyst ID:", analyst);
      console.log("Saving analysis - Analyst User:", analystUser);
      console.log("Saving analysis - Analysis Complete:", analysisComplete);

      // Update the assessment item with analysis data
      // Include analysedBy in the request body for the backend to use
      const requestData = {
        ...analysisData,
        analysedBy: analyst || undefined,
      };
      console.log("Saving analysis - Request data:", {
        ...requestData,
        analysedBy: analyst,
      });

      const response = await asbestosAssessmentService.updateItemAnalysis(
        assessmentId,
        itemNumber,
        requestData,
      );

      console.log("Analysis saved successfully:", response);
      console.log(
        "Analysis saved - Response item analysedBy:",
        response.item?.analysedBy,
      );

      // Update local state
      setAssessmentItem((prev) => ({
        ...prev,
        analysisData: {
          ...prev.analysisData,
          ...analysisData,
        },
        analysedBy: analystUser || prev.analysedBy,
        analysedAt: analysisDate,
      }));

      // Update the assessment state to reflect the item being analysed
      setAssessment((prev) => {
        if (!prev || !prev.items) return prev;
        const itemIndex = parseInt(itemNumber) - 1;
        return {
          ...prev,
          items: prev.items.map((item, index) => {
            // Find the item by itemNumber or array index
            const isTargetItem =
              item.itemNumber === parseInt(itemNumber) ||
              (itemIndex >= 0 && index === itemIndex);

            if (isTargetItem) {
              return {
                ...item,
                analysisData: {
                  ...item.analysisData,
                  ...analysisData,
                },
                analysedBy: analystUser || item.analysedBy,
                analysedAt: analysisDate,
              };
            }
            return item;
          }),
        };
      });

      // Refresh assessment data to update the assessment state
      await fetchAssessmentDetails();

      // Mark that a sample was edited so Finalise Analysis can be re-enabled if already finalised
      setHasSampleBeenEditedSinceFinalise(true);

      // Show success message
      const message = analysisComplete
        ? "Analysis saved and marked as complete!"
        : "Analysis saved successfully!";
      showSnackbar(message, "success");
    } catch (error) {
      console.error("Error saving analysis:", error);
      console.error("Error details:", error.response?.data);
      // You could add an error notification here
      showSnackbar(`Error saving analysis: ${error.message}`, "error");
    }
  };

  const handleEditAnalysis = async () => {
    try {
      console.log("Setting item to editable mode...");

      // Create analysis data with current form values but set isAnalysed to false
      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions: sampleType === "dimensions" ? sampleDimensions : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres: noFibreDetected ? [] : fibres, // Clear fibres array when no fibres detected
        finalResult: finalResult,
        traceAsbestos,
        traceAsbestosContent:
          traceAsbestos === "yes" ? traceAsbestosContent : null,
        traceCount: traceAsbestos === "yes" ? traceCount : null,
        comments: comments || null,
        isAnalysed: false,
        analysedAt: null,
      };

      // Update the assessment item with analysis data
      const response = await asbestosAssessmentService.updateItemAnalysis(
        assessmentId,
        itemNumber,
        analysisData,
      );

      console.log("Item set to editable mode successfully:", response);

      // Update local state
      setAssessmentItem((prev) => ({
        ...prev,
        analysisData: {
          ...prev.analysisData,
          ...analysisData,
        },
      }));

      // Refresh assessment data to update the assessment state
      await fetchAssessmentDetails();

      showSnackbar("Analysis is now editable!", "success");
    } catch (error) {
      console.error("Error setting item to editable mode:", error);
      console.error("Error details:", error.response?.data);
      showSnackbar(
        `Error setting item to editable mode: ${error.message}`,
        "error",
      );
    }
  };

  const handleFinaliseAnalysis = async () => {
    try {
      console.log("Finalising analysis and updating job status...");

      // Check if all sampled items are analysed (using the same logic as areAllItemsAnalysed)
      if (!areAllItemsAnalysed()) {
        showSnackbar(
          "Cannot finalise analysis: All sampled items must be analysed first.",
          "warning",
        );
        return;
      }

      // Update the assessment status and L&D supplied lab samples status
      await asbestosAssessmentService.updateAsbestosAssessment(assessmentId, {
        ...assessment,
        status: "sample-analysis-complete",
        labSamplesStatus: "analysis-complete",
      });

      console.log("Analysis finalised successfully");

      // Navigate back to L&D Supplied Jobs page
      showSnackbar(
        "Analysis finalised successfully! Job status updated.",
        "success",
      );
      navigate("/surveys/asbestos-assessment");
    } catch (error) {
      console.error("Error finalising analysis:", error);
      console.error("Error details:", error.response?.data);
      showSnackbar(`Error finalising analysis: ${error.message}`, "error");
    }
  };

  useEffect(() => {
    setFinalResult(calculateFinalResult());
  }, [
    fibres,
    traceAsbestos,
    traceAsbestosContent,
    traceCount,
    noFibreDetected,
  ]);

  useEffect(() => {
    if (noFibreDetected) {
      setMicroscope("N/A");
      setFinalResult("No fibres detected");
    } else {
      // Ensure there's always at least one fibre when analysis is active
      ensureOneFibre();
    }
  }, [noFibreDetected]);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center">
            Loading assessment details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !assessment || !assessmentItem) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            {error || "Assessment not found"}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/surveys/asbestos-assessment")}
            sx={{ mt: 2, display: "block", mx: "auto" }}
          >
            Return to Asbestos Assessment
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 2 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Asbestos Assessment
          </Link>
          <Typography color="text.primary">
            {assessmentItem.sampleReference || `Item ${itemNumber}`}
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Fibre Analysis
          </Typography>
        </Box>

        {/* Analyst and Analysis Date - Same Row */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="flex-start"
          sx={{ mb: 2 }}
        >
          <FormControl sx={{ minWidth: 200 }} required error={!analyst?.trim()}>
            <InputLabel>Analyst</InputLabel>
            <Select
              value={analyst || ""}
              onChange={(e) => setAnalyst(e.target.value)}
              label="Analyst *"
              disabled={assessmentItem?.analysisData?.isAnalysed}
            >
              <MenuItem value="">
                <em>Select Analyst</em>
              </MenuItem>
              {analysts.map((analystOption) => (
                <MenuItem key={analystOption._id} value={analystOption._id}>
                  {analystOption.firstName} {analystOption.lastName}
                </MenuItem>
              ))}
            </Select>
            {!analyst?.trim() && (
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 0.5, ml: 1.5 }}
              >
                Required
              </Typography>
            )}
          </FormControl>
          <TextField
            type="date"
            label="Analysis Date"
            value={analysisDate.toISOString().split("T")[0]}
            onChange={(e) => setAnalysisDate(new Date(e.target.value))}
            disabled={assessmentItem?.analysisData?.isAnalysed}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 200 }}
          />
        </Stack>
        {analysts.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No analysts found - check lab approvals
          </Typography>
        )}

        {/* Item Selection Dropdown - only show sampled items (exclude referred and visually assessed) */}
        {assessment && assessment.items && assessment.items.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth sx={{ maxWidth: 400 }}>
              <InputLabel>Select Item</InputLabel>
              <Select
                value={parseInt(itemNumber) || 1}
                onChange={(e) => {
                  const newItemNumber = e.target.value;
                  navigate(
                    `/fibre-id/assessment/${assessmentId}/item/${newItemNumber}/analysis`,
                  );
                }}
                label="Select Item"
              >
                {assessment.items.map((item, index) => {
                  if (!isSampledItem(item)) return null;
                  return (
                    <MenuItem key={index} value={index + 1}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <Typography variant="body2">
                          {item.sampleReference || `Item ${index + 1}`}
                          {item.locationDescription &&
                            ` - ${item.locationDescription}`}
                        </Typography>
                        {item.analysisData?.isAnalysed && (
                          <Typography
                            variant="body2"
                            color="success.main"
                            sx={{ ml: 1 }}
                          >
                            (Analysed)
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      {/* Assessment Item Information Card */}
      <Paper sx={{ mb: 2, p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Assessment Item Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Sample Reference
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {assessmentItem.sampleReference || "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Material Type
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {assessmentItem.materialType || "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Analysis Date
            </Typography>
            <TextField
              fullWidth
              type="date"
              value={analysisDate.toISOString().split("T")[0]}
              onChange={(e) => setAnalysisDate(new Date(e.target.value))}
              disabled={assessmentItem?.analysisData?.isAnalysed}
              InputLabelProps={{
                shrink: true,
              }}
              size="small"
              sx={{
                "& .MuiInputBase-input.Mui-disabled": {
                  backgroundColor: "#f5f5f5",
                  color: "#666",
                },
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Sample Details */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Grid container spacing={3}>
          {/* Sample Description - Full Row (required, linked to Fibre ID Sample Descriptions custom data) */}
          <Grid item xs={12}>
            <Autocomplete
              value={sampleDescription}
              onChange={(event, newValue) =>
                setSampleDescription(newValue ?? "")
              }
              onInputChange={(event, newInputValue) =>
                setSampleDescription(newInputValue ?? "")
              }
              options={fibreIdSampleDescriptions.map((item) => item.text)}
              freeSolo
              disabled={assessmentItem?.analysisData?.isAnalysed}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sample Description"
                  required
                  error={!sampleDescription.trim()}
                  helperText={!sampleDescription.trim() ? "Required" : ""}
                  sx={{
                    "& .MuiInputBase-input.Mui-disabled": {
                      backgroundColor: "#f5f5f5",
                      color: "#666",
                    },
                  }}
                />
              )}
            />
          </Grid>

          {/* Sample Type + Mass/Dimensions + Ashing - Same Row */}
          <Grid item xs={12} md={3}>
            <FormControl component="fieldset">
              <RadioGroup
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                disabled={assessmentItem?.analysisData?.isAnalysed}
              >
                <FormControlLabel
                  value="mass"
                  control={<Radio />}
                  label="Mass (g)"
                />
                <FormControlLabel
                  value="dimensions"
                  control={<Radio />}
                  label="Dimensions (mm)"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            {sampleType === "mass" ? (
              <TextField
                fullWidth
                label="Sample Mass"
                value={sampleMass}
                onChange={(e) => setSampleMass(e.target.value)}
                disabled={assessmentItem?.analysisData?.isAnalysed}
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    backgroundColor: "#f5f5f5",
                    color: "#666",
                  },
                }}
              />
            ) : (
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="D"
                    value={sampleDimensions.x}
                    onChange={(e) =>
                      setSampleDimensions({
                        ...sampleDimensions,
                        x: e.target.value,
                      })
                    }
                    disabled={assessmentItem?.analysisData?.isAnalysed}
                    sx={{
                      "& .MuiInputBase-input.Mui-disabled": {
                        backgroundColor: "#f5f5f5",
                        color: "#666",
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="L"
                    value={sampleDimensions.y}
                    onChange={(e) =>
                      setSampleDimensions({
                        ...sampleDimensions,
                        y: e.target.value,
                      })
                    }
                    disabled={assessmentItem?.analysisData?.isAnalysed}
                    sx={{
                      "& .MuiInputBase-input.Mui-disabled": {
                        backgroundColor: "#f5f5f5",
                        color: "#666",
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="W"
                    value={sampleDimensions.z}
                    onChange={(e) =>
                      setSampleDimensions({
                        ...sampleDimensions,
                        z: e.target.value,
                      })
                    }
                    disabled={assessmentItem?.analysisData?.isAnalysed}
                    sx={{
                      "& .MuiInputBase-input.Mui-disabled": {
                        backgroundColor: "#f5f5f5",
                        color: "#666",
                      },
                    }}
                  />
                </Grid>
              </Grid>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl component="fieldset">
              <RadioGroup
                value={ashing}
                onChange={(e) => setAshing(e.target.value)}
                disabled={assessmentItem?.analysisData?.isAnalysed}
              >
                <FormControlLabel
                  value="no"
                  control={<Radio />}
                  label="Ashing NOT Required"
                />
                <FormControlLabel
                  value="yes"
                  control={<Radio />}
                  label="Ashing Required"
                />
              </RadioGroup>
            </FormControl>

            {ashing === "yes" && (
              <TextField
                label="Crucible Number"
                value={crucibleNo}
                onChange={(e) => setCrucibleNo(e.target.value)}
                disabled={assessmentItem?.analysisData?.isAnalysed}
                sx={{
                  width: "150px",
                  ml: 2,
                  "& .MuiInputBase-input.Mui-disabled": {
                    backgroundColor: "#f5f5f5",
                    color: "#666",
                  },
                }}
              />
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Analysis Process */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Analysis Process
        </Typography>

        {/* Microscope and No Fibre Detected */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={noFibreDetected}
                    onChange={(e) => setNoFibreDetected(e.target.checked)}
                    disabled={assessmentItem?.analysisData?.isAnalysed}
                  />
                }
                label="No fibres detected"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              {!noFibreDetected && (
                <FormControl fullWidth>
                  <InputLabel>Microscope</InputLabel>
                  <Select
                    value={microscope}
                    onChange={(e) => setMicroscope(e.target.value)}
                    label="Microscope"
                    disabled={assessmentItem?.analysisData?.isAnalysed}
                  >
                    <MenuItem value="LD-PLM-1">LD-PLM-1</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Fibre Analysis Box */}
      {!noFibreDetected && (
        <Paper sx={{ mb: 2, p: 3 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h6">Fibre Analysis</Typography>
              {fibres.length > 0 && (
                <Typography
                  variant="body2"
                  color={isAnalysisComplete() ? "success.main" : "warning.main"}
                  sx={{ mt: 0.5 }}
                >
                  {isAnalysisComplete()
                    ? "✓ Analysis Complete"
                    : `⚠ ${
                        fibres.filter((f) => f.result && f.result.trim() !== "")
                          .length
                      }/${fibres.length} fibres have results`}
                </Typography>
              )}
            </Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addFibre}
              disabled={
                fibres.length >= 4 || assessmentItem?.analysisData?.isAnalysed
              }
              size="small"
            >
              Add Fibre
            </Button>
          </Box>

          {fibres.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Loading fibre analysis...
            </Typography>
          ) : (
            <TableContainer sx={{ maxWidth: "fit-content" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: "170px" }}>Field</TableCell>
                    {fibres.map((fibre, index) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Typography
                              variant="subtitle2"
                              color="black"
                              fontWeight="bold"
                            >
                              {fibre.name}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                handleAsbestosMenuOpen(e, fibre.id)
                              }
                              disabled={
                                assessmentItem?.analysisData?.isAnalysed
                              }
                              sx={{
                                backgroundColor: "transparent",
                                color: "inherit",
                                width: 20,
                                height: 20,
                                "&:hover": {
                                  backgroundColor: "action.hover",
                                },
                                "&.Mui-disabled": {
                                  backgroundColor: "transparent",
                                  color: "action.disabled",
                                },
                              }}
                            />
                          </Box>
                          <Button
                            variant="outlined"
                            color="error"
                            sx={{ backgroundColor: "white" }}
                            size="small"
                            onClick={() => removeFibre(fibre.id)}
                            disabled={assessmentItem?.analysisData?.isAnalysed}
                          >
                            Remove
                          </Button>
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Morphology
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.morphology}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "morphology",
                                e.target.value,
                              )
                            }
                            size="small"
                            disabled={assessmentItem?.analysisData?.isAnalysed}
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                            }}
                          >
                            <MenuItem value="curly">Curly</MenuItem>
                            <MenuItem value="straight">Straight</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Disintegrates
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.disintegrates}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "disintegrates",
                                e.target.value,
                              )
                            }
                            size="small"
                            disabled={assessmentItem?.analysisData?.isAnalysed}
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                            }}
                          >
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        RI Liquid
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.riLiquid}
                            onChange={(e) =>
                              updateFibre(fibre.id, "riLiquid", e.target.value)
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              assessmentItem?.analysisData?.isAnalysed
                            }
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                              "& .MuiInputBase-input.Mui-disabled": {
                                backgroundColor: "#f5f5f5",
                                color: "#666",
                              },
                            }}
                          >
                            <MenuItem value="">Select RI</MenuItem>
                            <MenuItem value="1.55">1.55</MenuItem>
                            <MenuItem value="1.67">1.67</MenuItem>
                            <MenuItem value="1.70">1.70</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Colour
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.colour}
                          onChange={(e) =>
                            updateFibre(fibre.id, "colour", e.target.value)
                          }
                          disabled={
                            fibre.disintegrates === "yes" ||
                            assessmentItem?.analysisData?.isAnalysed
                          }
                          sx={{
                            "& .MuiInputBase-input": { textAlign: "left" },
                            "& .MuiInputBase-input.Mui-disabled": {
                              backgroundColor: "#f5f5f5",
                              color: "#666",
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Pleochrism
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.pleochrism || "None"}
                          onChange={(e) =>
                            updateFibre(fibre.id, "pleochrism", e.target.value)
                          }
                          disabled={
                            fibre.disintegrates === "yes" ||
                            assessmentItem?.analysisData?.isAnalysed
                          }
                          placeholder="None"
                          sx={{
                            "& .MuiInputBase-input": { textAlign: "left" },
                            "& .MuiInputBase-input.Mui-disabled": {
                              backgroundColor: "#f5f5f5",
                              color: "#666",
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Birefringence
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.birefringence}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "birefringence",
                                e.target.value,
                              )
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              assessmentItem?.analysisData?.isAnalysed
                            }
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                              "& .MuiInputBase-input.Mui-disabled": {
                                backgroundColor: "#f5f5f5",
                                color: "#666",
                              },
                            }}
                          >
                            <MenuItem value="">Select Birefringence</MenuItem>
                            <MenuItem value="low">Low</MenuItem>
                            <MenuItem value="moderate">Moderate</MenuItem>
                            <MenuItem value="none">None</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Extinction
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.extinction}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "extinction",
                                e.target.value,
                              )
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              assessmentItem?.analysisData?.isAnalysed
                            }
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                              "& .MuiInputBase-input.Mui-disabled": {
                                backgroundColor: "#f5f5f5",
                                color: "#666",
                              },
                            }}
                          >
                            <MenuItem value="">Select Extinction</MenuItem>
                            <MenuItem value="complete">Complete</MenuItem>
                            <MenuItem value="partial">Partial</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Sign of Elongation
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.signOfElongation}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "signOfElongation",
                                e.target.value,
                              )
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              assessmentItem?.analysisData?.isAnalysed
                            }
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                              "& .MuiInputBase-input.Mui-disabled": {
                                backgroundColor: "#f5f5f5",
                                color: "#666",
                              },
                            }}
                          >
                            <MenuItem value="">
                              Select Sign of Elongation
                            </MenuItem>
                            <MenuItem value="Length-slow">Length-slow</MenuItem>
                            <MenuItem value="Length-fast">Length-fast</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Fibre Parallel
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.fibreParallel}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "fibreParallel",
                              e.target.value,
                            )
                          }
                          disabled={
                            fibre.disintegrates === "yes" ||
                            assessmentItem?.analysisData?.isAnalysed
                          }
                          sx={{
                            "& .MuiInputBase-input": { textAlign: "left" },
                            "& .MuiInputBase-input.Mui-disabled": {
                              backgroundColor: "#f5f5f5",
                              color: "#666",
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Fibre Perpendicular
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.fibrePerpendicular}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "fibrePerpendicular",
                              e.target.value,
                            )
                          }
                          disabled={
                            fibre.disintegrates === "yes" ||
                            assessmentItem?.analysisData?.isAnalysed
                          }
                          sx={{
                            "& .MuiInputBase-input": { textAlign: "left" },
                            "& .MuiInputBase-input.Mui-disabled": {
                              backgroundColor: "#f5f5f5",
                              color: "#666",
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ width: "170px" }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Result
                      </Typography>
                    </TableCell>
                    {fibres.map((fibre) => (
                      <TableCell
                        key={fibre.id}
                        align="left"
                        sx={{ width: "230px" }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.result}
                            onChange={(e) =>
                              updateFibre(fibre.id, "result", e.target.value)
                            }
                            size="small"
                            placeholder="Select Result"
                            disabled={assessmentItem?.analysisData?.isAnalysed}
                            sx={{
                              "& .MuiSelect-select": { textAlign: "left" },
                            }}
                          >
                            <MenuItem value="">Select Result</MenuItem>
                            <MenuItem value="Chrysotile Asbestos">
                              Chrysotile Asbestos
                            </MenuItem>
                            <MenuItem value="Amosite Asbestos">
                              Amosite Asbestos
                            </MenuItem>
                            <MenuItem value="Crocidolite Asbestos">
                              Crocidolite Asbestos
                            </MenuItem>
                            <MenuItem value="UMF">
                              Unidentified Mineral Fibre
                            </MenuItem>
                            <MenuItem value="Organic fibres">
                              Organic fibres
                            </MenuItem>
                            <MenuItem value="SMF">
                              Synthetic Mineral Fibre
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Trace Analysis Box */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Trace Analysis (2 slides)
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Trace asbestos identified?
              </Typography>
              <RadioGroup
                value={traceAsbestos}
                onChange={(e) => {
                  setTraceAsbestos(e.target.value);
                  if (e.target.value === "no") {
                    setTraceAsbestosContent("");
                    setTraceCount("");
                  }
                }}
                row
                disabled={assessmentItem?.analysisData?.isAnalysed}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </FormControl>
          </Grid>
          {traceAsbestos === "yes" && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Trace Fibre 1
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Asbestos Content</InputLabel>
                    <Select
                      value={traceAsbestosContent}
                      onChange={(e) => setTraceAsbestosContent(e.target.value)}
                      label="Asbestos Content"
                      disabled={assessmentItem?.analysisData?.isAnalysed}
                    >
                      <MenuItem value="Chrysotile Asbestos">
                        Chrysotile Asbestos
                      </MenuItem>
                      <MenuItem value="Amosite Asbestos">
                        Amosite Asbestos
                      </MenuItem>
                      <MenuItem value="Crocidolite Asbestos">
                        Crocidolite Asbestos
                      </MenuItem>
                      <MenuItem value="Unidentified Mineral Fibre">
                        Unidentified Mineral Fibre
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={8}>
                  <FormControl component="fieldset">
                    <RadioGroup
                      value={traceCount}
                      onChange={(e) => setTraceCount(e.target.value)}
                      row
                      disabled={assessmentItem?.analysisData?.isAnalysed}
                    >
                      <FormControlLabel
                        value="< 5 unequivocal"
                        control={<Radio />}
                        label="< 5 unequivocal"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontSize: "0.875rem",
                          },
                        }}
                      />
                      <FormControlLabel
                        value="5-19 unequivocal"
                        control={<Radio />}
                        label="5-19 unequivocal"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontSize: "0.875rem",
                          },
                        }}
                      />
                      <FormControlLabel
                        value="20+ unequivocal <100 visible"
                        control={<Radio />}
                        label="20+ unequivocal <100 visible"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontSize: "0.875rem",
                          },
                        }}
                      />
                      <FormControlLabel
                        value="100+ visible"
                        control={<Radio />}
                        label="100+ visible"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontSize: "0.875rem",
                          },
                        }}
                      />
                    </RadioGroup>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Comments Box */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Comments
        </Typography>
        <TextField
          fullWidth
          label="Sample Comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          multiline
          rows={4}
          placeholder="Enter any additional comments or notes about this sample..."
          disabled={assessmentItem?.analysisData?.isAnalysed}
          sx={{
            "& .MuiInputBase-input.Mui-disabled": {
              backgroundColor: "#f5f5f5",
              color: "#666",
            },
          }}
        />
      </Paper>

      {/* Final Result Box */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Final Result
        </Typography>
        <TextField
          fullWidth
          label="Final Analysis Result"
          value={finalResult}
          onChange={(e) => setFinalResult(e.target.value)}
          multiline
          rows={3}
          placeholder={
            noFibreDetected
              ? "No asbestos detected"
              : traceAsbestos === "yes" && traceCount && traceAsbestosContent
                ? "Automatically calculated from trace analysis"
                : "Summary of all fibre analysis results"
          }
          disabled={
            noFibreDetected ||
            assessmentItem?.analysisData?.isAnalysed ||
            (traceAsbestos === "yes" && traceCount && traceAsbestosContent)
          }
          sx={{
            "& .MuiInputBase-input.Mui-disabled": {
              backgroundColor: "#f5f5f5",
              color: "#666",
            },
          }}
        />
      </Paper>

      {/* Action Buttons */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {assessmentItem?.analysisData?.isAnalysed && (
          <Button
            variant="outlined"
            color="error"
            onClick={handleEditAnalysis}
            size="large"
          >
            Edit Analysis
          </Button>
        )}

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveAnalysis}
            size="large"
          >
            Save Analysis
          </Button>

          <Button
            variant="contained"
            onClick={handleFinaliseAnalysis}
            size="large"
            disabled={
              !areAllItemsAnalysed() ||
              ((assessment?.status === "sample-analysis-complete" ||
                assessment?.labSamplesStatus === "analysis-complete") &&
                !hasSampleBeenEditedSinceFinalise)
            }
            sx={{
              backgroundColor: "#3C4EC3",
              color: "#fff",
              "&:hover": {
                backgroundColor: "#2d3a9e",
              },
              "&.Mui-disabled": {
                backgroundColor: "rgba(0, 0, 0, 0.12)",
                color: "rgba(0, 0, 0, 0.26)",
              },
            }}
          >
            Finalise Analysis
          </Button>
        </Box>
      </Box>

      {/* Asbestos Preset Menu */}
      <Menu
        anchorEl={asbestosMenuAnchor}
        open={Boolean(asbestosMenuAnchor)}
        onClose={handleAsbestosMenuClose}
      >
        <MenuItem onClick={() => applyAsbestosPreset("Chrysotile")}>
          Chrysotile Asbestos
        </MenuItem>
        <MenuItem onClick={() => applyAsbestosPreset("Amosite")}>
          Amosite Asbestos
        </MenuItem>
        <MenuItem onClick={() => applyAsbestosPreset("Crocidolite")}>
          Crocidolite Asbestos
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default LDsuppliedAnalysisPage;
