import mongoose from "mongoose";

const viewHistorySchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },

  // ─── User ─────────────────────
  userPubKey: {
    type: String,
    required: true,
  },

  userDerivedPubKey: {
    type: String,
    required: true,
  },

  userName: {
    type: String,
    required: true,
  },

  // ─── Doctor ───────────────────
  doctorName: {
    type: String,
    required: true,
  },

  doctorPubKey: {
    type: String,
    required: true,
  },

  doctorDerivedPubKey: {
    type: String,
    required: true,
  },

  // ─── Time ─────────────────────
  time: {
    type: Date,
    default: Date.now,
  }

}, { timestamps: true });

export default mongoose.model("ViewHistory", viewHistorySchema);