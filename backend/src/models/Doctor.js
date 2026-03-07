const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true
    },
    pubkey: {
      type: String,
      required: true,
      unique: true
    },
    derivedpubkey: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    docs: [
      {
        type: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);