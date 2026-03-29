const express = require("express");
const router  = express.Router();
const {
  createRequest,
  getAllRequests,
  getRequestsByUserPubkey,
  getRequestsByDoctorPubkey,
} = require("../controllers/requestController");

router.post("/",                          createRequest);
router.get("/",                           getAllRequests);
router.get("/user/:userPubkey",           getRequestsByUserPubkey);
router.get("/doctor/:doctorPubkey",       getRequestsByDoctorPubkey);

module.exports = router;