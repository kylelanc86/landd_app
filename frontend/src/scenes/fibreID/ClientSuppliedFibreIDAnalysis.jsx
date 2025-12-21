import React, { useState, useEffect } from "react";
import { useSnackbar } from "../../context/SnackbarContext";
import {
  Box,
  Typography,
  Container,
  Paper,
  Breadcrumbs,
  Link,
  Grid,
  TextField,
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
  Checkbox,
  Stack,
  Menu,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { clientSuppliedJobsService, userService } from "../../services/api";

const ClientSuppliedFibreIDAnalysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId, sampleIndex } = useParams();
  const [job, setJob] = useState(null);
  const [sample, setSample] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobStatus, setJobStatus] = useState("");

  console.log("ClientSuppliedFibreIDAnalysis component mounted", {
    jobId,
    sampleIndex,
    pathname: location.pathname,
  });

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
  const [analysisDate, setAnalysisDate] = useState(new Date());
  const [analysts, setAnalysts] = useState([]);
  const [analyst, setAnalyst] = useState("");
  const { showSnackbar } = useSnackbar();
  const [asbestosMenuAnchor, setAsbestosMenuAnchor] = useState(null);
  const [selectedFibreId, setSelectedFibreId] = useState(null);

  // Unsaved changes detection
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [originalState, setOriginalState] = useState(null);

  useEffect(() => {
    if (jobId && sampleIndex !== undefined && sampleIndex !== null) {
      fetchJobAndSampleDetails();
    }
    fetchAnalysts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, sampleIndex]);

  useEffect(() => {
    // Ensure there's always at least one fibre when the component loads
    if (!noFibreDetected && fibres.length === 0) {
      ensureOneFibre();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noFibreDetected, fibres.length]);

  const fetchAnalysts = async () => {
    try {
      const response = await userService.getAll(true); // Get all users including inactive
      const fibreIdentificationAnalysts = response.data.filter(
        (user) => user.labApprovals?.fibreIdentification === true
      );
      setAnalysts(fibreIdentificationAnalysts);
    } catch (error) {
      console.error("Error fetching analysts:", error);
    }
  };

  const fetchJobAndSampleDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(
        "Fetching job and sample details for ID:",
        jobId,
        "Sample Index:",
        sampleIndex
      );

      const response = await clientSuppliedJobsService.getById(jobId);
      console.log("Job response:", response);

      if (!response || !response.data) {
        throw new Error("Invalid response format from server");
      }

      const jobData = response.data;
      setJob(jobData);
      setJobStatus(jobData.status || "In Progress");

      // Find the specific sample by index
      const samples = jobData.samples || [];
      if (samples.length === 0) {
        throw new Error(
          "No samples found in this job. Please add samples first."
        );
      }
      const sampleIdx = parseInt(sampleIndex);
      if (isNaN(sampleIdx) || sampleIdx < 0 || sampleIdx >= samples.length) {
        throw new Error(
          `Sample at index ${sampleIndex} not found. Please check the sample index.`
        );
      }

      const sampleData = samples[sampleIdx];
      setSample({ ...sampleData, _index: sampleIdx });

      // Load saved analysis data if it exists
      if (
        sampleData.analysisData &&
        Object.keys(sampleData.analysisData).length > 0
      ) {
        const savedData = sampleData.analysisData;
        console.log("Loading saved analysis data:", savedData);

        // Check if this was saved as "no fibres detected"
        const wasNoFibreDetected =
          savedData.finalResult === "No fibres detected" ||
          (savedData.fibres && savedData.fibres.length === 0);

        setNoFibreDetected(wasNoFibreDetected);

        // Populate form fields with saved data
        setMicroscope(savedData.microscope || "LD-PLM-1");
        setSampleDescription(savedData.sampleDescription || "");
        setSampleType(savedData.sampleType || "mass");
        setSampleMass(savedData.sampleMass || "");
        setSampleDimensions(
          savedData.sampleDimensions || { x: "", y: "", z: "" }
        );
        setAshing(savedData.ashing || "no");
        setCrucibleNo(savedData.crucibleNo || "");
        setFibres(savedData.fibres || []);
        setFinalResult(savedData.finalResult || "");
        setAnalysisDate(
          savedData.analyzedAt ? new Date(savedData.analyzedAt) : new Date()
        );

        // Load analyst if available
        if (sampleData.analyzedBy) {
          if (
            typeof sampleData.analyzedBy === "object" &&
            sampleData.analyzedBy._id
          ) {
            setAnalyst(sampleData.analyzedBy._id);
          } else if (typeof sampleData.analyzedBy === "string") {
            setAnalyst(sampleData.analyzedBy);
          }
        }

        // Set original state for change tracking after data is loaded
        setTimeout(() => {
          setOriginalState({
            microscope: savedData?.microscope || "LD-PLM-1",
            sampleDescription: savedData?.sampleDescription || "",
            sampleType: savedData?.sampleType || "mass",
            sampleMass: savedData?.sampleMass || "",
            sampleDimensions: savedData?.sampleDimensions || {
              x: "",
              y: "",
              z: "",
            },
            ashing: savedData?.ashing || "no",
            crucibleNo: savedData?.crucibleNo || "",
            fibres: savedData?.fibres || [],
            finalResult: savedData?.finalResult || "",
            noFibreDetected: wasNoFibreDetected,
            analysisDate: savedData?.analyzedAt
              ? new Date(savedData.analyzedAt)
              : new Date(),
            analyst: sampleData.analyzedBy
              ? typeof sampleData.analyzedBy === "object" &&
                sampleData.analyzedBy._id
                ? sampleData.analyzedBy._id
                : typeof sampleData.analyzedBy === "string"
                ? sampleData.analyzedBy
                : ""
              : "",
          });
        }, 100);
      } else {
        // Reset all form fields for new analysis
        setNoFibreDetected(false);
        setMicroscope("LD-PLM-1");
        setSampleDescription("");
        setSampleType("mass");
        setSampleMass("");
        setSampleDimensions({ x: "", y: "", z: "" });
        setAshing("no");
        setCrucibleNo("");
        setFibres([]);
        setFinalResult("");
        setAnalysisDate(new Date());

        // Set default analyst if available
        if (analysts.length > 0 && !analyst) {
          setAnalyst(analysts[0]._id);
        }

        // For new analysis, set original state as empty
        setTimeout(() => {
          setOriginalState({
            microscope: "LD-PLM-1",
            sampleDescription: "",
            sampleType: "mass",
            sampleMass: "",
            sampleDimensions: { x: "", y: "", z: "" },
            ashing: "no",
            crucibleNo: "",
            fibres: [],
            finalResult: "",
            noFibreDetected: false,
            analysisDate: new Date(),
            analyst: analysts.length > 0 ? analysts[0]._id : "",
          });
        }, 100);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching job and sample details:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        stack: error.stack,
      });

      // Handle specific error cases
      if (error.response?.status === 404) {
        console.error("Job or sample not found");
        setError("Job or sample not found. Please check the URL.");
      } else if (error.response?.status === 500) {
        console.error("Server error while fetching job");
        setError("Server error while fetching job data.");
      } else {
        setError(error.message || "Failed to fetch job and sample details");
      }

      // Set job and sample to null to prevent further errors
      setJob(null);
      setSample(null);
      setLoading(false);
    }
  };

  const handleBackToSamples = () => {
    if (hasUnsavedChanges) {
      const basePath = location.pathname.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id/client-supplied";
      setPendingNavigation(`${basePath}/${jobId}/samples`);
      setUnsavedChangesDialogOpen(true);
    } else {
      const basePath = location.pathname.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id/client-supplied";
      navigate(`${basePath}/${jobId}/samples`);
    }
  };

  const handleBackToHome = () => {
    if (hasUnsavedChanges) {
      const targetPath = location.pathname.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id";
      setPendingNavigation(targetPath);
      setUnsavedChangesDialogOpen(true);
    } else {
      if (location.pathname.startsWith("/client-supplied")) {
        navigate("/client-supplied");
      } else {
        navigate("/fibre-id");
      }
    }
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
      })
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

  const applyAsbestosPreset = (asbestosType) => {
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

    const preset = presets[asbestosType];
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
      })
    );

    handleAsbestosMenuClose();
    showSnackbar(`${asbestosType} preset applied successfully!`, "success");
  };

  const calculateFinalResult = () => {
    if (fibres.length === 0) {
      return "No fibres Detected";
    }

    // Get all unique fibre results
    const uniqueResults = [
      ...new Set(
        fibres.map((fibre) => fibre.result).filter((result) => result)
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

  const isSampleAnalyzed = () => {
    return sample?.analysisData?.isAnalyzed === true;
  };

  const areAllSamplesAnalyzed = () => {
    if (!job || !job.samples || job.samples.length === 0) {
      return false;
    }
    // Check if all samples have been analyzed (isAnalyzed === true)
    return job.samples.every(
      (s) => s.analysisData && s.analysisData.isAnalyzed === true
    );
  };

  const handleFinaliseAnalysis = async () => {
    try {
      console.log("Finalising analysis for job:", jobId);

      // Validate mass/dimensions first
      if (!isMassDimensionsValid()) {
        const fieldName =
          sampleType === "mass" ? "Sample Mass" : "Sample Dimensions";
        showSnackbar(
          `${fieldName} is required. Please enter a value before finalising.`,
          "warning"
        );
        return;
      }

      // Ensure current sample analysis is saved first
      const analysisComplete = isAnalysisComplete();

      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions:
          sampleType === "dimensions" ? { ...sampleDimensions } : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres: noFibreDetected ? [] : fibres.map((fibre) => ({ ...fibre })), // Deep copy fibres array
        finalResult: noFibreDetected ? "No fibres detected" : finalResult,
        isAnalyzed: analysisComplete,
        analyzedAt: analysisDate,
      };

      // Get analyst user object if analyst is selected
      let analystUser = null;
      if (analyst) {
        analystUser = analysts.find((a) => a._id === analyst);
      }

      // Update the sample in the job's samples array - create deep copy to avoid reference sharing
      const updatedSamples = (job.samples || []).map((s, idx) => {
        if (idx === sample._index) {
          // Update the specific sample with new analysis data
          return {
            ...s,
            analysisData, // This is already a new object with deep copied nested data
            analyzedBy: analystUser || s.analyzedBy,
            analyzedAt: analysisDate,
          };
        }
        // Return a copy of other samples to avoid reference sharing
        return { ...s };
      });

      // Update the job with Analysis Complete status
      const response = await clientSuppliedJobsService.update(jobId, {
        samples: updatedSamples,
        status: "Analysis Complete",
        analysisDate: analysisDate ? new Date(analysisDate) : new Date(),
      });

      console.log("Analysis finalised successfully:", response);

      // Update local state
      setJobStatus("Analysis Complete");
      setJob((prev) => ({
        ...prev,
        status: "Analysis Complete",
        samples: updatedSamples,
      }));
      setSample((prev) => ({
        ...prev,
        analysisData: {
          ...prev.analysisData,
          ...analysisData,
        },
      }));

      showSnackbar("Analysis finalised successfully!", "success");

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);

      // Navigate back to samples page
      navigate(
        location.pathname.startsWith("/client-supplied")
          ? `/client-supplied`
          : `/fibre-id/client-supplied`
      );
    } catch (error) {
      console.error("Error finalising analysis:", error);
      console.error("Error details:", error.response?.data);
      showSnackbar(`Error finalising analysis: ${error.message}`, "error");
    }
  };

  const handleSaveAnalysis = async () => {
    try {
      console.log("Starting to save analysis...");

      // Validate mass/dimensions
      if (!isMassDimensionsValid()) {
        const fieldName =
          sampleType === "mass" ? "Sample Mass" : "Sample Dimensions";
        showSnackbar(
          `${fieldName} is required. Please enter a value before saving.`,
          "warning"
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
        sampleDimensions:
          sampleType === "dimensions" ? { ...sampleDimensions } : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres: noFibreDetected ? [] : fibres.map((fibre) => ({ ...fibre })), // Deep copy fibres array
        finalResult: noFibreDetected ? "No fibres detected" : finalResult,
        isAnalyzed: analysisComplete,
        analyzedAt: analysisDate,
      };

      // Get analyst user object if analyst is selected
      let analystUser = null;
      if (analyst) {
        analystUser = analysts.find((a) => a._id === analyst);
      }

      // Update the sample in the job's samples array - create deep copy to avoid reference sharing
      const updatedSamples = (job.samples || []).map((s, idx) => {
        if (idx === sample._index) {
          // Update the specific sample with new analysis data
          return {
            ...s,
            analysisData, // This is already a new object with deep copied nested data
            analyzedBy: analystUser || s.analyzedBy,
            analyzedAt: analysisDate,
          };
        }
        // Return a copy of other samples to avoid reference sharing
        return { ...s };
      });

      // If job was finalized, revert status back to "In Progress" when changes are made
      const wasFinalized = jobStatus === "Analysis Complete";
      const wasApproved = job.reportApprovedBy;
      const newStatus = wasFinalized ? "In Progress" : job.status;

      // Update the job with the updated samples array
      // If report was approved, clear approval fields since analysis has been edited
      const updateData = {
        samples: updatedSamples,
        status: newStatus,
      };

      if (wasApproved) {
        updateData.reportApprovedBy = null;
        updateData.reportIssueDate = null;
      }

      const response = await clientSuppliedJobsService.update(
        jobId,
        updateData
      );

      console.log("Analysis saved successfully:", response);

      // Refresh job data to ensure we have the latest state
      await fetchJobAndSampleDetails();

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);
      setOriginalState({
        microscope,
        sampleDescription,
        sampleType,
        sampleMass,
        sampleDimensions,
        ashing,
        crucibleNo,
        fibres: fibres.map((f) => ({ ...f })),
        finalResult,
        noFibreDetected,
        analysisDate,
        analyst,
      });

      // Show success message
      showSnackbar("Analysis saved successfully!", "success");
    } catch (error) {
      console.error("Error saving analysis:", error);
      console.error("Error details:", error.response?.data);
      showSnackbar(`Error saving analysis: ${error.message}`, "error");
    }
  };

  const handleMarkAsAnalyzed = async () => {
    try {
      console.log("Marking sample as analysed...");

      // Validate mass/dimensions first
      if (!isMassDimensionsValid()) {
        const fieldName =
          sampleType === "mass" ? "Sample Mass" : "Sample Dimensions";
        showSnackbar(
          `${fieldName} is required. Please enter a value before marking as analysed.`,
          "warning"
        );
        return;
      }

      // Check if analysis is complete (all fibres have results or no fibres detected)
      const analysisComplete = isAnalysisComplete();

      if (!analysisComplete) {
        showSnackbar(
          "Cannot mark as analysed: All fibres must have results first.",
          "warning"
        );
        return;
      }

      // Create analysis data with current form values
      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions:
          sampleType === "dimensions" ? { ...sampleDimensions } : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres: noFibreDetected ? [] : fibres.map((fibre) => ({ ...fibre })), // Deep copy fibres array
        finalResult: noFibreDetected ? "No fibres detected" : finalResult,
        isAnalyzed: true,
        analyzedAt: analysisDate,
      };

      // Get analyst user object if analyst is selected
      let analystUser = null;
      if (analyst) {
        analystUser = analysts.find((a) => a._id === analyst);
      }

      // Update the sample in the job's samples array - create deep copy to avoid reference sharing
      const updatedSamples = (job.samples || []).map((s, idx) => {
        if (idx === sample._index) {
          // Update the specific sample with new analysis data
          return {
            ...s,
            analysisData, // This is already a new object with deep copied nested data
            analyzedBy: analystUser || s.analyzedBy,
            analyzedAt: analysisDate,
          };
        }
        // Return a copy of other samples to avoid reference sharing
        return { ...s };
      });

      // If job was finalized, revert status back to "In Progress" when changes are made
      const wasFinalized = jobStatus === "Analysis Complete";
      const wasApproved = job.reportApprovedBy;
      const newStatus = wasFinalized ? "In Progress" : job.status;

      // Update the job with the updated samples array
      // If report was approved, clear approval fields since analysis has been edited
      const updateData = {
        samples: updatedSamples,
        status: newStatus,
      };

      if (wasApproved) {
        updateData.reportApprovedBy = null;
        updateData.reportIssueDate = null;
      }

      const response = await clientSuppliedJobsService.update(
        jobId,
        updateData
      );

      console.log("Sample marked as analysed successfully:", response);

      // Refresh job data to ensure we have the latest state
      await fetchJobAndSampleDetails();

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);
      setOriginalState({
        microscope,
        sampleDescription,
        sampleType,
        sampleMass,
        sampleDimensions,
        ashing,
        crucibleNo,
        fibres: fibres.map((f) => ({ ...f })),
        finalResult,
        noFibreDetected,
        analysisDate,
        analyst,
      });

      showSnackbar("Sample marked as analysed successfully!", "success");
    } catch (error) {
      console.error("Error marking sample as analysed:", error);
      console.error("Error details:", error.response?.data);
      showSnackbar(
        `Error marking sample as analysed: ${error.message}`,
        "error"
      );
    }
  };

  const handleEditAnalysis = async () => {
    try {
      console.log("Setting sample to editable mode...");

      // Create analysis data with current form values but set isAnalyzed to false
      const analysisData = {
        microscope: noFibreDetected ? "N/A" : microscope,
        sampleDescription,
        sampleType,
        sampleMass: sampleType === "mass" ? sampleMass : null,
        sampleDimensions:
          sampleType === "dimensions" ? { ...sampleDimensions } : null,
        ashing,
        crucibleNo: ashing === "yes" ? crucibleNo : null,
        fibres: noFibreDetected ? [] : fibres.map((fibre) => ({ ...fibre })), // Deep copy fibres array
        finalResult: noFibreDetected ? "No fibres detected" : finalResult,
        isAnalyzed: false,
        analyzedAt: null,
      };

      // Get analyst user object if analyst is selected
      let analystUser = null;
      if (analyst) {
        analystUser = analysts.find((a) => a._id === analyst);
      }

      // Update the sample in the job's samples array - create deep copy to avoid reference sharing
      const updatedSamples = (job.samples || []).map((s, idx) => {
        if (idx === sample._index) {
          // Update the specific sample with new analysis data
          return {
            ...s,
            analysisData, // This is already a new object with deep copied nested data
            analyzedBy: analystUser || s.analyzedBy,
            analyzedAt: null,
          };
        }
        // Return a copy of other samples to avoid reference sharing
        return { ...s };
      });

      // If job was finalized, revert status back to "In Progress" when changes are made
      const wasFinalized = jobStatus === "Analysis Complete";
      const wasApproved = job.reportApprovedBy;
      const newStatus = wasFinalized ? "In Progress" : job.status;

      // Update the job with the updated samples array
      // If report was approved, clear approval fields since analysis has been edited
      const updateData = {
        samples: updatedSamples,
        status: newStatus,
      };

      if (wasApproved) {
        updateData.reportApprovedBy = null;
        updateData.reportIssueDate = null;
      }

      const response = await clientSuppliedJobsService.update(
        jobId,
        updateData
      );

      console.log("Sample set to editable mode successfully:", response);

      // Refresh job data to ensure we have the latest state
      await fetchJobAndSampleDetails();

      showSnackbar("Analysis is now editable!", "success");
    } catch (error) {
      console.error("Error setting sample to editable mode:", error);
      console.error("Error details:", error.response?.data);
      showSnackbar(
        `Error setting sample to editable mode: ${error.message}`,
        "error"
      );
    }
  };

  useEffect(() => {
    setFinalResult(calculateFinalResult());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fibres]);

  // Track form changes and compare with original values
  useEffect(() => {
    if (!originalState) return;

    const currentState = {
      microscope,
      sampleDescription,
      sampleType,
      sampleMass,
      sampleDimensions,
      ashing,
      crucibleNo,
      fibres: fibres.map((f) => ({ ...f })),
      finalResult,
      noFibreDetected,
      analysisDate,
      analyst,
    };

    const hasChanges =
      JSON.stringify(currentState) !== JSON.stringify(originalState);

    setHasUnsavedChanges(hasChanges);

    // Set global variables for sidebar navigation
    window.hasUnsavedChanges = hasChanges;
    window.currentAnalysisPath = window.location.pathname;
    window.showUnsavedChangesDialog = () => {
      setPendingNavigation(null);
      setUnsavedChangesDialogOpen(true);
    };

    return () => {
      // Clean up global variables when component unmounts or changes are cleared
      if (!hasChanges) {
        window.hasUnsavedChanges = false;
        window.currentAnalysisPath = null;
        window.showUnsavedChangesDialog = null;
      }
    };
  }, [
    microscope,
    sampleDescription,
    sampleType,
    sampleMass,
    sampleDimensions,
    ashing,
    crucibleNo,
    fibres,
    finalResult,
    noFibreDetected,
    analysisDate,
    analyst,
    originalState,
  ]);

  // Handle page refresh and browser navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    // Handle browser back/forward buttons
    const handlePopState = (e) => {
      if (hasUnsavedChanges) {
        window.history.pushState(null, "", window.location.pathname);
        setPendingNavigation(null);
        setUnsavedChangesDialogOpen(true);
      }
    };

    // Handle refresh button clicks and F5 key
    const handleRefreshClick = (e) => {
      const isRefreshButton = e.target.closest(
        'button[aria-label*="refresh"], button[title*="refresh"], .refresh-button'
      );
      const isF5Key = e.key === "F5";

      if ((isRefreshButton || isF5Key) && hasUnsavedChanges) {
        e.preventDefault();
        e.stopPropagation();
        setRefreshDialogOpen(true);
        return false;
      }
    };

    if (hasUnsavedChanges) {
      window.history.pushState(null, "", window.location.pathname);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleRefreshClick, true);
    document.addEventListener("keydown", handleRefreshClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleRefreshClick, true);
      document.removeEventListener("keydown", handleRefreshClick, true);
    };
  }, [hasUnsavedChanges]);

  // Intercept clicks on navigation links
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleLinkClick = (e) => {
      const target = e.target.closest("a[href]");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;

      const currentPath = window.location.pathname;
      const basePath = currentPath.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id/client-supplied";

      if (href.startsWith("/") && !href.startsWith(basePath)) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigation(href);
        setUnsavedChangesDialogOpen(true);
        return false;
      }
    };

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

  // Confirm navigation and discard changes
  const confirmNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setHasUnsavedChanges(false);

    // Clear window variables
    window.hasUnsavedChanges = false;
    window.currentAnalysisPath = null;
    window.showUnsavedChangesDialog = null;

    // Get the target path before clearing pendingNavigation
    const targetPath = pendingNavigation;
    setPendingNavigation(null);

    // Use setTimeout to ensure state updates complete before navigation
    setTimeout(() => {
      if (targetPath) {
        navigate(targetPath);
      } else if (window.pendingNavigation) {
        // Handle sidebar navigation
        navigate(window.pendingNavigation);
        window.pendingNavigation = null;
      }
    }, 0);
  };

  // Cancel navigation and stay on page
  const cancelNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setPendingNavigation(null);
  };

  // Confirm page refresh and discard changes
  const confirmRefresh = () => {
    setRefreshDialogOpen(false);
    setHasUnsavedChanges(false);
    window.location.reload();
  };

  // Cancel page refresh and stay on page
  const cancelRefresh = () => {
    setRefreshDialogOpen(false);
  };

  useEffect(() => {
    if (noFibreDetected) {
      setMicroscope("N/A");
      setFinalResult("No fibres detected");
    } else {
      // Ensure there's always at least one fibre when analysis is active
      ensureOneFibre();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noFibreDetected]);

  // Debug: Always log render state
  console.log("ClientSuppliedFibreIDAnalysis render state:", {
    loading,
    error,
    hasJob: !!job,
    hasSample: !!sample,
    jobId,
    sampleIndex,
  });

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center">
            Loading job and sample details...
          </Typography>
          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ mt: 2 }}
          >
            Job ID: {jobId}, Sample Index: {sampleIndex}
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !job || !sample) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            {error || "Job or sample not found"}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              if (location.pathname.startsWith("/client-supplied")) {
                navigate("/client-supplied");
              } else {
                navigate("/fibre-id");
              }
            }}
            sx={{ mt: 2, display: "block", mx: "auto" }}
          >
            Return to Fibre ID Home
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
            Fibre ID Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToSamples}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Sample Items
          </Link>
          <Typography color="text.primary">{sample.labReference}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Fibre Analysis
          </Typography>
          {job &&
            job.samples &&
            (() => {
              const analyzedCount = job.samples.filter(
                (s) => s.analysisData && s.analysisData.isAnalyzed === true
              ).length;
              const totalCount = job.samples.length;
              const color =
                analyzedCount === totalCount ? "success.main" : "error.main";
              return (
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    fontWeight: "bold",
                    color: color,
                  }}
                >
                  {analyzedCount} of {totalCount} samples analysed
                </Typography>
              );
            })()}
        </Box>

        {/* Analyst and Analysis Date - Same Row */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="flex-start"
          sx={{ mb: 2 }}
        >
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Analyst</InputLabel>
            <Select
              value={analyst}
              onChange={(e) => setAnalyst(e.target.value)}
              label="Analyst"
              disabled={isSampleAnalyzed()}
            >
              {analysts.map((analystOption) => (
                <MenuItem key={analystOption._id} value={analystOption._id}>
                  {analystOption.firstName} {analystOption.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="date"
            label="Analysis Date"
            value={analysisDate.toISOString().split("T")[0]}
            onChange={(e) => setAnalysisDate(new Date(e.target.value))}
            disabled={isSampleAnalyzed()}
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

        {/* Sample Selection Dropdown */}
        {job && job.samples && job.samples.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth sx={{ maxWidth: 400 }}>
              <InputLabel>Select Sample</InputLabel>
              <Select
                value={parseInt(sampleIndex) || 0}
                onChange={(e) => {
                  const newIndex = e.target.value;
                  const basePath = location.pathname.startsWith(
                    "/client-supplied"
                  )
                    ? "/client-supplied"
                    : "/fibre-id/client-supplied";
                  navigate(`${basePath}/${jobId}/sample/${newIndex}/analysis`);
                }}
                label="Select Sample"
              >
                {job.samples.map((sampleItem, index) => (
                  <MenuItem key={index} value={index}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <Typography variant="body2">
                        {sampleItem.labReference || `Sample ${index + 1}`}
                        {sampleItem.clientReference &&
                          ` - ${sampleItem.clientReference}`}
                      </Typography>
                      {sampleItem.analysisData?.isAnalyzed && (
                        <Typography
                          variant="body2"
                          color="success.main"
                          sx={{ ml: 1 }}
                        >
                          (Analyzed)
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      {/* Sample Information Card */}
      <Paper sx={{ mb: 2, p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Sample Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Lab Reference
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {sample.labReference || "N/A"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Client Reference
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "medium" }}>
              {sample.clientReference || "N/A"}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Sample Details */}
      <Paper sx={{ mb: 2, p: 3 }}>
        <Grid container spacing={3}>
          {/* Sample Description - Full Row */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Sample Description"
              value={sampleDescription}
              onChange={(e) => setSampleDescription(e.target.value)}
              disabled={isSampleAnalyzed()}
              sx={{
                "& .MuiInputBase-input.Mui-disabled": {
                  backgroundColor: "#f5f5f5",
                  color: "#666",
                },
              }}
            />
          </Grid>

          {/* Sample Type + Mass/Dimensions + Ashing - Same Row */}
          <Grid item xs={12} md={3}>
            <FormControl component="fieldset">
              <RadioGroup
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                disabled={isSampleAnalyzed()}
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
                required
                label="Sample Mass"
                value={sampleMass}
                onChange={(e) => setSampleMass(e.target.value)}
                disabled={isSampleAnalyzed()}
                error={!isSampleAnalyzed() && !sampleMass}
                helperText={
                  !isSampleAnalyzed() && !sampleMass ? "Required" : ""
                }
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
                    disabled={isSampleAnalyzed()}
                    error={
                      !isSampleAnalyzed() &&
                      !sampleDimensions.x &&
                      !sampleDimensions.y &&
                      !sampleDimensions.z
                    }
                    helperText={
                      !isSampleAnalyzed() &&
                      !sampleDimensions.x &&
                      !sampleDimensions.y &&
                      !sampleDimensions.z
                        ? "Required"
                        : ""
                    }
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
                    disabled={isSampleAnalyzed()}
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
                    disabled={isSampleAnalyzed()}
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
                disabled={isSampleAnalyzed()}
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
                disabled={isSampleAnalyzed()}
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
                    disabled={isSampleAnalyzed()}
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
                    disabled={isSampleAnalyzed()}
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
              disabled={fibres.length >= 4 || isSampleAnalyzed()}
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
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
                              disabled={isSampleAnalyzed()}
                              sx={{
                                backgroundColor: "transparent",
                                color: "transparent",
                                width: 20,
                                height: 20,
                                "&:hover": {
                                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                                },
                                "&.Mui-disabled": {
                                  backgroundColor: "transparent",
                                  color: "#ccc",
                                },
                              }}
                            >
                              <AddIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                          <Button
                            variant="outlined"
                            color="error"
                            sx={{ backgroundColor: "white" }}
                            size="small"
                            onClick={() => removeFibre(fibre.id)}
                            disabled={isSampleAnalyzed()}
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.morphology}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "morphology",
                                e.target.value
                              )
                            }
                            size="small"
                            disabled={isSampleAnalyzed()}
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.disintegrates}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "disintegrates",
                                e.target.value
                              )
                            }
                            size="small"
                            disabled={isSampleAnalyzed()}
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.riLiquid}
                            onChange={(e) =>
                              updateFibre(fibre.id, "riLiquid", e.target.value)
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              isSampleAnalyzed()
                            }
                            sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.colour}
                          onChange={(e) =>
                            updateFibre(fibre.id, "colour", e.target.value)
                          }
                          disabled={
                            fibre.disintegrates === "yes" || isSampleAnalyzed()
                          }
                          sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.pleochrism || "None"}
                          onChange={(e) =>
                            updateFibre(fibre.id, "pleochrism", e.target.value)
                          }
                          disabled={
                            fibre.disintegrates === "yes" || isSampleAnalyzed()
                          }
                          placeholder="None"
                          sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.birefringence}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "birefringence",
                                e.target.value
                              )
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              isSampleAnalyzed()
                            }
                            sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.extinction}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "extinction",
                                e.target.value
                              )
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              isSampleAnalyzed()
                            }
                            sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.signOfElongation}
                            onChange={(e) =>
                              updateFibre(
                                fibre.id,
                                "signOfElongation",
                                e.target.value
                              )
                            }
                            size="small"
                            disabled={
                              fibre.disintegrates === "yes" ||
                              isSampleAnalyzed()
                            }
                            sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.fibreParallel}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "fibreParallel",
                              e.target.value
                            )
                          }
                          disabled={
                            fibre.disintegrates === "yes" || isSampleAnalyzed()
                          }
                          sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={fibre.fibrePerpendicular}
                          onChange={(e) =>
                            updateFibre(
                              fibre.id,
                              "fibrePerpendicular",
                              e.target.value
                            )
                          }
                          disabled={
                            fibre.disintegrates === "yes" || isSampleAnalyzed()
                          }
                          sx={{
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
                      <TableCell key={fibre.id} sx={{ width: "230px" }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={fibre.result}
                            onChange={(e) =>
                              updateFibre(fibre.id, "result", e.target.value)
                            }
                            size="small"
                            placeholder="Select Result"
                            disabled={isSampleAnalyzed()}
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
                            <MenuItem value="Organic fibres">
                              Organic fibres
                            </MenuItem>
                            <MenuItem value="SMF">SMF</MenuItem>
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
              ? "No fibres detected"
              : "Summary of all fibre analysis results"
          }
          disabled={noFibreDetected || isSampleAnalyzed()}
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
        {isSampleAnalyzed() ? (
          <Button
            variant="outlined"
            color="error"
            onClick={handleEditAnalysis}
            size="large"
          >
            Edit Analysis
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="success"
            onClick={handleMarkAsAnalyzed}
            size="large"
            disabled={!sample?.analysisData || !isAnalysisComplete()}
          >
            Mark as Analysed
          </Button>
        )}

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveAnalysis}
            size="large"
            disabled={isSampleAnalyzed()}
          >
            Save Analysis
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleFinaliseAnalysis}
            size="large"
            disabled={
              jobStatus === "Analysis Complete" || !areAllSamplesAnalyzed()
            }
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

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={unsavedChangesDialogOpen}
        onClose={cancelNavigation}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 2, px: 3, pt: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "warning.main",
                color: "white",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                !
              </Typography>
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Unsaved Changes
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to leave this page
            without saving? All unsaved changes will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button
            onClick={cancelNavigation}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Stay on Page
          </Button>
          <Button
            onClick={confirmNavigation}
            variant="contained"
            color="warning"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Leave Without Saving
          </Button>
        </DialogActions>
      </Dialog>

      {/* Page Refresh Confirmation Dialog */}
      <Dialog
        open={refreshDialogOpen}
        onClose={cancelRefresh}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 2, px: 3, pt: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "warning.main",
                color: "white",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                !
              </Typography>
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Unsaved Changes
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to refresh this
            page? All unsaved changes will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button
            onClick={cancelRefresh}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Stay on Page
          </Button>
          <Button
            onClick={confirmRefresh}
            variant="contained"
            color="warning"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Refresh Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ClientSuppliedFibreIDAnalysis;
