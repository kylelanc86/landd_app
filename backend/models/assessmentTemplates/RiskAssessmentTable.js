// Risk Assessment Table Content Management
// This file contains the structured data for the Risk Assessment table
// to generate a 2-column, 4-row table (column 1 = 17% width) with risk levels and descriptions

const riskAssessmentTableData = {
  categories: [
    {
      risk: "Very Low Risk:",
      description: "Material is very unlikely to pose an exposure risk in its current condition during standard building use",
      color: "#90EE90" // green shading
    },
    {
      risk: "Low Risk:",
      description: "Material is unlikely to pose an exposure risk in its current condition during standard building use",
      color: "#FFFF00" // yellow shading
    },
    {
      risk: "Medium Risk:",
      description: "Material is likely to pose an exposure risk in its current condition during standard building use",
      color: "#FFA500" // orange shading
    },
    {
      risk: "High Risk:",
      description: "Material poses an exposure risk in its current condition",
      color: "#FF6B6B" // red shading
    }
  ]
};

// Function to generate the HTML table (2 columns, 4 rows; first column 17% width)
// Returns single-line HTML so placeholder replacement does not break table when \n -> <br>
const generateRiskAssessmentTable = () => {
  const { categories } = riskAssessmentTableData;

  if (categories.length !== 4) {
    console.error('Risk assessment table requires exactly 4 categories');
    return '';
  }

  const rows = categories.map(
    (c) =>
      `<tr><td style="border: 1px solid #888; padding: 6px 8px; background-color: ${c.color}; font-weight: bold; width: 15%; vertical-align: top;">${c.risk}</td><td style="border: 1px solid #888; padding: 6px 8px; background-color: ${c.color}; vertical-align: top;">${c.description}</td></tr>`
  ).join('');

  return `<div style="margin: 12px 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;"><tbody>${rows}</tbody></table></div>`;
};

// Function to get the table data for external use
const getRiskAssessmentTableData = () => {
  return riskAssessmentTableData;
};

module.exports = {
  riskAssessmentTableData,
  generateRiskAssessmentTable,
  getRiskAssessmentTableData
};
