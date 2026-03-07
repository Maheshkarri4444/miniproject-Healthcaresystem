const express = require("express");
const router = express.Router();

const controller = require("../controllers/medicalRecordController");

router.post("/", controller.createRecord);

router.get("/", controller.getAllRecords);

router.get("/user/:pubkey", controller.getRecordsByUser);

router.get("/token/:tokenId", controller.getRecordByTokenId);

module.exports = router;