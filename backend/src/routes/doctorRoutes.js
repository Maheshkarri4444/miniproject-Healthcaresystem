const express = require("express");
const router = express.Router();
const {
  createDoctor,
  addDocs,
  getAllDoctors
} = require("../controllers/doctorController");

router.post("/", createDoctor);
router.put("/:pubkey/docs", addDocs);
router.get("/", getAllDoctors);

module.exports = router;