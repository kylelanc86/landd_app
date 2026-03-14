/**
 * Formats a phone number to the appropriate format
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - The formatted phone number
 */
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') return '';
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid Australian mobile number (10 digits starting with 04)
  if (cleaned.length === 10 && cleaned.startsWith('04')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  // Check if it's a valid Australian landline number (8-9 digits starting with 02, 03, 07, 08)
  if ((cleaned.length === 8 || cleaned.length === 9) && 
      (cleaned.startsWith('02') || cleaned.startsWith('03') || 
       cleaned.startsWith('07') || cleaned.startsWith('08'))) {
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
    } else {
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
    }
  }
  
  // If it's not a valid format, return the cleaned number
  return cleaned;
};

/**
 * Validates if a phone number is a valid Australian mobile number or dash
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
export const isValidAustralianMobile = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  // Allow dash as a valid entry
  if (phoneNumber === '-') return true;
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid Australian mobile number (10 digits starting with 04)
  return cleaned.length === 10 && cleaned.startsWith('04');
};

/**
 * Validates if a phone number is a valid Australian phone number (mobile or landline) or dash
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
export const isValidAustralianPhone = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  // Allow dash as a valid entry
  if (phoneNumber === '-') return true;
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid Australian mobile number (10 digits starting with 04)
  if (cleaned.length === 10 && cleaned.startsWith('04')) {
    return true;
  }
  
  // Check if it's a valid Australian landline number (8-9 digits starting with 02, 03, 07, 08)
  if ((cleaned.length === 8 || cleaned.length === 9) && 
      (cleaned.startsWith('02') || cleaned.startsWith('03') || 
       cleaned.startsWith('07') || cleaned.startsWith('08'))) {
    return true;
  }
  
  return false;
};

/**
 * Validates if an email is valid or is a dash
 * @param {string} email - The email to validate
 * @returns {boolean} - Whether the email is valid
 */
export const isValidEmailOrDash = (email) => {
  if (!email) return false;
  
  // Allow dash as a valid entry
  if (email === '-') return true;
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Formats an authoriser/approver full name for display: first name as initial only, e.g. "John Smith" -> "J. Smith"
 * @param {string} fullName - Full name (e.g. "First Last")
 * @returns {string} - Display form (e.g. "F. Last") or original if no space
 */
export const formatAuthoriserDisplayName = (fullName) => {
  if (!fullName || typeof fullName !== "string") return fullName || "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex <= 0) return trimmed.length > 0 ? `${trimmed[0]}.` : "";
  return `${trimmed[0]}. ${trimmed.slice(spaceIndex + 1)}`;
};

/**
 * Formats a fibre ID lab reference for display so it always shows the "Lab" suffix.
 * Converts legacy format "PROJ-1" to "PROJ-Lab1"; leaves "PROJ-Lab1" unchanged.
 * @param {string} labRef - Stored lab reference (e.g. "LDJ01234-1" or "LDJ01234-Lab1")
 * @returns {string} - Display form (e.g. "LDJ01234-Lab1")
 */
export const formatLabReferenceForDisplay = (labRef) => {
  if (!labRef || typeof labRef !== "string") return labRef || "";
  const trimmed = labRef.trim();
  if (!trimmed) return "";
  if (/-Lab\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(.+)-(\d+)$/);
  if (match) return `${match[1]}-Lab${match[2]}`;
  return trimmed;
};

/**
 * Parses the numeric suffix from a lab reference for sorting (e.g. "PROJ-Lab10" -> 10, "PROJ-5" -> 5).
 * @param {string} labRef - Lab reference string
 * @returns {number} - The number after -Lab or after last -, or 0 if not parseable
 */
export const parseLabReferenceNumber = (labRef) => {
  if (!labRef || typeof labRef !== "string") return 0;
  const labMatch = labRef.match(/-Lab(\d+)$/);
  if (labMatch) return parseInt(labMatch[1], 10);
  const numMatch = labRef.match(/-(\d+)$/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return 0;
};

/**
 * Comparator for sorting lab references numerically (Lab1, Lab2, ..., Lab9, Lab10, Lab11)
 * instead of lexicographically (Lab1, Lab10, Lab11, Lab2, ...).
 * Use with Array.prototype.sort: items.sort(compareLabReference).
 * @param {string} a - First lab reference
 * @param {string} b - Second lab reference
 * @returns {number} - Negative if a < b, positive if a > b, 0 if equal
 */
export const compareLabReference = (a, b) => {
  const refA = (a && a.labReference) || (typeof a === "string" ? a : "") || "";
  const refB = (b && b.labReference) || (typeof b === "string" ? b : "") || "";
  const prefixA = refA.replace(/-Lab?\d+$/, "") || refA;
  const prefixB = refB.replace(/-Lab?\d+$/, "") || refB;
  const cmpPrefix = prefixA.localeCompare(prefixB);
  if (cmpPrefix !== 0) return cmpPrefix;
  const numA = parseLabReferenceNumber(refA);
  const numB = parseLabReferenceNumber(refB);
  return numA - numB;
};
