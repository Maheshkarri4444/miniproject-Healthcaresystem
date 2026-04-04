import Complaint from "../models/Complaint.js";


// 1. Create Complaint
export const createComplaint = async (req, res) => {
  try {
    const complaint = new Complaint(req.body);
    await complaint.save();

    res.status(201).json({
      message: "Complaint created successfully",
      complaint
    });

  } catch (err) {
    console.error("createComplaint:", err);
    res.status(500).json({ error: "Failed to create complaint" });
  }
};


// 2. Get by User
export const getComplaintsByUser = async (req, res) => {
  try {
    const { userPubKey } = req.params;

    const complaints = await Complaint
      .find({ userPubKey })
      .sort({ createdAt: -1 })
      .populate("history");

    res.json(complaints);

  } catch (err) {
    console.error("getComplaintsByUser:", err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
};


// 3. Get by Doctor
export const getComplaintsByDoctor = async (req, res) => {
  try {
    const { doctorPubKey } = req.params;

    const complaints = await Complaint
      .find({ doctorPubKey })
      .sort({ createdAt: -1 })
      .populate("history");

    res.json(complaints);

  } catch (err) {
    console.error("getComplaintsByDoctor:", err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
};


// 4. Admin Update Status
export const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["not_yet_seen", "verifying", "verified", "resolved"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await Complaint.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    console.error("updateComplaintStatus:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
};


// 5. Doctor Acknowledgement
export const addDoctorAcknowledgement = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const updated = await Complaint.findByIdAndUpdate(
      id,
      { doctorAcknowledgement: message },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    console.error("addDoctorAcknowledgement:", err);
    res.status(500).json({ error: "Failed to add doctor acknowledgement" });
  }
};


// 6. Admin Acknowledgement
export const addAdminAcknowledgement = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const updated = await Complaint.findByIdAndUpdate(
      id,
      { adminAcknowledgement: message },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    console.error("addAdminAcknowledgement:", err);
    res.status(500).json({ error: "Failed to add admin acknowledgement" });
  }
};


// 7. User OK
export const updateUserOk = async (req, res) => {
  try {
    const { id } = req.params;
    const { userOk } = req.body;

    const updated = await Complaint.findByIdAndUpdate(
      id,
      { userOk },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    console.error("updateUserOk:", err);
    res.status(500).json({ error: "Failed to update user confirmation" });
  }
};


export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint
      .find()
      .sort({ createdAt: -1 })
      .populate("history");

    res.json(complaints);

  } catch (err) {
    console.error("getAllComplaints:", err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
};