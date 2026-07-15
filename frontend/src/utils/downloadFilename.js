import { formatDateInSydney } from './dateUtils';

export function parseContentDispositionFilename(disposition) {
  if (!disposition) return null;

  const starMatch = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1]);
    } catch {
      // fall through to quoted filename
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];

  return null;
}

export function getAxiosDownloadFilename(response, fallback) {
  const disposition =
    response?.headers?.['content-disposition'] ??
    response?.headers?.['Content-Disposition'];
  return parseContentDispositionFilename(disposition) || fallback;
}

function formatFilenameDateYYYYMMDD(dateValue = new Date()) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}${month}${day}`;
}

/** L&D-generated Chain of Custody form filename (generation date; no auth/sequence). */
export function buildShiftChainOfCustodyFilename(projectID, generationDate = new Date()) {
  const id = projectID || 'Unknown';
  const dateToken = formatFilenameDateYYYYMMDD(generationDate || new Date()) || formatFilenameDateYYYYMMDD(new Date());
  return `${id}_L&D Chain of Custody - ${dateToken}.pdf`;
}

export function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
