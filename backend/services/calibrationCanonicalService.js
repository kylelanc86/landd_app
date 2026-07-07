const Equipment = require("../models/Equipment");
const AirPumpCalibration = require("../models/AirPumpCalibration");
const FlowmeterCalibration = require("../models/FlowmeterCalibration");
const PrimaryFlowmeterCalibration = require("../models/PrimaryFlowmeterCalibration");
const FurnaceCalibration = require("../models/FurnaceCalibration");
const PneumaticTesterCalibration = require("../models/PneumaticTesterCalibration");
const MassBalanceCalibration = require("../models/MassBalanceCalibration");
const MicrometerCalibration = require("../models/MicrometerCalibration");
const FumeHoodCalibration = require("../models/FumeHoodCalibration");
const CaliperCalibration = require("../models/CaliperCalibration");
const SieveCalibration = require("../models/SieveCalibration");
const AcetoneVaporiserCalibration = require("../models/AcetoneVaporiserCalibration");
const RiLiquidCalibration = require("../models/RiLiquidCalibration");
const EFACalibration = require("../models/EFACalibration");
const GraticuleCalibration = require("../models/GraticuleCalibration");
const HSETestSlideCalibration = require("../models/HSETestSlideCalibration");
const PCMMicroscopeCalibration = require("../models/PCMMicroscopeCalibration");
const PLMMicroscopeCalibration = require("../models/PLMMicroscopeCalibration");
const StereomicroscopeCalibration = require("../models/StereomicroscopeCalibration");
const IAQRecord = require("../models/IAQRecord");
const ProjectAudit = require("../models/ProjectAudit");

const CACHE_TTL_MS = 60000;

const CANONICAL_CALIBRATION_CONTRACT = {
  equipmentId: "ObjectId|null",
  equipmentReference: "string|null",
  sourceType: "string",
  calibrationAt: "Date",
  nextCalibrationAt: "Date|null",
  recordId: "ObjectId|string",
  updatedAt: "Date|null",
  createdAt: "Date|null",
  isSuperseded: "boolean",
};

let cache = {
  generatedAt: 0,
  events: [],
  latestEvents: [],
  notifications: [],
  latestByEquipmentReference: {},
};

const calibrationConfigs = [
  { sourceType: "Air Pump Calibration", model: AirPumpCalibration, eventField: "calibrationDate", dueField: "nextCalibrationDue", refField: "pumpId", refKind: "equipmentId" },
  { sourceType: "Site Rotameter Calibration", model: FlowmeterCalibration, eventField: "date", dueField: "nextCalibration", refField: "flowmeterId", refKind: "equipmentReference" },
  { sourceType: "Primary Flowmeter Calibration", model: PrimaryFlowmeterCalibration, eventField: "date", dueField: "nextCalibration", refField: "flowmeterReference", refKind: "equipmentReference" },
  { sourceType: "Furnace Calibration", model: FurnaceCalibration, eventField: "date", dueField: "nextCalibration", refField: "furnaceReference", refKind: "equipmentReference" },
  { sourceType: "Pneumatic Tester Calibration", model: PneumaticTesterCalibration, eventField: "date", dueField: "nextCalibration", refField: "pneumaticTesterReference", refKind: "equipmentReference" },
  { sourceType: "Mass Balance Calibration", model: MassBalanceCalibration, eventField: "date", dueField: "nextCalibration", refField: "massBalanceReference", refKind: "equipmentReference" },
  { sourceType: "Micrometer Calibration", model: MicrometerCalibration, eventField: "date", dueField: "nextCalibration", refField: "micrometerReference", refKind: "equipmentReference" },
  { sourceType: "Fume Hood Calibration", model: FumeHoodCalibration, eventField: "date", dueField: "nextCalibration", refField: "fumeHoodReference", refKind: "equipmentReference" },
  { sourceType: "Caliper Calibration", model: CaliperCalibration, eventField: "date", dueField: "nextCalibration", refField: "caliperReference", refKind: "equipmentReference" },
  { sourceType: "Sieve Calibration", model: SieveCalibration, eventField: "date", dueField: null, refField: "sieveReference", refKind: "equipmentReference" },
  { sourceType: "Acetone Vaporiser Calibration", model: AcetoneVaporiserCalibration, eventField: "date", dueField: "nextCalibration", refField: "vaporiserId", refKind: "equipmentId" },
  { sourceType: "RI Liquid Calibration", model: RiLiquidCalibration, eventField: "date", dueField: "nextCalibration", refField: "bottleId", refKind: "equipmentReference" },
  { sourceType: "EFA Calibration", model: EFACalibration, eventField: "date", dueField: "nextCalibration", refField: "filterHolderModel", refKind: "equipmentReference" },
  { sourceType: "Graticule Calibration", model: GraticuleCalibration, eventField: "date", dueField: "nextCalibration", refField: "graticuleId", refKind: "equipmentReference" },
  { sourceType: "HSE Test Slide Calibration", model: HSETestSlideCalibration, eventField: "date", dueField: "nextCalibration", refField: "testSlideReference", refKind: "equipmentReference" },
  { sourceType: "PCM Microscope Calibration", model: PCMMicroscopeCalibration, eventField: "date", dueField: "nextCalibration", refField: "microscopeReference", refKind: "equipmentReference" },
  { sourceType: "PLM Microscope Calibration", model: PLMMicroscopeCalibration, eventField: "date", dueField: "nextCalibration", refField: "microscopeReference", refKind: "equipmentReference" },
  { sourceType: "Stereomicroscope Calibration", model: StereomicroscopeCalibration, eventField: "date", dueField: "nextCalibration", refField: "microscopeReference", refKind: "equipmentReference" },
];

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeRef = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveEquipmentIdRef = async (eventsNeedingLookup) => {
  const ids = Array.from(
    new Set(
      eventsNeedingLookup
        .map((item) => item.rawRef)
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  );
  if (ids.length === 0) return {};

  const equipment = await Equipment.find({ _id: { $in: ids } })
    .select("_id equipmentReference")
    .lean();

  return equipment.reduce((acc, eq) => {
    acc[String(eq._id)] = eq.equipmentReference;
    return acc;
  }, {});
};

const toCanonicalEvent = (record, config) => {
  const calibrationAt = parseDate(record[config.eventField]);
  if (!calibrationAt) return null;

  let nextCalibrationAt = null;
  if (config.dueField) {
    nextCalibrationAt = parseDate(record[config.dueField]);
  }

  const rawRef = record[config.refField];
  const isSuperseded =
    Boolean(record.isArchived) ||
    Boolean(record.archivedAt) ||
    Boolean(record.supersededAt);

  return {
    sourceType: config.sourceType,
    recordId: String(record._id),
    calibrationAt,
    nextCalibrationAt,
    updatedAt: parseDate(record.updatedAt),
    createdAt: parseDate(record.createdAt),
    rawRef,
    refKind: config.refKind,
    equipmentId: config.refKind === "equipmentId" ? normalizeRef(rawRef) : null,
    equipmentReference:
      config.refKind === "equipmentReference" ? normalizeRef(rawRef) : null,
    isSuperseded,
  };
};

const pickLatest = (existing, candidate) => {
  if (!existing) return candidate;
  const existingTs = existing.calibrationAt?.getTime() || 0;
  const candidateTs = candidate.calibrationAt?.getTime() || 0;
  if (candidateTs !== existingTs) return candidateTs > existingTs ? candidate : existing;

  const existingUpdatedTs = existing.updatedAt?.getTime() || 0;
  const candidateUpdatedTs = candidate.updatedAt?.getTime() || 0;
  if (candidateUpdatedTs !== existingUpdatedTs) {
    return candidateUpdatedTs > existingUpdatedTs ? candidate : existing;
  }

  const existingCreatedTs = existing.createdAt?.getTime() || 0;
  const candidateCreatedTs = candidate.createdAt?.getTime() || 0;
  return candidateCreatedTs > existingCreatedTs ? candidate : existing;
};

const CALIBRATION_RECORD_DESCRIPTIONS = {
  "Air Pump Calibration": "Air Monitor",
  "Site Rotameter Calibration": "Site Rotameter",
  "Primary Flowmeter Calibration": "Primary Flowmeter",
  "Furnace Calibration": "Furnace",
  "Pneumatic Tester Calibration": "Pneumatic Tester",
  "Mass Balance Calibration": "Mass Balance",
  "Micrometer Calibration": "Micrometer",
  "Fume Hood Calibration": "Fume Hood",
  "Caliper Calibration": "Caliper",
  "Sieve Calibration": "Sieve",
  "Acetone Vaporiser Calibration": "Acetone Vaporiser",
  "RI Liquid Calibration": "RI Liquid",
  "EFA Calibration": "Effective Filter Area",
  "Graticule Calibration": "PCM Graticule",
  "HSE Test Slide Calibration": "HSE Test Slide",
  "PCM Microscope Calibration": "PCM Microscope",
  "PLM Microscope Calibration": "PLM Microscope",
  "Stereomicroscope Calibration": "Stereomicroscope",
};

const formatMonthYear = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return parsed.toLocaleString("en-AU", { month: "long", year: "numeric" });
};

const buildCalibrationRecordDescription = (sourceType) =>
  CALIBRATION_RECORD_DESCRIPTIONS[sourceType] ||
  sourceType.replace(/\s+Calibration$/, "");

const buildIaqRecordDescription = (monitoringDate) => {
  const monthYear = formatMonthYear(monitoringDate);
  return monthYear || "Indoor Air Quality";
};

// TODO(audit-notifications): When audit notifications are added, populate auditRows
// with recordDescription built from audit type + due month, e.g. "Internal Audit - July 2026".
const buildAuditRecordDescription = (auditType, dueDate) => {
  const monthYear = formatMonthYear(dueDate);
  const label = auditType || "Audit";
  return monthYear ? `${label} - ${monthYear}` : label;
};

const buildNotificationRows = (
  latestEvents,
  { daysWindow = 30, outOfServiceRefs = new Set() } = {},
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = latestEvents
    .filter((event) => event.nextCalibrationAt)
    .filter((event) => !outOfServiceRefs.has(event.equipmentReference))
    .map((event) => {
      const dueDate = new Date(event.nextCalibrationAt);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: `${event.sourceType}-${event.recordId}`,
        recordType: "Calibration",
        recordDescription: buildCalibrationRecordDescription(event.sourceType),
        equipmentReference: event.equipmentReference,
        sourceType: event.sourceType,
        recordId: event.recordId,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        calibrationAt: event.calibrationAt?.toISOString() || null,
      };
    })
    .filter((row) => row.daysUntilDue <= daysWindow);

  // TODO(iaq-notifications): Load IAQ records due within daysWindow and map rows with:
  // recordType: "IAQ", recordDescription: buildIaqRecordDescription(record.monitoringDate)
  const iaqRows = [];

  // TODO(audit-notifications): Load audit records due within daysWindow and map rows with:
  // recordType: "Audit", recordDescription: buildAuditRecordDescription(auditType, dueDate)
  const auditRows = [];

  const allRows = [...rows, ...iaqRows, ...auditRows].map((row) => {
    if (row.daysUntilDue < 0) return { ...row, bucket: "overdue", sortOrder: 0 };
    if (row.daysUntilDue < 7) return { ...row, bucket: "dueSoon", sortOrder: 1 };
    return { ...row, bucket: "dueThisMonth", sortOrder: 2 };
  });

  allRows.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.daysUntilDue - b.daysUntilDue;
  });

  return allRows;
};

const buildLatestByEquipmentReference = (latestEvents) => {
  const grouped = {};
  latestEvents.forEach((event) => {
    if (!event.equipmentReference) return;
    if (!grouped[event.equipmentReference]) grouped[event.equipmentReference] = [];
    grouped[event.equipmentReference].push(event);
  });
  return grouped;
};

const refreshCache = async () => {
  const rawBySource = await Promise.all(
    calibrationConfigs.map(async (config) => {
      const docs = await config.model.find().lean();
      return { config, docs };
    }),
  );

  const events = [];
  const idBackedEvents = [];

  rawBySource.forEach(({ config, docs }) => {
    docs.forEach((doc) => {
      const event = toCanonicalEvent(doc, config);
      if (!event || event.isSuperseded) return;
      events.push(event);
      if (event.refKind === "equipmentId" && event.equipmentId) {
        idBackedEvents.push(event);
      }
    });
  });

  const equipmentRefById = await resolveEquipmentIdRef(idBackedEvents);
  idBackedEvents.forEach((event) => {
    event.equipmentReference = normalizeRef(
      equipmentRefById[String(event.equipmentId)] || null,
    );
  });

  const latestMap = new Map();
  events.forEach((event) => {
    const refKey = event.equipmentReference || event.equipmentId;
    if (!refKey) return;
    const key = `${event.sourceType}|${refKey}`;
    latestMap.set(key, pickLatest(latestMap.get(key), event));
  });

  const latestEvents = Array.from(latestMap.values()).filter(
    (event) => event.equipmentReference,
  );

  const outOfServiceEquipment = await Equipment.find({ status: "out-of-service" })
    .select("equipmentReference")
    .lean();
  const outOfServiceRefs = new Set(
    outOfServiceEquipment.map((eq) => eq.equipmentReference),
  );

  cache = {
    generatedAt: Date.now(),
    events,
    latestEvents,
    notifications: buildNotificationRows(latestEvents, { outOfServiceRefs }),
    latestByEquipmentReference: buildLatestByEquipmentReference(latestEvents),
  };
};

const ensureFresh = async ({ forceRefresh = false } = {}) => {
  if (
    !forceRefresh &&
    cache.generatedAt &&
    Date.now() - cache.generatedAt < CACHE_TTL_MS
  ) {
    return;
  }
  await refreshCache();
};

const invalidateCanonicalCache = () => {
  cache.generatedAt = 0;
};

const deriveDueState = (equipment, latestEventsForEquipment, dueSoonDays = 30) => {
  if (equipment.status === "out-of-service") {
    return {
      dueState: "out_of_service",
      dueDate: null,
      daysUntilDue: null,
      daysOverdue: null,
    };
  }

  const datedEvents = latestEventsForEquipment.filter((event) => event.nextCalibrationAt);
  if (datedEvents.length === 0) {
    return {
      dueState: "active",
      dueDate: null,
      daysUntilDue: null,
      daysOverdue: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueWithDays = datedEvents.map((event) => {
    const dueDate = new Date(event.nextCalibrationAt);
    dueDate.setHours(0, 0, 0, 0);
    const days = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { dueDate, days };
  });

  const mostUrgent = dueWithDays.sort((a, b) => a.days - b.days)[0];
  if (mostUrgent.days < 0) {
    return {
      dueState: "overdue",
      dueDate: mostUrgent.dueDate.toISOString(),
      daysUntilDue: mostUrgent.days,
      daysOverdue: Math.abs(mostUrgent.days),
    };
  }
  if (mostUrgent.days <= dueSoonDays) {
    return {
      dueState: "due",
      dueDate: mostUrgent.dueDate.toISOString(),
      daysUntilDue: mostUrgent.days,
      daysOverdue: null,
    };
  }

  return {
    dueState: "active",
    dueDate: mostUrgent.dueDate.toISOString(),
    daysUntilDue: mostUrgent.days,
    daysOverdue: null,
  };
};

const getEquipmentDueSnapshot = async (equipmentList, options = {}) => {
  await ensureFresh(options);
  return equipmentList.map((equipment) => {
    const latestEventsForEquipment =
      cache.latestByEquipmentReference[equipment.equipmentReference] || [];
    const due = deriveDueState(equipment, latestEventsForEquipment);
    return {
      ...equipment,
      ...due,
      latestCalibrationEvents: latestEventsForEquipment.map((event) => ({
        sourceType: event.sourceType,
        calibrationAt: event.calibrationAt?.toISOString() || null,
        nextCalibrationAt: event.nextCalibrationAt?.toISOString() || null,
        recordId: event.recordId,
      })),
    };
  });
};

const getNotificationSnapshot = async (options = {}) => {
  await ensureFresh(options);
  return {
    generatedAt: cache.generatedAt,
    rows: cache.notifications,
    urgentCount: cache.notifications.filter(
      (row) => row.bucket === "overdue" || row.bucket === "dueSoon",
    ).length,
  };
};

const getCanonicalDiagnostics = async (options = {}) => {
  await ensureFresh(options);

  const missingReferenceCount = cache.events.filter(
    (event) => !event.equipmentReference && !event.equipmentId,
  ).length;

  const bySourceType = cache.latestEvents.reduce((acc, event) => {
    acc[event.sourceType] = (acc[event.sourceType] || 0) + 1;
    return acc;
  }, {});

  const rawKeyCounts = {};
  cache.events.forEach((event) => {
    const refKey = event.equipmentReference || event.equipmentId;
    if (!refKey) return;
    const key = `${event.sourceType}|${refKey}`;
    rawKeyCounts[key] = (rawKeyCounts[key] || 0) + 1;
  });

  const potentialSupersededChains = Object.entries(rawKeyCounts)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return {
    generatedAt: cache.generatedAt,
    canonicalContract: CANONICAL_CALIBRATION_CONTRACT,
    totals: {
      rawEventCount: cache.events.length,
      latestEventCount: cache.latestEvents.length,
      notificationRowCount: cache.notifications.length,
      missingReferenceCount,
      potentialSupersededChains: potentialSupersededChains.length,
    },
    bySourceType,
    potentialSupersededChains,
  };
};

module.exports = {
  CANONICAL_CALIBRATION_CONTRACT,
  getEquipmentDueSnapshot,
  getNotificationSnapshot,
  getCanonicalDiagnostics,
  ensureFresh,
  invalidateCanonicalCache,
};
