import { format, parseISO } from 'date-fns';

// Format date to en-GB format (DD MMM YYYY)
export const formatDate = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'dd MMM yyyy');
};

// Format date and time to en-GB format (DD MMM YYYY HH:mm)
export const formatDateTime = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'dd MMM yyyy HH:mm');
};

// Format time to 24-hour format (HH:mm)
export const formatTime = (time) => {
  if (!time) return '';
  // If it's already in HH:mm format, return as is
  if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
    return time;
  }
  // If it's a full date string, parse and format just the time
  try {
    const parsedTime = typeof time === 'string' ? parseISO(time) : time;
    return format(parsedTime, 'HH:mm');
  } catch (error) {
    // If parsing fails, try to remove seconds from the time string
    if (typeof time === 'string' && time.includes(':')) {
      return time.split(':').slice(0, 2).join(':');
    }
    console.error('Error formatting time:', error);
    return time; // Return original value if parsing fails
  }
};

// Format date for input fields (YYYY-MM-DD)
export const formatDateForInput = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'yyyy-MM-dd');
}; 