const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    tokenId: {
      type: Number,
      required: true,
      unique: true
    },

    fileName: {
      type: String,
      required: true
    },

    ipfsHash: {
      type: String,
      required: true
    },

    userPubKey: {
      type: String,
      required: true
    },

    userDerivedPubKey: {
      type: String,
      required: true
    },

    userName: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);