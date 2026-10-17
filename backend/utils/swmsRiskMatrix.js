const RATINGS = {
  1: { 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'Medium', 5: 'High' },
  2: { 1: 'Low', 2: 'Medium', 3: 'Medium', 4: 'High', 5: 'High' },
  3: { 1: 'Medium', 2: 'Medium', 3: 'High', 4: 'High', 5: 'Extreme' },
  4: { 1: 'Medium', 2: 'High', 3: 'High', 4: 'Extreme', 5: 'Extreme' },
  5: { 1: 'High', 2: 'High', 3: 'Extreme', 4: 'Extreme', 5: 'Extreme' },
};

const parseLevel = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return null;
  return number;
};

const getSwmsRiskRating = (probability, severity) => {
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

module.exports = {
  getSwmsRiskRating,
  parseLevel,
};
