import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  Breadcrumbs,
  Link,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from "@mui/material";
import { ArrowBack as ArrowBackIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { mycometerJobsService, userService } from "../../services/api";
import { usePermissions } from "../../hooks/usePermissions";
import { getTodayInSydney } from "../../utils/dateUtils";
import {
  SAMPLE_TYPE_FROM_SLUG,
  SAMPLE_TYPE_COLORS,
  SAMPLE_TYPE_SLUGS,
  AIR_SAMPLING_SLUG,
  AIR_SAMPLING_LABEL,
  AIR_LIKE_SAMPLE_TYPES,
  isAirSamplingType,
  DEFAULT_STANDARD_VALUE,
  DEFAULT_MYCOMETER_CERTIFICATION,
  calculateMycometerValue,
  calculateAirSampleReactionTime,
  calculateAirSampleValue,
  calculateAirFai,
  getAirFaiResultCategory,
  getMycometerValueLabel,
  getResultCategoryForSampleType,
  getAirSampleResultDisplay,
  isAirLikeSampleType,
  getMycometerCertNumberForSampleType,
  formatMycometerUserLabel,
  getSamplerDisplayWithCertFromMeta,
} from "./mycometerConstants";

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getUserId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const getUserDisplayName = (user) =>
  `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
  user.email ||
  "Unnamed user";

const isCalibrationComplete = (measuredValue, standardValue) => {
  const measured = Number(measuredValue);
  const standard = Number(standardValue);
  if (!Number.isFinite(measured) || !Number.isFinite(standard) || standard === 0) {
    return null;
  }
  const tolerance = standard * 0.02;
  return Math.abs(measured - standard) <= tolerance;
};

/**
 * Excel equivalent:
 * =IF(H6=0,"",IF(H6<18,"error",IF(H6>30,"error",
 *   TEXT(((217.42/EXP(-5798.1*(1/(H6+273))+24.97)*30)/60)/24,"mm:ss"))))
 *
 * Duration minutes = 217.42 / EXP(24.97 - 5798.1/(T+273)) * 30
 * then formatted as mm:ss.
 */
const calculateTimeDuration = (roomTemperatureCelsius) => {
  if (
    roomTemperatureCelsius === "" ||
    roomTemperatureCelsius === null ||
    roomTemperatureCelsius === undefined
  ) {
    return { value: "", error: false };
  }

  const temperature = Number(roomTemperatureCelsius);
  if (!Number.isFinite(temperature) || temperature === 0) {
    return { value: "", error: false };
  }
  if (temperature < 18 || temperature > 30) {
    return { value: "error", error: true };
  }

  const durationMinutes =
    (217.42 / Math.exp(-5798.1 * (1 / (temperature + 273)) + 24.97)) * 30;
  const totalSeconds = Math.round(durationMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const value = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { value, error: false };
};

const mapSamplesForAnalysis = (samples = []) =>
  samples.map((sample) => ({
    ...sample,
    blankValue:
      sample.blankValue !== undefined && sample.blankValue !== null
        ? String(sample.blankValue)
        : "",
    analysisValue:
      sample.analysisValue !== undefined && sample.analysisValue !== null
        ? String(sample.analysisValue)
        : "",
  }));

const analysisPart = (sample) => ({
  _id: sample._id,
  blankValue:
    sample.blankValue !== undefined && sample.blankValue !== null
      ? String(sample.blankValue)
      : "",
  analysisValue:
    sample.analysisValue !== undefined && sample.analysisValue !== null
      ? String(sample.analysisValue)
      : "",
});

const pairAirAnalysisSamples = (jobData, types) => {
  const rows = new Map();
  const order = [];
  const add = (sample, key) => {
    const id = sample.sampleId || String(sample._id);
    if (!rows.has(id)) {
      rows.set(id, {
        sampleId: sample.sampleId,
        sampleLocation: sample.sampleLocation || "",
        flowRate: sample.flowRate,
        qualityControl: sample.qualityControl || "",
        fungi: null,
        allergen: null,
      });
      order.push(id);
    }
    const row = rows.get(id);
    if (!row.sampleLocation && sample.sampleLocation) {
      row.sampleLocation = sample.sampleLocation;
    }
    if (
      (row.flowRate === undefined || row.flowRate === null || row.flowRate === "") &&
      sample.flowRate !== undefined &&
      sample.flowRate !== null
    ) {
      row.flowRate = sample.flowRate;
    }
    if (!row.qualityControl && sample.qualityControl) {
      row.qualityControl = sample.qualityControl;
    }
    row[key] = analysisPart(sample);
  };

  if (types.includes("Air Fungi")) {
    (jobData.samples || [])
      .filter((sample) => sample.sampleType === "Air Fungi")
      .forEach((sample) => add(sample, "fungi"));
  }
  if (types.includes("Air Allergen")) {
    (jobData.samples || [])
      .filter((sample) => sample.sampleType === "Air Allergen")
      .forEach((sample) => add(sample, "allergen"));
  }
  return order.map((id) => rows.get(id));
};

const AIR_ANALYSIS_PARTS = {
  "Air Fungi": "fungi",
  "Air Allergen": "allergen",
};

const FLUOROMETER_ID = "LD-FLU01";

const isRoomTemperatureInRange = (value) => {
  if (value === "" || value === null || value === undefined) return false;
  const temperature = Number(value);
  return Number.isFinite(temperature) && temperature >= 18 && temperature <= 30;
};

const MycometerSampleAnalysis = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { jobId, sampleTypeSlug } = useParams();
  const isCombinedAir = sampleTypeSlug === AIR_SAMPLING_SLUG;
  const sampleType = isCombinedAir
    ? AIR_SAMPLING_LABEL
    : SAMPLE_TYPE_FROM_SLUG[sampleTypeSlug];
  const redirectAirAnalysis =
    !isCombinedAir && isAirSamplingType(sampleType);
  const typeColors =
    SAMPLE_TYPE_COLORS[isCombinedAir ? "Air Fungi" : sampleType] ||
    SAMPLE_TYPE_COLORS["Surface Fungi"];
  const [airAnalysisTypes, setAirAnalysisTypes] = useState([]);
  const isAirLike = isCombinedAir || isAirLikeSampleType(sampleType);
  const mycometerValueLabel = getMycometerValueLabel(sampleType);

  const [job, setJob] = useState(null);
  const [users, setUsers] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [finaliseDialogOpen, setFinaliseDialogOpen] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopening, setReopening] = useState(false);

  const [analyst, setAnalyst] = useState("");
  const [analysisDate, setAnalysisDate] = useState(getTodayInSydney());
  const [standardValue] = useState(DEFAULT_STANDARD_VALUE);
  const [measuredStandardValue, setMeasuredStandardValue] = useState("");
  const [roomTemperature, setRoomTemperature] = useState("");
  const [flowmeter, setFlowmeter] = useState("");

  const mycometerCertificationNumber = useMemo(() => {
    const selected = users.find((user) => user._id === analyst);
    if (selected) {
      return getMycometerCertNumberForSampleType(selected, sampleType);
    }
    const analysisMeta = (job?.analysisMeta || []).find(
      (item) => item.sampleType === sampleType,
    );
    return (
      analysisMeta?.mycometerCertificationNumber ||
      DEFAULT_MYCOMETER_CERTIFICATION
    );
  }, [users, analyst, sampleType, job]);

  const analystOptions = useMemo(() => {
    const options = [...users];
    const analysisMeta = (job?.analysisMeta || []).find(
      (item) => item.sampleType === sampleType,
    );
    const analystId = getUserId(analysisMeta?.analyst);
    if (
      analystId &&
      !options.some((user) => String(user._id) === String(analystId))
    ) {
      options.push({
        _id: analystId,
        firstName: analysisMeta?.analystName || "Unknown user",
        lastName: "",
        licences: [
          {
            licenceType: "Mycometer Certification",
            surface: analysisMeta?.mycometerCertificationNumber,
            air: analysisMeta?.mycometerCertificationNumber,
          },
        ],
      });
    }
    return options;
  }, [users, job, sampleType]);

  const calibrationComplete = isCalibrationComplete(
    measuredStandardValue,
    standardValue,
  );
  const timeDuration = calculateTimeDuration(roomTemperature);
  const sharedReactionTime = useMemo(() => {
    if (!isAirLike || samples.length === 0) return null;
    const source = samples[0];
    const type = isCombinedAir
      ? airAnalysisTypes.includes("Air Fungi")
        ? "Air Fungi"
        : airAnalysisTypes[0]
      : sampleType;
    if (!type) return null;
    return calculateAirSampleReactionTime(type, {
      roomTemperature,
      flowmeter,
      qualityControl: source.qualityControl,
      flowRate: source.flowRate,
    });
  }, [
    isAirLike,
    isCombinedAir,
    airAnalysisTypes,
    sampleType,
    samples,
    roomTemperature,
    flowmeter,
  ]);
  const isAnalysisReadOnly = analysisComplete;

  const samplesPath = `/mycometer-sampling/${jobId}/${
    isCombinedAir || isAirSamplingType(sampleType)
      ? AIR_SAMPLING_SLUG
      : sampleTypeSlug || SAMPLE_TYPE_SLUGS["Surface Fungi"]
  }`;

  const isAllAnalysisComplete = useMemo(() => {
    if (!analyst || !analysisDate) return false;
    if (calibrationComplete !== true) return false;
    if (!isRoomTemperatureInRange(roomTemperature)) return false;

    if (isAirLike) {
      if (!flowmeter) return false;
    } else if (timeDuration.error || !timeDuration.value) {
      return false;
    }

    if (samples.length === 0) return false;

    if (isCombinedAir) {
      if (airAnalysisTypes.length === 0) return false;
      return airAnalysisTypes.every((type) => {
        const partKey = AIR_ANALYSIS_PARTS[type];
        return samples.every((sample) => {
          const part = sample[partKey];
          if (!part) return false;
          const hasValues =
            part.blankValue !== "" &&
            part.blankValue !== null &&
            part.blankValue !== undefined &&
            part.analysisValue !== "" &&
            part.analysisValue !== null &&
            part.analysisValue !== undefined;
          if (!hasValues) return false;
          const reaction = calculateAirSampleReactionTime(type, {
            roomTemperature,
            flowmeter,
            qualityControl: sample.qualityControl,
            flowRate: sample.flowRate,
          });
          return reaction.ok;
        });
      });
    }

    return samples.every((sample) => {
      const hasValues =
        sample.blankValue !== "" &&
        sample.blankValue !== null &&
        sample.blankValue !== undefined &&
        sample.analysisValue !== "" &&
        sample.analysisValue !== null &&
        sample.analysisValue !== undefined;
      if (!hasValues) return false;

      if (isAirLike) {
        const reaction = calculateAirSampleReactionTime(sampleType, {
          roomTemperature,
          flowmeter,
          qualityControl: sample.qualityControl,
          flowRate: sample.flowRate,
        });
        return reaction.ok;
      }
      return true;
    });
  }, [
    analyst,
    analysisDate,
    calibrationComplete,
    roomTemperature,
    flowmeter,
    isAirLike,
    isCombinedAir,
    airAnalysisTypes,
    sampleType,
    timeDuration.error,
    timeDuration.value,
    samples,
  ]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (redirectAirAnalysis && jobId) {
      navigate(
        `/mycometer-sampling/${jobId}/${AIR_SAMPLING_SLUG}/analysis`,
        { replace: true },
      );
    }
  }, [redirectAirAnalysis, jobId, navigate]);

  useEffect(() => {
    if (redirectAirAnalysis) return;
    if (!sampleType) {
      setError("Unknown sample type.");
      setLoading(false);
      return;
    }
    fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, sampleTypeSlug]);

  const fetchUsers = async () => {
    try {
      const response = await userService.getMycometerCertified();
      const usersData = (response.data || []).slice();
      usersData.sort((a, b) =>
        getUserDisplayName(a).localeCompare(getUserDisplayName(b)),
      );
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching mycometer-certified users:", err);
    }
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await mycometerJobsService.getById(jobId);
      const jobData = response.data;

      const includedTypes = isCombinedAir
        ? AIR_LIKE_SAMPLE_TYPES.filter((type) =>
            jobData?.scopeOfWorks?.includes(type),
          )
        : [];
      if (isCombinedAir) {
        setAirAnalysisTypes(includedTypes);
      }

      if (
        isCombinedAir
          ? includedTypes.length === 0
          : !jobData?.scopeOfWorks?.includes(sampleType)
      ) {
        setError(
          `${isCombinedAir ? AIR_SAMPLING_LABEL : sampleType} is not part of this job's scope of works.`,
        );
        setJob(jobData);
        setLoading(false);
        return;
      }

      const detailType = isCombinedAir
        ? includedTypes.includes("Air Fungi")
          ? "Air Fungi"
          : includedTypes[0]
        : sampleType;
      const samplingMeta = (jobData.samplingMeta || []).find(
        (item) => item.sampleType === detailType,
      );
      const samplingReady = isCombinedAir
        ? includedTypes.every((type) =>
            Boolean(
              (jobData.samplingMeta || []).find(
                (item) => item.sampleType === type,
              )?.samplingComplete,
            ),
          )
        : Boolean(samplingMeta?.samplingComplete);
      if (!samplingReady) {
        setError("Sampling must be completed before analysis.");
        setJob(jobData);
        setLoading(false);
        return;
      }

      setFlowmeter(samplingMeta?.flowmeter || "");

      setJob(jobData);
      setSamples(
        isCombinedAir
          ? pairAirAnalysisSamples(jobData, includedTypes)
          : mapSamplesForAnalysis(
              (jobData.samples || []).filter(
                (sample) => sample.sampleType === sampleType,
              ),
            ),
      );

      const analysisMetas = isCombinedAir
        ? includedTypes.map((type) =>
            (jobData.analysisMeta || []).find((item) => item.sampleType === type),
          )
        : [];
      const analysisMeta = isCombinedAir
        ? analysisMetas.find((item) => item?.analyst) || analysisMetas[0]
        : (jobData.analysisMeta || []).find(
            (item) => item.sampleType === sampleType,
          );
      if (isCombinedAir) {
        setAnalysisComplete(
          includedTypes.every((type) =>
            Boolean(
              (jobData.analysisMeta || []).find((item) => item.sampleType === type)
                ?.analysisComplete,
            ),
          ),
        );
      } else {
        setAnalysisComplete(Boolean(analysisMeta?.analysisComplete));
      }
      setHasUnsavedChanges(false);
      setAnalyst(getUserId(analysisMeta?.analyst));
      setAnalysisDate(
        analysisMeta?.analysisDate
          ? formatDateInput(analysisMeta.analysisDate)
          : getTodayInSydney(),
      );
      setMeasuredStandardValue(
        analysisMeta?.measuredStandardValue !== undefined &&
          analysisMeta?.measuredStandardValue !== null
          ? String(analysisMeta.measuredStandardValue)
          : "",
      );
      setRoomTemperature(
        analysisMeta?.roomTemperature !== undefined &&
          analysisMeta?.roomTemperature !== null
          ? String(analysisMeta.roomTemperature)
          : "",
      );
    } catch (err) {
      console.error("Error loading analysis job:", err);
      setError(
        err.response?.data?.message || "Failed to load job. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const persistAnalysisDetails = async (overrides = {}) => {
    const nextAnalyst =
      overrides.analyst !== undefined ? overrides.analyst : analyst;
    const nextAnalysisDate =
      overrides.analysisDate !== undefined
        ? overrides.analysisDate
        : analysisDate;
    const nextMeasured =
      overrides.measuredStandardValue !== undefined
        ? overrides.measuredStandardValue
        : measuredStandardValue;
    const nextRoomTemperature =
      overrides.roomTemperature !== undefined
        ? overrides.roomTemperature
        : roomTemperature;

    if (!nextAnalyst || !nextAnalysisDate) return false;

    const nextSamples = overrides.samples || samples;
    const markingComplete = overrides.analysisComplete === true;
    const payloadBase = {
      analyst: nextAnalyst,
      analysisDate: nextAnalysisDate,
      mycometerCertificationNumber,
      standardValue,
      measuredStandardValue: nextMeasured === "" ? null : Number(nextMeasured),
      roomTemperature:
        nextRoomTemperature === "" ? null : Number(nextRoomTemperature),
    };

    if (isCombinedAir) {
      const typesToSave = airAnalysisTypes.filter((type) => {
        const meta = (job?.analysisMeta || []).find(
          (item) => item.sampleType === type,
        );
        return !meta?.analysisComplete;
      });
      for (const type of typesToSave) {
        const partKey = AIR_ANALYSIS_PARTS[type];
        await mycometerJobsService.updateAnalysis(jobId, type, {
          ...payloadBase,
          analysisComplete: markingComplete,
          samples: nextSamples
            .filter((sample) => sample[partKey])
            .map((sample) => ({
              _id: sample[partKey]._id,
              sampleId: sample.sampleId,
              blankValue:
                sample[partKey].blankValue === ""
                  ? null
                  : sample[partKey].blankValue,
              analysisValue:
                sample[partKey].analysisValue === ""
                  ? null
                  : sample[partKey].analysisValue,
            })),
        });
      }
      return true;
    }

    await mycometerJobsService.updateAnalysis(jobId, sampleType, {
      ...payloadBase,
      analysisComplete:
        overrides.analysisComplete !== undefined
          ? overrides.analysisComplete
          : analysisComplete,
      samples: nextSamples.map((sample) => ({
        _id: sample._id,
        sampleId: sample.sampleId,
        blankValue: sample.blankValue === "" ? null : sample.blankValue,
        analysisValue:
          sample.analysisValue === "" ? null : sample.analysisValue,
      })),
    });
    return true;
  };

  const saveAnalysisDetails = async (overrides = {}) => {
    const nextAnalyst =
      overrides.analyst !== undefined ? overrides.analyst : analyst;
    const nextAnalysisDate =
      overrides.analysisDate !== undefined
        ? overrides.analysisDate
        : analysisDate;

    if (!nextAnalyst || !nextAnalysisDate || isAnalysisReadOnly) return false;

    try {
      setSaving(true);
      setError("");
      const saved = await persistAnalysisDetails(overrides);
      if (!saved) return false;
      setSavedNote(true);
      setHasUnsavedChanges(false);
      if (overrides.analysisComplete) {
        setAnalysisComplete(true);
      }
      return true;
    } catch (err) {
      console.error("Error saving analysis details:", err);
      setError(
        err.response?.data?.message ||
          "Failed to save analysis details. Please try again.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAnalystOrDateChange = async (field, value) => {
    if (isAnalysisReadOnly) return;
    setSavedNote(false);
    setHasUnsavedChanges(true);
    if (field === "analyst") setAnalyst(value);
    if (field === "analysisDate") setAnalysisDate(value);

    await saveAnalysisDetails({
      analyst: field === "analyst" ? value : analyst,
      analysisDate: field === "analysisDate" ? value : analysisDate,
    });
  };

  const handleMeasuredStandardValueChange = (event) => {
    if (isAnalysisReadOnly) return;
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 3);
    setSavedNote(false);
    setHasUnsavedChanges(true);
    setMeasuredStandardValue(digitsOnly);
  };

  const handleMeasuredStandardValueBlur = async () => {
    if (isAnalysisReadOnly) return;
    await saveAnalysisDetails({
      measuredStandardValue,
    });
  };

  const handleRoomTemperatureChange = (event) => {
    if (isAnalysisReadOnly) return;
    // Allow digits and one decimal point for °C values.
    let nextValue = event.target.value.replace(/[^0-9.]/g, "");
    const parts = nextValue.split(".");
    if (parts.length > 2) {
      nextValue = `${parts[0]}.${parts.slice(1).join("")}`;
    }
    setSavedNote(false);
    setHasUnsavedChanges(true);
    setRoomTemperature(nextValue);
  };

  const handleRoomTemperatureBlur = async () => {
    if (isAnalysisReadOnly) return;
    await saveAnalysisDetails({
      roomTemperature,
    });
  };

  const handleSampleFieldChange = (sampleKey, field, value, partKey) => {
    if (isAnalysisReadOnly) return;
    const cleaned = value.replace(/[^0-9.]/g, "");
    setSavedNote(false);
    setHasUnsavedChanges(true);
    setSamples((prev) =>
      prev.map((sample) => {
        const key = sample._id || sample.sampleId;
        if (key !== sampleKey) return sample;
        if (partKey) {
          return {
            ...sample,
            [partKey]: { ...sample[partKey], [field]: cleaned },
          };
        }
        return { ...sample, [field]: cleaned };
      }),
    );
  };

  const handleSampleFieldBlur = async (sampleKey, field, value, partKey) => {
    if (isAnalysisReadOnly) return;
    const cleaned = String(value || "").replace(/[^0-9.]/g, "");
    const nextSamples = samples.map((sample) => {
      const key = sample._id || sample.sampleId;
      if (key !== sampleKey) return sample;
      if (partKey) {
        return {
          ...sample,
          [partKey]: { ...sample[partKey], [field]: cleaned },
        };
      }
      return { ...sample, [field]: cleaned };
    });
    setSamples(nextSamples);
    await saveAnalysisDetails({ samples: nextSamples });
  };

  const handleSaveAndContinue = async () => {
    if (isAnalysisReadOnly) return;
    if (!analyst || !analysisDate) {
      setError("Analyst and Analysis Date are required before saving.");
      return;
    }
    await saveAnalysisDetails();
  };

  const handleSaveAndClose = async () => {
    if (isAnalysisReadOnly) return;
    if (!analyst || !analysisDate) {
      setError("Analyst and Analysis Date are required before saving.");
      return;
    }
    const saved = await saveAnalysisDetails();
    if (saved) {
      navigate(samplesPath);
    }
  };

  const handleFinaliseAnalysis = () => {
    if (isAnalysisReadOnly || !isAllAnalysisComplete) return;
    setFinaliseDialogOpen(true);
  };

  const handleConfirmFinaliseAnalysis = async () => {
    if (isAnalysisReadOnly || !isAllAnalysisComplete) return;
    setFinalising(true);
    const saved = await saveAnalysisDetails({ analysisComplete: true });
    setFinalising(false);
    setFinaliseDialogOpen(false);
    if (saved) {
      setAnalysisComplete(true);
      setHasUnsavedChanges(false);
      navigate(samplesPath);
    }
  };

  const handleReopenReport = async () => {
    try {
      setReopening(true);
      setError("");
      if (isCombinedAir) {
        for (const type of airAnalysisTypes) {
          await mycometerJobsService.reopenSampleType(jobId, type);
        }
      } else {
        await mycometerJobsService.reopenSampleType(jobId, sampleType);
      }
      setReopenDialogOpen(false);
      setHasUnsavedChanges(false);
      navigate(samplesPath);
    } catch (err) {
      console.error("Error reopening Mycometer report:", err);
      setError(
        err.response?.data?.message ||
          "Failed to reopen report. Only admins can reopen reports.",
      );
    } finally {
      setReopening(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges && !isAnalysisReadOnly) {
      setCancelDialogOpen(true);
      return;
    }
    navigate(samplesPath);
  };

  const showFaiColumn =
    airAnalysisTypes.includes("Air Fungi") &&
    airAnalysisTypes.includes("Air Allergen");

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={isCombinedAir ? "xl" : "lg"}>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate(samplesPath)}
              sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            >
              <ArrowBackIcon sx={{ mr: 1 }} />
              {`${sampleType} Samples` || "Samples"}
            </Link>
          </Breadcrumbs>
          <Typography variant="h4" component="h1" gutterBottom>
            Mycometer - {sampleType || "Mycometer"} Analysis
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1 }}>
            {job?.projectId?.projectID
              ? `${job.projectId.projectID} — ${job.projectId.name || "Unnamed Project"}`
              : job?.projectId?.name || "Mycometer Job"}
          </Typography>
          {(() => {
            const detailType = isCombinedAir
              ? airAnalysisTypes.includes("Air Fungi")
                ? "Air Fungi"
                : airAnalysisTypes[0]
              : sampleType;
            const samplingMeta = (job?.samplingMeta || []).find(
              (item) => item.sampleType === detailType,
            );
            const samplerName = samplingMeta
              ? getSamplerDisplayWithCertFromMeta(samplingMeta, detailType)
              : "";
            const dateLabel = samplingMeta?.sampleDate
              ? new Date(samplingMeta.sampleDate).toLocaleDateString("en-AU")
              : null;
            if (!samplerName && !dateLabel) return null;
            return (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Sampler: <strong>{samplerName || "—"}</strong>
                {" · "}
                Sampling date: <strong>{dateLabel || "—"}</strong>
              </Typography>
            );
          })()}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper
          sx={{
            p: 3,
            mb: 3,
            borderTop: `4px solid ${typeColors.borderColor}`,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Analysis Details
              {analysisComplete && (
                <Chip
                  size="small"
                  color="success"
                  label="Finalised"
                  sx={{ ml: 1, verticalAlign: "middle" }}
                />
              )}
              {/* {savedNote && !analysisComplete && (
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1, fontWeight: 400 }}
                >
                  (saved)
                </Typography>
              )} */}
            </Typography>
            {saving && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Saving...
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <FormControl fullWidth required>
                <InputLabel id="analyst-label">Analyst</InputLabel>
                <Select
                  labelId="analyst-label"
                  label="Analyst"
                  value={analyst}
                  disabled={saving || isAnalysisReadOnly}
                  onChange={(e) =>
                    handleAnalystOrDateChange("analyst", e.target.value)
                  }
                >
                  {analystOptions.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {formatMycometerUserLabel(
                        user,
                        isCombinedAir ? "Air Fungi" : sampleType,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Analysis Date"
                type="date"
                value={analysisDate}
                disabled={saving || isAnalysisReadOnly}
                onChange={(e) =>
                  handleAnalystOrDateChange("analysisDate", e.target.value)
                }
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Fluorometer"
                value={`${FLUOROMETER_ID} (STD VAL = ${standardValue})`}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: isAirLike ? "1fr auto 1fr auto" : "1fr auto 1fr",
                },
                gap: 2,
                alignItems: "flex-start",
              }}
            >
              <TextField
                label="Measured standard value"
                value={measuredStandardValue}
                onChange={handleMeasuredStandardValueChange}
                onBlur={handleMeasuredStandardValueBlur}
                fullWidth
                disabled={isAnalysisReadOnly}
                inputProps={{
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  maxLength: 3,
                }}
              />

              <Box
                sx={{
                  minWidth: 200,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pt: 1,
                  color:
                    calibrationComplete === null
                      ? "text.secondary"
                      : calibrationComplete
                        ? "success.main"
                        : "error.main",
                }}
              >
                {calibrationComplete === null ? (
                  <Typography variant="body2" color="text.secondary">
                    Enter measured value
                  </Typography>
                ) : (
                  <>
                    {calibrationComplete ? (
                      <CheckCircleIcon fontSize="small" />
                    ) : (
                      <CancelIcon fontSize="small" />
                    )}
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {calibrationComplete
                        ? "Calibration Complete"
                        : "Calibration Failed"}
                    </Typography>
                  </>
                )}
              </Box>

              <TextField
                label="Room temperature (°C)"
                value={roomTemperature}
                onChange={handleRoomTemperatureChange}
                onBlur={handleRoomTemperatureBlur}
                fullWidth
                disabled={isAnalysisReadOnly}
                error={
                  roomTemperature !== "" &&
                  !isRoomTemperatureInRange(roomTemperature)
                }
                helperText={
                  roomTemperature !== "" &&
                  !isRoomTemperatureInRange(roomTemperature)
                    ? "Room temperature must be between 18°C and 30°C"
                    : " "
                }
                inputProps={{
                  inputMode: "decimal",
                }}
              />

              {isAirLike && (
                <Box sx={{ minWidth: 160, pt: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Reaction time
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      lineHeight: 1.4,
                      color:
                        sharedReactionTime && !sharedReactionTime.ok
                          ? "error.main"
                          : "text.primary",
                    }}
                  >
                    {sharedReactionTime?.display || "—"}
                  </Typography>
                </Box>
              )}
            </Box>

            {!isAirLike && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  label="Time duration"
                  value={timeDuration.value}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  error={timeDuration.error}
                  helperText={
                    timeDuration.error
                      ? "Room temperature must be between 18°C and 30°C"
                      : " "
                  }
                />
              </Box>
            )}
          </Box>
        </Paper>

        {isCombinedAir && (
          <Paper sx={{ p: 3 }}>
            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow
                    sx={{
                      background:
                        "linear-gradient(to right, #045E1F, #96CC78) !important",
                      color: "white",
                      "&:hover": { backgroundColor: "transparent" },
                    }}
                  >
                    <TableCell
                      rowSpan={2}
                      sx={{
                        fontWeight: "bold",
                        color: "inherit",
                        width: "30ch",
                        borderRight: "1px solid #000",
                        borderBottom: "1px solid #000 !important",
                      }}
                    >
                      Sample ID
                    </TableCell>
                    {airAnalysisTypes.map((type, index) => (
                      <TableCell
                        key={type}
                        colSpan={4}
                        align="center"
                        sx={{
                          fontWeight: "bold",
                          color: "inherit",
                          borderBottom: "1px solid #000 !important",
                          ...(index > 0 && {
                            borderLeft: "1px solid #000",
                          }),
                        }}
                      >
                        {type}
                      </TableCell>
                    ))}
                    {showFaiColumn && (
                      <TableCell
                        rowSpan={2}
                        align="center"
                        sx={{
                          fontWeight: "bold",
                          color: "inherit",
                          borderLeft: "1px solid #000",
                          borderBottom: "1px solid #000 !important",
                        }}
                      >
                        FAI
                      </TableCell>
                    )}
                  </TableRow>
                  <TableRow
                    sx={{
                      background:
                        "linear-gradient(to right, #045E1F, #96CC78) !important",
                      color: "white",
                    }}
                  >
                    {airAnalysisTypes.map((type, index) => (
                      <React.Fragment key={`${type}-headers`}>
                        <TableCell
                          sx={{
                            fontWeight: "bold",
                            color: "inherit",
                            borderBottom: "1px solid #000 !important",
                            ...(index > 0 && {
                              borderLeft: "1px solid #000",
                            }),
                          }}
                        >
                          Blank Value
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: "bold",
                            color: "inherit",
                            borderBottom: "1px solid #000 !important",
                          }}
                        >
                          Analysis Value
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: "bold",
                            color: "inherit",
                            borderBottom: "1px solid #000 !important",
                          }}
                        >
                          {getMycometerValueLabel(type)}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: "bold",
                            color: "inherit",
                            borderBottom: "1px solid #000 !important",
                          }}
                        >
                          Result
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {samples.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          1 +
                          airAnalysisTypes.length * 4 +
                          (showFaiColumn ? 1 : 0)
                        }
                        align="center"
                      >
                        No samples available for analysis.
                      </TableCell>
                    </TableRow>
                  ) : (
                    samples.map((sample) => {
                      const sampleKey = sample.sampleId;
                      const fai = showFaiColumn
                        ? calculateAirFai(
                            sample.fungi
                              ? calculateAirSampleValue("Air Fungi", {
                                  analysisValue: sample.fungi.analysisValue,
                                  blankValue: sample.fungi.blankValue,
                                  qualityControl: sample.qualityControl,
                                })
                              : null,
                            sample.allergen
                              ? calculateAirSampleValue("Air Allergen", {
                                  analysisValue: sample.allergen.analysisValue,
                                  blankValue: sample.allergen.blankValue,
                                })
                              : null,
                          )
                        : null;
                      const faiCategory = fai?.ok
                        ? getAirFaiResultCategory(fai.value)
                        : null;
                      return (
                        <TableRow key={sampleKey} hover>
                          <TableCell
                            sx={{
                              width: "30ch",
                              minWidth: "30ch",
                              borderRight: "1px solid #000",
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 500, whiteSpace: "nowrap" }}
                            >
                              {sample.sampleId || "—"}
                            </Typography>
                          </TableCell>
                          {airAnalysisTypes.map((type, index) => {
                            const partKey = AIR_ANALYSIS_PARTS[type];
                            const part = sample[partKey];
                            const valueResult = part
                              ? calculateAirSampleValue(type, {
                                  analysisValue: part.analysisValue,
                                  blankValue: part.blankValue,
                                  qualityControl: sample.qualityControl,
                                })
                              : null;
                            const category = getAirSampleResultDisplay(
                              type,
                              valueResult,
                            );
                            return (
                              <React.Fragment key={`${sampleKey}-${type}`}>
                                <TableCell
                                  sx={
                                    index > 0
                                      ? {
                                          borderLeft: "1px solid #000",
                                        }
                                      : undefined
                                  }
                                >
                                  <TextField
                                    size="small"
                                    value={part?.blankValue || ""}
                                    disabled={isAnalysisReadOnly || !part}
                                    onChange={(e) =>
                                      handleSampleFieldChange(
                                        sampleKey,
                                        "blankValue",
                                        e.target.value,
                                        partKey,
                                      )
                                    }
                                    onBlur={(e) =>
                                      handleSampleFieldBlur(
                                        sampleKey,
                                        "blankValue",
                                        e.target.value,
                                        partKey,
                                      )
                                    }
                                    inputProps={{ inputMode: "decimal" }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    value={part?.analysisValue || ""}
                                    disabled={isAnalysisReadOnly || !part}
                                    onChange={(e) =>
                                      handleSampleFieldChange(
                                        sampleKey,
                                        "analysisValue",
                                        e.target.value,
                                        partKey,
                                      )
                                    }
                                    onBlur={(e) =>
                                      handleSampleFieldBlur(
                                        sampleKey,
                                        "analysisValue",
                                        e.target.value,
                                        partKey,
                                      )
                                    }
                                    inputProps={{ inputMode: "decimal" }}
                                  />
                                </TableCell>
                                <TableCell>
                                  {valueResult?.display ?? "—"}
                                </TableCell>
                                <TableCell>
                                  {category ? (
                                    <Chip
                                      size="small"
                                      label={`${category.code} (${category.label})`}
                                      sx={category.sx}
                                    />
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          {showFaiColumn && (
                            <TableCell
                              align="center"
                              sx={{
                                borderLeft: "1px solid #000",
                                fontWeight: 600,
                              }}
                            >
                              {faiCategory ? (
                                <Chip
                                  size="small"
                                  label={`${faiCategory.code} (${faiCategory.label})`}
                                  sx={faiCategory.sx}
                                />
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
        {!isCombinedAir && (
        <Paper sx={{ p: 3 }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow
                  sx={{
                    background:
                      "linear-gradient(to right, #045E1F, #96CC78) !important",
                    color: "white",
                    "&:hover": { backgroundColor: "transparent" },
                  }}
                >
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: "30ch" }}
                  >
                    Sample ID
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 100 }}
                  >
                    Blank Value
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 100 }}
                  >
                    Analysis Value
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 140 }}
                  >
                    {mycometerValueLabel}
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: "bold", color: "inherit", width: 140 }}
                  >
                    Result Category
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {samples.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No samples available for analysis.
                    </TableCell>
                  </TableRow>
                ) : (
                  samples.map((sample) => {
                    const sampleKey = sample._id || sample.sampleId;
                    const airValueResult = isAirLike
                      ? calculateAirSampleValue(sampleType, {
                          analysisValue: sample.analysisValue,
                          blankValue: sample.blankValue,
                          qualityControl: sample.qualityControl,
                        })
                      : null;
                    const mycometerValue = isAirLike
                      ? null
                      : calculateMycometerValue(
                          sample.analysisValue,
                          sample.blankValue,
                        );
                    const category = isAirLike
                      ? getAirSampleResultDisplay(sampleType, airValueResult)
                      : getResultCategoryForSampleType(
                          sampleType,
                          mycometerValue,
                        );
                    const mycometerDisplay = isAirLike
                      ? airValueResult?.display ?? "—"
                      : mycometerValue === null
                        ? "—"
                        : mycometerValue;

                    return (
                      <TableRow key={sampleKey} hover>
                        <TableCell sx={{ width: "30ch", minWidth: "30ch" }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 500, whiteSpace: "nowrap" }}
                          >
                            {sample.sampleId || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: 100, maxWidth: 100 }}>
                          <TextField
                            size="small"
                            value={sample.blankValue}
                            disabled={isAnalysisReadOnly}
                            onChange={(e) =>
                              handleSampleFieldChange(
                                sampleKey,
                                "blankValue",
                                e.target.value,
                              )
                            }
                            onBlur={(e) =>
                              handleSampleFieldBlur(
                                sampleKey,
                                "blankValue",
                                e.target.value,
                              )
                            }
                            fullWidth
                            inputProps={{ inputMode: "decimal" }}
                          />
                        </TableCell>
                        <TableCell sx={{ width: 100, maxWidth: 100 }}>
                          <TextField
                            size="small"
                            value={sample.analysisValue}
                            disabled={isAnalysisReadOnly}
                            onChange={(e) =>
                              handleSampleFieldChange(
                                sampleKey,
                                "analysisValue",
                                e.target.value,
                              )
                            }
                            onBlur={(e) =>
                              handleSampleFieldBlur(
                                sampleKey,
                                "analysisValue",
                                e.target.value,
                              )
                            }
                            fullWidth
                            inputProps={{ inputMode: "decimal" }}
                          />
                        </TableCell>
                        <TableCell sx={{ width: 140, maxWidth: 140 }}>
                          {mycometerDisplay}
                        </TableCell>
                        <TableCell sx={{ width: 140, maxWidth: 140 }}>
                          {category ? (
                            <Chip
                              size="small"
                              label={`${category.code} (${category.label})`}
                              sx={category.sx}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        )}

        <Box
          sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 2 }}
        >
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={saving}
            sx={{
              color: theme.palette.primary.main,
              borderColor: theme.palette.primary.main,
              "&:hover": {
                borderColor: theme.palette.primary.dark,
              },
            }}
          >
            Cancel
          </Button>
          {!isAnalysisReadOnly && (
            <>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSaveAndContinue}
                disabled={saving}
              >
                Save and Continue
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveAndClose}
                disabled={saving}
                sx={{
                  backgroundColor: theme.palette.primary[400],
                  "&:hover": {
                    backgroundColor: theme.palette.primary[500],
                  },
                }}
              >
                Save & Close
              </Button>
              <Button
                variant="contained"
                onClick={handleFinaliseAnalysis}
                disabled={saving || !isAllAnalysisComplete}
                sx={{
                  backgroundColor: "#1976d2",
                  "&:hover": {
                    backgroundColor: "#1565c0",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: theme.palette.grey[700],
                    color: theme.palette.grey[500],
                  },
                }}
              >
                Finalise Analysis
              </Button>
            </>
          )}
          {isAnalysisReadOnly && isAdmin && (
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => setReopenDialogOpen(true)}
              disabled={reopening}
              sx={{
                backgroundColor: "#f57c00",
                "&:hover": {
                  backgroundColor: "#e65100",
                },
              }}
            >
              Reopen Report (Admin)
            </Button>
          )}
        </Box>

        <Dialog
          open={reopenDialogOpen}
          onClose={() => !reopening && setReopenDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Reopen Report for Editing?</DialogTitle>
          <DialogContent>
            {error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : null}
            <Typography sx={{ mb: 2 }}>
              This will reopen <strong>{sampleType}</strong> so sampling and
              analysis can be edited again.
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              If you continue:
              <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
                <li>
                  Sampling Complete and Analysis Finalised will be cleared
                </li>
                <li>
                  Report authorisation will be cleared (including any pending
                  authorisation request)
                </li>
              <li>
                If this report has been authorised, use Revise on the project
                reports page. This button cannot start a revision.
              </li>
                <li>Existing sample and analysis values will be kept</li>
              </Box>
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setReopenDialogOpen(false)}
              disabled={reopening}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReopenReport}
              variant="contained"
              disabled={reopening}
              sx={{
                backgroundColor: "#f57c00",
                "&:hover": { backgroundColor: "#e65100" },
              }}
            >
              {reopening ? "Reopening..." : "Reopen Report"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={finaliseDialogOpen}
          onClose={() => !finalising && setFinaliseDialogOpen(false)}
        >
          <DialogTitle>Finalise Analysis?</DialogTitle>
          <DialogContent>
            <Typography>
              Please confirm that all site work and analysis is complete. Once
              finalised, analysis values will be locked and the report can be
              generated for authorisation.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setFinaliseDialogOpen(false)}
              disabled={finalising}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmFinaliseAnalysis}
              variant="contained"
              color="primary"
              disabled={finalising}
            >
              {finalising ? "Finalising..." : "Confirm"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={cancelDialogOpen}
          onClose={() => setCancelDialogOpen(false)}
        >
          <DialogTitle>Discard Changes?</DialogTitle>
          <DialogContent>
            <Typography>
              You have unsaved changes. Are you sure you want to discard them?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)}>
              Continue Editing
            </Button>
            <Button
              onClick={() => {
                setCancelDialogOpen(false);
                setHasUnsavedChanges(false);
                navigate(samplesPath);
              }}
              color="error"
            >
              Discard Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default MycometerSampleAnalysis;
