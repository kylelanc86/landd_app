// Format date with full month name (e.g. 01 January 2026)
export const formatDateFull = (date) => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Date";
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("default", { month: "long" });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (error) {
    return "Invalid Date";
  }
};

// Format date to Australian format (dd/mm/yyyy)
export const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Date";
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return "Invalid Date";
  }
};

// Parse Australian format date string to Date object
export const parseDate = (dateString) => {
  if (!dateString) return null;
  try {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
  } catch (error) {
    return null;
  }
};

// Format date for input fields (yyyy-mm-dd)
export const formatDateForInput = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return "";
  }
}; 