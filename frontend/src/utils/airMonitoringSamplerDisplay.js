/** Display name for a populated User ref or raw id (ids alone yield empty string). */
export function formatAirMonitoringPersonName(ref) {
  if (!ref) return "";
  if (typeof ref === "object") {
    const fn = ref.firstName || "";
    const ln = ref.lastName ? ` ${ref.lastName}` : "";
    return `${fn}${ln}`.trim();
  }
  return "";
}

/**
 * Air monitoring sample: setup = sampler, pick-up = collectedBy.
 * Same person → one name; different → "Setup & Pickup".
 */
export function formatSampleSetupPickupLabel(sample) {
  if (!sample) return "";
  const setup = sample.sampler;
  const pickup = sample.collectedBy;
  const setupName = formatAirMonitoringPersonName(setup);
  const pickupName = formatAirMonitoringPersonName(pickup);
  const setupId =
    setup && typeof setup === "object" ? setup._id?.toString?.() || setup._id : setup;
  const pickupId =
    pickup && typeof pickup === "object"
      ? pickup._id?.toString?.() || pickup._id
      : pickup;

  const effectiveSetup = setupName || pickupName;
  const effectivePickup = pickupName || setupName;
  if (!effectiveSetup && !effectivePickup) return "";

  const haveBothIds = setupId && pickupId;
  const samePerson = haveBothIds
    ? String(setupId) === String(pickupId)
    : effectiveSetup === effectivePickup;

  if (samePerson) return effectiveSetup || effectivePickup;
  return `${effectiveSetup} & ${effectivePickup}`.replace(/\s+/g, " ").trim();
}

/** "Sampled by" line for shift PDF when deriving from samples (not client-supplied). */
export function uniqueShiftSampleSamplerLabels(samples) {
  if (!samples?.length) return [];
  return [
    ...new Set(
      samples.map((s) => formatSampleSetupPickupLabel(s)).filter(Boolean)
    ),
  ];
}
