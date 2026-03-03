/**
 * Format dates in Australia/Sydney timezone for reports and display.
 * Use these helpers for report authorisation dates, samples received dates, and issue dates.
 */

const SYDNEY_TZ = 'Australia/Sydney';

/**
 * Format a date as DD/MM/YYYY in Sydney timezone (en-GB style).
 * @param {Date|string|null|undefined} date
 * @returns {string} Formatted date or empty string
 */
function formatDateSydney(date) {
  if (date == null || date === '') return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { timeZone: SYDNEY_TZ });
}

/**
 * Format a date for clearance-style display (e.g. "26 February 2025") in Sydney timezone.
 * @param {Date|string|null|undefined} date
 * @returns {string} Formatted date or 'Unknown'
 */
function formatClearanceDateSydney(date) {
  if (date == null || date === '') return 'Unknown';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const str = d.toLocaleDateString('en-GB', {
    timeZone: SYDNEY_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  // Use non-breaking space between day and month to match original clearance format
  return str.replace(/^(\d+)\s/, '$1\u00A0');
}

/**
 * Current date/time in Sydney - date part only (DD/MM/YYYY).
 * Use for "PDF generation date", "Issue Date", "Authorisation Date" when using "now".
 */
function todaySydney() {
  return new Date().toLocaleDateString('en-GB', { timeZone: SYDNEY_TZ });
}

/**
 * Current date and time in Sydney (e.g. for "Printed" or email body).
 * @param {Object} options - Intl options for time (hour, minute)
 */
function nowSydneyDateTime(options = { hour: '2-digit', minute: '2-digit' }) {
  const d = new Date();
  const datePart = d.toLocaleDateString('en-GB', { timeZone: SYDNEY_TZ });
  const timePart = d.toLocaleTimeString('en-GB', { timeZone: SYDNEY_TZ, ...options });
  return `${datePart} ${timePart}`;
}

module.exports = {
  formatDateSydney,
  formatClearanceDateSydney,
  todaySydney,
  nowSydneyDateTime,
  SYDNEY_TZ
};
