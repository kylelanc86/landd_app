import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { formatDateInSydney } from './dateUtils';

const SYDNEY_TZ = 'Australia/Sydney';

const toSydneyDateKey = (date) => {
  if (!date) return null;
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return null;
  const sydney = utcToZonedTime(parsed, SYDNEY_TZ);
  return format(sydney, 'yyyy-MM-dd');
};

const areConsecutiveDays = (sortedDateKeys) => {
  for (let i = 1; i < sortedDateKeys.length; i += 1) {
    const prev = new Date(`${sortedDateKeys[i - 1]}T12:00:00`);
    const curr = new Date(`${sortedDateKeys[i]}T12:00:00`);
    const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
    if (diffDays !== 1) return false;
  }
  return true;
};

/**
 * Format one or more analysis dates for display in reports and read-only views.
 * - 1 date: {date1}
 * - 2 dates: {date1} & {date2}
 * - 3+ consecutive: {date1} - {date(n)}
 * - 3+ non-consecutive: {date1}, {date2}, ... & {date(n)}
 */
export const formatAnalysisDates = (dates) => {
  if (!dates?.length) return 'N/A';

  const keys = [...new Set(dates.map(toSydneyDateKey).filter(Boolean))].sort();
  if (keys.length === 0) return 'N/A';
  if (keys.length === 1) return formatDateInSydney(keys[0]);

  const formatted = keys.map((key) => formatDateInSydney(key));

  if (keys.length === 2) {
    return `${formatted[0]} & ${formatted[1]}`;
  }

  if (areConsecutiveDays(keys)) {
    return `${formatted[0]} - ${formatted[formatted.length - 1]}`;
  }

  const last = formatted[formatted.length - 1];
  const rest = formatted.slice(0, -1);
  return `${rest.join(', ')} & ${last}`;
};

/** Resolve analysis dates from a record (supports legacy single analysisDate). */
export const getRecordAnalysisDates = (record) => {
  if (record?.analysisDates?.length) {
    return record.analysisDates;
  }
  if (record?.analysisDate) {
    return [record.analysisDate];
  }
  return [];
};

const toDateKey = (date) => {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return toSydneyDateKey(date);
};

/** Validate analysis dates are present, unique, and in ascending chronological order. */
export const validateAnalysisDates = (dates) => {
  const keys = (dates || []).map(toDateKey).filter(Boolean);

  if (keys.length === 0) {
    return { ok: false, message: 'Please enter at least one analysis date.' };
  }

  if (new Set(keys).size !== keys.length) {
    return { ok: false, message: 'Analysis dates must be unique.' };
  }

  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i] <= keys[i - 1]) {
      return {
        ok: false,
        message: 'Analysis dates must be in chronological order.',
      };
    }
  }

  return { ok: true };
};
