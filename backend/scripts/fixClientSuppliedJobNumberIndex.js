const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const fixJobNumberIndex = async () => {
  const collection = mongoose.connection.db.collection("clientsuppliedjobs");

  const existingIndexes = await collection.indexes();
  console.log(
    "📊 Existing indexes:",
    existingIndexes.map((idx) => ({
      name: idx.name,
      key: idx.key,
      partialFilterExpression: idx.partialFilterExpression,
    }))
  );

  const legacyIndex = existingIndexes.find(
    (index) =>
      index.name === "jobNumber_1" &&
      (!index.partialFilterExpression ||
        !index.partialFilterExpression.jobNumber)
  );

  if (legacyIndex) {
    console.log("🧹 Dropping legacy unique index on jobNumber_1");
    await collection.dropIndex(legacyIndex.name);
    console.log("✅ Dropped legacy jobNumber_1 index");
  } else {
    console.log("ℹ️ No legacy jobNumber_1 index found (or already partial).");
  }

  const desiredIndexName = "clientSuppliedJob_jobNumber_unique";
  const updatedIndexes = await collection.indexes();
  const desiredIndex = updatedIndexes.find(
    (index) => index.name === desiredIndexName
  );

  if (desiredIndex) {
    console.log("✅ Desired partial unique index already exists.");
    return;
  }

  console.log("🛠 Creating partial unique index on jobNumber");
  await collection.createIndex(
    { jobNumber: 1 },
    {
      unique: true,
      name: desiredIndexName,
      partialFilterExpression: {
        jobNumber: { $exists: true, $type: "string", $ne: "" },
      },
    }
  );
  console.log("✅ Created partial unique jobNumber index.");
};

const main = async () => {
  try {
    await connectDB();
    await fixJobNumberIndex();
  } catch (error) {
    console.error("❌ Failed to update jobNumber index:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("📡 MongoDB connection closed");
  }
};

main();

