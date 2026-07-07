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

export function buildShiftChainOfCustodyFilename(projectID, shiftDate) {
  const id = projectID || 'Unknown';
  const date = shiftDate ? formatDateInSydney(shiftDate) : 'N/A';
  return `${id}: Chain of Custody - ${date}.pdf`;
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
