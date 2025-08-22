const mongoose = require("mongoose");

const asbestosClearanceItemsSchema = new mongoose.Schema(
  {
    clearanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AsbestosClearance",
      required: true,
    },
    locationDescription: {
      type: String,
      required: true,
    },
    levelFloor: {
      type: String,
      required: false,
    },
    roomArea: {
      type: String,
      required: true,
    },
    materialDescription: {
      type: String,
      required: true,
    },
    asbestosType: {
      type: String,
      enum: ["friable", "non-friable"],
      required: true,
    },
    photograph: {
      type: String, // Base64 encoded image or file path
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
asbestosClearanceItemsSchema.index({ clearanceId: 1 });
asbestosClearanceItemsSchema.index({ createdAt: 1 });

module.exports = mongoose.model("AsbestosClearanceItems", asbestosClearanceItemsSchema); 