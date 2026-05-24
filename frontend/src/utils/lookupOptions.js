/**
 * Helpers for historical lookup fields (users, equipment) — display labels
 * independent of current dropdown option lists.
 */

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function resolveUserLabel(userOrId, usersList = []) {
  if (!userOrId) return '';
  if (typeof userOrId === 'object') {
    const name = `${userOrId.firstName || ''} ${userOrId.lastName || ''}`.trim();
    return name;
  }
  const str = String(userOrId).trim();
  if (OBJECT_ID_RE.test(str)) {
    const user = usersList.find((u) => String(u._id) === str);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  }
  return str;
}

export function buildUserDisplayLabel(userOrPopulated, fallbackName = '') {
  const fromPopulate = resolveUserLabel(userOrPopulated, []);
  if (fromPopulate) return fromPopulate;
  if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim();
  return '';
}

export function resolveEquipmentLabel(equipmentOrId) {
  if (!equipmentOrId) return '';
  if (typeof equipmentOrId === 'object') {
    const ref = equipmentOrId.equipmentReference || '';
    const brand = equipmentOrId.brandModel;
    if (ref && brand) return `${ref} - ${brand}`;
    return ref || '';
  }
  return String(equipmentOrId).trim();
}

export function buildEquipmentDisplayLabel(equipmentOrPopulated, fallback = '') {
  const fromPopulate = resolveEquipmentLabel(equipmentOrPopulated);
  if (fromPopulate) return fromPopulate;
  if (fallback && String(fallback).trim()) return String(fallback).trim();
  return '';
}

/**
 * @param {string} displayLabel - Resolved label to show
 * @param {{ required?: boolean, emptyDisplay?: string }} opts
 * @returns {string}
 */
export function formatLookupDisplay(displayLabel, opts = {}) {
  const { required = true, emptyDisplay = '-' } = opts;
  const trimmed = displayLabel != null ? String(displayLabel).trim() : '';
  if (trimmed) return trimmed;
  return required ? 'N/A' : emptyDisplay;
}

/** Map user list to { value, label } for LookupField */
export function userOptionsFromList(users, getValue = (u) => u._id) {
  return (users || []).map((u) => ({
    value: getValue(u),
    label: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
  }));
}

/** Map equipment list to { value, label } for LookupField */
export function equipmentOptionsFromList(equipment, getValue = (e) => String(e._id)) {
  return (equipment || []).map((e) => ({
    value: getValue(e),
    label: buildEquipmentDisplayLabel(e) || e.equipmentReference || '',
  }));
}
