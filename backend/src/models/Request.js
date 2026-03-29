const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    // User info
    userName:       { type: String, required: true },
    userEmail:      { type: String, required: true },
    userPubkey:     { type: String, required: true },
    userDerivedPubkey: { type: String, required: true },

    // Doctor info
    doctorName:     { type: String, required: true },
    doctorPubkey:   { type: String, required: true },
    doctorDerivedPubkey: { type: String, required: true },

    // Record info
    recordName:     { type: String, required: true },
    recordTokenId:  { type: Number, default: null },

    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);
