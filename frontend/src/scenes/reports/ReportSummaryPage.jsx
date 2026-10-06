import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { shiftService, sampleService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import { formatDate } from "../../utils/dateFormat";

const SUMMARY_TYPES = new Set([
  "shift",
  "clearance",
  "enclosure_certificate",
]);

const text = (value) => {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const personName = (person) => {
  if (!person) return null;
  if (typeof person === "string") return person;
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return name || null;
};

const Line = ({ label, value }) => {
  const display = text(value);
  if (display == null) return null;
  return (
    <Typography variant="body1" sx={{ mb: 0.75, whiteSpace: "pre-wrap" }}>
      {label}: {display}
    </Typography>
  );
};

const Section = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" sx={{ mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const formatReportedConcentration = (analysis) => {
  if (!analysis) return null;
  if (
    analysis.uncountableDueToDust === true ||
    analysis.uncountableDueToDust === "true"
  ) {
    return "UDD";
  }
  return analysis.reportedConcentration || null;
};

const ReportSummaryPage = () => {
  const { projectId, reportType, reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("Report summary");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!SUMMARY_TYPES.has(reportType) || !reportId) {
        setError("Unsupported report type");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPayload(null);

      try {
        if (reportType === "shift") {
          const shiftResponse = await shiftService.getById(reportId);
          const shift = shiftResponse?.data || shiftResponse;
          if (!shift) throw new Error("Shift not found");

          const jobId = shift.job?._id || shift.job;
          let job = shift.job && typeof shift.job === "object" ? shift.job : null;
          if (jobId) {
            try {
              const jobResponse = await asbestosRemovalJobService.getById(jobId);
              job = jobResponse?.data || jobResponse || job;
            } catch (_) {
              // Keep whatever came with the shift
            }
          }

          const samplesResponse = await sampleService.getByShift(reportId);
          const samplesRaw = samplesResponse?.data || samplesResponse || [];
          const samples = await Promise.all(
            (Array.isArray(samplesRaw) ? samplesRaw : []).map(async (sample) => {
              if (sample?.analysis) return sample;
              try {
                const full = await sampleService.getById(sample._id);
                return full?.data || full || sample;
              } catch (_) {
                return sample;
              }
            }),
          );

          if (cancelled) return;
          setTitle("Air monitoring shift summary");
          setPayload({ kind: "shift", shift, job, samples });
        } else {
          const clearance = await asbestosClearanceService.getById(reportId);
          if (!clearance) throw new Error("Clearance not found");

          const isEnclosure =
            reportType === "enclosure_certificate" ||
            clearance.isEnclosureCertificate;

          if (cancelled) return;
          setTitle(
            isEnclosure
              ? "Enclosure inspection certificate summary"
              : "Asbestos clearance summary",
          );
          setPayload({
            kind: isEnclosure ? "enclosure_certificate" : "clearance",
            clearance,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load report summary",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reportType, reportId]);

  const handleBack = () => {
    navigate(`/reports/project/${projectId}`, {
      state: location.state || undefined,
    });
  };

  const renderShift = () => {
    const { shift, job, samples } = payload;
    const project = job?.projectId;

    return (
      <>
        <Section title="Job">
          <Line
            label="Project"
            value={
              project?.projectID
                ? `${project.projectID}${project.name ? ` — ${project.name}` : ""}`
                : project?.name
            }
          />
          <Line label="Job name" value={job?.name} />
          <Line label="Asbestos removalist" value={job?.asbestosRemovalist} />
          <Line label="Job description" value={job?.description} />
        </Section>

        <Section title="Shift">
          <Line label="Shift name" value={shift?.name} />
          <Line label="Date" value={formatDate(shift?.date)} />
          <Line
            label="Asbestos removalist"
            value={
              shift?.asbestosRemovalist || job?.asbestosRemovalist
            }
          />
          <Line label="Start time" value={shift?.startTime} />
          <Line label="End time" value={shift?.endTime} />
          <Line label="Status" value={shift?.status} />
          <Line label="Description of works" value={shift?.descriptionOfWorks} />
          <Line label="Supervisor" value={personName(shift?.supervisor)} />
          <Line
            label="Default sampler"
            value={personName(shift?.defaultSampler)}
          />
          <Line label="Analysed by" value={shift?.analysedBy} />
          <Line label="Analysis date" value={formatDate(shift?.analysisDate)} />
          <Line label="Report approved by" value={shift?.reportApprovedBy} />
          <Line
            label="Report issue date"
            value={formatDate(shift?.reportIssueDate)}
          />
          <Line label="Revision" value={shift?.revision ?? 0} />
        </Section>

        <Section title={`Samples (${samples?.length || 0})`}>
          {!samples?.length ? (
            <Typography color="text.secondary">No samples.</Typography>
          ) : (
            samples.map((sample, index) => (
              <Box key={sample._id || index} sx={{ mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Sample {index + 1}
                  {sample.fullSampleID ? ` — ${sample.fullSampleID}` : ""}
                </Typography>
                <Line label="Type" value={sample.type} />
                <Line label="Location" value={sample.location} />
                <Line label="Time on" value={sample.startTime} />
                <Line label="Time off" value={sample.endTime} />
                <Line label="Average flow (L/min)" value={sample.averageFlowrate} />
                <Line label="Sampler" value={personName(sample.sampler)} />
                <Line label="Status" value={sample.status} />
                <Line
                  label="Fibres counted"
                  value={sample.analysis?.fibresCounted}
                />
                <Line
                  label="Fields counted"
                  value={sample.analysis?.fieldsCounted}
                />
                <Line
                  label="Reported concentration"
                  value={formatReportedConcentration(sample.analysis)}
                />
                <Line
                  label="Background dust"
                  value={sample.analysis?.backgroundDust}
                />
                <Line
                  label="Edges distribution"
                  value={sample.analysis?.edgesDistribution}
                />
                {index < samples.length - 1 && <Divider sx={{ mt: 1.5 }} />}
              </Box>
            ))
          )}
        </Section>
      </>
    );
  };

  const renderClearance = () => {
    const { clearance } = payload;
    const project = clearance?.projectId;
    const items = Array.isArray(clearance?.items) ? clearance.items : [];

    return (
      <>
        <Section title="Clearance">
          <Line
            label="Project"
            value={
              project?.projectID
                ? `${project.projectID}${project.name ? ` — ${project.name}` : ""}`
                : project?.name
            }
          />
          <Line label="Clearance date" value={formatDate(clearance?.clearanceDate)} />
          <Line label="Inspection time" value={clearance?.inspectionTime} />
          <Line label="Type" value={clearance?.clearanceType} />
          <Line label="Jurisdiction" value={clearance?.jurisdiction} />
          <Line label="Status" value={clearance?.status} />
          <Line label="LAA" value={clearance?.LAA} />
          <Line
            label="Asbestos removalist"
            value={clearance?.asbestosRemovalist}
          />
          <Line label="Secondary header" value={clearance?.secondaryHeader} />
          <Line
            label="Job-specific exclusions"
            value={clearance?.jobSpecificExclusions}
          />
          <Line
            label="Vehicle / equipment description"
            value={clearance?.vehicleEquipmentDescription}
          />
          <Line label="Notes" value={clearance?.notes} />
          <Line label="Air monitoring" value={clearance?.airMonitoring} />
          <Line label="Site plan" value={clearance?.sitePlan} />
          <Line label="Report approved by" value={clearance?.reportApprovedBy} />
          <Line
            label="Report issue date"
            value={formatDate(clearance?.reportIssueDate)}
          />
          <Line label="Report reference" value={clearance?.reportReference} />
          <Line label="Revision" value={clearance?.revision ?? 0} />
        </Section>

        <Section title={`Clearance items (${items.length})`}>
          {!items.length ? (
            <Typography color="text.secondary">No clearance items.</Typography>
          ) : (
            items.map((item, index) => (
              <Box key={item._id || index} sx={{ mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Item {index + 1}
                </Typography>
                <Line label="Location" value={item.locationDescription} />
                <Line label="Level / floor" value={item.levelFloor} />
                <Line label="Room / area" value={item.roomArea} />
                <Line label="Material" value={item.materialDescription} />
                <Line label="Asbestos type" value={item.asbestosType} />
                <Line label="Notes" value={item.notes} />
                {index < items.length - 1 && <Divider sx={{ mt: 1.5 }} />}
              </Box>
            ))
          )}
        </Section>
      </>
    );
  };

  const renderEnclosure = () => {
    const { clearance } = payload;
    const project = clearance?.projectId;
    const photos = Array.isArray(clearance?.enclosurePhotos)
      ? clearance.enclosurePhotos
      : [];

    return (
      <>
        <Section title="Enclosure certificate">
          <Line
            label="Project"
            value={
              project?.projectID
                ? `${project.projectID}${project.name ? ` — ${project.name}` : ""}`
                : project?.name
            }
          />
          <Line label="Clearance type" value={clearance?.clearanceType} />
          <Line label="Jurisdiction" value={clearance?.jurisdiction} />
          <Line label="Status" value={clearance?.status} />
          <Line label="LAA" value={clearance?.LAA} />
          <Line
            label="Asbestos removalist"
            value={clearance?.asbestosRemovalist}
          />
          <Line
            label="Inspection date/time"
            value={
              clearance?.enclosureInspectionDateTime
                ? formatDate(clearance.enclosureInspectionDateTime)
                : formatDate(clearance?.clearanceDate)
            }
          />
          <Line
            label="Inspection time"
            value={
              clearance?.enclosureInspectionDateTime
                ? new Date(clearance.enclosureInspectionDateTime).toLocaleTimeString(
                    "en-AU",
                    { hour: "2-digit", minute: "2-digit" },
                  )
                : clearance?.inspectionTime
            }
          />
          <Line
            label="Inspected by"
            value={clearance?.enclosureInspectedBy || clearance?.LAA}
          />
          <Line
            label="Enclosure description"
            value={clearance?.enclosureDescription}
          />
          <Line
            label="Certificate approved by"
            value={clearance?.enclosureCertificateApprovedBy}
          />
          <Line
            label="Certificate issue date"
            value={formatDate(clearance?.enclosureCertificateIssueDate)}
          />
          <Line
            label="Certificate reference"
            value={clearance?.enclosureCertificateReportReference}
          />
          <Line label="Revision" value={clearance?.revision ?? 0} />
        </Section>

        <Section title={`Enclosure photos (${photos.length})`}>
          {!photos.length ? (
            <Typography color="text.secondary">No photo captions.</Typography>
          ) : (
            photos.map((photo, index) => (
              <Typography key={index} variant="body1" sx={{ mb: 0.75 }}>
                Photo {index + 1}:{" "}
                {photo?.description ||
                  "Photograph of removal enclosure taken during inspection"}
              </Typography>
            ))
          )}
        </Section>
      </>
    );
  };

  return (
    <Box sx={{ p: 3, px: { xs: 1.5, sm: 3 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleBack}
        sx={{ mb: 2 }}
      >
        Back to project reports
      </Button>

      <Typography variant="h4" component="h1" gutterBottom>
        {title}
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && payload?.kind === "shift" && renderShift()}
      {!loading && !error && payload?.kind === "clearance" && renderClearance()}
      {!loading &&
        !error &&
        payload?.kind === "enclosure_certificate" &&
        renderEnclosure()}
    </Box>
  );
};

export default ReportSummaryPage;
