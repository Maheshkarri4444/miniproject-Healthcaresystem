import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema({

  // ─── User ─────────────────────
  userPubKey: {
    type: String,
    required: true,
    index: true,
  },

  userDerivedPubKey: {
    type: String,
    required: true,
  },

  userName: {
    type: String,
    required: true,
  },

  // ─── Optional link to view history ─────────────────
  history: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ViewHistory",
    required: false,
  },

  // ─── Complaint Description ─────────────────
  complaintDescription: {
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
    index: true,
  },

  doctorDerivedPubKey: {
    type: String,
    required: true,
  },

  // ─── Admin Status ─────────────────
  status: {
    type: String,
    enum: ["not_yet_seen", "verifying", "verified", "resolved"],
    default: "not_yet_seen",
  },

  // ─── Acknowledgements ─────────────────
  doctorAcknowledgement: {
    type: String,
    default: "",
  },

  adminAcknowledgement: {
    type: String,
    default: "",
  },

  // ─── Final User Confirmation ─────────────────
  userOk: {
    type: Boolean,
    default: false,
  }

}, { timestamps: true });

export default mongoose.model("Complaint", complaintSchema);