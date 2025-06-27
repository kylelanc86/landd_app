const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", async () => {
  console.log("Connected to MongoDB");

  try {
    // Get the database
    const database = db.db;
    
    // Get collections
    const collections = await database.listCollections().toArray();
    console.log("Available collections:", collections.map(c => c.name));

    // Check if asbestos clearances collection exists
    const clearanceCollection = database.collection("asbestosclearances");
    const clearanceCount = await clearanceCollection.countDocuments();
    console.log(`Found ${clearanceCount} asbestos clearance documents`);

    // Check if asbestos clearance reports collection exists
    const reportCollection = database.collection("asbestosclearancereports");
    const reportCount = await reportCollection.countDocuments();
    console.log(`Found ${reportCount} asbestos clearance report documents`);

    // Add clearance IDs to reports if they don't exist
    if (reportCount > 0) {
      const reports = await reportCollection.find({}).toArray();
      let updatedCount = 0;

      for (const report of reports) {
        if (!report.clearanceId) {
          // Find the corresponding clearance based on some criteria
          // This is a placeholder - you'll need to define the logic
          const clearance = await clearanceCollection.findOne({
            // Add your matching criteria here
            // For example: projectId: report.projectId
          });

          if (clearance) {
            await reportCollection.updateOne(
              { _id: report._id },
              { $set: { clearanceId: clearance._id } }
            );
            updatedCount++;
            console.log(`Updated report ${report._id} with clearance ID ${clearance._id}`);
          } else {
            console.log(`No matching clearance found for report ${report._id}`);
          }
        }
      }

      console.log(`Updated ${updatedCount} reports with clearance IDs`);
    }

    console.log("Script completed successfully");
  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}); 