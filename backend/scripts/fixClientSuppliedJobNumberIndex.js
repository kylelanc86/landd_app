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
      sparse: idx.sparse,
    }))
  );

  // Find ALL indexes on jobNumber (regardless of name)
  const jobNumberIndexes = existingIndexes.filter(
    (index) =>
      index.key && index.key.jobNumber === 1
  );

  console.log(`Found ${jobNumberIndexes.length} index(es) on jobNumber field`);

  // Drop ALL jobNumber indexes - we'll recreate the correct one
  for (const index of jobNumberIndexes) {
    console.log(`🧹 Dropping index: ${index.name}`);
    try {
      await collection.dropIndex(index.name);
      console.log(`✅ Successfully dropped index: ${index.name}`);
    } catch (error) {
      console.log(`⚠️ Could not drop index ${index.name}:`, error.message);
      // If it's a different error code, still try to continue
      if (error.code !== 27) { // 27 = IndexNotFound
        throw error;
      }
    }
  }

  // Wait a moment for indexes to be fully dropped
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify indexes are dropped
  const updatedIndexes = await collection.indexes();
  const remainingJobNumberIndexes = updatedIndexes.filter(
    (index) => index.key && index.key.jobNumber === 1
  );
  
  if (remainingJobNumberIndexes.length > 0) {
    console.log(`⚠️ Warning: ${remainingJobNumberIndexes.length} jobNumber index(es) still exist`);
    remainingJobNumberIndexes.forEach(idx => console.log(`  - ${idx.name}`));
  } else {
    console.log("✅ All jobNumber indexes have been dropped");
  }

  // Create the correct index with partial filter (cannot use $ne in partial indexes)
  // Use $gt "" to ensure non-empty strings
  console.log("🛠 Creating new partial unique index on jobNumber with proper null exclusion");
  try {
    await collection.createIndex(
      { jobNumber: 1 },
      {
        unique: true,
        name: "clientSuppliedJob_jobNumber_unique",
        partialFilterExpression: {
          $and: [
            { jobNumber: { $exists: true } },
            { jobNumber: { $type: "string" } },
            { jobNumber: { $gt: "" } }
          ]
        },
      }
    );
    console.log("✅ Created partial unique jobNumber index with null exclusion.");
  } catch (error) {
    console.error("❌ Failed to create index:", error.message);
    throw error;
  }

  // Verify the new index
  const finalIndexes = await collection.indexes();
  const newIndex = finalIndexes.find(
    (index) => index.name === "clientSuppliedJob_jobNumber_unique"
  );
  
  if (newIndex) {
    console.log("✅ Verification: New index exists");
    console.log("   - Unique:", newIndex.unique);
    console.log("   - Partial Filter:", JSON.stringify(newIndex.partialFilterExpression));
  } else {
    console.log("⚠️ Warning: New index not found after creation");
  }
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

