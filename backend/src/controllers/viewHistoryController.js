// controllers/viewHistoryController.js

import ViewHistory from "../models/ViewHistory.js";

// 1. Create record
export const createViewHistoryRecord = async (req, res) => {
  try {
    const data = req.body;

    const record = new ViewHistory(data);
    await record.save();

    res.status(201).json({ message: "View history recorded", record });

  } catch (err) {
    console.error("createViewHistoryRecord:", err);
    res.status(500).json({ error: "Failed to create view history" });
  }
};

// 2. Get all history
export const getAllViewHistory = async (req, res) => {
  try {
    const records = await ViewHistory.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error("getAllViewHistory:", err);
    res.status(500).json({ error: "Failed to fetch view history" });
  }
};

// 3. Get history by user
export const getHistoryByUser = async (req, res) => {
  try {
    const { userPubKey } = req.params;

    const records = await ViewHistory
      .find({ userPubKey })
      .sort({ createdAt: -1 });

    res.json(records);

  } catch (err) {
    console.error("getHistoryByUser:", err);
    res.status(500).json({ error: "Failed to fetch user history" });
  }
};

// 4. Get history by doctor
export const getHistoryByDoctor = async (req, res) => {
  try {
    const { doctorPubKey } = req.params;

    const records = await ViewHistory
      .find({ doctorPubKey })
      .sort({ createdAt: -1 });

    res.json(records);

  } catch (err) {
    console.error("getHistoryByDoctor:", err);
    res.status(500).json({ error: "Failed to fetch doctor history" });
  }
};