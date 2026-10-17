export const PROBABILITY_OPTIONS = [
  { value: 1, label: "Rare" },
  { value: 2, label: "Unlikely" },
  { value: 3, label: "Possible" },
  { value: 4, label: "Likely" },
  { value: 5, label: "Almost Certain" },
];

export const SEVERITY_OPTIONS = [
  { value: 1, label: "Insignificant" },
  { value: 2, label: "Minor" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "Major" },
  { value: 5, label: "Catastrophic" },
];

// Typical 5×5 SWMS matrix. Row is probability, column is severity.
const RATINGS = {
  1: { 1: "Low", 2: "Low", 3: "Medium", 4: "Medium", 5: "High" },
  2: { 1: "Low", 2: "Medium", 3: "Medium", 4: "High", 5: "High" },
  3: { 1: "Medium", 2: "Medium", 3: "High", 4: "High", 5: "Extreme" },
  4: { 1: "Medium", 2: "High", 3: "High", 4: "Extreme", 5: "Extreme" },
  5: { 1: "High", 2: "High", 3: "Extreme", 4: "Extreme", 5: "Extreme" },
};

export const RATING_COLOURS = {
  Low: { backgroundColor: "#2e7d32", color: "#ffffff" },
  Medium: { backgroundColor: "#f9a825", color: "#1a1a1a" },
  High: { backgroundColor: "#ef6c00", color: "#ffffff" },
  Extreme: { backgroundColor: "#c62828", color: "#ffffff" },
};

const parseLevel = (value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return null;
  return number;
};

export const getSwmsRiskRating = (probability, severity) => {
  const p = parseLevel(probability);
  const s = parseLevel(severity);
  const rating = p && s ? RATINGS[p][s] : null;
  if (!rating) return null;
  return {
    probability: p,
    severity: s,
    score: p * s,
    rating,
  };
};
