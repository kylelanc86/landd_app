'use strict';

/**
 * Map common typographic punctuation to ASCII so the legacy filename= parameter
 * stays readable when the string is otherwise Latin-1-safe for Node headers.
 */
function replaceCommonUnicodePunctuation(s) {
  return String(s)
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014\u2212\u2010\u2011]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2026/g, '...');
}

/**
 * Node's HTTP stack rejects outgoing header values containing code points > U+00FF,
 * ASCII control characters (except HTAB in some cases), and DEL.
 * Build a safe value for the quoted `filename` parameter.
 */
function makeAsciiFilenameFallback(filename) {
  const normalized = replaceCommonUnicodePunctuation(filename);
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code === 34 || code === 92) {
      out += '_';
    } else if (code === 9) {
      out += ' ';
    } else if (code >= 32 && code <= 126) {
      out += normalized[i];
    } else if (code >= 128 && code <= 255) {
      out += normalized[i];
    } else {
      out += '_';
    }
  }
  let t = out.trim();
  if (!t) t = 'download';
  if (t.length > 200) t = t.slice(0, 200);
  return t;
}

/**
 * Content-Disposition for attachment downloads: RFC 5987 filename* (UTF-8) for the
 * real name (commas, apostrophes, full Unicode), plus ASCII filename fallback for Node.
 */
function buildContentDispositionAttachment(filename, options = {}) {
  const defaultName = options.defaultFilename || 'download.pdf';
  const nameRaw =
    filename == null || String(filename).trim() === ''
      ? defaultName
      : String(filename);
  // Unit-complex site names commonly use x/y; map "/" to ", " for filenames.
  const name = nameRaw.replace(/\//g, ', ');
  const fallback = makeAsciiFilenameFallback(name);
  const star = encodeURIComponent(name).replace(/'/g, '%27');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${star}`;
}

module.exports = {
  buildContentDispositionAttachment,
  makeAsciiFilenameFallback,
};
