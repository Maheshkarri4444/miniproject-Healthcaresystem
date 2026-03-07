const express = require("express");
const router = express.Router();
const {
  createDoctor,
  addDocs,
  getAllDoctors ,
  getDoctorByAddress,
  verifyDoctor,
} = require("../controllers/doctorController");

router.post("/", createDoctor);
router.put("/:pubkey/docs", addDocs);
router.get("/", getAllDoctors);
router.get("/:address", getDoctorByAddress);
router.post("/:address/verify", verifyDoctor); 

module.exports = router;