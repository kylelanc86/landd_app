// Risk Assessment Table Content Management
// This file contains the structured data for the Risk Assessment table
// to make it easier to generate and maintain the table HTML

const riskAssessmentTableData = {
  categories: [
    {
      risk: "VERY LOW RISK",
      description: "Materials in excellent condition, well bonded, in very low traffic areas, and extremely unlikely to be disturbed during normal activities. These materials pose minimal risk to health and safety.",
      color: "#90EE90", // Light green
      shading: "light green"
    },
    {
      risk: "LOW RISK",
      description: "Materials in good condition, well bonded, in low traffic areas, and unlikely to be disturbed during normal activities. These materials pose minimal risk to health and safety.",
      color: "#FFFFE0", // Light yellow
      shading: "light yellow"
    },
    {
      risk: "MEDIUM RISK",
      description: "Materials in fair condition, may be slightly damaged or in moderate traffic areas. These materials pose a moderate risk and should be managed appropriately.",
      color: "#FFA500", // Orange
      shading: "orange"
    },
    {
      risk: "HIGH RISK",
      description: "Materials in poor condition, damaged, friable, or in high traffic areas where disturbance is likely. These materials pose a significant risk and require immediate attention.",
      color: "#FFB6C1", // Light pink
      shading: "light pink"
    }
  ]
};

// Function to generate the HTML table
const generateRiskAssessmentTable = () => {
  const { categories } = riskAssessmentTableData;
  
  if (categories.length !== 4) {
    console.error('Risk assessment table requires exactly 4 categories');
    return '';
  }
  
  return `
    <div style="margin: 12px 0;">
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #444; font-size: 0.9rem;">
        <tr>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[0].color}; font-weight: bold; text-align: center; width: 30%;">${categories[0].risk}</td>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[0].color}; vertical-align: top;">${categories[0].description}</td>
        </tr>
        <tr>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[1].color}; font-weight: bold; text-align: center; width: 30%;">${categories[1].risk}</td>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[1].color}; vertical-align: top;">${categories[1].description}</td>
        </tr>
        <tr>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[2].color}; font-weight: bold; text-align: center; width: 30%;">${categories[2].risk}</td>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[2].color}; vertical-align: top;">${categories[2].description}</td>
        </tr>
        <tr>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[3].color}; font-weight: bold; text-align: center; width: 30%;">${categories[3].risk}</td>
          <td style="border: 2px solid #444; padding: 8px; background-color: ${categories[3].color}; vertical-align: top;">${categories[3].description}</td>
        </tr>
      </table>
    </div>
  `;
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