import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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

const dateValue = (value) => {
  if (value == null || value === "") return null;
  const formatted = formatDate(value);
  if (!formatted || formatted === "N/A") return null;
  return formatted;
};

const personName = (person) => {
  if (!person) return null;
  if (typeof person === "string") return person;
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return name || null;
};

const humanize = (value) => {
  const raw = text(value);
  if (!raw) return null;
  if (raw.includes(" ") || raw.includes("-")) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return raw
    .split("_")
    .filter(Boolean)
    .map(
      (word, index) =>
        index === 0
          ? word.charAt(0).toUpperCase() + word.slice(1)
          : word.toLowerCase(),
    )
    .join(" ");
};

const projectLabel = (project) => {
  if (!project || typeof project !== "object") return null;
  if (project.projectID) {
    return `${project.projectID}${project.name ? ` — ${project.name}` : ""}`;
  }
  return project.name || null;
};

const statusColor = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "failed" || key === "cancelled") return "error";
  if (
    key.includes("complete") ||
    key === "closed" ||
    key === "analysed" ||
    key === "completed"
  ) {
    return "success";
  }
  if (
    key === "ongoing" ||
    key === "in progress" ||
    key === "pending" ||
    key === "in_progress"
  ) {
    return "warning";
  }
  return "default";
};

const asbestosTypeColor = (type) => {
  const key = String(type || "").toLowerCase();
  if (key === "friable") return "error";
  if (key === "non-friable") return "warning";
  return "default";
};

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

const headerCellSx = {
  fontWeight: 600,
  fontSize: "0.75rem",
  color: "text.secondary",
  whiteSpace: "nowrap",
  bgcolor: "grey.50",
  borderBottom: 1,
  borderColor: "divider",
};

const bodyCellSx = {
  verticalAlign: "top",
  fontSize: "0.875rem",
};

const Fields = ({ items }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "1fr",
        sm: "1fr 1fr",
        lg: "1fr 1fr 1fr",
      },
      columnGap: 3,
      rowGap: 2.25,
    }}
  >
    {items.map((item, index) => {
      const display = text(item.value);
      if (display == null) return null;
      return (
        <Box
          key={`${item.label}-${index}`}
          sx={{
            gridColumn: item.full ? "1 / -1" : undefined,
            minWidth: 0,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", fontWeight: 600, mb: 0.25 }}
          >
            {item.label}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: item.full ? 1.6 : 1.4,
            }}
          >
            {display}
          </Typography>
        </Box>
      );
    })}
  </Box>
);

const Section = ({ title, count, flush, children }) => (
  <Paper
    variant="outlined"
    sx={{ mb: 2.5, borderRadius: 2, overflow: "hidden" }}
  >
    <Box
      sx={{
        px: 2.5,
        py: 1.25,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {count != null && (
        <Chip label={count} size="small" variant="outlined" />
      )}
    </Box>
    <Box sx={flush ? undefined : { p: { xs: 2, sm: 2.5 } }}>{children}</Box>
  </Paper>
);

const EmptyNote = ({ children }) => (
  <Typography color="text.secondary" sx={{ px: 2.5, py: 2 }}>
    {children}
  </Typography>
);

const StatusChip = ({ status }) => {
  const label = humanize(status);
  if (!label) return null;
  return <Chip label={label} size="small" color={statusColor(status)} />;
};

const dash = (value) => {
  const display = text(value);
  return display == null ? "—" : display;
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
    const showDust = samples.some((sample) =>
      text(sample.analysis?.backgroundDust),
    );
    const showEdges = samples.some((sample) =>
      text(sample.analysis?.edgesDistribution),
    );

    return (
      <>
        <Section title="Job">
          <Fields
            items={[
              { label: "Job name", value: job?.name },
              { label: "Asbestos removalist", value: job?.asbestosRemovalist },
              { label: "Job description", value: job?.description, full: true },
            ]}
          />
        </Section>

        <Section title="Shift">
          <Fields
            items={[
              { label: "Shift name", value: shift?.name },
              { label: "Date", value: dateValue(shift?.date) },
              {
                label: "Asbestos removalist",
                value: shift?.asbestosRemovalist || job?.asbestosRemovalist,
              },
              { label: "Start time", value: shift?.startTime },
              { label: "End time", value: shift?.endTime },
              { label: "Status", value: humanize(shift?.status) },
              {
                label: "Description of works",
                value: shift?.descriptionOfWorks,
                full: true,
              },
              { label: "Supervisor", value: personName(shift?.supervisor) },
              {
                label: "Default sampler",
                value: personName(shift?.defaultSampler),
              },
              { label: "Analysed by", value: shift?.analysedBy },
              { label: "Analysis date", value: dateValue(shift?.analysisDate) },
              { label: "Report approved by", value: shift?.reportApprovedBy },
              {
                label: "Report issue date",
                value: dateValue(shift?.reportIssueDate),
              },
              { label: "Revision", value: shift?.revision ?? 0 },
            ]}
          />
        </Section>

        <Section title="Samples" count={samples?.length || 0} flush>
          {!samples?.length ? (
            <EmptyNote>No samples.</EmptyNote>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{ "&:hover": { backgroundColor: "transparent" } }}
                  >
                    {[
                      "Sample ID",
                      "Type",
                      "Location",
                      "Time on",
                      "Time off",
                      "Flow (L/min)",
                      "Sampler",
                      "Fibres",
                      "Fields",
                      "Concentration",
                      ...(showDust ? ["Background dust"] : []),
                      ...(showEdges ? ["Edges"] : []),
                      "Status",
                    ].map((heading) => (
                      <TableCell key={heading} sx={headerCellSx}>
                        {heading}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {samples.map((sample, index) => (
                    <TableRow key={sample._id || index} hover>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: "nowrap" }}>
                        {dash(sample.fullSampleID || `Sample ${index + 1}`)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {sample.location === "Field blank"
                          ? "—"
                          : dash(sample.type)}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 160 }}>
                        {dash(sample.location)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {dash(sample.startTime)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {dash(sample.endTime)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {sample.status === "failed" ? (
                          <Typography
                            component="span"
                            variant="body2"
                            color="error"
                            sx={{ fontWeight: 600 }}
                          >
                            Failed
                          </Typography>
                        ) : (
                          dash(sample.averageFlowrate)
                        )}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {dash(personName(sample.sampler))}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {dash(sample.analysis?.fibresCounted)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {dash(sample.analysis?.fieldsCounted)}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: "nowrap" }}>
                        {dash(formatReportedConcentration(sample.analysis))}
                      </TableCell>
                      {showDust && (
                        <TableCell sx={bodyCellSx}>
                          {dash(sample.analysis?.backgroundDust)}
                        </TableCell>
                      )}
                      {showEdges && (
                        <TableCell sx={bodyCellSx}>
                          {dash(sample.analysis?.edgesDistribution)}
                        </TableCell>
                      )}
                      <TableCell sx={bodyCellSx}>
                        <StatusChip status={sample.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Section>
      </>
    );
  };

  const renderClearance = () => {
    const { clearance } = payload;
    const items = Array.isArray(clearance?.items) ? clearance.items : [];
    const showLevel = items.some((item) => text(item.levelFloor));
    const showNotes = items.some((item) => text(item.notes));

    return (
      <>
        <Section title="Clearance">
          <Fields
            items={[
              {
                label: "Clearance date",
                value: dateValue(clearance?.clearanceDate),
              },
              { label: "Inspection time", value: clearance?.inspectionTime },
              { label: "Type", value: clearance?.clearanceType },
              { label: "Jurisdiction", value: clearance?.jurisdiction },
              { label: "Status", value: humanize(clearance?.status) },
              { label: "LAA", value: clearance?.LAA },
              {
                label: "Asbestos removalist",
                value: clearance?.asbestosRemovalist,
              },
              { label: "Secondary header", value: clearance?.secondaryHeader },
              { label: "Air monitoring", value: clearance?.airMonitoring },
              { label: "Site plan", value: clearance?.sitePlan },
              { label: "Report approved by", value: clearance?.reportApprovedBy },
              {
                label: "Report issue date",
                value: dateValue(clearance?.reportIssueDate),
              },
              { label: "Report reference", value: clearance?.reportReference },
              { label: "Revision", value: clearance?.revision ?? 0 },
              {
                label: "Job-specific exclusions",
                value: clearance?.jobSpecificExclusions,
                full: true,
              },
              {
                label: "Vehicle / equipment description",
                value: clearance?.vehicleEquipmentDescription,
                full: true,
              },
              { label: "Notes", value: clearance?.notes, full: true },
            ]}
          />
        </Section>

        <Section title="Clearance items" count={items.length} flush>
          {!items.length ? (
            <EmptyNote>No clearance items.</EmptyNote>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{ "&:hover": { backgroundColor: "transparent" } }}
                  >
                    {[
                      ...(showLevel ? ["Level / floor"] : []),
                      "Room / area",
                      "Location",
                      "Material",
                      "Asbestos type",
                      ...(showNotes ? ["Notes"] : []),
                    ].map((heading) => (
                      <TableCell key={heading} sx={headerCellSx}>
                        {heading}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item._id || index} hover>
                      {showLevel && (
                        <TableCell sx={bodyCellSx}>
                          {dash(item.levelFloor)}
                        </TableCell>
                      )}
                      <TableCell sx={{ ...bodyCellSx, minWidth: 120 }}>
                        {dash(item.roomArea)}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 180 }}>
                        {dash(item.locationDescription)}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 160 }}>
                        {dash(item.materialDescription)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {text(item.asbestosType) ? (
                          <Chip
                            label={humanize(item.asbestosType)}
                            size="small"
                            color={asbestosTypeColor(item.asbestosType)}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {showNotes && (
                        <TableCell
                          sx={{
                            ...bodyCellSx,
                            minWidth: 160,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {dash(item.notes)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Section>
      </>
    );
  };

  const renderEnclosure = () => {
    const { clearance } = payload;
    const photos = Array.isArray(clearance?.enclosurePhotos)
      ? clearance.enclosurePhotos
      : [];
    const inspectionTime = clearance?.enclosureInspectionDateTime
      ? new Date(clearance.enclosureInspectionDateTime).toLocaleTimeString(
          "en-AU",
          { hour: "2-digit", minute: "2-digit" },
        )
      : clearance?.inspectionTime;

    return (
      <>
        <Section title="Enclosure certificate">
          <Fields
            items={[
              { label: "Clearance type", value: clearance?.clearanceType },
              { label: "Jurisdiction", value: clearance?.jurisdiction },
              { label: "Status", value: humanize(clearance?.status) },
              { label: "LAA", value: clearance?.LAA },
              {
                label: "Asbestos removalist",
                value: clearance?.asbestosRemovalist,
              },
              {
                label: "Inspection date",
                value: dateValue(
                  clearance?.enclosureInspectionDateTime ||
                    clearance?.clearanceDate,
                ),
              },
              { label: "Inspection time", value: inspectionTime },
              {
                label: "Inspected by",
                value: clearance?.enclosureInspectedBy || clearance?.LAA,
              },
              {
                label: "Certificate approved by",
                value: clearance?.enclosureCertificateApprovedBy,
              },
              {
                label: "Certificate issue date",
                value: dateValue(clearance?.enclosureCertificateIssueDate),
              },
              {
                label: "Certificate reference",
                value: clearance?.enclosureCertificateReportReference,
              },
              { label: "Revision", value: clearance?.revision ?? 0 },
              {
                label: "Enclosure description",
                value: clearance?.enclosureDescription,
                full: true,
              },
            ]}
          />
        </Section>

        <Section title="Enclosure photos" count={photos.length}>
          {!photos.length ? (
            <Typography color="text.secondary">No photo captions.</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {photos.map((photo, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "88px 1fr" },
                    gap: { xs: 0.25, sm: 2 },
                    alignItems: "baseline",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    Photo {index + 1}
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                    {photo?.description ||
                      "Photograph of removal enclosure taken during inspection"}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Section>
      </>
    );
  };

  const headerProject =
    payload?.kind === "shift"
      ? projectLabel(payload.job?.projectId)
      : projectLabel(payload?.clearance?.projectId);

  const headerStatus =
    payload?.kind === "shift"
      ? payload.shift?.status
      : payload?.clearance?.status;

  const headerDate =
    payload?.kind === "shift"
      ? dateValue(payload.shift?.date)
      : payload?.kind === "clearance"
        ? dateValue(payload.clearance?.clearanceDate)
        : dateValue(
            payload?.clearance?.enclosureInspectionDateTime ||
              payload?.clearance?.clearanceDate,
          );

  const headerMeta = [
    headerProject,
    headerDate,
    payload?.kind === "clearance" ? payload.clearance?.clearanceType : null,
    payload?.kind === "enclosure_certificate"
      ? payload.clearance?.clearanceType
      : null,
  ]
    .map((value) => text(value))
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleBack}
        sx={{ mb: 2, ml: -1 }}
      >
        Back to project reports
      </Button>

      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {!loading && !error && headerMeta && (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mt: 0.75 }}
            >
              {headerMeta}
            </Typography>
          )}
        </Box>
        {!loading && !error && <StatusChip status={headerStatus} />}
      </Box>

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
