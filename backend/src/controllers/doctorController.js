const Doctor = require("../models/Doctor");

exports.createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.status(201).json(doctor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.addDocs = async (req, res) => {
  const doctor = await Doctor.findOne({ pubkey: req.params.pubkey });
  if (!doctor) return res.status(404).json({ message: "Doctor not found" });

  doctor.docs.push(...req.body.docs);
  await doctor.save();

  res.json(doctor);
};

exports.getAllDoctors = async (req, res) => {
  const doctors = await Doctor.find();
  res.json(doctors);
};