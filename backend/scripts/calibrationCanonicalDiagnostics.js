const dotenv = require("dotenv");
const connectDB = require("../config/db");
const {
  getCanonicalDiagnostics,
} = require("../services/calibrationCanonicalService");

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    const diagnostics = await getCanonicalDiagnostics({ forceRefresh: true });

    console.log("=== Canonical Calibration Diagnostics ===");
    console.log(JSON.stringify(diagnostics.totals, null, 2));
    console.log("\nBy Source Type:");
    console.log(JSON.stringify(diagnostics.bySourceType, null, 2));

    if (diagnostics.potentialSupersededChains.length > 0) {
      console.log("\nTop Potential Superseded Chains:");
      diagnostics.potentialSupersededChains.slice(0, 25).forEach((entry) => {
        console.log(`- ${entry.key}: ${entry.count} records`);
      });
    } else {
      console.log("\nNo potential superseded chains detected.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed to run canonical calibration diagnostics:", error);
    process.exit(1);
  }
};

run();
