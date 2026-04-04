// routes/viewHistoryRoutes.js

const express = require("express");
const {
  createViewHistoryRecord,
  getAllViewHistory,
  getHistoryByUser,
  getHistoryByDoctor
}  = require("../controllers/viewHistoryController");


const router = express.Router();


// 1. Create
router.post("/createviewhistoryrecord", createViewHistoryRecord);

// 2. Get all
router.get("/", getAllViewHistory);

// 3. Get by user
router.get("/user/:userPubKey", getHistoryByUser);

// 4. Get by doctor
router.get("/doctor/:doctorPubKey", getHistoryByDoctor);

module.exports = router;