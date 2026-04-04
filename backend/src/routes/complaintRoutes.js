const express = require("express");
const {
  createComplaint,
  getComplaintsByUser,
  getComplaintsByDoctor,
  updateComplaintStatus,
  addDoctorAcknowledgement,
  addAdminAcknowledgement,
  updateUserOk,
  getAllComplaints
} = require("../controllers/complaintController.js");

const router = express.Router();

// 1. Create
router.post("/", createComplaint);

router.get("/", getAllComplaints);


// 2. Get by user
router.get("/user/:userPubKey", getComplaintsByUser);

// 3. Get by doctor
router.get("/doctor/:doctorPubKey", getComplaintsByDoctor);

// 4. Admin update status
router.put("/status/:id", updateComplaintStatus);

// 5. Doctor acknowledgement
router.put("/doctor-ack/:id", addDoctorAcknowledgement);

// 6. Admin acknowledgement
router.put("/admin-ack/:id", addAdminAcknowledgement);

// 7. User OK
router.put("/user-ok/:id", updateUserOk);

module.exports = router;
