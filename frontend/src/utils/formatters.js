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

 